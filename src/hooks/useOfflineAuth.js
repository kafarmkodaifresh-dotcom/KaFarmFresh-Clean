/**
 * useOfflineAuth.js
 * 
 * Manages worker authentication for offline operations.
 * 
 * Features:
 * - Persists worker name in localStorage across sessions
 * - Single login per session (no repeated prompts)
 * - Clear logout functionality
 * - Provides worker identity for sync attribution
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'kafarm_offline_worker';

/**
 * Custom hook for managing offline worker authentication.
 * 
 * @returns {Object} { workerName, isLoggedIn, login, logout }
 */
export const useOfflineAuth = () => {
  const [workerName, setWorkerName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Validate the stored data structure
        if (data && typeof data.name === 'string' && data.name.trim().length > 0) {
          setWorkerName(data.name);
          setIsLoggedIn(true);
        } else {
          // Invalid data, clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load offline auth session:', error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logs in a worker by name.
   * 
   * @param {string} name - The worker's full name.
   * @returns {boolean} True if login succeeded, false otherwise.
   */
  const login = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      console.warn('Invalid worker name provided for login.');
      return false;
    }

    try {
      const sessionData = { name: trimmed, loggedInAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      setWorkerName(trimmed);
      setIsLoggedIn(true);
      console.log(`✅ Offline auth: ${trimmed} logged in.`);
      return true;
    } catch (error) {
      console.error('Failed to save offline auth session:', error);
      return false;
    }
  }, []);

  /**
   * Logs out the current worker.
   * Clears both state and localStorage.
   * 
   * @returns {void}
   */
  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setWorkerName('');
      setIsLoggedIn(false);
      console.log('🚪 Offline auth: Worker logged out.');
    } catch (error) {
      console.error('Failed to clear offline auth session:', error);
    }
  }, []);

  return {
    workerName,
    isLoggedIn,
    isLoading,
    login,
    logout,
  };
};

export default useOfflineAuth;
