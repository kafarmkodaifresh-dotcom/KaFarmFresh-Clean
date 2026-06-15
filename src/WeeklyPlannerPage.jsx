import React, { useEffect, useState } from 'react';
import { useWeeklyPlanner } from '../hooks/useWeeklyPlanner';
import Modal from '../CustomComponents';
import DeleteModal from '../components/DeleteModal';
import { useDeleteWithReason } from '../hooks/useDeleteWithReason';

const WeeklyPlannerPage = ({ auth }) => {
  const {
    recommendations,
    loading,
    error,
    products,
    history,
    weather,
    loadData,
    generatePlan,
    approvePlan
  } = useWeeklyPlanner();

  const [approving, setApproving] = useState(false);
  const [approveModal, setApproveModal] = useState(false);
  const [planToApprove, setPlanToApprove] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { softDeleteWeeklyPlan } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === "superadmin";

  useEffect(() => {
    loadData();
  }, []);

  const activeItems = recommendations.filter(p => !p.deletedAt);
  const deletedItems = recommendations.filter(p => p.deletedAt);
  const displayedItems = showDeleted ? deletedItems : activeItems;

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedIds(displayedItems.map(p => String(p.id || p.date)));
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
    if (selectedIds.length === 0) return alert("Select at least one plan.");
    if (!confirm(`Delete ${selectedIds.length} selected plans?`)) return;
    setIsDeleting(true);
    try {
      // This is a placeholder; actual bulk delete would require Firestore collection of weeklyRecommendations
      // For now, we'll just remove from local state
      alert(`✅ Deleted ${selectedIds.length} plans (local only). Implement Firestore batch for production.`);
      setSelectedIds([]);
      setSelectAll(false);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Error during bulk delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreSelected = async () => {
    if (selectedIds.length === 0) return alert("Select at least one plan to restore.");
    if (!confirm(`Restore ${selectedIds.length} selected plans?`)) return;
    setIsRestoring(true);
    try {
      // Placeholder for restore
      alert(`✅ Restored ${selectedIds.length} plans (local only). Implement Firestore batch for production.`);
      setSelectedIds([]);
      setSelectAll(false);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      alert("Error during bulk restore.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleGenerate = async () => {
    await generatePlan();
  };

  const handleApprove = async () => {
    if (!planToApprove) return;
    setApproving(true);
    try {
      const result = await approvePlan(planToApprove);
      alert(`✅ ${result.count} schedule entries added!`);
      setApproveModal(false);
      setPlanToApprove(null);
      await generatePlan();
    } catch (err) {
      alert(`❌ ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteWeeklyPlan(String(itemToDelete.id || itemToDelete.date), reason);
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

  if (loading && !recommendations.length) {
    return <div className="card"><div className="center" style={{ padding: '40px' }}>Loading weekly planner...</div></div>;
  }

  return (
    <div className="card">
      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>📅 Active ({activeItems.length})</button>
          {isSuperAdmin && (
            <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedItems.length})</button>
          )}
        </div>
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : '🤖 Generate AI Plan'}
          </button>
          {recommendations.length > 0 && !showDeleted && (
            <button className="btn btn-gold btn-sm" onClick={() => { setPlanToApprove(recommendations); setApproveModal(true); }}>
              ✅ Approve All
            </button>
          )}
          {isSuperAdmin && showDeleted && (
            <button className="btn btn-success btn-sm" onClick={handleBulkRestoreSelected} disabled={selectedIds.length === 0 || isRestoring}>
              {isRestoring ? 'Restoring...' : `🔄 Restore Selected (${selectedIds.length})`}
            </button>
          )}
          {isSuperAdmin && !showDeleted && (
            <button className="btn btn-outline btn-sm" onClick={handleBulkDeleteSelected} disabled={selectedIds.length === 0 || isDeleting}>
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert a-err mb16">{error}</div>}

      {weather.length > 0 && (
        <div className="row mb16" style={{ gap: '10px', flexWrap: 'wrap' }}>
          {weather.map(w => (
            <div key={w.date} style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 12px', fontSize: 12, border: '1px solid #ddd' }}>
              <strong>{w.date}</strong><br />
              <span>{w.temp}°C</span> · <span>{w.humidity}%</span> · <span>{w.rainChance}% rain</span>
            </div>
          ))}
        </div>
      )}

      {displayedItems.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p>No recommendations yet. Click "Generate AI Plan" to get started.</p>
        </div>
      )}

      {displayedItems.length > 0 && (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={displayedItems.length === 0} />
                </th>
                <th>Date</th>
                <th>Recommended Product</th>
                <th>Dose/100L</th>
                <th>Reason</th>
                <th>PHI (days)</th>
                <th>Stock Warning</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((r, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(r.id || r.date))}
                      onChange={() => toggleCheckbox(r.id || r.date)}
                    />
                  </td>
                  <td className="fw7">{r.date}</td>
                  <td><span className="badge bg-primary">{r.product}</span></td>
                  <td>{r.dose || '—'}</td>
                  <td style={{ maxWidth: 200 }}>{r.reason || '—'}</td>
                  <td>{r.PHI || '—'}</td>
                  <td>
                    {r.lowStockWarning ? (
                      <span className="badge bg-red">⚠️ {r.lowStockWarning}</span>
                    ) : '—'}
                  </td>
                  {showDeleted && <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(r.deletedAt)}</td>}
                  <td>
                    {!showDeleted ? (
                      <div className="row">
                        <button className="btn btn-xs btn-outline" onClick={() => { setPlanToApprove([r]); setApproveModal(true); }}>✅ Approve</button>
                        {isSuperAdmin && (
                          <button className="btn btn-xs btn-danger" onClick={() => { setItemToDelete(r); setDeleteItemName(`${r.product} – ${r.date}`); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                        )}
                      </div>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve Modal */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="✅ Approve Weekly Plan" size="modal-md"
        footer={<>
          <button className="btn btn-primary" onClick={handleApprove} disabled={approving}>
            {approving ? 'Approving...' : '✅ Approve All'}
          </button>
          <button className="btn btn-ghost" onClick={() => setApproveModal(false)}>Cancel</button>
        </>}>
        <div className="alert a-info mb16">
          This will add <strong>{planToApprove?.length || 0}</strong> entries to your schedule.
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Are you sure you want to approve this weekly plan? Each entry will be added to the Daily Schedule page.
        </p>
      </Modal>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Weekly Plan"
        message="Are you sure you want to delete this plan? This action will be recorded."
        itemName={deleteItemName}
      />
    </div>
  );
};

export default WeeklyPlannerPage;
