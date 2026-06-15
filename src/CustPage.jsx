import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Confirm } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { today, fmtNum, fmtDate } from './utils';
import { ResponsiveContainer, BarChart, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';

const CustPage = ({ customers, setCustomers, auth }) => {
  const BLANK = { name: "", phone: "", location: "", type: "regular", since: today(), orders: [] };
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [orderModal, setOrderModal] = useState(null);
  const [orderForm, setOrderForm] = useState({ date: today(), boxes: 50 });
  const [err, setErr] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteCustomer } = useDeleteWithReason(auth);
  const f = (k, v) => { setForm(p => ({ ...p, [k]: v }));
    setErr(""); };

  const activeCustomers = customers.filter(c => !c.deletedAt);
  const deletedCustomers = customers.filter(c => c.deletedAt);
  const displayedCustomers = showDeleted ? deletedCustomers : activeCustomers;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedCustomers.map(c => String(c.id)));
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
    if (selectedIds.length === 0) return alert("Select at least one customer.");
    if (!confirm(`Delete ${selectedIds.length} selected customers?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "customers", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selectedIds.length} customers.`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one customer to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected customers?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "customers", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Restored ${selectedIds.length} customers.`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const openAdd = () => { setForm(BLANK);
    setEditId(null);
    setErr("");
    setModal(true); };
  const openEdit = c => { setForm({ ...c });
    setEditId(c.id);
    setErr("");
    setModal(true); };
  const save = async () => {
    if (!form.name.trim()) { setErr("Customer பெயர் உள்ளிடுங்கள்"); return; }
    if (editId) {
      await updateDoc(doc(db, "customers", String(editId)), form);
    } else {
      await addDoc(collection(db, "customers"), form);
    }
    setModal(false);
  };

  const addOrder = async () => {
    if (!orderModal) return;
    if (!(orderForm.boxes > 0)) { alert("Boxes அளவு உள்ளிடுங்கள்"); return; }
    const c = customers.find(c => c.id === orderModal);
    if (c) {
      const updated = { orders: [...(c.orders || []), { ...orderForm, id: Date.now() }] };
      await updateDoc(doc(db, "customers", String(orderModal)), updated);
    }
    setOrderModal(null);
  };

  const getTier = c => {
    const t = c.orders.reduce((a, o) => a + (o.boxes || 0), 0);
    if (t >= 300) return { label: "Platinum 💎", color: "var(--purple)", bg: "var(--purple-pale)" };
    if (t >= 100) return { label: "Gold ⭐", color: "var(--warning)", bg: "var(--warning-pale)" };
    return { label: "Regular", color: "var(--primary)", bg: "var(--primary-pale)" };
  };

  const sorted = [...displayedCustomers].sort((a, b) => b.orders.reduce((x, o) => x + o.boxes, 0) - a.orders.reduce((x, o) => x + o.boxes, 0));
  const chartData = sorted.map(c => ({ name: (c.name || "").split(" ")[0], boxes: c.orders.reduce((a, o) => a + o.boxes, 0), rev: c.orders.reduce((a, o) => a + o.boxes * 120, 0) }));

  const handleDeleteConfirm = async (reason) => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteCustomer(String(customerToDelete.id), reason);
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
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
      <div className="stat-grid mb20">
        <div className="stat-card sc-primary"><div className="stat-num">{activeCustomers.length}</div><div className="stat-lbl">Active Customers</div></div>
        <div className="stat-card sc-warning"><div className="stat-num">{activeCustomers.filter(c => c.type === "premium").length}</div><div className="stat-lbl">Premium ⭐</div></div>
        <div className="stat-card sc-secondary"><div className="stat-num">{totalBoxes}</div><div className="stat-lbl">Total Boxes</div><div className="stat-sub">200g each</div></div>
        <div className="stat-card sc-danger"><div className="stat-num">{deletedCustomers.length}</div><div className="stat-lbl">Deleted Customers</div><div className="stat-sub">Click toggle below to view</div></div>
      </div>

      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>✅ Active</button>
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedCustomers.length})</button>
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
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ Customer சேர்</button>
        </div>
      </div>

      <div className="g2 mb20">
        <div className="card"><div className="card-title">📦 Boxes by Customer</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip />
              <Bar dataKey="boxes" name="Boxes" fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card"><div className="card-title">💰 Revenue Split</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={chartData.filter(d => d.rev > 0)} cx="50%" cy="50%" outerRadius={75} dataKey="rev" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {chartData.map((_, i) => <Cell key={i} fill={["var(--primary)", "var(--warning)", "var(--secondary)", "#34a853", "var(--purple)"][i % 5]} />)}
              </Pie>
              <Tooltip formatter={v => "₹" + fmtNum(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={displayedCustomers.length === 0} />
                </th>
                <th>Customer</th><th>இடம்</th><th>Tier</th><th>Orders</th><th>Total Boxes</th><th>Revenue</th><th>Avg/Order</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const total = c.orders.reduce((a, o) => a + (o.boxes || 0), 0);
                const rev = total * 120;
                const avg = c.orders.length > 0 ? Math.round(total / c.orders.length) : 0;
                const tier = getTier(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(String(c.id))}
                        onChange={() => toggleCheckbox(c.id)}
                      />
                    </td>
                    <td><div className="fw7">{c.name}</div><div className="muted">{c.phone}</div></td>
                    <td style={{ fontSize: 12 }}>{c.location}</td>
                    <td><span className="badge" style={{ background: tier.bg, color: tier.color }}>{tier.label}</span></td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{c.orders.length}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "var(--text-dark)" }}>{total}</td>
                    <td style={{ fontWeight: 700, color: "var(--primary)" }}>₹{fmtNum(rev)}</td>
                    <td style={{ textAlign: "center" }}>{avg}</td>
                    {showDeleted && <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(c.deletedAt?.toDate?.() || c.deletedAt)}</td>}
                    <td>
                      {!showDeleted ? (
                        <div className="row">
                          <button className="btn btn-xs btn-primary" onClick={() => setOrderModal(c.id)}>📦 Order</button>
                          <button className="btn btn-xs btn-outline" onClick={() => openEdit(c)}>✏️</button>
                          <button className="btn btn-xs btn-danger" onClick={() => { setCustomerToDelete(c); setDeleteItemName(c.name); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                        </div>
                      ) : (
                        <span className="badge bg-gray">Deleted</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId != null ? "✏️ Customer திருத்தம்" : "➕ புதிய Customer"} size="modal-sm"
        footer={<><button className="btn btn-primary" onClick={save}>💾 சேமி</button><button className="btn btn-ghost" onClick={() => setModal(false)}>ரத்து</button></>}>
        {err && <div className="alert a-err mb16">{err}</div>}
        <div className="fg"><label>பெயர் *</label><input value={form.name} onChange={e => f("name", e.target.value)} placeholder="Customer / Store பெயர்" /></div>
        <div className="fr2"><div className="fg"><label>தொலைபேசி</label><input type="tel" value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="9876543210" /></div><div className="fg"><label>இடம்</label><input value={form.location} onChange={e => f("location", e.target.value)} placeholder="Madurai" /></div></div>
        <div className="fr2"><div className="fg"><label>வகை</label><select value={form.type} onChange={e => f("type", e.target.value)}><option value="regular">Regular</option><option value="premium">Premium ⭐</option></select></div><div className="fg"><label>Since</label><input type="date" value={form.since} onChange={e => f("since", e.target.value)} /></div></div>
      </Modal>

      <Modal open={orderModal != null} onClose={() => setOrderModal(null)} title="📦 Order சேர்" size="modal-sm"
        footer={<><button className="btn btn-primary" onClick={addOrder}>💾 சேமி</button><button className="btn btn-ghost" onClick={() => setOrderModal(null)}>ரத்து</button></>}>
        <div className="alert a-info mb16">200g boxes – ₹120 per box</div>
        <div className="fg"><label>Order தேதி</label><input type="date" value={orderForm.date} onChange={e => setOrderForm(p => ({ ...p, date: e.target.value }))} /></div>
        <div className="fg"><label>Boxes எத்தனை?</label><input type="number" min={1} value={orderForm.boxes} onChange={e => setOrderForm(p => ({ ...p, boxes: +e.target.value }))} /></div>
        <div style={{ background: "var(--warning-pale)", borderRadius: 8, padding: "10px 12px", marginTop: 4 }}><div className="fw7" style={{ fontSize: 15, color: "var(--text-dark)" }}>Total: ₹{fmtNum((orderForm.boxes || 0) * 120)}</div><div className="muted">{orderForm.boxes || 0} boxes × ₹120 = ₹{fmtNum((orderForm.boxes || 0) * 120)}</div></div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? All order history will be preserved for audit."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default CustPage;
