/**
 * localDB.js
 * 
 * IndexedDB wrapper for KaFarmFresh.
 * Provides performant, offline-first CRUD operations.
 * All methods return Promises for seamless async/await integration.
 * 
 * Stores:
 * - plants        : keyPath = 'id' (plantId = fieldId|rowId|plantIndex)
 * - syncQueue     : keyPath = 'id' (autoIncrement) — FIFO queue
 * - nutrientHistory: keyPath = 'id' (plantId_timestamp)
 * - schedule      : keyPath = 'id' (schedule entry ID)
 * - weatherCache  : keyPath = 'date' (7-day forecast)
 * - workers       : keyPath = 'id' (workerId)
 */

const DB_NAME = 'KaFarmFreshDB';
const DB_VERSION = 2;  // Incremented for new store

let db = null;
let isOpening = false;
let openPromise = null;

/**
 * Opens the IndexedDB database.
 * Returns a singleton connection to avoid repeated open calls.
 * 
 * @returns {Promise<IDBDatabase>}
 */
export const openDB = () => {
  if (db) return Promise.resolve(db);
  if (isOpening) return openPromise;
  
  isOpening = true;
  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const oldVersion = event.oldVersion;
      
      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains('plants')) {
        const plantsStore = database.createObjectStore('plants', { keyPath: 'id' });
        plantsStore.createIndex('fieldRow', ['fieldId', 'rowId'], { unique: false });
        plantsStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('syncQueue')) {
        const queueStore = database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('retryCount', 'retryCount', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('nutrientHistory')) {
        const historyStore = database.createObjectStore('nutrientHistory', { keyPath: 'id' });
        historyStore.createIndex('plantId', 'plantId', { unique: false });
        historyStore.createIndex('date', 'date', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('schedule')) {
        const scheduleStore = database.createObjectStore('schedule', { keyPath: 'id' });
        scheduleStore.createIndex('date', 'date', { unique: false });
        scheduleStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('weatherCache')) {
        const weatherStore = database.createObjectStore('weatherCache', { keyPath: 'date' });
        weatherStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('workers')) {
        const workersStore = database.createObjectStore('workers', { keyPath: 'id' });
        workersStore.createIndex('active', 'active', { unique: false });
        workersStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      
      // Handle unexpected close
      db.onclose = () => {
        db = null;
        isOpening = false;
        openPromise = null;
      };
      
      // Handle version change from another tab
      db.onversionchange = () => {
        db.close();
        db = null;
        isOpening = false;
        openPromise = null;
      };
      
      isOpening = false;
      resolve(db);
    };
    
    request.onerror = (event) => {
      isOpening = false;
      openPromise = null;
      reject(new Error(`IndexedDB open error: ${event.target.error?.message || 'Unknown error'}`));
    };
    
    request.onblocked = () => {
      isOpening = false;
      openPromise = null;
      reject(new Error('IndexedDB blocked. Please close other tabs with this app.'));
    };
  });
  
  return openPromise;
};

/**
 * Ensures the database is open and the specified store exists.
 * 
 * @param {string} storeName - Name of the object store.
 * @returns {Promise<IDBObjectStore>}
 * @throws {Error} If store doesn't exist or DB can't be opened.
 */
const getStore = async (storeName, mode = 'readonly') => {
  const database = await openDB();
  if (!database.objectStoreNames.contains(storeName)) {
    throw new Error(`Store "${storeName}" does not exist. Please migrate the database.`);
  }
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

/**
 * Retrieves a single record by key.
 * 
 * @param {string} storeName - Name of the object store.
 * @param {string|number} key - Key of the record to retrieve.
 * @returns {Promise<Object|null>} The record, or null if not found.
 */
export const localGet = async (storeName, key) => {
  try {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Read error in ${storeName}: ${request.error?.message}`));
    });
  } catch (error) {
    console.error(`localGet(${storeName}, ${key}) failed:`, error);
    throw error;
  }
};

/**
 * Retrieves all records from a store.
 * 
 * @param {string} storeName - Name of the object store.
 * @param {IDBIndex|string} [indexName] - Optional index name for sorted results.
 * @param {IDBKeyRange} [keyRange] - Optional key range for filtering.
 * @returns {Promise<Array>} Array of records.
 */
export const localGetAll = async (storeName, indexName = null, keyRange = null) => {
  try {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      let source = store;
      if (indexName) {
        if (!store.indexNames.contains(indexName)) {
          reject(new Error(`Index "${indexName}" not found in store "${storeName}"`));
          return;
        }
        source = store.index(indexName);
      }
      const request = source.getAll(keyRange);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Read all error in ${storeName}: ${request.error?.message}`));
    });
  } catch (error) {
    console.error(`localGetAll(${storeName}) failed:`, error);
    throw error;
  }
};

