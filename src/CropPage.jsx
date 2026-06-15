import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, query, where, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { Prog, Ring } from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { callGemini } from './gemini';
import PlantFilterBar from './components/PlantFilterBar';
import PlantCell from './components/PlantCell';
import { healthRules } from './utils/healthRules';
import BulkQRPrint from './components/BulkQRPrint';
import QRCodeGenerator from './components/QRCodeGenerator';
import useAIPlantAnalysis from './hooks/useAIPlantAnalysis';

const TOTAL_PLANTS = 10000;

const CropPage = ({ auth }) => {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sampleSize, setSampleSize] = useState(50);
  const [filterType, setFilterType] = useState('all');
  const [selectedPlantIndices, setSelectedPlantIndices] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResp, setAiResp] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearError, setClearError] = useState('');

  const { softDeletePlant } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === 'superadmin';
  const fieldsFetched = useRef(false);

  const [summary, setSummary] = useState({
    healthy: 0, issues: 0, flowering: 0, greenFruits: 0, ready: 0, totalYield: 0, totalRedFruits: 0, defectCounts: {}, topYieldPlants: [],
  });

  // ─── AI Recommendation Hook ──────────────────────────────
  const {
    loading: aiAnalysisLoading,
    error: aiAnalysisError,
    response: aiAnalysisResponse,
    providerUsed: aiProviderUsed,
    triggerAnalysis,
    approveRecommendation,
    rejectRecommendation,
  } = useAIPlantAnalysis();

  // ─── Load fields once ──────────────────────────────────
  useEffect(() => {
    if (fieldsFetched.current) return;
    fieldsFetched.current = true;
    const loadFields = async () => {
      try {
        const snap = await getDocs(collection(db, 'fields'));
        setFields(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Failed to load fields:', err);
      }
    };
    loadFields();
  }, []);

  // ─── Load plants from selected row ────────────────────
  useEffect(() => {
    if (!selectedFieldId) { setPlants([]); return; }
    setLoading(true);

    const field = fields.find(f => f.id === selectedFieldId);
    if (!field) { setLoading(false); return; }

    const isBlockBased = field.hasBlocks === true;
    let rowRefPath;
    if (isBlockBased) {
      const blockId = selectedBlockId || 'block_1';
      const rowId = selectedRowId || 'row_1';
      setSelectedBlockId(blockId);
      setSelectedRowId(rowId);
      rowRefPath = `fields/${selectedFieldId}/blocks/${blockId}/rows/${rowId}`;
    } else {
      const rowId = selectedRowId || 'row_1';
      setSelectedRowId(rowId);
      rowRefPath = `fields/${selectedFieldId}/rows/${rowId}`;
    }

    const rowRef = doc(db, rowRefPath);
    const unsubscribe = onSnapshot(rowRef, (snap) => {
      if (snap.exists()) {
        setPlants((snap.data().plants || []).filter(p => !p.deletedAt));
      } else {
        setPlants([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedFieldId, selectedBlockId, selectedRowId, fields]);

  // ─── Filtered Plants (Derived State) ──────────────────
  const filteredPlants = useMemo(() => {
    return plants.filter(p => {
      if (filterType === 'all') return true;
      const health = healthRules.getHealthStatus(p);
      return health === filterType;
    });
  }, [plants, filterType]);

  // ─── Select All Handler ───────────────────────────────
  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      const visibleIndices = filteredPlants.slice(0, sampleSize).map(p => p.index);
      setSelectedPlantIndices(visibleIndices);
    } else {
      setSelectedPlantIndices([]);
    }
  };

  useEffect(() => {
    if (!selectAll) {
      const visibleIndices = filteredPlants.slice(0, sampleSize).map(p => p.index);
      const allSelected = visibleIndices.every(idx => selectedPlantIndices.includes(idx));
      if (allSelected && selectedPlantIndices.length > 0) {
        setSelectAll(true);
      }
    }
  }, [filteredPlants, sampleSize, selectedPlantIndices]);

  const togglePlantSelection = (index) => {
    setSelectedPlantIndices(prev => {
      const newSelection = prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index];
      const visibleIndices = filteredPlants.slice(0, sampleSize).map(p => p.index);
      const allSelected = visibleIndices.every(idx => newSelection.includes(idx));
      setSelectAll(allSelected);
      return newSelection;
    });
  };

  const clearSelection = () => {
    setSelectedPlantIndices([]);
    setSelectAll(false);
  };

  const getSelectedPlants = useCallback(() => {
    return plants.filter(p => selectedPlantIndices.includes(p.index));
  }, [plants, selectedPlantIndices]);

  // ─── Summary & Stats ──────────────────────────────────
  useEffect(() => {
    const newSummary = {
      healthy: 0, issues: 0, flowering: 0, greenFruits: 0, ready: 0, totalYield: 0, totalRedFruits: 0, defectCounts: {}, topYieldPlants: [],
    };
    const samplePlants = plants.slice(0, sampleSize);
    samplePlants.forEach(p => {
      const status = healthRules.getHealthStatus(p);
      if (status === 'healthy') newSummary.healthy++;
      else if (status === 'issue') newSummary.issues++;
      else if (status === 'flowering') newSummary.flowering++;
      else if (status === 'harvest') newSummary.ready++;
      if (p.greenFruits > 0) newSummary.greenFruits += p.greenFruits;
      newSummary.totalYield += p.yieldGrams || 0;
      newSummary.totalRedFruits += p.redFruits || 0;
      if (p.defect) newSummary.defectCounts[p.defect] = (newSummary.defectCounts[p.defect] || 0) + 1;
    });
    newSummary.topYieldPlants = [...plants].sort((a, b) => (b.yieldGrams || 0) - (a.yieldGrams || 0)).slice(0, 5);
    setSummary(newSummary);
  }, [plants, sampleSize]);

  const sampleSizeSafe = Math.min(sampleSize, plants.length) || 1;
  const ratio = TOTAL_PLANTS / sampleSizeSafe;
  const extrapolatedData = {
    healthy: Math.round(summary.healthy * ratio),
    issues: Math.round(summary.issues * ratio),
    flowering: Math.round(summary.flowering * ratio),
    ready: Math.round(summary.ready * ratio),
    redFruits: Math.round(summary.totalRedFruits * ratio),
    yield: Math.round(summary.totalYield * ratio),
    revenue: Math.round(summary.totalYield * ratio * 120),
    healthPercent: Math.round((summary.healthy / sampleSizeSafe) * 100),
    harvestPercent: Math.round((summary.ready / sampleSizeSafe) * 100),
    yieldScorePercent: Math.round((summary.totalYield / (sampleSizeSafe * 300)) * 100),
  };

  // ─── Bulk AI Recommendation ──────────────────────────
  const handleBulkAIRecommendation = async () => {
    const selected = getSelectedPlants();
    if (selected.length === 0) return alert('Please select at least one plant.');
    setAiLoading(true);
    setAiResp('');
    const plantData = selected.map(p =>
      `Plant #${p.index}: Flowers=${p.flowers}, Green Fruits=${p.greenFruits}, Red Fruits=${p.redFruits}, Defect=${p.defect || 'None'}, Yield=${p.yieldGrams}g`
    ).join('\n');
    const prompt = `You are a strawberry farm advisor...\n${plantData}\nReturn as JSON: { "product": "...", "dose": "...", "timing": N, "PHI": N, "reason": "..." }`;
    try {
      const resp = await callGemini(prompt);
      setAiResp(resp);
    } catch (err) {
      console.error('AI recommendation failed:', err);
      setAiResp('Failed to get AI recommendation.');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── AI Farm Advice ──────────────────────────────────
  const handleAIFarmAdvice = async () => {
    setAiLoading(true);
    setAiResp('');
    const prompt = `I am a farm manager... sample health summary... Provide actionable advice.`;
    try {
      const resp = await callGemini(prompt);
      setAiResp(resp);
    } catch (err) {
      console.error('AI Farm Advice failed:', err);
      setAiResp('Failed to get AI farm advice.');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Single Plant AI Analysis (Phase 5) ────────────────
  const handleSingleAIAnalysis = async () => {
    if (!selectedPlant) return;
    try {
      const result = await triggerAnalysis(
        selectedFieldId,
        selectedBlockId || null,
        selectedRowId,
        String(selectedPlant.index)
      );
      console.log('✅ AI analysis completed:', result);
    } catch (err) {
      console.error('❌ AI analysis failed:', err);
    }
  };

  const handleApproveAI = async () => {
    if (!selectedPlant || !aiAnalysisResponse) return;
    try {
      await approveRecommendation(
        selectedFieldId,
        selectedBlockId || null,
        selectedRowId,
        String(selectedPlant.index),
        aiAnalysisResponse.id,
        auth?.name || 'Admin'
      );
      alert('✅ Recommendation approved.');
    } catch (err) {
      console.error('Approval failed:', err);
      alert('Failed to approve recommendation.');
    }
  };

  const handleRejectAI = async () => {
    if (!selectedPlant || !aiAnalysisResponse) return;
    try {
      await rejectRecommendation(
        selectedFieldId,
        selectedBlockId || null,
        selectedRowId,
        String(selectedPlant.index),
        aiAnalysisResponse.id,
        auth?.name || 'Admin',
        'Rejected by admin'
      );
      alert('✅ Recommendation rejected.');
    } catch (err) {
      console.error('Rejection failed:', err);
      alert('Failed to reject recommendation.');
    }
  };

  // ─── Delete Handlers ──────────────────────────────────
  const handleDeleteConfirm = async (reason) => {
    if (!plantToDelete) return;
    setIsDeleting(true);
    try {
      await softDeletePlant(String(plantToDelete.index), reason);
      setDeleteModalOpen(false);
      setPlantToDelete(null);
      setDeleteItemName('');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteSelected = async () => {
    const selected = getSelectedPlants();
    if (selected.length === 0) return alert('Select at least one plant.');
    if (!confirm(`Delete ${selected.length} selected plants?`)) return;
    setIsDeleting(true);
    try {
      const isBlockBased = fields.find(f => f.id === selectedFieldId)?.hasBlocks === true;
      let rowRefPath;
      if (isBlockBased) {
        const blockId = selectedBlockId || 'block_1';
        rowRefPath = `fields/${selectedFieldId}/blocks/${blockId}/rows/${selectedRowId}`;
      } else {
        rowRefPath = `fields/${selectedFieldId}/rows/${selectedRowId}`;
      }
      const rowRef = doc(db, rowRefPath);
      const rowSnap = await getDoc(rowRef);
      if (!rowSnap.exists()) return;
      const data = rowSnap.data();
      const updatedPlants = data.plants.map(p =>
        selected.some(s => s.index === p.index) ? { ...p, deletedAt: new Date().toISOString() } : p
      );
      await updateDoc(rowRef, { plants: updatedPlants });
      setSelectedPlantIndices([]);
      setSelectAll(false);
      alert(`✅ Deleted ${selected.length} plants.`);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Error during bulk delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllPlants = async () => {
    if (!isSuperAdmin) { setClearError('Only Super Admin can perform this action.'); return; }
    const users = JSON.parse(localStorage.getItem('auth_users') || '[]');
    const admin = users.find(u => u.id === auth?.id);
    if (!admin || admin.password !== clearPassword) { setClearError('Incorrect password.'); return; }
    if (!confirm('⚠️ This will permanently delete ALL plants in the selected row.')) return;
    setIsDeleting(true);
    try {
      const isBlockBased = fields.find(f => f.id === selectedFieldId)?.hasBlocks === true;
      let rowRefPath;
      if (isBlockBased) {
        const blockId = selectedBlockId || 'block_1';
        rowRefPath = `fields/${selectedFieldId}/blocks/${blockId}/rows/${selectedRowId}`;
      } else {
        rowRefPath = `fields/${selectedFieldId}/rows/${selectedRowId}`;
      }
      const rowRef = doc(db, rowRefPath);
      await deleteDoc(rowRef);
      setPlants([]);
      setClearModalOpen(false);
      setClearPassword('');
      setClearError('');
      alert('✅ All plants in the selected row have been deleted.');
    } catch (error) {
      console.error('Clear all plants failed:', error);
      alert('Error during clear operation.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Plant Editing ────────────────────────────────────
  const handlePlantClick = (plant) => {
    setSelectedPlant(plant);
    setEditForm(plant);
    setEditModalOpen(true);
  };

  const updatePlantDetails = async (fieldId, rowId, plantIndex, updates) => {
    const isBlockBased = fields.find(f => f.id === fieldId)?.hasBlocks === true;
    let rowRefPath;
    if (isBlockBased) {
      const blockId = selectedBlockId || 'block_1';
      rowRefPath = `fields/${fieldId}/blocks/${blockId}/rows/${rowId}`;
    } else {
      rowRefPath = `fields/${fieldId}/rows/${rowId}`;
    }
    const rowRef = doc(db, rowRefPath);
    try {
      const rowSnap = await getDoc(rowRef);
      if (rowSnap.exists()) {
        const data = rowSnap.data();
        const updatedPlants = data.plants.map(p =>
          p.index === plantIndex ? { ...p, ...updates } : p
        );
        await updateDoc(rowRef, { plants: updatedPlants });
      }
    } catch (err) {
      console.error('Failed to update plant:', err);
      alert('Failed to update plant details.');
    }
  };

  const saveEdit = () => {
    if (!selectedPlant || !selectedFieldId || !selectedRowId) return;
    const { index, ...updates } = editForm;
    updatePlantDetails(selectedFieldId, selectedRowId, selectedPlant.index, updates);
    setEditModalOpen(false);
  };

  const flagNutrient = async (fieldId, rowId, plantIndex, nutrientName) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const scheduleRef = collection(db, 'schedule');
      const q = query(scheduleRef, where('date', '==', dateStr));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(scheduleRef, {
          date: dateStr,
          drip: `Apply ${nutrientName} via drip`,
          spray: `Recommended: ${nutrientName} spray`,
          field: `Field: ${fieldId}, Row: ${rowId}`,
          note: `Targeted nutrient request for Plant #${plantIndex}`,
          type: 'monitor',
          done: false
        });
      } else {
        const existingDoc = snap.docs[0];
        await updateDoc(existingDoc.ref, {
          note: existingDoc.data().note + ` | Plant #${plantIndex} needs ${nutrientName}`
        });
      }
      updatePlantDetails(fieldId, rowId, plantIndex, { needsNutrients: true });
      alert(`✅ ${nutrientName} task added to tomorrow's schedule for Plant #${plantIndex}`);
    } catch (err) {
      console.error('Failed to flag nutrient:', err);
      alert('Failed to schedule nutrient.');
    }
  };

  const getPlantClass = (plant) => {
    if (plant.defect) return 'pc-issue';
    if (plant.redFruits > 2) return 'pc-harvest';
    if (plant.flowers > 3) return 'pc-flower';
    return 'pc-ok';
  };

  if (loading) return <div className="card"><div className="center" style={{ padding: '40px' }}>Loading grid...</div></div>;

  const selectedField = fields.find(f => f.id === selectedFieldId);
  const isBlockBased = selectedField?.hasBlocks === true;
  const blockCount = selectedField?.blocksPerField || 0;
  const blockOptions = Array.from({ length: blockCount }, (_, i) => `block_${i + 1}`);
  let rowCount = 0;
  if (isBlockBased) {
    rowCount = selectedField?.rowsPerBlock || 0;
  } else {
    rowCount = selectedField?.totalRows || 1;
  }
  const rowOptions = Array.from({ length: rowCount }, (_, i) => `row_${i + 1}`);

  const displayPlants = plants.slice(0, sampleSize);

  // ─── Resolve human-readable names for QR code ──────────
  const fieldName = selectedField?.name || selectedFieldId;
  const blockName = selectedBlockId ? `Block ${selectedBlockId.replace('block_', '')}` : '';
  const rowNumber = selectedRowId ? selectedRowId.replace('row_', '') : '';

  return (
    <div className="card">
      <div className="card-title">🌱 Crop Monitoring</div>

      {/* ─── Field, Block, Row Selectors ─── */}
      <div className="row" style={{ marginBottom: '20px' }}>
        <div className="fg" style={{ flex: 1 }}><label>Select Field</label>
          <select value={selectedFieldId} onChange={e => setSelectedFieldId(e.target.value)}>
            <option value="">Select a field</option>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {isBlockBased && <div className="fg" style={{ flex: 1 }}><label>Select Block</label>
          <select value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)}>
            <option value="">Select a block</option>
            {blockOptions.map(blockId => <option key={blockId} value={blockId}>Block {blockId.replace('block_', '')}</option>)}
          </select>
        </div>}
        <div className="fg" style={{ flex: 1 }}><label>Select Row</label>
          <select value={selectedRowId} onChange={e => setSelectedRowId(e.target.value)}>
            <option value="">Select a row</option>
            {rowOptions.map(rowId => <option key={rowId} value={rowId}>Row {rowId.replace('row_', '')}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Sample Size ────────────────────────────────── */}
      <div className="between mb16">
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Plants displayed: {displayPlants.length} / {plants.length}</span>
        <select value={sampleSize} onChange={e => setSampleSize(Number(e.target.value))} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
          {[10, 25, 50, 100].filter(n => n <= plants.length).map(n => <option key={n} value={n}>{n} plants</option>)}
          <option value={plants.length}>{plants.length} (All)</option>
        </select>
      </div>

      {/* ─── Stats Cards ────────────────────────────────── */}
      <div className="stat-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderTop: '4px solid #1a73e8' }}><div className="stat-num" style={{ color: '#1a73e8' }}>{extrapolatedData.healthy}</div><div className="stat-lbl">Healthy</div></div>
        <div className="stat-card" style={{ borderTop: '4px solid #ea4335' }}><div className="stat-num" style={{ color: '#ea4335' }}>{extrapolatedData.issues}</div><div className="stat-lbl">Issues</div></div>
        <div className="stat-card" style={{ borderTop: '4px solid #fbbc04' }}><div className="stat-num" style={{ color: '#fbbc04' }}>{extrapolatedData.flowering}</div><div className="stat-lbl">Flowers</div></div>
        <div className="stat-card" style={{ borderTop: '4px solid #34a853' }}><div className="stat-num" style={{ color: '#34a853' }}>{summary.greenFruits}</div><div className="stat-lbl">Green</div></div>
        <div className="stat-card" style={{ borderTop: '4px solid #7e22ce' }}><div className="stat-num" style={{ color: '#7e22ce' }}>{extrapolatedData.ready}</div><div className="stat-lbl">Ready</div></div>
      </div>

      {/* ─── Middle Section ──────────────────────────────── */}
      <div className="g2 mb20">
        <div className="card">
          <div className="card-title">🌾 Farm Analytics</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '15px' }}>
            <Ring pct={extrapolatedData.healthPercent} color="#1a73e8" size={80} label="Healthy" sub={`${extrapolatedData.healthy} plants`} />
            <Ring pct={extrapolatedData.harvestPercent} color="#7e22ce" size={80} label="Harvest Ready" sub={`${extrapolatedData.ready} plants`} />
            <Ring pct={extrapolatedData.yieldScorePercent} color="#fbbc04" size={80} label="Yield Score" sub={`${extrapolatedData.yieldScorePercent}%`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px' }}>
            <div><span style={{ color: 'var(--muted)', fontSize: '12px' }}>Est. Red Fruits</span><div style={{ fontWeight: 700 }}>{extrapolatedData.redFruits}</div></div>
            <div><span style={{ color: 'var(--muted)', fontSize: '12px' }}>Est. Yield</span><div style={{ fontWeight: 700 }}>{extrapolatedData.yield} kg</div></div>
            <div><span style={{ color: 'var(--muted)', fontSize: '12px' }}>Est. Revenue</span><div style={{ fontWeight: 700 }}>₹{extrapolatedData.revenue.toLocaleString()}</div></div>
            <div><span style={{ color: 'var(--muted)', fontSize: '12px' }}>Issue Plants</span><div style={{ fontWeight: 700 }}>{extrapolatedData.issues} plants</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">⚠️ Defect Summary</div>
          <div style={{ marginBottom: '15px' }}>
            {Object.keys(summary.defectCounts).length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>No defects reported in this sample.</div>
            ) : (
              Object.entries(summary.defectCounts).map(([defect, count]) => (
                <div key={defect} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '14px' }}>{defect}</span>
                  <span className="badge bg-red" style={{ fontSize: '12px' }}>{count} plants</span>
                </div>
              ))
            )}
          </div>
          <button className="btn btn-gold btn-sm" style={{ width: '100%' }} onClick={handleAIFarmAdvice} disabled={aiLoading}>
            {aiLoading ? '🤔 Analyzing...' : '🤖 AI Farm Advice'}
          </button>
        </div>
      </div>

      {aiResp && (
        <div className="ai-box" style={{ marginBottom: '15px' }}>
          <div className="ai-lbl">🤖 AI Suggestion</div>
          <div className="ai-txt">{aiResp}</div>
        </div>
      )}

      {/* ─── Delete Options ─────────────────────────────── */}
      <div className="row" style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <button className="btn btn-outline btn-sm" onClick={handleBulkDeleteSelected} disabled={selectedPlantIndices.length === 0 || isDeleting}>
          🗑️ Delete Selected ({selectedPlantIndices.length})
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => setClearModalOpen(true)}>
          🧹 Clear All Plants (Row)
        </button>
      </div>

      {/* ─── Plant Grid Controls ────────────────────────── */}
      <div className="between mb16">
        <div className="row">
          <PlantFilterBar
            filterType={filterType}
            onFilterChange={setFilterType}
            selectAll={selectAll}
            onSelectAllChange={handleSelectAll}
            totalCount={displayPlants.length}
            filteredCount={filteredPlants.length}
          />
        </div>
        <div className="row">
          <button className="btn btn-gold btn-sm" onClick={handleBulkAIRecommendation} disabled={aiLoading}>
            {aiLoading ? '🤔 Analyzing...' : '🧪 Recommend Selected'}
          </button>
          <BulkQRPrint
            plants={getSelectedPlants().map(p => ({
              fieldId: selectedFieldId,
              blockId: selectedBlockId || null,
              rowId: selectedRowId,
              plantIndex: p.index,
            }))}
            onComplete={(count) => alert(`✅ ${count} QR codes printed!`)}
            onError={(err) => alert('Failed to print QR codes.')}
          />
          <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Clear Selection</button>
        </div>
      </div>

      {/* ─── Plant Grid ──────────────────────────────────── */}
      <div className="plant-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(displayPlants.length, 15)}, 1fr)`, gap: '4px', marginBottom: '20px' }}>
        {displayPlants.map((plant) => (
          <PlantCell
            key={plant.index}
            plant={plant}
            isSelected={selectedPlantIndices.includes(plant.index)}
            onToggle={() => togglePlantSelection(plant.index)}
            onClick={() => handlePlantClick(plant)}
            getPlantClass={getPlantClass}
          />
        ))}
      </div>

      {displayPlants.length === 0 && (
        <div className="empty-state" style={{ marginTop: '-15px', marginBottom: '15px' }}>
          <div className="empty-icon">🌱</div>
          <p>No plants match the current filter.</p>
        </div>
      )}

      {/* ─── Top Yielding Plants ────────────────────────── */}
      <div className="card" style={{ background: 'var(--warning-pale)', border: '1px solid var(--warning)' }}>
        <div className="card-title">🏆 Top 5 Yielding Plants</div>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          {summary.topYieldPlants.map((plant, idx) => (
            <div key={plant.index} style={{ flex: 1, minWidth: '80px', textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px', boxShadow: 'var(--sh-sm)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Plant #{plant.index}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{plant.yieldGrams || 0}g</div>
              <div className="badge bg-gold" style={{ fontSize: '10px' }}>#{idx + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Edit Modal ──────────────────────────────────── */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Plant #${selectedPlant?.index} Details`} size="modal-md"
        footer={<><button className="btn btn-primary" onClick={saveEdit}>💾 Save Plant</button><button className="btn btn-ghost" onClick={() => setEditModalOpen(false)}>Close</button></>}>
        {selectedPlant && (
          <div>
            <div className="fr2">
              <div className="fg"><label>🌸 Flowers</label><input type="number" value={editForm.flowers || 0} onChange={e => setEditForm(p => ({ ...p, flowers: +e.target.value }))} /></div>
              <div className="fg"><label>🟢 Green Fruits</label><input type="number" value={editForm.greenFruits || 0} onChange={e => setEditForm(p => ({ ...p, greenFruits: +e.target.value }))} /></div>
            </div>
            <div className="fr2">
              <div className="fg"><label>🍓 Red Fruits</label><input type="number" value={editForm.redFruits || 0} onChange={e => setEditForm(p => ({ ...p, redFruits: +e.target.value }))} /></div>
              <div className="fg"><label>⚖️ Yield (grams)</label><input type="number" value={editForm.yieldGrams || 0} onChange={e => setEditForm(p => ({ ...p, yieldGrams: +e.target.value }))} /></div>
            </div>
            <div className="fg"><label>⚠️ Defect</label>
              <select value={editForm.defect || ""} onChange={e => setEditForm(p => ({ ...p, defect: e.target.value }))}>
                <option value="">Healthy</option>
                <option value="slug damage">Slug Damage</option>
                <option value="aphids">Aphids</option>
                <option value="grey mould">Grey Mould</option>
                <option value="leaf curl">Leaf Curl</option>
                <option value="caterpillar">Caterpillar</option>
                <option value="root rot">Root Rot</option>
                <option value="mites">Spider Mites</option>
              </select>
            </div>

            {/* ─── QR GENERATOR ────────────────────────────── */}
            <div className="card" style={{ marginTop: '15px', background: 'var(--primary-pale)' }}>
              <QRCodeGenerator
                fieldName={fieldName}
                blockName={blockName}
                rowNumber={rowNumber}
                plantIndex={selectedPlant?.index}
                size={100}
              />
            </div>

            {/* ─── AI RECOMMENDATION PANEL (Phase 5) ────────── */}
            <div className="card" style={{ marginTop: '15px', background: 'var(--primary-pale)', border: '1px solid var(--primary)' }}>
              <div className="card-title">🤖 AI Recommendation</div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                  className="btn btn-gold btn-sm"
                  onClick={handleSingleAIAnalysis}
                  disabled={aiAnalysisLoading}
                >
                  {aiAnalysisLoading ? 'Analyzing...' : 'Generate AI Recommendation'}
                </button>
                {aiAnalysisResponse && aiAnalysisResponse.status === 'pending' && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={handleApproveAI}>✅ Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={handleRejectAI}>❌ Reject</button>
                  </>
                )}
              </div>
              {aiAnalysisError && (
                <div className="alert a-err" style={{ marginBottom: '10px' }}>{aiAnalysisError}</div>
              )}
              {aiAnalysisResponse && (
                <div className="ai-box" style={{ marginTop: '10px' }}>
                  <div className="ai-lbl">
                    🤖 AI Suggestion (via {aiAnalysisResponse.provider})
                    <span style={{ float: 'right', fontSize: '10px' }}>
                      Status: {aiAnalysisResponse.status}
                    </span>
                  </div>
                  <div className="ai-txt">
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>
                      {JSON.stringify(aiAnalysisResponse.response, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="card" style={{ marginTop: '15px', background: 'var(--gold-pale)', border: '1px solid var(--gold)' }}>
              <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>🧪 Schedule Nutrient Application</h4>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                Clicking a button below will add a task to <strong>tomorrow's schedule</strong> for this specific plant.
              </p>
              <div className="row" style={{ gap: '10px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => flagNutrient(selectedFieldId, selectedRowId, selectedPlant.index, 'Boron (20%)')}>🌱 Flag for Boron</button>
                <button className="btn btn-sage btn-sm" onClick={() => flagNutrient(selectedFieldId, selectedRowId, selectedPlant.index, 'Nitrogen (NIXI)')}>🌱 Flag for Nitrogen</button>
                <button className="btn btn-gold btn-sm" onClick={() => flagNutrient(selectedFieldId, selectedRowId, selectedPlant.index, 'Potassium (SOP)')}>🌱 Flag for Potassium</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Delete Modal ────────────────────────────────── */}
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Plant"
        message="Are you sure you want to delete this plant?"
        itemName={deleteItemName}
      />

      {/* ─── Clear All Plants Modal ────────────────────── */}
      <Modal open={clearModalOpen} onClose={() => { setClearModalOpen(false); setClearPassword(''); setClearError(''); }} title="🧹 Clear All Plants" size="modal-sm"
        footer={<>
          <button className="btn btn-danger" onClick={handleClearAllPlants} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Clear All Plants'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setClearModalOpen(false); setClearPassword(''); setClearError(''); }}>Cancel</button>
        </>}>
        <div className="alert a-warn mb16">This will permanently delete all plants in the selected row.</div>
        {clearError && <div className="alert a-err mb16">{clearError}</div>}
        <div className="fg">
          <label>Enter your Super Admin password to confirm:</label>
          <input type="password" value={clearPassword} onChange={e => setClearPassword(e.target.value)} placeholder="Password" />
        </div>
      </Modal>
    </div>
  );
};

export default CropPage;
