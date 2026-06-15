import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Modal, { Confirm } from '../CustomComponents';
import DeleteModal from '../components/DeleteModal';
import { useDeleteWithReason } from '../hooks/useDeleteWithReason';
import { fmtDate } from '../utils';

const ProductManagementPage = ({ auth }) => {
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    productName: '',
    type: 'fertiliser',
    activeIngredient: '',
    dosePer100L: '',
    PHI: 0,
    stockQuantity: 0,
    supplier: ''
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteProduct } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === "superadmin";

  // Load products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('productName'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const activeItems = products.filter(p => !p.deletedAt);
  const deletedItems = products.filter(p => p.deletedAt);
  const displayedItems = showDeleted ? deletedItems : activeItems;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedItems.map(p => String(p.id)));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleCheckbox = (id) => {
    const strId = String(id);
    setSelectedIds(prev => 
      prev.includes(strId) ? prev.filter(pid => pid !== strId) : [...prev, strId]
    );
    setSelectAll(false);
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one product.");
    if (!confirm(`Delete ${selectedIds.length} selected products?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "products", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selectedIds.length} products.`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one product to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected products?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "products", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Restored ${selectedIds.length} products.`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleInput = (e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const resetForm = () => {
    setForm({
      productName: '',
      type: 'fertiliser',
      activeIngredient: '',
      dosePer100L: '',
      PHI: 0,
      stockQuantity: 0,
      supplier: ''
    });
    setEditId(null);
  };

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setForm(product);
    setEditId(product.id);
    setModalOpen(true);
  };

  const saveProduct = async () => {
    if (!form.productName) return alert('Product name is required');
    const data = {
      ...form,
      lastUsedDate: form.lastUsedDate || null,
      updatedAt: new Date().toISOString()
    };
    if (editId) {
      await updateDoc(doc(db, 'products', String(editId)), data);
    } else {
      await addDoc(collection(db, 'products'), { ...data, createdAt: new Date().toISOString() });
    }
    setModalOpen(false);
    resetForm();
  };

  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteProduct(String(itemToDelete.id), reason);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteItemName('');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete. Check console.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex-between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>🧪 Active ({activeItems.length})</button>
          {isSuperAdmin && (
            <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedItems.length})</button>
          )}
        </div>
        <div className="row">
          {isSuperAdmin && showDeleted ? (
            <button className="btn btn-success btn-sm" onClick={handleBulkRestoreSelected} disabled={selectedIds.length === 0 || isRestoring}>
              {isRestoring ? 'Restoring...' : `🔄 Restore Selected (${selectedIds.length})`}
            </button>
          ) : isSuperAdmin && !showDeleted ? (
            <button className="btn btn-outline btn-sm" onClick={handleBulkDeleteSelected} disabled={selectedIds.length === 0 || isDeleting}>
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ Add Product</button>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={displayedItems.length === 0} />
                </th>
                <th>Product</th><th>Type</th><th>Active Ingredient</th><th>Dose / 100L</th><th>PHI</th><th>Stock (kg)</th><th>Supplier</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map(p => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(p.id))}
                      onChange={() => toggleCheckbox(p.id)}
                    />
                  </td>
                  <td><strong>{p.productName}</strong></td>
                  <td><span className={`badge ${p.type === 'fertiliser' ? 'bg-green' : 'bg-red'}`}>{p.type}</span></td>
                  <td>{p.activeIngredient || '—'}</td>
                  <td>{p.dosePer100L || '—'}</td>
                  <td>{p.PHI > 0 ? `${p.PHI} days` : '—'}</td>
                  <td className={p.stockQuantity < 2 ? 'text-red' : ''}>{p.stockQuantity}</td>
                  <td>{p.supplier || '—'}</td>
                  {showDeleted && <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(p.deletedAt?.toDate?.() || p.deletedAt)}</td>}
                  <td>
                    {!showDeleted ? (
                      <div className="row">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(p)}>✏️</button>
                        {isSuperAdmin && (
                          <button className="btn btn-xs btn-danger" onClick={() => { setItemToDelete(p); setDeleteItemName(p.productName); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                        )}
                      </div>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayedItems.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>{showDeleted ? "No deleted products" : "No products added yet"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editId ? '✏️ Edit Product' : '➕ Add Product'} size="modal-md"
        footer={<><button className="btn btn-primary" onClick={saveProduct}>💾 Save</button><button className="btn btn-ghost" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</button></>}>
        <div className="fr2">
          <div className="fg"><label>Product Name *</label><input name="productName" value={form.productName} onChange={handleInput} placeholder="e.g. Boron 20%" /></div>
          <div className="fg"><label>Type</label><select name="type" value={form.type} onChange={handleInput}><option value="fertiliser">Fertiliser</option><option value="pesticide">Pesticide</option></select></div>
        </div>
        <div className="fr2">
          <div className="fg"><label>Active Ingredient</label><input name="activeIngredient" value={form.activeIngredient} onChange={handleInput} placeholder="e.g. Boron Minsol 20%" /></div>
          <div className="fg"><label>Dose per 100L</label><input name="dosePer100L" value={form.dosePer100L} onChange={handleInput} placeholder="e.g. 100g" /></div>
        </div>
        <div className="fr2">
          <div className="fg"><label>PHI (days)</label><input name="PHI" type="number" min="0" value={form.PHI} onChange={handleInput} placeholder="7" /></div>
          <div className="fg"><label>Stock (kg)</label><input name="stockQuantity" type="number" min="0" value={form.stockQuantity} onChange={handleInput} placeholder="0" /></div>
        </div>
        <div className="fr2">
          <div className="fg"><label>Supplier</label><input name="supplier" value={form.supplier} onChange={handleInput} placeholder="e.g. FertiGlobal" /></div>
        </div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action will be recorded."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default ProductManagementPage;
