import React, { useState, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Confirm } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { today, fmtNum, fmtDate } from './utils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const BillPage = ({ bills, setBills, auth }) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: today(), type: "fertiliser", vendor: "", amount: "", description: "", billFile: "" });
  const [editId, setEditId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fileRef = useRef();

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteBill } = useDeleteWithReason(auth);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const activeItems = bills.filter(b => !b.deletedAt);
  const deletedItems = bills.filter(b => b.deletedAt);
  const displayedItems = showDeleted ? deletedItems : activeItems;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedItems.map(b => String(b.id)));
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
    if (selectedIds.length === 0) return alert("Select at least one bill.");
    if (!confirm(`Delete ${selectedIds.length} selected bills?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "bills", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selectedIds.length} bills.`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one bill to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected bills?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "bills", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Restored ${selectedIds.length} bills.`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const totalSpent = activeItems.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const fertSpent = activeItems.filter(b => b.type === "fertiliser").reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const pestSpent = activeItems.filter(b => b.type === "pesticide").reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const otherSpent = activeItems.filter(b => b.type === "other").reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => f("billFile", ev.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.vendor || !form.amount) { alert("Vendor and amount required"); return; }
    if (editId) {
      await updateDoc(doc(db, "bills", String(editId)), { ...form, amount: Number(form.amount) });
    } else {
      await addDoc(collection(db, "bills"), { ...form, amount: Number(form.amount), createdAt: new Date().toISOString() });
    }
    setModal(false);
    setEditId(null);
    setForm({ date: today(), type: "fertiliser", vendor: "", amount: "", description: "", billFile: "" });
  };

  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteBill(String(itemToDelete.id), reason);
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

  const chartData = [
    { name: "Fertiliser", value: fertSpent },
    { name: "Pesticide", value: pestSpent },
    { name: "Other", value: otherSpent }
  ].filter(d => d.value > 0);

  return (
    <div className="bill-panel">
      <div className="stat-grid mb20">
        <div className="stat-card sc-primary"><div className="stat-num">₹{fmtNum(totalSpent)}</div><div className="stat-lbl">Total Spent</div><div className="stat-sub">{activeItems.length} bills</div></div>
        <div className="stat-card sc-secondary"><div className="stat-num">₹{fmtNum(fertSpent)}</div><div className="stat-lbl">Fertiliser</div></div>
        <div className="stat-card sc-danger"><div className="stat-num">₹{fmtNum(pestSpent)}</div><div className="stat-lbl">Pesticide</div></div>
        <div className="stat-card sc-warning"><div className="stat-num">₹{fmtNum(otherSpent)}</div><div className="stat-lbl">Other</div></div>
      </div>

      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>📄 Active ({activeItems.length})</button>
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedItems.length})</button>
        </div>
        <div className="row">
          {showDeleted ? (
            <button className="btn btn-success btn-sm" onClick={handleBulkRestoreSelected} disabled={selectedIds.length === 0 || isRestoring}>
              {isRestoring ? 'Restoring...' : `🔄 Restore Selected (${selectedIds.length})`}
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={handleBulkDeleteSelected} disabled={selectedIds.length === 0 || isDeleting}>
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => { setForm({ date: today(), type: "fertiliser", vendor: "", amount: "", description: "", billFile: "" }); setEditId(null); setModal(true); }}>➕ Add Bill</button>
        </div>
      </div>

      <div className="g2 mb20">
        <div className="card">
          <div className="card-title">💰 Expense Breakdown</div>
          {chartData.length === 0 ? (
            <div className="empty-state">No bills yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartData.map((_, i) => <Cell key={i} fill={["var(--primary)", "#ea4335", "var(--warning)"][i % 3]} />)}
                </Pie>
                <Tooltip formatter={v => "₹" + fmtNum(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <div className="card-title">📊 Monthly Trend</div>
          <div className="empty-state">Monthly trend chart coming soon</div>
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
                <th>Date</th><th>Type</th><th>Vendor</th><th>Amount</th><th>Description</th><th>Bill</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.sort((a, b) => b.id - a.id).map(b => (
                <tr key={b.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(b.id))}
                      onChange={() => toggleCheckbox(b.id)}
                    />
                  </td>
                  <td>{fmtDate(b.date)}</td>
                  <td><span className={`badge ${b.type === "fertiliser" ? "bg-primary" : b.type === "pesticide" ? "bg-red" : "bg-gold"}`}>{b.type}</span></td>
                  <td>{b.vendor}</td>
                  <td className="fw7" style={{ color: "var(--text-dark)" }}>₹{fmtNum(b.amount)}</td>
                  <td className="muted">{b.description || "—"}</td>
                  <td>{b.billFile ? <a href={`data:image/jpeg;base64,${b.billFile}`} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">📎 View</a> : "—"}</td>
                  {showDeleted && <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(b.deletedAt?.toDate?.() || b.deletedAt)}</td>}
                  <td>
                    {!showDeleted ? (
                      <div className="row">
                        <button className="btn btn-xs btn-outline" onClick={() => { setForm(b); setEditId(b.id); setModal(true); }}>✏️</button>
                        <button className="btn btn-xs btn-danger" onClick={() => { setItemToDelete(b); setDeleteItemName(`${b.vendor} – ₹${b.amount}`); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                      </div>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayedItems.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>{showDeleted ? "No deleted bills" : "No bills added yet"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "✏️ Edit Bill" : "➕ Add Bill"} size="modal-md"
        footer={<><button className="btn btn-primary" onClick={save}>💾 Save</button><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button></>}>
        <div className="fr2">
          <div className="fg"><label>Date</label><input type="date" value={form.date} onChange={e => f("date", e.target.value)} /></div>
          <div className="fg"><label>Type</label><select value={form.type} onChange={e => f("type", e.target.value)}><option value="fertiliser">Fertiliser</option><option value="pesticide">Pesticide</option><option value="other">Other</option></select></div>
        </div>
        <div className="fr2">
          <div className="fg"><label>Vendor *</label><input value={form.vendor} onChange={e => f("vendor", e.target.value)} placeholder="Vendor name" /></div>
          <div className="fg"><label>Amount (₹) *</label><input type="number" value={form.amount} onChange={e => f("amount", e.target.value)} placeholder="0" /></div>
        </div>
        <div className="fg"><label>Description</label><textarea value={form.description} onChange={e => f("description", e.target.value)} placeholder="Bill description..." /></div>
        <div className="fg">
          <label>Upload Bill (Image)</label>
          <div className="upz" onClick={() => fileRef.current?.click()}>
            <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            {form.billFile ? <div style={{ color: "var(--primary)", fontWeight: 600 }}>✅ Bill uploaded</div> : <div><div style={{ fontSize: 28 }}>📄</div><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Click to upload bill image</div></div>}
          </div>
        </div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Bill"
        message="Are you sure you want to delete this bill? This action will be recorded."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default BillPage;
