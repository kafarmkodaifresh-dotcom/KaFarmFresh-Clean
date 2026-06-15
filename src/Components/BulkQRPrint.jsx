import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 5;
const GAP_MM = 4;
const COLS = 3;
const ROWS = 5;

const AVAILABLE_WIDTH = PAGE_WIDTH_MM - 2 * MARGIN_MM;
const AVAILABLE_HEIGHT = PAGE_HEIGHT_MM - 2 * MARGIN_MM;
const CELL_WIDTH = (AVAILABLE_WIDTH - (COLS - 1) * GAP_MM) / COLS;
const CELL_HEIGHT = (AVAILABLE_HEIGHT - (ROWS - 1) * GAP_MM) / ROWS;
const QR_SIZE_MM = Math.min(CELL_WIDTH, CELL_HEIGHT - 8);

export const generateBulkQRPrint = async (plants) => {
  if (!Array.isArray(plants) || plants.length === 0) {
    throw new Error('No plants provided for QR generation.');
  }

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${PAGE_WIDTH_MM}mm`;
  container.style.height = `${PAGE_HEIGHT_MM}mm`;
  container.style.background = '#ffffff';
  container.style.padding = `${MARGIN_MM}mm`;
  container.style.boxSizing = 'border-box';
  document.body.appendChild(container);

  const roots = [];

  try {
    plants.forEach((plant, index) => {
      const plantIdentifier = [plant.fieldId, plant.blockId, plant.rowId, plant.plantIndex].filter(Boolean).join('|');

      const cell = document.createElement('div');
      cell.style.cssText = `
        display: inline-block;
        width: ${CELL_WIDTH}mm;
        height: ${CELL_HEIGHT}mm;
        vertical-align: top;
        margin-right: ${GAP_MM}mm;
        margin-bottom: ${GAP_MM}mm;
        box-sizing: border-box;
      `;
      if (index % COLS === COLS - 1) {
        cell.style.marginRight = '0';
      }

      const qrDiv = document.createElement('div');
      qrDiv.style.cssText = `
        display: flex;
        flexDirection: column;
        alignItems: center;
        justifyContent: center;
        height: 100%;
        width: 100%;
      `;

      cell.appendChild(qrDiv);
      container.appendChild(cell);

      const root = createRoot(qrDiv);
      roots.push(root);
      root.render(
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
          <div style={{ height: `${QR_SIZE_MM}mm`, width: `${QR_SIZE_MM}mm`, flexShrink: 0 }}>
            <QRCodeCanvas
              value={plantIdentifier}
              size={QR_SIZE_MM * 3.7795}
              bgColor="#ffffff"
              fgColor="#1a73e8"
              level="L"
              includeMargin={true}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div style={{ fontSize: '6px', fontFamily: 'monospace', color: '#555', marginTop: '2mm', wordBreak: 'break-all', textAlign: 'center', maxWidth: '100%' }}>
            {plantIdentifier}
          </div>
        </div>
      );
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups for printing.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Bulk QR Codes</title>
          <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #ffffff; }
            img { max-width: 100%; max-height: 100%; }
          </style>
        </head>
        <body>
          <img src="${imgData}" alt="Bulk QR Codes" />
        </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
    };

  } catch (error) {
    console.error('Bulk QR generation error:', error);
    throw error;
  } finally {
    setTimeout(() => {
      roots.forEach(r => r.unmount());
      document.body.removeChild(container);
    }, 1000);
  }
};

const BulkQRPrint = ({ plants, onComplete, onError }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!Array.isArray(plants) || plants.length === 0) {
      setError('No plants selected.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await generateBulkQRPrint(plants);
      if (onComplete) onComplete(plants.length);
    } catch (err) {
      setError(err.message || 'Failed to generate QR print.');
      if (onError) onError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : '🖨️ Print QR (Bulk)'}
      </button>
      {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>{error}</div>}
    </div>
  );
};

export default BulkQRPrint;
