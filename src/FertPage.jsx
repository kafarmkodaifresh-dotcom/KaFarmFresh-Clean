import React, { useState } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Confirm, AiDots } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { callGemini } from './gemini';
import { today, fmtDate } from './utils';

const FertPage = ({ pestLog, setPestLog, schedule, setSchedule, td, auth }) => {
  const BLANK = { date: td, reason: "weather", original: "", replacement: "", notes: "" };
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResp, setAiResp] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeletePestLog } = useDeleteWithReason(auth);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const activeItems = pestLog.filter(i => !i.deletedAt);
  const deletedItems = pestLog.filter(i => i.deletedAt);
  const displayedItems = showDeleted ? deletedItems : activeItems;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedItems.map(i => String(i.id)));
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
    if (selectedIds.length === 0) return alert("Select at least one item.");
    if (!confirm(`Delete ${selectedIds.length} selected items?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "pestlog", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selectedIds.length} items.`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one item to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected items?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "pestlog", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Restored ${selectedIds.length} items.`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const askAI = async () => {
    if (!form.reason && !form.original) { alert("காரணம் / Original plan உள்ளிடுங்கள்"); return; }
    setAiLoading(true);
    setAiResp("");
    const r = await callGemini(`Farm change needed. Reason: ${form.reason}. Original plan: ${form.original || "not specified"}. Suggest best alternative fertiliser/pesticide from available stock. When, dose, PHI?`);
    setAiResp(r);
    setAiLoading(false);
  };

  const save = async () => {
    await addDoc(collection(db, "pestlog"), { ...form, aiRec: aiResp, createdAt: new Date().toISOString() });
    setModal(false);
    setAiResp("");
    setForm(BLANK);
  };

  const addToSched = async (item) => {
    if (!item.date) { alert("தேதி இல்லை"); return; }
    const d = new Date(item.date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const ds = d.toISOString().split("T")[0];
    const q = query(collection(db, "schedule"), where("date", "==", ds));
    const existing = (await getDocs(q)).docs[0];
    if (existing) {
      await updateDoc(doc(db, "schedule", existing.id), { note: (existing.data().note || "") + ` | AI Modified: ${(item.replacement || "").slice(0, 50)}` });
    } else {
      await addDoc(collection(db, "schedule"), { date: ds, drip: "AI-recommended – சரிபார்க்கவும்", spray: (item.replacement || "").slice(0, 50), field: "Defect Treatment", note: "AI recommended fix", type: "monitor", done: false });
    }
    alert("✅ அட்டவணை புதுப்பிக்கப்பட்டது!");
  };

  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeletePestLog(String(itemToDelete.id), reason);
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

  const REASONS = { weather: "🌧️ வானிலை மாற்றம்", busy: "🔧 வேலை நெரிசல்", stock: "📦 Stock இல்லை", ai: "🤖 AI பரிந்துரை", other: "📝 வேறு காரணம்" };

  return (
    <div>
      <div className="alert a-info mb16">🧪 வானிலை மாற்றம் / stock பிரச்சனை / வேலை நெரிசல் காரணமாக fertiliser/pesticide மாற்றங்களை பதிவிட்டு, AI-யிடம் மாற்று பரிந்துரை கேட்டு அட்டவணையில் நேரடியாக சேர்க்கலாம்.</div>
      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>📋 Active ({activeItems.length})</button>
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
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK); setAiResp(""); setModal(true); }}>➕ புதிய மாற்றம்</button>
        </div>
      </div>

      {pestLog.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-icon">🧪</div>மாற்றங்கள் இல்லை.</div></div>
      ) : (
        displayedItems.map(item => (
          <div className="card mb16" key={item.id}>
            <div className="between mb16">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {!showDeleted && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(String(item.id))}
                    onChange={() => toggleCheckbox(item.id)}
                  />
                )}
                <div>
                  <div className="fw7" style={{ fontSize: 14 }}>{REASONS[item.reason] || item.reason}</div>
                  <div className="muted">{fmtDate(item.date)} · {new Date(item.createdAt).toLocaleString("en-IN")}</div>
                </div>
              </div>
              <div className="row">
                <button className="btn btn-primary btn-sm" onClick={() => addToSched(item)}>📋 அட்டவணையில் சேர்</button>
                {!showDeleted ? (
                  <button className="btn btn-danger btn-xs" onClick={() => { setItemToDelete(item); setDeleteItemName(`${item.original || item.reason}`); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                ) : (
                  <span className="badge bg-gray">Deleted</span>
                )}
              </div>
            </div>
            <div className="g2" style={{ marginBottom: item.aiRec ? 12 : 0 }}>
              <div style={{ background: "var(--primary-pale)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", marginBottom: 3 }}>❌ மாற்றப்பட்டது</div>
                <div style={{ fontSize: 13 }}>{item.original || "—"}</div>
              </div>
              <div style={{ background: "var(--secondary-pale)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--secondary)", marginBottom: 3 }}>✅ மாற்று</div>
                <div style={{ fontSize: 13 }}>{item.replacement || "—"}</div>
              </div>
            </div>
            {item.notes && <div className="muted" style={{ marginBottom: item.aiRec ? 8 : 0 }}>📝 {item.notes}</div>}
            {item.aiRec && <div className="ai-box"><div className="ai-lbl">🤖 AI பரிந்துரை</div><div className="ai-txt">{item.aiRec}</div></div>}
          </div>
        ))
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="🔄 புதிய மாற்றம் பதிவிடு" size="modal-lg"
        footer={<><button className="btn btn-primary" onClick={save}>💾 சேமி</button><button className="btn btn-ghost" onClick={() => setModal(false)}>ரத்து</button></>}>
        <div className="fr2"><div className="fg"><label>தேதி</label><input type="date" value={form.date} onChange={e => f("date", e.target.value)} /></div><div className="fg"><label>காரணம்</label><select value={form.reason} onChange={e => f("reason", e.target.value)}>{Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
        <div className="fg"><label>Original Plan (மாற்றப்பட வேண்டியது)</label><input value={form.original} onChange={e => f("original", e.target.value)} placeholder="உதா: ONDA 200ml spray அல்லது Simodis spray" /></div>
        <div className="fg"><label>மாற்று (Alternative)</label><input value={form.replacement} onChange={e => f("replacement", e.target.value)} placeholder="உதா: Boron 1g/L spray அல்லது skip" /></div>
        <div className="fg"><label>குறிப்பு</label><textarea value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="கூடுதல் காரணம் / விவரம்..." /></div>
        <button className="btn btn-gold" onClick={askAI} disabled={aiLoading}>{aiLoading ? "🤔 AI யோசிக்கிறது..." : "🤖 AI-யிடம் மாற்று பரிந்துரை கேளு"}</button>
        {aiLoading && <AiDots />}
        {aiResp && <div className="ai-box" style={{ marginTop: 12 }}><div className="ai-lbl">🤖 AI பரிந்துரை</div><div className="ai-txt">{aiResp}</div></div>}
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Change Log"
        message="Are you sure you want to delete this change log? This action will be recorded."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default FertPage;
