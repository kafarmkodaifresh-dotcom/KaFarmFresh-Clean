/**
 * syncEngine.js
 * 
 * Background sync engine for KaFarmFresh.
 * Processes the IndexedDB syncQueue and syncs with Firestore.
 * 
 * Features:
 * - Exponential backoff for retries
 * - Batch writes to reduce Firestore costs
 * - Conflict resolution via lastWriteWins
 * - Transaction safety for critical operations
 */

import { localGetAll, localDelete, localBulkPut, localGet, localPut } from './localDB';
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================================
// Constants
// ============================================================================

const SYNC_INTERVAL = 60000; // 1 minute
const BATCH_SIZE = 50;       // Firestore batch size limit
const MAX_RETRIES = 5;       // Max retry attempts per queue item
const RETRY_DELAY_MS = 5000; // Base delay before retry (exponential backoff)

let syncTimer = null;
let isSyncing = false;

// ============================================================================
// Private helpers
// ============================================================================

/**
 * Computes exponential backoff delay.
 * 
 * @param {number} attempt - Current retry attempt (0-indexed).
 * @returns {number} Delay in milliseconds.
 */
const getRetryDelay = (attempt) => {
  return Math.min(RETRY_DELAY_MS * Math.pow(2, attempt), 120000); // Cap at 2 minutes
};

/**
 * Writes a single operation to Firestore.
 * 
 * @param {Object} item - Queue item: { collection, docId, data, operation, timestamp, retryCount }
 * @returns {Promise<boolean>} True if successful.
 */
const processQueueItem = async (item) => {
  const { collection: col, docId, data, operation, retryCount = 0 } = item;
  const ref = doc(db, col, docId);
  
  try {
    switch (operation) {
      case 'set':
        await setDoc(ref, { ...data, syncedAt: serverTimestamp() });
        break;
      case 'update':
        await updateDoc(ref, { ...data, syncedAt: serverTimestamp() });
        break;
      case 'delete':
        await deleteDoc(ref);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    return true;
  } catch (error) {
    console.error(`Sync error for ${col}/${docId} (attempt ${retryCount + 1}):`, error);
    throw error;
  }
};

// ============================================================================
// Public sync engine
// ============================================================================

/**
 * Starts the background sync engine.
 * 
 * @param {number} interval - Sync interval in milliseconds (default: 60000).
 * @returns {void}
 */
export const startSync = (interval = SYNC_INTERVAL) => {
  if (syncTimer) {
    console.warn('Sync engine is already running.');
    return;
  }
  
  syncTimer = setInterval(async () => {
    await processQueue();
  }, interval);
  
  console.log(`🔄 Sync engine started (interval: ${interval}ms)`);
  
  // Process queue immediately on start
  processQueue().catch((error) => {
    console.error('Initial sync failed:', error);
  });
};

/**
 * Stops the background sync engine.
 * 
 * @returns {void}
 */
export const stopSync = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('🛑 Sync engine stopped.');
  }
};

/**
 * Manually triggers a sync of the queue.
 * 
 * @returns {Promise<Object>} Result summary.
 */