/**
 * Inserts or updates a record.
 * 
 * @param {string} storeName - Name of the object store.
 * @param {Object} data - Record to store (must contain the keyPath field).
 * @returns {Promise<any>} The key of the stored record.
 */
export const localPut = async (storeName, data) => {
  try {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Put error in ${storeName}: ${request.error?.message}`));
    });
  } catch (error) {
    console.error(`localPut(${storeName}) failed:`, error);
    throw error;
  }
};

/**
 * Deletes a record by key.
 * 
 * @param {string} storeName - Name of the object store.
 * @param {string|number} key - Key of the record to delete.
 * @returns {Promise<void>}
 */
export const localDelete = async (storeName, key) => {
  try {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Delete error in ${storeName}: ${request.error?.message}`));
    });
  } catch (error) {
    console.error(`localDelete(${storeName}, ${key}) failed:`, error);
    throw error;
  }
};

/**
 * Clears all records from a store.
 * 
 * @param {string} storeName - Name of the object store.
 * @returns {Promise<void>}
 */
export const localClear = async (storeName) => {
  try {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Clear error in ${storeName}: ${request.error?.message}`));
    });
  } catch (error) {
    console.error(`localClear(${storeName}) failed:`, error);
    throw error;
  }
};

/**
 * Bulk inserts or updates multiple records.
 * Uses a single transaction for atomicity.
 * 
 * @param {string} storeName - Name of the object store.
 * @param {Array<Object>} dataArray - Array of records to store.
 * @returns {Promise<Array>} Array of stored keys.
 */
export const localBulkPut = async (storeName, dataArray) => {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return [];
  }
  try {
    const database = await openDB();
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const results = [];
    
    return new Promise((resolve, reject) => {
      let completed = 0;
      let errors = [];
      
      dataArray.forEach((data) => {
        const request = store.put(data);
        request.onsuccess = (e) => {
          results.push(e.target.result);
          completed++;
          if (completed === dataArray.length) {
            resolve(results);
          }
        };
        request.onerror = (e) => {
          errors.push(e.target.error);
          completed++;
          if (completed === dataArray.length) {
            reject(new Error(`Bulk put errors: ${errors.map(e => e.message).join(', ')}`));
          }
        };
      });
      
      transaction.onerror = (e) => {
        reject(new Error(`Transaction error: ${e.target.error?.message}`));
      };
    });
  } catch (error) {
    console.error(`localBulkPut(${storeName}) failed:`, error);
    throw error;
  }
};

/**
 * Retrieves a record by index (non-unique).
 * 
 * @param {string} storeName - Name of the object store.
 * @param {string} indexName - Name of the index.
 * @param {any} indexValue - Value to look up.
 * @returns {Promise<Array>} Array of matching records.
 */
export const localGetByIndex = async (storeName, indexName, indexValue) => {
  try {
    const store = await getStore(storeName);
    if (!store.indexNames.contains(indexName)) {
      throw new Error(`Index "${indexName}" not found in store "${storeName}"`);
    }
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(indexValue);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Index get error: ${request.error?.message}`));
    });
  } catch (error) {
    console.error(`localGetByIndex(${storeName}, ${indexName}, ${indexValue}) failed:`, error);
    throw error;
  }
};

export default {
  openDB,
  localGet,
  localGetAll,
  localPut,
  localDelete,
  localClear,
  localBulkPut,
  localGetByIndex
};
