import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const QRCodeGenerator = ({ fieldName, blockName, rowNumber, plantIndex, size = 120, title = 'Plant QR' }) => {
  const [showQR, setShowQR] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const qrContainerRef = useRef(null);

  const plantIdentifier = [fieldName, blockName, rowNumber, plantIndex].filter(Boolean).join('|');

  const handlePrint = async () => {
    if (!qrContainerRef.current || !showQR) {
      alert('Please generate the QR code first.');
      return;
    }

    setIsPrinting(true);
    try {
      const canvas = qrContainerRef.current.querySelector('canvas');
      if (!canvas) {
        alert('QR code not rendered yet. Please try again.');
        setIsPrinting(false);
        return;
      }

      const qrImageData = canvas.toDataURL('image/png');

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow pop-ups for printing.');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: Arial, sans-serif; }
              .container { text-align: center; }
              .qr-img { width: ${size}px; height: ${size}px; }
              .scan-id { font-size: 14px; font-family: monospace; margin-top: 6px; color: #555; }
            </style>
          </head>
          <body>
            <div class="container">
              <img src="${qrImageData}" alt="QR Code" class="qr-img" />
              <div class="scan-id">${plantIdentifier}</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        setIsPrinting(false);
      }, 500);
    } catch (error) {
      console.error('QR print error:', error);
      alert('Failed to print QR. Please check console.');
      setIsPrinting(false);
    }
  };

  const handleGenerate = () => {
    setShowQR(true);
  };

  const handleClose = () => {
    setShowQR(false);
  };

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={handleGenerate} disabled={isPrinting}>
        📱 Generate QR
      </button>

      {showQR && (
        <div
          className="qr-wrapper"
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '12px',
            background: '#fff',
          }}
        >
          <div ref={qrContainerRef} id="qr-container">
            <QRCodeCanvas
              value={plantIdentifier}
              size={size}
              bgColor="#ffffff"
              fgColor="#1a73e8"
              level="L"
              includeMargin={true}
            />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={isPrinting}>
              {isPrinting ? 'Printing...' : '🖨️ Print QR'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleClose}>
              Close
            </button>
          </div>
          <small style={{ marginTop: '6px', color: 'var(--muted)' }}>
            Scan to identify Plant #{plantIndex}
          </small>
        </div>
      )}
    </div>
  );
};

export default QRCodeGenerator;
