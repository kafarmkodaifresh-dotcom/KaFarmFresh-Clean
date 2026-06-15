import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Confirm } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { today, fmtDate } from './utils';

const SchedPage = ({ schedule, setSchedule, td, auth }) => {
  const BLANK = { date: td, drip: "", spray: "ஏதுமில்லை", field: "", note: "", type: "harvest", done: false };
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [bulk, setBulk] = useState({ startDate: td, days: "7", pattern: "harvest" });
  const [err, setErr] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Bulk Delete (Date Range) State
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteRange, setBulkDeleteRange] = useState({ startDate: td, endDate: td });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // 🔥 Checkbox Selection for Multiple Operations
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteSchedule } = useDeleteWithReason(auth);
  const f = (k, v) => { setForm(p => ({ ...p, [k]: v }));
    setErr(""); };

  const activeSchedule = schedule.filter(s => !s.deletedAt);
  const deletedSchedule = schedule.filter(s => s.deletedAt);
  const displayedSchedule = showDeleted ? deletedSchedule : activeSchedule;
  const filteredSchedule = displayedSchedule.filter(s => filter === "all" || s.type === filter);

  // 🔥 Handle Select All
  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(filteredSchedule.map(s => String(s.id)));
    } else {
      setSelectedIds([]);
    }
  };

  // 🔥 Toggle individual checkbox
  const toggleCheckbox = (id) => {
    const strId = String(id);
    setSelectedIds(prev => 
      prev.includes(strId) ? prev.filter(pid => pid !== strId) : [...prev, strId]
    );
    setSelectAll(false);
  };

  // 🔥 Bulk Delete by Selection
  const handleBulkDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one entry to delete.");
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected entries?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "schedule", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Successfully deleted ${selectedIds.length} entries.`);
    } catch (error) {
      console.error("Bulk delete by selection failed:", error);
      alert("Error during bulk delete. Check console for details.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 🔥 NEW: Bulk Restore (Retrieve) Deleted Schedule Entries
  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one deleted entry to restore.");
      return;
    }
    if (!confirm(`Are you sure you want to restore ${selectedIds.length} selected entries?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "schedule", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Successfully restored ${selectedIds.length} entries.`);
    } catch (error) {
      console.error("Bulk restore by selection failed:", error);
      alert("Error during bulk restore. Check console for details.");
    } finally {
      setIsRestoring(false);
    }
  };

  const openAdd = () => { setForm(BLANK);
    setEditId(null);
    setErr("");
    setModal(true); };
  const openEdit = s => { setForm({ ...s });
    setEditId(s.id);
    setErr("");
    setModal(true); };
  const save = async () => {
    if (!form.date) { setErr("தேதி தேர்ந்தெடுங்கள்"); return; }
    if (!form.drip.trim()) { setErr("சொட்டு நீர் உரம் உள்ளிடுங்கள்"); return; }
    if (editId) {
      await updateDoc(doc(db, "schedule", String(editId)), form);
    } else {
      await addDoc(collection(db, "schedule"), form);
    }
    setModal(false);
  };
  const toggleDone = async (id) => {
    const s = schedule.find(s => s.id === id);
    await updateDoc(doc(db, "schedule", String(id)), { done: !s.done });
  };

  const PATTERNS = {
    harvest: { drip: "SOP 0:00:50 (1.5-2 kg)", spray: "ஏதுமில்லை", field: "அறுவடை", type: "harvest" },
    spray: { drip: "கட்டுப்படுத்தப்பட்ட பாசனம்", spray: "ONDA (200ml) + COLORE (250g)", field: "QR பதிவு & இலை கத்தரிப்பு", type: "spray" },
    monitor: { drip: "கட்டுப்படுத்தப்பட்ட பாசனம்", spray: "Boron 20% (100g/100L)", field: "கண்காணிப்பு", type: "monitor" },
  };
  const addBulk = async () => {
    if (!bulk.startDate) { alert("தொடக்க தேதி தேர்ந்தெடுங்கள்"); return; }
    const pat = PATTERNS[bulk.pattern] || PATTERNS.harvest;
    const entries = [];
    for (let i = 0; i < Math.min(90, parseInt(bulk.days) || 7); i++) {
      const d = new Date(bulk.startDate + "T00:00:00");
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split("T")[0];
      if (!schedule.find(s => s.date === ds)) entries.push({ ...pat, date: ds, note: "Auto-generated", done: false, id: Date.now() + i });
    }
    if (entries.length === 0) { alert("இந்த தேதிகளில் ஏற்கனவே அட்டவணை உள்ளது."); return; }
    const batch = writeBatch(db);
    entries.forEach(e => batch.set(doc(db, "schedule", e.id.toString()), e));
    await batch.commit();
    setBulkModal(false);
    alert(`✅ ${entries.length} நாட்கள் சேர்க்கப்பட்டன.`);
  };

  // Bulk Delete by Date Range
  const handleBulkDeleteByRange = async () => {
    if (!bulkDeleteRange.startDate || !bulkDeleteRange.endDate) {
      alert("Please select both start and end dates.");
      return;
    }
    setIsBulkDeleting(true);
    try {
      const start = bulkDeleteRange.startDate;
      const end = bulkDeleteRange.endDate;
      const q = query(
        collection(db, "schedule"),
        where("date", ">=", start),
        where("date", "<=", end)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("No schedule entries found in this date range.");
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach(docRef => {
        if (!docRef.data().deletedAt) {
          batch.update(docRef.ref, {
            deletedAt: serverTimestamp(),
            deletedBy: auth?.name || 'unknown',
            changeReason: "Bulk delete by date range"
          });
        }
      });
      await batch.commit();
      setBulkDeleteModalOpen(false);
      alert(`✅ Successfully deleted ${snap.docs.length} schedule entries.`);
    } catch (error) {
      console.error("Bulk delete by date range failed:", error);
      alert("Error during bulk delete. Check console for details.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const TL = { harvest: "bg-primary", monitor: "bg-green", spray: "bg-blue", rest: "bg-gray" };
  const TN = { harvest: "🍓 அறுவடை", monitor: "👁 கண்காணிப்பு", spray: "🌿 தெளிப்பு", rest: "😴 ஓய்வு" };

  const handleDeleteConfirm = async (reason) => {
    if (!scheduleToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteSchedule(String(scheduleToDelete.id), reason);
      setDeleteModalOpen(false);
      setScheduleToDelete(null);
      setDeleteItemName('');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete. Check console for error details.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>📅 Active ({activeSchedule.length})</button>
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedSchedule.length})</button>
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
          <button className="btn btn-gold btn-sm" onClick={() => setBulkModal(true)}>⚡ Bulk சேர்</button>
          <button className="btn btn-danger btn-sm" onClick={() => setBulkDeleteModalOpen(true)}>🗑️ Bulk Delete (Date Range)</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ நாள் சேர்</button>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={filteredSchedule.length === 0} />
                </th>
                <th>தேதி</th><th>வகை</th><th>💧 சொட்டு நீர் உரம்</th><th>🌿 தெளிப்பு</th><th>🌾 களப்பணி</th><th>குறிப்பு</th><th>நிலை</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.map(s => (
                <tr key={s.id} className={s.date === td && !showDeleted ? "tbl-today" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(s.id))}
                      onChange={() => toggleCheckbox(s.id)}
                      disabled={false}
                    />
                  </td>
                  <td className="fw7" style={{ whiteSpace: "nowrap" }}>{s.date === td && !showDeleted ? "👉 " : ""}{s.date}</td>
                  <td><span className={`badge ${TL[s.type] || "bg-gray"}`}>{TN[s.type] || s.type}</span></td>
                  <td style={{ fontSize: 12, maxWidth: 160 }}>{s.drip}</td>
                  <td style={{ fontSize: 12, maxWidth: 140 }}>{!s.spray || s.spray === "ஏதுமில்லை" ? <span style={{ color: "#ccc" }}>—</span> : s.spray}</td>
                  <td style={{ fontSize: 12 }}>{s.field}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 120 }}>{s.note}</td>
                  <td><button className={`btn btn-xs ${s.done ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleDone(s.id)}>{s.done ? "✅" : "⏳"}</button></td>
                  {showDeleted && <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(s.deletedAt?.toDate?.() || s.deletedAt)}</td>}
                  <td>
                    {!showDeleted ? (
                      <div className="row">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(s)}>✏️</button>
                        <button className="btn btn-xs btn-danger" onClick={() => { setScheduleToDelete(s); setDeleteItemName(`${s.date} – ${s.drip || s.spray || s.field}`); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                      </div>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSchedule.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>{showDeleted ? "No deleted entries" : "No active entries"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId != null ? "✏️ நாள் திருத்தம்" : "➕ புதிய நாள்"} size="modal-md"
        footer={<><button className="btn btn-primary" onClick={save}>💾 சேமி</button><button className="btn btn-ghost" onClick={() => setModal(false)}>ரத்து</button></>}>
        {err && <div className="alert a-err mb16">{err}</div>}
        <div className="fr2"><div className="fg"><label>தேதி *</label><input type="date" value={form.date} onChange={e => f("date", e.target.value)} /></div><div className="fg"><label>வகை</label><select value={form.type} onChange={e => f("type", e.target.value)}><option value="harvest">🍓 அறுவடை</option><option value="monitor">👁 கண்காணிப்பு</option><option value="spray">🌿 தெளிப்பு</option><option value="rest">😴 ஓய்வு</option></select></div></div>
        <div className="fg"><label>💧 சொட்டு நீர் உரம் *</label><input value={form.drip} onChange={e => f("drip", e.target.value)} placeholder="உதா: MinSol 13:00:45 (1.5kg)" /></div>
        <div className="fg"><label>🌿 மாலை தெளிப்பு</label><input value={form.spray} onChange={e => f("spray", e.target.value)} placeholder="உதா: COLORE 250g + ONDA 200ml அல்லது ஏதுமில்லை" /></div>
        <div className="fg"><label>🌾 களப்பணி</label><input value={form.field} onChange={e => f("field", e.target.value)} placeholder="உதா: அறுவடை / கண்காணிப்பு / ஓய்வு" /></div>
        <div className="fg"><label>📝 குறிப்பு</label><textarea value={form.note} onChange={e => f("note", e.target.value)} placeholder="கூடுதல் விவரங்கள்..." style={{ minHeight: 60 }} /></div>
      </Modal>

      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="⚡ Bulk நாட்கள் சேர்" size="modal-sm"
        footer={<><button className="btn btn-gold" onClick={addBulk}>⚡ சேர்</button><button className="btn btn-ghost" onClick={() => setBulkModal(false)}>ரத்து</button></>}>
        <div className="fg"><label>தொடக்க தேதி</label><input type="date" value={bulk.startDate} onChange={e => setBulk(p => ({ ...p, startDate: e.target.value }))} /></div>
        <div className="fg"><label>எத்தனை நாட்கள்? (max 90)</label><input type="number" min={1} max={90} value={bulk.days} onChange={e => setBulk(p => ({ ...p, days: e.target.value }))} /></div>
        <div className="fg"><label>Pattern</label><select value={bulk.pattern} onChange={e => setBulk(p => ({ ...p, pattern: e.target.value }))}><option value="harvest">🍓 Harvest Pattern</option><option value="spray">🌿 Spray Pattern</option><option value="monitor">👁 Monitor Pattern</option></select></div>
        <div className="alert a-info" style={{ marginTop: 8 }}>ஏற்கனவே உள்ள தேதிகளை skip செய்யும்.</div>
      </Modal>

      {/* Bulk Delete by Date Range Modal */}
      <Modal open={bulkDeleteModalOpen} onClose={() => setBulkDeleteModalOpen(false)} title="🗑️ Bulk Delete (Date Range)" size="modal-sm"
        footer={<><button className="btn btn-danger" onClick={handleBulkDeleteByRange} disabled={isBulkDeleting}>{isBulkDeleting ? 'Deleting...' : '🗑️ Delete All in Range'}</button><button className="btn btn-ghost" onClick={() => setBulkDeleteModalOpen(false)}>Cancel</button></>}>
        <div className="alert a-warn mb16">
          This will permanently soft-delete all <strong>active</strong> schedule entries within the selected date range.
        </div>
        <div className="fr2">
          <div className="fg"><label>Start Date</label><input type="date" value={bulkDeleteRange.startDate} onChange={e => setBulkDeleteRange(p => ({ ...p, startDate: e.target.value }))} /></div>
          <div className="fg"><label>End Date</label><input type="date" value={bulkDeleteRange.endDate} onChange={e => setBulkDeleteRange(p => ({ ...p, endDate: e.target.value }))} /></div>
        </div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Schedule Entry"
        message="Are you sure you want to delete this schedule entry? This action will be recorded and cannot be undone."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default SchedPage;
