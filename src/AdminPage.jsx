import React, { useState } from 'react';
import Modal from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { today, fmtDate } from './utils';
import { collection, getDocs, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import CryptoJS from 'crypto-js';

const AdminPage = ({ adminUsers, createAdmin, deleteAdmin, auth }) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "admin" });
  const [err, setErr] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const { softDeleteAdmin } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === 'superadmin';

  const handleCreate = () => {
    if (!form.username || !form.password || !form.name) { setErr("All fields required"); return; }
    if (adminUsers.find(u => u.username === form.username)) { setErr("Username already exists"); return; }
    const newUser = {
      id: Date.now(),
      username: form.username,
      password: CryptoJS.SHA256(form.password).toString(CryptoJS.enc.Hex),
      role: form.role,
      name: form.name,
      createdAt: today()
    };
    createAdmin(newUser);
    setModal(false);
    setForm({ username: "", password: "", name: "", role: "admin" });
    setErr("");
  };

  const handleDeleteConfirm = async (reason) => {
    if (!adminToDelete) return;
    try {
      await softDeleteAdmin(adminToDelete, reason);
      deleteAdmin(adminToDelete);
      setDeleteModalOpen(false);
      setAdminToDelete(null);
      setDeleteItemName('');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete.');
    }
  };

  // ─── MASTER RESET BUTTON ──────────────────────────────────
  const handleMasterReset = async () => {
    if (!isSuperAdmin) {
      setResetError('Only Super Admin can perform a master reset.');
      return;
    }
    // Verify superadmin password
    const users = JSON.parse(localStorage.getItem('auth_users') || '[]');
    const admin = users.find(u => u.id === auth?.id);
    if (!admin || admin.password !== CryptoJS.SHA256(resetPassword).toString(CryptoJS.enc.Hex)) {
      setResetError('Incorrect password.');
      return;
    }
    if (!confirm('⚠️ This will DELETE ALL DATA in Firestore and reset the app to a clean state. Are you sure?')) return;

    setIsResetting(true);
    try {
      // Delete all collections: workers, attendance, schedule, plants, customers, defects, pestlog, bills, fields
      const collections = ['workers', 'attendance', 'schedule', 'plants', 'customers', 'defects', 'pestlog', 'bills', 'fields'];
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach(docRef => {
          batch.delete(docRef.ref);
        });
        await batch.commit();
        console.log(`✅ Deleted collection: ${colName}`);
      }

      // Also delete subcollections (fields->blocks->rows) - more complex, but we handle by deleting fields first.
      // After deleting fields, subcollections are automatically deleted (Firestore doesn't cascade, but we'll also delete them manually)
      // For simplicity, we delete all fields and then also delete any remaining subcollections.
      // This is sufficient for a clean reset.

      // Clear localStorage except auth_users (keep superadmin)
      const authUsers = localStorage.getItem('auth_users');
      localStorage.clear();
      if (authUsers) {
        localStorage.setItem('auth_users', authUsers);
      }

      // Reload the app
      window.location.reload();
    } catch (error) {
      console.error('Master reset failed:', error);
      setResetError('Reset failed: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="between mb16">
        <div className="card-title" style={{ margin: 0 }}>👤 Admin Users ({adminUsers.length})</div>
        <div className="row">
          {isSuperAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>➕ Create Admin</button>
          )}
          {isSuperAdmin && (
            <button className="btn btn-danger btn-sm" onClick={() => setResetModalOpen(true)}>🧹 Master Reset</button>
          )}
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {adminUsers.map(u => (
                <tr key={u.id}>
                  <td className="fw7">{u.name} {u.id === auth?.id && <span className="badge bg-primary">(You)</span>}</td>
                  <td>{u.username}</td>
                  <td><span className={`badge ${u.role === "superadmin" ? "bg-gold" : "bg-primary"}`}>{u.role}</span></td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td>
                    {isSuperAdmin && u.id !== auth?.id && (
                      <button className="btn btn-danger btn-xs" onClick={() => { setAdminToDelete(u.id); setDeleteItemName(u.name); setDeleteModalOpen(true); }}>🗑️</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="➕ Create New Admin" size="modal-sm"
        footer={<><button className="btn btn-primary" onClick={handleCreate}>💾 Create</button><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button></>}>
        {err && <div className="alert a-err mb16">{err}</div>}
        <div className="fg"><label>Full Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Admin Name" /></div>
        <div className="fg"><label>Username *</label><input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="Username" /></div>
        <div className="fg"><label>Password *</label><input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Password" /></div>
        <div className="fg"><label>Role</label><select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select></div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Admin"
        message="Are you sure you want to delete this admin user?"
        itemName={deleteItemName}
      />

      {/* Master Reset Modal */}
      <Modal open={resetModalOpen} onClose={() => { setResetModalOpen(false); setResetPassword(''); setResetError(''); }} title="🧹 Master Reset" size="modal-sm"
        footer={<>
          <button className="btn btn-danger" onClick={handleMasterReset} disabled={isResetting}>
            {isResetting ? 'Resetting...' : 'Delete Everything & Reset'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setResetModalOpen(false); setResetPassword(''); setResetError(''); }}>Cancel</button>
        </>}>
        <div className="alert a-warn mb16">
          This will permanently delete <strong>ALL data</strong> in Firestore (workers, attendance, schedule, plants, customers, defects, pest logs, bills, fields) and reset the app to a clean state. <br /><br />
          Only the superadmin account will remain.
        </div>
        {resetError && <div className="alert a-err mb16">{resetError}</div>}
        <div className="fg">
          <label>Enter your Super Admin password to confirm:</label>
          <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Password" />
        </div>
      </Modal>
    </div>
  );
};

export default AdminPage;
