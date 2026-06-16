import React from 'react';
import Modal from '../CustomComponents';

const DeleteModal = ({ open, onClose, onConfirm, title, message, itemName = '' }) => {
  const [reason, setReason] = React.useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('Please enter a reason for deletion.');
      return;
    }
    onConfirm(reason);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`🗑️ ${title || 'Delete'}`}
      size="modal-sm"
      footer={
        <>
          <button className="btn btn-danger btn-sm" onClick={handleConfirm}>
            ⚠️ Delete
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>
            Cancel
          </button>
        </>
      }
    >
      <div style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '14px', lineHeight: 1.6 }}>
          {message || 'Are you sure you want to delete this item?'}
          {itemName && <strong style={{ display: 'block', marginTop: '6px' }}>“{itemName}”</strong>}
        </p>
      </div>
      <div className="fg">
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)' }}>
          Reason for deletion *
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you deleting this? (This will be stored for audit)"
          style={{ minHeight: '60px' }}
        />
      </div>
    </Modal>
  );
};

export default DeleteModal;
