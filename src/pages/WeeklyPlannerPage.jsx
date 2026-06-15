import React, { useEffect, useState } from 'react';
import { useWeeklyPlanner } from '../hooks/useWeeklyPlanner';
import Modal from '../CustomComponents';

const WeeklyPlannerPage = () => {
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

  useEffect(() => {
    loadData();
  }, []);

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
      // Refresh the plan after approval
      await generatePlan();
    } catch (err) {
      alert(`❌ ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  if (loading && !recommendations.length) {
    return <div className="card"><div className="center" style={{ padding: '40px' }}>Loading weekly planner...</div></div>;
  }

  return (
    <div className="card">
      <div className="between mb16">
        <h2 className="card-title">📅 Weekly Planner</h2>
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : '🤖 Generate AI Plan'}
          </button>
          {recommendations.length > 0 && (
            <button className="btn btn-gold btn-sm" onClick={() => { setPlanToApprove(recommendations); setApproveModal(true); }}>
              ✅ Approve All
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

      {recommendations.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p>No recommendations yet. Click "Generate AI Plan" to get started.</p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Recommended Product</th>
                <th>Dose/100L</th>
                <th>Reason</th>
                <th>PHI (days)</th>
                <th>Stock Warning</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((r, idx) => (
                <tr key={idx}>
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
    </div>
  );
};

export default WeeklyPlannerPage;
