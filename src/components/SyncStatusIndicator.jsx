/**
 * SyncStatusIndicator.jsx
 * 
 * Real-time UI component showing online/offline status and pending sync count.
 * Designed to be placed in the app's topbar.
 * 
 * Features:
 * - Automatic network status detection (online/offline)
 * - Polls IndexedDB for pending sync queue count
 * - Color-coded status indicators
 * - Responsive and mobile-friendly
 * - Self-cleaning interval management
 */

import React, { useState, useEffect, useRef } from 'react';
import { localGetAll } from '../services/localDB';

const POLL_INTERVAL = 10000; // Check queue every 10 seconds

/**
 * SyncStatusIndicator component.
 * 
 * @returns {JSX.Element}
 */
const SyncStatusIndicator = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef(null);

  // --- Network status handlers ---
  const handleOnline = () => {
    setOnline(true);
    console.log('🔗 Network connection restored.');
  };

  const handleOffline = () => {
    setOnline(false);
    console.warn('🔴 Network connection lost.');
  };

  // --- Poll sync queue ---
  const fetchPendingCount = async () => {
    try {
      const queue = await localGetAll('syncQueue');
      const count = Array.isArray(queue) ? queue.length : 0;
      setPendingCount(count);
      if (count > 0) {
        console.log(`⏳ ${count} items pending sync.`);
      }
    } catch (error) {
      console.error('Failed to fetch sync queue count:', error);
      // Do not update state on error — keep previous count
    } finally {
      setIsLoading(false);
    }
  };

  // --- Setup ---
  useEffect(() => {
    // Set initial state
    setOnline(navigator.onLine);
    fetchPendingCount();

    // Add event listeners for network changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start polling for queue updates
    pollTimerRef.current = setInterval(fetchPendingCount, POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []); // Empty dependency array means run once on mount

  // --- Render ---
  return (
    <div className="sync-status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
      {/* Status dot and label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: online ? '#34a853' : '#ea4335',
            boxShadow: online ? '0 0 4px rgba(52, 168, 83, 0.5)' : '0 0 4px rgba(234, 67, 53, 0.5)',
            animation: online ? 'none' : 'pulse 1.5s infinite',
          }}
        />
        <span style={{ fontSize: '11px', fontWeight: 500 }}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Pending count badge */}
      {!isLoading && pendingCount > 0 && (
        <span
          className="badge bg-gold"
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: '#fef7e0',
            color: '#92400e',
            border: '1px solid #fcd34d',
          }}
          title={`${pendingCount} item(s) waiting to sync`}
        >
          {pendingCount}
        </span>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
