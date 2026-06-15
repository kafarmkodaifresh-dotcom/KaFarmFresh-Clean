import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Confirm } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { today, fmtDate } from './utils';

const WorkersPage = ({ workers, setWorkers, auth }) => {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    gender: 'male',
    phone: '',
    salary: 500,
    role: 'Field Worker',
    joined: new Date().toISOString().split('T')[0],
    active: true
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteWorker } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === "superadmin";

  const activeWorkers = workers.filter(w => !w.deletedAt);
  const deletedWorkers = workers.filter(w => w.deletedAt);
  const displayedWorkers = showDeleted ? deletedWorkers : activeWorkers;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedWorkers.map(w => String(w.id)));
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
    if (!isSuperAdmin) return alert("Only superadmin can perform bulk delete.");
    if (selectedIds.length === 0) return alert("Select at least one worker.");
    if (!confirm(`Delete ${selectedIds.length} selected workers?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "workers", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selectedIds.length} workers.`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (!isSuperAdmin) return alert("Only superadmin can perform bulk restore.");
    if (selectedIds.length === 0) return alert("Select at least one worker to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected workers?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "workers", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Restored ${selectedIds.length} workers.`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const saveWorker = async () => {
    if (!form.name.trim()) return alert('Name is required');
    if (editId) {
      await updateDoc(doc(db, 'workers', String(editId)), form);
    } else {
      await addDoc(collection(db, 'workers'), form);
    }
    setModal(false);
    setEditId(null);
    setForm({ name: '', gender: 'male', phone: '', salary: 500, role: 'Field Worker', joined: new Date().toISOString().split('T')[0], active: true });
  };

  const toggleActive = async (worker) => {
    await updateDoc(doc(db, 'workers', String(worker.id)), { active: !worker.active });
  };

  const handleDeleteConfirm = async (reason) => {
    if (!workerToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteWorker(String(workerToDelete.id), reason);
      setDeleteModalOpen(false);
      setWorkerToDelete(null);
      setDeleteItemName('');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete. Check console.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalSalary = activeWorkers.reduce((a, w) => a + Number(w.salary || 0), 0);

  return (
    <div>
      <div className="stat-grid mb20">
        <div className="stat-card sc-primary">
          <div className="stat-number">{activeWorkers.length}</div>
          <div className="stat-label">Active Workers</div>
        </div>
        <div className="stat-card sc-secondary">
          <div className="stat-number">₹{totalSalary.toLocaleString()}</div>
          <div className="stat-label">Daily Total Salary</div>
        </div>
        <div className="stat-card sc-warning">
          <div className="stat-number">{activeWorkers.filter(w => w.gender === 'male').length}M / {activeWorkers.filter(w => w.gender === 'female').length}F</div>
          <div className="stat-label">Male / Female</div>
        </div>
        <div className="stat-card sc-danger">
          <div className="stat-number">{deletedWorkers.length}</div>
          <div className="stat-label">Deleted Workers</div>
          <div className="stat-sub">Click toggle below to view</div>
        </div>
      </div>

      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>✅ Active ({activeWorkers.length})</button>
          {isSuperAdmin && (
            <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedWorkers.length})</button>
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
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>➕ Add Worker</button>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={displayedWorkers.length === 0} />
                </th>
                <th>Name</th><th>Gender</th><th>Role</th><th>Phone</th><th>Salary</th><th>Status</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedWorkers.map(w => (
                <tr key={w.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(w.id))}
                      onChange={() => toggleCheckbox(w.id)}
                    />
                  </td>
                  <td><strong>{w.name}</strong></td>
                  <td>{w.gender === 'male' ? '👨 Male' : '👩 Female'}</td>
                  <td>{w.role}</td>
                  <td>{w.phone}</td>
                  <td>₹{w.salary}</td>
                  <td>
                    {!showDeleted ? (
                      <span className={`badge ${w.active ? 'bg-primary' : 'bg-gray'}`}>
                        {w.active ? 'Active' : 'Inactive'}
                      </span>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                  {showDeleted && <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(w.deletedAt?.toDate?.() || w.deletedAt)}</td>}
                  <td>
                    {!showDeleted ? (
                      <div className="row">
                        <button className="btn btn-xs btn-outline" onClick={() => { setForm(w); setEditId(w.id); setModal(true); }}>✏️</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => toggleActive(w)}>
                          {w.active ? 'Deactivate' : 'Activate'}
                        </button>
                        {isSuperAdmin && (
                          <button className="btn btn-xs btn-danger" onClick={() => { setWorkerToDelete(w); setDeleteItemName(w.name); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                        )}
                      </div>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayedWorkers.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>{showDeleted ? "No deleted workers" : "No active workers"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditId(null); setForm({ name: '', gender: 'male', phone: '', salary: 500, role: 'Field Worker', joined: new Date().toISOString().split('T')[0], active: true }); }} title={editId ? '✏️ Edit Worker' : '➕ Add Worker'} size="modal-sm"
        footer={<><button className="btn btn-primary" onClick={saveWorker}>💾 Save</button><button className="btn btn-ghost" onClick={() => { setModal(false); setEditId(null); setForm({ name: '', gender: 'male', phone: '', salary: 500, role: 'Field Worker', joined: new Date().toISOString().split('T')[0], active: true }); }}>Cancel</button></>}>
        <div className="fg"><label>Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Worker name" /></div>
        <div className="fr2">
          <div className="fg"><label>Gender</label><select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="male">Male</option><option value="female">Female</option></select></div>
          <div className="fg"><label>Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number" /></div>
        </div>
        <div className="fr2">
          <div className="fg"><label>Salary (₹)</label><input type="number" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} placeholder="500" /></div>
          <div className="fg"><label>Role</label><select value={form.role} onChange={e => setForm({...form, role: e.target.value})}><option>Field Worker</option><option>Harvester</option><option>Irrigation</option><option>Supervisor</option></select></div>
        </div>
        <div className="fg"><label>Joined Date</label><input type="date" value={form.joined} onChange={e => setForm({...form, joined: e.target.value})} /></div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Worker"
        message="Are you sure you want to delete this worker? This action will be recorded."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default WorkersPage;
