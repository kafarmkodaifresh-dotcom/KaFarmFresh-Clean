import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import Modal, { Confirm } from '../CustomComponents';

const ProductManagementPage = () => {
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
  const [confirm, setConfirm] = useState(null);

  // Load products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('productName'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

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
      await updateDoc(doc(db, 'products', editId), data);
    } else {
      await addDoc(collection(db, 'products'), { ...data, createdAt: new Date().toISOString() });
    }
    setModalOpen(false);
    resetForm();
  };

  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, 'products', id));
    setConfirm(null);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div>
      <div className="flex-between mb16">
        <h2 className="card-title">🧪 Product Management</h2>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ Add Product</button>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Active Ingredient</th>
                <th>Dose / 100L</th>
                <th>PHI</th>
                <th>Stock (kg)</th>
                <th>Supplier</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.productName}</strong></td>
                  <td><span className={`badge ${p.type === 'fertiliser' ? 'bg-green' : 'bg-red'}`}>{p.type}</span></td>
                  <td>{p.activeIngredient || '—'}</td>
                  <td>{p.dosePer100L || '—'}</td>
                  <td>{p.PHI > 0 ? `${p.PHI} days` : '—'}</td>
                  <td className={p.stockQuantity < 2 ? 'text-red' : ''}>{p.stockQuantity}</td>
                  <td>{p.supplier || '—'}</td>
                  <td>{formatDate(p.lastUsedDate)}</td>
                  <td>
                    <button className="btn btn-xs btn-outline" onClick={() => openEdit(p)}>✏️</button>
                    <button className="btn btn-xs btn-danger" onClick={() => setConfirm(p.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No products added yet</td></tr>
              )}
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

      <Confirm open={confirm !== null} msg="Delete this product permanently?" onYes={() => deleteProduct(confirm)} onNo={() => setConfirm(null)} />
    </div>
  );
};

export default ProductManagementPage;