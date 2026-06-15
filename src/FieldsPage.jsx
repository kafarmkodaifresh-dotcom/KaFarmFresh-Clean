import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import Modal from './CustomComponents';
import DeleteModal from './components/DeleteModal';
import { useDeleteWithReason } from './hooks/useDeleteWithReason';
import { fmtDate } from './utils';

const FieldsPage = ({ auth }) => {
  const [fields, setFields] = useState([]);
  const [fieldName, setFieldName] = useState('');
  const [hasBlocks, setHasBlocks] = useState(false);
  const [blocksPerField, setBlocksPerField] = useState(1);
  const [rowsPerBlock, setRowsPerBlock] = useState(1);
  const [plantsPerRow, setPlantsPerRow] = useState(50);
  const [blockInputs, setBlockInputs] = useState([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [selectAllFields, setSelectAllFields] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteItemName, setDeleteItemName] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearError, setClearError] = useState('');

  const { softDeleteField } = useDeleteWithReason(auth);
  const isSuperAdmin = auth?.role === 'superadmin';

  // ─── Load Fields ──────────────────────────────────────
  useEffect(() => {
    const loadFields = async () => {
      try {
        const snap = await getDocs(collection(db, 'fields'));
        const fieldData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setFields(fieldData);
        setSelectedFieldIds([]);
        setSelectAllFields(false);
      } catch (err) {
        console.error('Failed to load fields:', err);
      }
    };
    loadFields();
  }, []);

  // ─── Block/Rows Input Initialization ──────────────────
  useEffect(() => {
    const totalBlocks = parseInt(blocksPerField) || 1;
    const newBlockInputs = Array.from({ length: totalBlocks }, () =>
      Array.from({ length: parseInt(rowsPerBlock) || 1 }, () => plantsPerRow)
    );
    setBlockInputs(newBlockInputs);
  }, [blocksPerField, rowsPerBlock, plantsPerRow]);

  const handleBlockInput = (blockIndex, rowIndex, value) => {
    const newBlockInputs = [...blockInputs];
    newBlockInputs[blockIndex][rowIndex] = parseInt(value) || 0;
    setBlockInputs(newBlockInputs);
  };

  // ─── Display Helpers ─────────────────────────────────
  const activeFields = fields.filter(f => !f.deletedAt);
  const deletedFields = fields.filter(f => f.deletedAt);
  const displayedFields = showDeleted ? deletedFields : activeFields;

  // ─── Handlers ─────────────────────────────────────────
  const handleSelectAll = (checked) => {
    setSelectAllFields(checked);
    if (checked) {
      setSelectedFieldIds(displayedFields.map(f => String(f.id)));
    } else {
      setSelectedFieldIds([]);
    }
  };

  const toggleFieldCheckbox = (id) => {
    const strId = String(id);
    setSelectedFieldIds(prev => {
      const newSelection = prev.includes(strId)
        ? prev.filter(pid => pid !== strId)
        : [...prev, strId];
      setSelectAllFields(newSelection.length === displayedFields.length);
      return newSelection;
    });
  };

  const verifyPassword = (password) => {
    try {
      const users = JSON.parse(localStorage.getItem('auth_users') || '[]');
      const user = users.find(u => u.id === auth?.id);
      if (!user) return false;
      return bcrypt.compareSync(password, user.password);
    } catch {
      return false;
    }
  };

  // ─── Add Field ────────────────────────────────────────
  const addField = async () => {
    if (!fieldName.trim()) return alert('Please enter a field name.');
    if (!hasBlocks) return alert('Please enable blocks for flexible row counts.');
    if (activeFields.some(f => f.name === fieldName)) return alert(`Field "${fieldName}" already exists.`);

    try {
      const fieldRef = await addDoc(collection(db, 'fields'), {
        name: fieldName,
        hasBlocks: true,
        blocksPerField: parseInt(blocksPerField),
        rowsPerBlock: parseInt(rowsPerBlock),
        createdAt: new Date().toISOString()
      });

      const batch = writeBatch(db);
      const numBlocks = parseInt(blocksPerField);
      const numRows = parseInt(rowsPerBlock);

      for (let b = 0; b < numBlocks; b++) {
        const blockId = `block_${b + 1}`;
        const blockRef = doc(db, 'fields', fieldRef.id, 'blocks', blockId);
        batch.set(blockRef, {
          name: `Block ${b + 1}`,
          rowCount: numRows,
          createdAt: serverTimestamp()
        });

        for (let r = 0; r < numRows; r++) {
          const rowId = `row_${r + 1}`;
          const rowRef = doc(db, 'fields', fieldRef.id, 'blocks', blockId, 'rows', rowId);
          const plantCount = blockInputs[b]?.[r] || 50;
          const newPlants = Array.from({ length: plantCount }, (_, i) => ({
            index: i + 1,
            status: 'healthy',
            flowers: Math.floor(Math.random() * 6),
            greenFruits: Math.floor(Math.random() * 4),
            redFruits: Math.floor(Math.random() * 2),
            defect: '',
            yieldGrams: Math.floor(Math.random() * 280 + 50),
            deletedAt: null,
          }));
          batch.set(rowRef, { rowNumber: r + 1, plantCount, plants: newPlants });
        }
      }
      await batch.commit();

      const snap = await getDocs(collection(db, 'fields'));
      setFields(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFieldName('');
      alert(`✅ Field "${fieldName}" created.`);
    } catch (err) {
      console.error('Field creation failed:', err);
      alert('Failed to create field.');
    }
  };

  // ─── Bulk Delete Fields ──────────────────────────────
  const handleBulkDeleteFields = async (password) => {
    if (!isSuperAdmin) return alert('Only Super Admin can perform this action.');
    if (!verifyPassword(password)) { setClearError('Incorrect password.'); return; }
    if (selectedFieldIds.length === 0) return alert('Select at least one field.');
    if (!confirm(`Delete ${selectedFieldIds.length} selected fields?`)) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedFieldIds.forEach(id => {
        const ref = doc(db, 'fields', String(id));
        batch.update(ref, {
          deletedAt: serverTimestamp(),
          deletedBy: auth?.name || 'unknown',
          changeReason: 'Bulk delete by selection'
        });
      });
      await batch.commit();
      setSelectedFieldIds([]);
      setSelectAllFields(false);
      setClearModalOpen(false);
      setClearPassword('');
      setClearError('');
      const snap = await getDocs(collection(db, 'fields'));
      setFields(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      alert(`✅ Deleted ${selectedFieldIds.length} fields.`);
    } catch (error) {
      console.error('Bulk field delete failed:', error);
      alert('Error during bulk delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Single Field Delete ─────────────────────────────
  const handleDeleteConfirm = async (reason) => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteField(String(itemToDelete.id), reason);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      setDeleteItemName('');
      const snap = await getDocs(collection(db, 'fields'));
      setFields(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="card">
        <div className="empty-state"><div className="empty-icon">🔒</div><p>Only Super Admin can access Field Management.</p></div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">🌾 Field & Row Management</h2>

      <div className="between mb16">
        <div className="row">
          <button className={`btn btn-sm ${!showDeleted ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDeleted(false)}>🌱 Active ({activeFields.length})</button>
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setShowDeleted(true)}>🗑️ Deleted ({deletedFields.length})</button>
        </div>
        <div className="row">
          <button className="btn btn-danger btn-sm" onClick={() => setClearModalOpen(true)}>🗑️ Bulk Delete Selected ({selectedFieldIds.length})</button>
        </div>
      </div>

      {!showDeleted && (
        <>
          <div className="form-row" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label>Field Name</label>
              <input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="e.g., Vattakanal" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Enable Blocks</label>
              <input type="checkbox" checked={hasBlocks} onChange={e => setHasBlocks(e.target.checked)} />
            </div>
          </div>

          {hasBlocks && (
            <div className="form-row" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label>Blocks per Field</label>
                <input type="number" min="1" value={blocksPerField} onChange={e => setBlocksPerField(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Rows per Block</label>
                <input type="number" min="1" value={rowsPerBlock} onChange={e => setRowsPerBlock(e.target.value)} />
              </div>
            </div>
          )}

          {hasBlocks && blockInputs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4>Define Plants per Row:</h4>
              {blockInputs.map((blockRows, blockIndex) => (
                <div key={blockIndex} style={{ marginBottom: 10, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
                  <strong>Block {blockIndex + 1}</strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {blockRows.map((count, rowIndex) => (
                      <div key={rowIndex} style={{ flex: '1 1 60px' }}>
                        <label style={{ fontSize: 10 }}>Row {rowIndex + 1}</label>
                        <input
                          type="number"
                          min="1"
                          value={count}
                          onChange={e => handleBlockInput(blockIndex, rowIndex, e.target.value)}
                          style={{ width: '100%', padding: 4, fontSize: 12 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-primary" onClick={addField} disabled={!hasBlocks}>➕ Add Field</button>
        </>
      )}

      <div style={{ marginTop: 20 }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>
                  <input
                    type="checkbox"
                    checked={selectAllFields}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={displayedFields.length === 0}
                  />
                </th>
                <th>Field Name</th>
                <th>Structure</th>
                <th>Created</th>
                {showDeleted && <th>Deleted At</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedFields.map(f => (
                <tr key={f.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedFieldIds.includes(String(f.id))}
                      onChange={() => toggleFieldCheckbox(f.id)}
                    />
                  </td>
                  <td><strong>{f.name}</strong></td>
                  <td>
                    <span className="badge bg-blue">{f.blocksPerField || 0} blocks × {f.rowsPerBlock || 0} rows</span>
                  </td>
                  <td className="muted">{f.createdAt ? fmtDate(f.createdAt) : 'N/A'}</td>
                  {showDeleted && <td style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(f.deletedAt?.toDate?.() || f.deletedAt)}</td>}
                  <td>
                    {!showDeleted ? (
                      <button className="btn btn-danger btn-xs" onClick={() => { setItemToDelete(f); setDeleteItemName(f.name); setDeleteModalOpen(true); }} disabled={isDeleting}>🗑️</button>
                    ) : (
                      <span className="badge bg-gray">Deleted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Field"
        message="Are you sure you want to delete this field?"
        itemName={deleteItemName}
      />

      <Modal open={clearModalOpen} onClose={() => { setClearModalOpen(false); setClearPassword(''); setClearError(''); }} title="🧹 Bulk Delete" size="modal-sm"
        footer={<>
          <button className="btn btn-danger" onClick={() => handleBulkDeleteFields(clearPassword)} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setClearModalOpen(false); setClearPassword(''); setClearError(''); }}>Cancel</button>
        </>}>
        <div className="alert a-warn mb16">This will soft-delete the selected Field(s).</div>
        {clearError && <div className="alert a-err mb16">{clearError}</div>}
        <div className="fg">
          <label>Enter your Super Admin password to confirm:</label>
          <input type="password" value={clearPassword} onChange={e => setClearPassword(e.target.value)} placeholder="Password" />
        </div>
      </Modal>
    </div>
  );
};

export default FieldsPage;