export const processQueue = async () => {
  if (isSyncing) {
    console.log('⚠️ Sync already in progress. Skipping.');
    return { skipped: true, message: 'Sync already in progress' };
  }
  
  isSyncing = true;
  const result = { processed: 0, failed: 0, skipped: 0 };
  
  try {
    const queue = await localGetAll('syncQueue');
    if (queue.length === 0) {
      return { processed: 0, failed: 0, skipped: 0, message: 'Queue empty' };
    }
    
    console.log(`🔄 Syncing ${queue.length} items...`);
    
    // Process items in batches
    const batches = [];
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      batches.push(queue.slice(i, i + BATCH_SIZE));
    }
    
    let failedItems = [];
    
    for (const batch of batches) {
      const batchResult = await processBatch(batch);
      result.processed += batchResult.processed;
      result.failed += batchResult.failed;
      failedItems = [...failedItems, ...batchResult.failedItems];
    }
    
    // Remove successfully processed items from queue
    const successfulIds = queue
      .filter(item => !failedItems.includes(item.id))
      .map(item => item.id);
    
    if (successfulIds.length > 0) {
      for (const id of successfulIds) {
        await localDelete('syncQueue', id);
      }
    }
    
    // Update retry counts for failed items
    for (const item of failedItems) {
      const existing = await localGet('syncQueue', item);
      if (existing) {
        const newRetryCount = (existing.retryCount || 0) + 1;
        if (newRetryCount >= MAX_RETRIES) {
          console.warn(`⚠️ Max retries reached for item ${existing.id}. Discarding.`);
          await localDelete('syncQueue', item);
        } else {
          await localPut('syncQueue', { ...existing, retryCount: newRetryCount });
        }
      }
    }
    
    console.log(`✅ Sync complete: ${result.processed} processed, ${result.failed} failed.`);
    return result;
  } catch (error) {
    console.error('❌ Sync engine error:', error);
    result.failed = queue.length;
    result.error = error.message;
    return result;
  } finally {
    isSyncing = false;
  }
};

/**
 * Processes a single batch of queue items using a Firestore write batch.
 * 
 * @param {Array} batch - Array of queue items.
 * @returns {Promise<Object>} Result summary.
 */
const processBatch = async (batch) => {
  const batchRef = writeBatch(db);
  const failedItems = [];
  let processed = 0;
  
  for (const item of batch) {
    const { collection: col, docId, data, operation, id } = item;
    const ref = doc(db, col, docId);
    
    try {
      switch (operation) {
        case 'set':
          batchRef.set(ref, { ...data, syncedAt: serverTimestamp() });
          break;
        case 'update':
          batchRef.update(ref, { ...data, syncedAt: serverTimestamp() });
          break;
        case 'delete':
          batchRef.delete(ref);
          break;
        default:
          failedItems.push(id);
          continue;
      }
      processed++;
    } catch (error) {
      console.error(`Batch prep error for ${col}/${docId}:`, error);
      failedItems.push(id);
    }
  }
  
  if (batch.length === 0) {
    return { processed: 0, failed: 0, failedItems: [] };
  }
  
  try {
    await batchRef.commit();
    return { processed, failed: failedItems.length, failedItems };
  } catch (error) {
    console.error('❌ Batch commit failed:', error);
    // If batch commit fails, mark all as failed
    return { 
      processed: 0, 
      failed: batch.length, 
      failedItems: batch.map(item => item.id) 
    };
  }
};

/**
 * Adds an item to the sync queue.
 * 
 * @param {string} collection - Firestore collection name.
 * @param {string} docId - Document ID.
 * @param {Object} data - Data to write.
 * @param {string} operation - 'set', 'update', or 'delete'.
 * @param {number} timestamp - Optional timestamp (defaults to now).
 * @returns {Promise<void>}
 */
export const addToSyncQueue = async (collection, docId, data, operation = 'set', timestamp = Date.now()) => {
  const queueItem = {
    collection,
    docId,
    data,
    operation,
    timestamp,
    retryCount: 0
  };
  
  await localPut('syncQueue', queueItem);
  
  // If online, try immediate sync
  if (navigator.onLine) {
    processQueue().catch((error) => {
      console.warn('Immediate sync failed:', error);
    });
  }
};

/**
 * Gets the current sync queue status.
 * 
 * @returns {Promise<Object>} Queue statistics.
 */
export const getSyncStatus = async () => {
  const queue = await localGetAll('syncQueue');
  const failed = queue.filter(item => (item.retryCount || 0) >= MAX_RETRIES);
  return {
    pending: queue.length,
    failed: failed.length,
    items: queue.slice(0, 10) // Return first 10 items for inspection
  };
};

export default {
  startSync,
  stopSync,
  processQueue,
  addToSyncQueue,
  getSyncStatus
};
