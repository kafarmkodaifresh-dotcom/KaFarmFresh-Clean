import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { localGetAll } from '../services/localDB';
import BulkQRPrint from '../components/BulkQRPrint';

const QRManagementPage = ({ auth }) => {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const isSuperAdmin = auth?.role === 'superadmin';

  useEffect(() => {
    const loadPlants = async () => {
      setLoading(true);
      setError(null);
      try {
        let plantData = [];
        const localPlants = await localGetAll('plants');
        if (localPlants && localPlants.length > 0) {
          plantData = localPlants;
        } else {
          const fieldsSnap = await getDocs(collection(db, 'fields'));
          const fields = fieldsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          for (const field of fields) {
            const hasBlocks = field.hasBlocks === true;
            if (hasBlocks) {
              const blocksSnap = await getDocs(collection(db, 'fields', field.id, 'blocks'));
              for (const blockDoc of blocksSnap.docs) {
                const rowsSnap = await getDocs(collection(db, 'fields', field.id, 'blocks', blockDoc.id, 'rows'));
                for (const rowDoc of rowsSnap.docs) {
                  const rowData = rowDoc.data();
                  const plantsInRow = rowData.plants || [];
                  plantsInRow.forEach((p, idx) => {
                    plantData.push({
                      ...p,
                      plantIndex: p.index || idx + 1,
                      fieldId: field.id,
                      blockId: blockDoc.id,
                      rowId: rowDoc.id,
                    });
                  });
                }
              }
            } else {
              const rowsSnap = await getDocs(collection(db, 'fields', field.id, 'rows'));
              for (const rowDoc of rowsSnap.docs) {
                const rowData = rowDoc.data();
                const plantsInRow = rowData.plants || [];
                plantsInRow.forEach((p, idx) => {
                  plantData.push({
                    ...p,
                    plantIndex: p.index || idx + 1,
                    fieldId: field.id,
                    blockId: null,
                    rowId: rowDoc.id,
                  });
                });
              }
            }
          }
        }
        setPlants(plantData);
      } catch (err) {
        console.error('Failed to load plants:', err);
        setError('Unable to load plant data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadPlants();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (selectAll) {
      setSelectedIds(plants.map(p => String(p.plantIndex)));
    }
  }, [selectAll, plants]);

  const togglePlant = (index) => {
    const strId = String(index);
    setSelectedIds(prev =>
      prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
    );
    setSelectAll(false);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectAll(false);
  };

  if (!isSuperAdmin) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <p>Only superadmin can access QR management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="card"><div className="center" style={{ padding: '40px' }}>Loading plants...</div></div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="alert a-err">{error}</div>
        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (plants.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">🌱</div>
          <p>No plants found. Add fields and plants first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">📱 QR Management</div>

      <div className="between mb16">
        <div className="row">
          <span className="badge bg-primary">{plants.length} plants</span>
          {isOffline && <span className="badge bg-red">🔴 Offline</span>}
        </div>
        <div className="row">
          <button className="btn btn-outline btn-sm" onClick={clearSelection} disabled={selectedIds.length === 0}>
            Clear Selected
          </button>
          <BulkQRPrint
            plants={plants.filter(p => selectedIds.includes(String(p.plantIndex)))}
            onComplete={(count) => alert(`✅ ${count} QR codes printed!`)}
            onError={(err) => alert('Failed to print QR codes.')}
          />
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '30px' }}>
                <input type="checkbox" checked={selectAll} onChange={() => setSelectAll(!selectAll)} />
              </th>
              <th>Field</th>
              <th>Block</th>
              <th>Row</th>
              <th>Plant #</th>
              <th>Status</th>
              <th>Defect</th>
              <th>Yield</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p) => (
              <tr key={`${p.fieldId}-${p.blockId}-${p.rowId}-${p.plantIndex}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(String(p.plantIndex))}
                    onChange={() => togglePlant(p.plantIndex)}
                  />
                </td>
                <td>{p.fieldId}</td>
                <td>{p.blockId || '—'}</td>
                <td>{p.rowId}</td>
                <td>{p.plantIndex}</td>
                <td>
                  <span className={`badge ${p.defect ? 'bg-red' : 'bg-green'}`}>
                    {p.defect ? 'Issue' : 'Healthy'}
                  </span>
                </td>
                <td>{p.defect || 'None'}</td>
                <td>{p.yieldGrams || 0}g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QRManagementPage;
