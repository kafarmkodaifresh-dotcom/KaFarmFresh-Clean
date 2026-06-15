import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { fmtDate } from './utils';

const AttPage = ({ auth }) => {
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selDate, setSelDate] = useState(new Date().toISOString().split('T')[0]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteAttendance } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === "superadmin";

  useEffect(() => {
    const unsubWorkers = onSnapshot(collection(db, 'workers'), (snap) => {
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(w => w.active));
    });
    return () => unsubWorkers();
  }, []);

  useEffect(() => {
    const unsubAtt = onSnapshot(collection(db, 'attendance'), (snap) => {
      const data = {};
      snap.docs.forEach(d => {
        const { date, workerId, status } = d.data();
        data[`${date}_${workerId}`] = status;
      });
      setAttendance(data);
    });
    return () => unsubAtt();
  }, []);

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

  const markStatus = async (workerId, status) => {
    const q = query(collection(db, 'attendance'), where('date', '==', selDate), where('workerId', '==', workerId));
    const existing = (await getDocs(q)).docs[0];
    if (existing) {
      await updateDoc(doc(db, 'attendance', existing.id), { status });
    } else {
      await addDoc(collection(db, 'attendance'), { date: selDate, workerId, status });
    }
  };

  const getStatus = (wid) => attendance[`${selDate}_${wid}`] || 'absent';

  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteAttendance(String(itemToDelete.id), reason);
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

  const presentCount = activeWorkers.filter(w => getStatus(w.id) === 'present').length;
  const halfCount = activeWorkers.filter(w => getStatus(w.id) === 'halfday').length;
  const absentCount = activeWorkers.length - presentCount - halfCount;
  const totalSalary = activeWorkers
    .filter(w => getStatus(w.id) === 'present')
    .reduce((a, w) => a + Number(w.salary || 0), 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selDate);
    d.setDate(d.getDate() - 6 + i);
    const ds = d.toISOString().split('T')[0];
    const cnt = activeWorkers.filter(w => attendance[`${ds}_${w.id}`] === 'present').length;
    return { date: ds.slice(5), count: cnt };
  });

  return (
    <div>
      <div className="stat-grid mb20">
        <div className="stat-card sc-primary"><div className="stat-number">{presentCount}/{activeWorkers.length}</div><div className="stat-label">Present</div></div>
        <div className="stat-card sc-danger"><div className="stat-number">{absentCount}</div><div className="stat-label">Absent</div></div>
        <div className="stat-card sc-warning"><div className="stat-number">₹{totalSalary.toLocaleString()}</div><div className="stat-label">Today's Salary</div></div>
        <div className="stat-card sc-danger"><div className="stat-number">{deletedWorkers.length}</div><div className="stat-label">Deleted Workers</div><div className="stat-sub">Click toggle below to view</div></div>
      </div>

      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>📅 Active ({activeWorkers.length})</button>
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
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="flex-between">
            <h3 className="card-title">📅 Attendance – {selDate}</h3>
            <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
          </div>
          <div className="gap-10">
            <button className="btn btn-primary btn-sm" onClick={() => activeWorkers.forEach(w => markStatus(w.id, 'present'))}>✅ Mark All Present</button>
            <button className="btn btn-ghost btn-sm" onClick={() => activeWorkers.forEach(w => markStatus(w.id, 'absent'))}>🔄 Reset</button>
          </div>
          <div style={{ marginTop: 12 }}>
            {activeWorkers.map(w => {
              const s = getStatus(w.id);
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: '#f8f9fa', borderRadius: 8 }}>
                  <div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(w.id))}
                      onChange={() => toggleCheckbox(w.id)}
                      disabled={!isSuperAdmin || showDeleted}
                    />
                  </div>
                  <div style={{ fontWeight: 600, minWidth: 80 }}>{w.name}</div>
                  <div style={{ flex: 1, fontSize: 12, color: '#666' }}>{w.role} · ₹{w.salary}</div>
                  <div className="gap-10">
                    <button className={`btn btn-xs ${s === 'present' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => markStatus(w.id, 'present')}>✅</button>
                    <button className={`btn btn-xs ${s === 'halfday' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => markStatus(w.id, 'halfday')}>½</button>
                    <button className={`btn btn-xs ${s === 'absent' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => markStatus(w.id, 'absent')}>✗</button>
                    {isSuperAdmin && !showDeleted && (
                      <button className="btn btn-xs btn-danger" onClick={() => { setItemToDelete(w); setDeleteItemName(w.name); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card">
            <h3 className="card-title">📊 Last 7 Days</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, activeWorkers.length || 1]} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="card-title">💰 Monthly Summary</h3>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>Worker</th><th>Present</th><th>Half</th><th>Salary</th></tr></thead>
                <tbody>
                  {activeWorkers.map(w => {
                    const days = Object.keys(attendance).filter(k => k.endsWith(`_${w.id}`) && attendance[k] === 'present').length;
                    const half = Object.keys(attendance).filter(k => k.endsWith(`_${w.id}`) && attendance[k] === 'halfday').length;
                    const salary = days * Number(w.salary || 0) + half * (Number(w.salary || 0) / 2);
                    return (
                      <tr key={w.id}>
                        <td>{w.name}</td>
                        <td>{days}</td>
                        <td>{half}</td>
                        <td>₹{salary.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

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

export default AttPage;
