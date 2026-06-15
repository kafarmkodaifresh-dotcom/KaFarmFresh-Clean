import React, { useState } from 'react';
import Modal from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { today, fmtDate } from './utils';

const AdminPage = ({ adminUsers, createAdmin, deleteAdmin, auth }) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "admin" });
  const [err, setErr] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');

  const { softDeleteAdmin } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === 'superadmin';

  const handleCreate = () => {
    if (!form.username || !form.password || !form.name) { setErr("All fields required"); return; }
    if (adminUsers.find(u => u.username === form.username)) { setErr("Username already exists"); return; }
    const newUser = {
      id: Date.now(),
      username: form.username,
      password: form.password,
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
    setIsDeleting(true);
    try {
      await softDeleteAdmin(adminToDelete, reason);
      deleteAdmin(adminToDelete);
      setDeleteModalOpen(false);
      setAdminToDelete(null);
      setDeleteItemName('');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="between mb16">
        <div className="card-title" style={{ margin: 0 }}>👤 Admin Users ({adminUsers.length})</div>
        {isSuperAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>➕ Create Admin</button>
        )}
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
    </div>
  );
};

export default AdminPage;
