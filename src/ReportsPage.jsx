import React, { useState, useRef } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Confirm, AiDots } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { callGemini } from './gemini';
import { parseLocation } from './utils/parseLocation';
import { today, fmtDate } from './utils';

const ReportsPage = ({ defects, setDefects, schedule, setSchedule, td, auth }) => {
  const [addModal, setAddModal] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [selR, setSelR] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResp, setAiResp] = useState("");
  const [form, setForm] = useState({ workerName: "", date: td, description: "", section: "", severity: "medium", imageData: "" });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // 🔥 FIX: Added missing fileRef for file upload
  const fileRef = useRef();

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteDefect } = useDeleteWithReason(auth);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const activeItems = defects.filter(d => !d.deletedAt);
  const deletedItems = defects.filter(d => d.deletedAt);
  const displayedItems = showDeleted ? deletedItems : activeItems;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedItems.map(d => String(d.id)));
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
    if (selectedIds.length === 0) return alert("Select at least one report.");
    if (!confirm(`Delete ${selectedIds.length} selected reports?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "defects", String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: "Bulk delete by selection"
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selectedIds.length} reports.`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one report to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected reports?`)) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, "defects", String(id));
        batch.update(ref, {
          deletedAt: null,
          deletedBy: null,
          changeReason: null
        });
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      alert(`✅ Restored ${selectedIds.length} reports.`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleImg = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => f("imageData", ev.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const saveReport = async () => {
    if (!form.description.trim()) { alert("விவரம் உள்ளிடுங்கள்"); return; }
    await addDoc(collection(db, "defects"), { ...form, seen: false, createdAt: new Date().toISOString() });
    setAddModal(false);
    setForm({ workerName: "", date: td, description: "", section: "", severity: "medium", imageData: "" });
  };

  // 🔥 Expert-level AI analysis with location parsing
  const openAI = async (r) => {
    setSelR(r);
    setAiResp("");
    setAiLoading(true);
    setAiModal(true);
    await markSeen(r.id);

    // Parse the section field to extract location
    const location = parseLocation(r.section || '', { strict: false });
    console.log('🔍 Parsed location:', location);

    // Build the prompt with plant health and nutrient history if available
    let plantContext = '';
    if (location.isComplete) {
      try {
        // Attempt to fetch plant health and nutrient history
        const plantRef = doc(db, 'fields', location.field, 'blocks', location.block, 'rows', location.row, 'plants', String(location.plantIndex));
        const plantSnap = await getDoc(plantRef);
        if (plantSnap.exists()) {
          const plantData = plantSnap.data();
          plantContext = `
Plant health data:
- Flowers: ${plantData.flowers || 0}
- Green fruits: ${plantData.greenFruits || 0}
- Red fruits: ${plantData.redFruits || 0}
- Yield: ${plantData.yieldGrams || 0} grams
- Defect: ${plantData.defect || 'none'}

Last 5 nutrient applications:
`;
          // Fetch nutrient history from subcollection
          const historySnap = await getDocs(collection(db, plantRef.path, 'nutrientHistory'));
          const history = historySnap.docs.slice(0, 5).map(d => d.data());
          if (history.length > 0) {
            history.forEach((h, i) => {
              plantContext += `- ${h.nutrientName} on ${h.date}: ${h.reason || 'AI recommended'}\n`;
            });
          } else {
            plantContext += '- No recent nutrient applications.\n';
          }
        } else {
          plantContext = '- Plant not found in database. Using report data only.\n';
        }
      } catch (err) {
        console.warn('Could not fetch plant data:', err);
        plantContext = '- Could not fetch plant history. Using report data only.\n';
      }
    } else {
      plantContext = '- No precise plant location provided. Using report data only.\n';
    }

    const prompt = `You are a strawberry farm advisor. A worker has reported a defect.

Report details:
- Description: ${r.description}
- Section: ${r.section || 'not specified'}
- Severity: ${r.severity}
- Date: ${r.date}
${plantContext}

Analyze the report and the attached image (if any). Recommend:
1. Specific fertiliser/pesticide from the list of available products (name, dose, PHI, stock)
2. Timing (1–4 days from today)
3. A short reason for the recommendation
4. Any important notes for the farm team

Output as JSON:
{
  "product": "product name",
  "dose": "dose per 100L",
  "timing": 1-4,
  "PHI": 0-30,
  "reason": "short explanation"
}`;
    const resp = await callGemini(prompt, r.imageData || null);
    setAiResp(resp);
    setAiLoading(false);
  };

  const markSeen = async (id) => {
    await updateDoc(doc(db, "defects", String(id)), { seen: true });
    setDefects(p => p.map(r => r.id === id ? { ...r, seen: true } : r));
  };

  const addToSchedule = async () => {
    if (!selR) return;
    const d = new Date(td + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const ds = d.toISOString().split("T")[0];
    const q = query(collection(db, "schedule"), where("date", "==", ds));
    const existing = (await getDocs(q)).docs[0];
    if (existing) {
      await updateDoc(doc(db, "schedule", existing.id), { note: (existing.data().note || "") + " | AI Fix: " + (aiResp || "").slice(0, 80) });
    } else {
      await addDoc(collection(db, "schedule"), { id: Date.now(), date: ds, drip: "AI-recommended – scheduleதை சரிபார்க்கவும்", spray: (aiResp || "").slice(0, 60), field: "Defect Treatment", note: (aiResp || "").slice(0, 120), type: "monitor", done: false });
    }
    alert("✅ AI பரிந்துரை நாளைய அட்டவணையில் சேர்க்கப்பட்டது!");
    setAiModal(false);
  };

  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteDefect(String(itemToDelete.id), reason);
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

  const SEV = { high: "bg-red", medium: "bg-gold", low: "bg-green" };
  const exportToCSV = () => {
    const rows = defects.map(r => [
      fmtDate(r.date),
      r.workerName || 'Worker',
      r.section || '—',
      r.severity,
      r.description
    ]);
    rows.unshift(['Date', 'Worker', 'Section', 'Severity', 'Description']);
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defect-reports-${today()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="between mb16">
        <div className="alert a-info" style={{ flex: 1, marginRight: 12, margin: 0 }}>👷 Workers field-ல் பார்த்த பிரச்சனைகளை report செய்கிறார்கள். Admin AI பகுப்பாய்வு செய்து அட்டவணையில் சேர்க்கலாம்.</div>
        <div className="row">
          <button className="btn btn-outline btn-sm" onClick={exportToCSV}>📊 CSV</button>
          <button className="btn btn-berry btn-sm" onClick={() => setAddModal(true)}>➕ Report சேர்</button>
        </div>
      </div>

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
        </div>
      </div>

      {defects.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-icon">✅</div><div className="fw6">Defect reports இல்லை. பண்ணை நல்ல நிலையில் உள்ளது!</div></div></div>
      ) : (
        <div className="g2">
          {displayedItems.map(r => (
            <div key={r.id} className="def-card">
              <div className="between mb16">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!showDeleted && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(r.id))}
                      onChange={() => toggleCheckbox(r.id)}
                    />
                  )}
                  <div>
                    <div className="fw7" style={{ fontSize: 14 }}>👷 {r.workerName || "Worker"}</div>
                    <div className="muted">{fmtDate(r.date)} · Section: {r.section || "—"}</div>
                  </div>
                </div>
                <div className="row">
                  <span className={`badge ${SEV[r.severity] || "bg-gold"}`}>{r.severity}</span>
                  {!r.seen && !showDeleted && <span className="badge bg-red">🆕</span>}
                </div>
              </div>
              {r.imageData && (
                <img src={`data:image/jpeg;base64,${r.imageData}`} alt="defect" className="def-img" onError={e => e.target.style.display = "none"} />
              )}
              <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>{r.description}</div>
              <div className="row">
                {!showDeleted ? (
                  <>
                    <button className="btn btn-gold btn-sm" onClick={() => openAI(r)}>🤖 AI பகுப்பாய்வு</button>
                    <button className="btn btn-danger btn-xs" onClick={() => { setItemToDelete(r); setDeleteItemName(r.description.slice(0, 40)); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                  </>
                ) : (
                  <span className="badge bg-gray">Deleted</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={aiModal} onClose={() => { setAiModal(false); setAiResp(""); }} title="🤖 AI பகுப்பாய்வு & அட்டவணை புதுப்பு" size="modal-lg"
        footer={<><button className="btn btn-primary" onClick={addToSchedule} disabled={!aiResp || aiLoading}>📋 நாளைய அட்டவணையில் சேர்</button><button className="btn btn-ghost" onClick={() => { setAiModal(false); setAiResp(""); }}>மூடு</button></>}>
        {selR && (
          <div>
            <div className="alert a-warn mb16">
              <div><strong>Report:</strong> {selR.description}</div>
              <div style={{ marginTop: 4 }}><strong>Section:</strong> {selR.section || "—"} · <strong>Severity:</strong> {selR.severity}</div>
            </div>
            {aiLoading && <AiDots />}
            {aiResp && (
              <div>
                <div className="ai-box"><div className="ai-lbl">🤖 AI பரிந்துரை</div><div className="ai-txt">{aiResp}</div></div>
                <div className="alert a-ok" style={{ marginTop: 12 }}>✅ "📋 நாளைய அட்டவணையில் சேர்" கிளிக் செய்தால் AI பரிந்துரை நாளைய schedule-ல் சேர்க்கப்படும்.</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="🚨 Defect Report சேர்" size="modal-md"
        footer={<><button className="btn btn-berry" onClick={saveReport}>💾 Report சேமி</button><button className="btn btn-ghost" onClick={() => setAddModal(false)}>ரத்து</button></>}>
        <div className="fr2"><div className="fg"><label>Worker பெயர்</label><input value={form.workerName} onChange={e => f("workerName", e.target.value)} placeholder="பெயர்" /></div><div className="fg"><label>தேதி</label><input type="date" value={form.date} onChange={e => f("date", e.target.value)} /></div></div>
        <div className="fr2"><div className="fg"><label>Plant Section</label><input value={form.section} onChange={e => f("section", e.target.value)} placeholder="உதா: Row 1-10 / Block A / Field A Block 2 Row 3 Plant 45" /></div><div className="fg"><label>தீவிரம்</label><select value={form.severity} onChange={e => f("severity", e.target.value)}><option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option></select></div></div>
        <div className="fg"><label>பிரச்சனை விவரம் *</label><textarea value={form.description} onChange={e => f("description", e.target.value)} placeholder="பார்த்தது என்ன? எத்தனை செடிகளில்? அறிகுறிகள் என்ன?" /></div>
        <div className="fg"><label>📸 படம் (விரும்பினால்)</label>
          <div className="upz" onClick={() => fileRef.current?.click()}>
            <input type="file" ref={fileRef} accept="image/*" onChange={handleImg} style={{ display: "none" }} />
            {form.imageData ? <div style={{ color: "var(--primary)", fontWeight: 600 }}>✅ படம் சேர்க்கப்பட்டது – AI பகுப்பாய்வுக்கு தயார்</div> : <div><div style={{ fontSize: 28 }}>📸</div><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>படம் பதிவேற்ற கிளிக் செய்யுங்கள்</div></div>}
          </div>
        </div>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Report"
        message="Are you sure you want to delete this report? This action will be recorded."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default ReportsPage;
