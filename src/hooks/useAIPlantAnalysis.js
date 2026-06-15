import { useState } from 'react';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { buildAIContext } from '../services/aiContextBuilder';
import { callAI } from '../services/aiProvider';

/**
 * Custom hook to trigger AI plant analysis and store the result.
 * @returns {Object} { loading, error, response, providerUsed, triggerAnalysis, approveRecommendation, rejectRecommendation }
 */
export const useAIPlantAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const [providerUsed, setProviderUsed] = useState(null);

  /**
   * Triggers AI analysis for a specific plant.
   * @param {string} fieldId - Field ID.
   * @param {string|null} blockId - Block ID (or null).
   * @param {string} rowId - Row ID.
   * @param {string} plantId - Plant ID (usually the index as string).
   * @param {string|null} imageData - Base64 image data (optional).
   * @returns {Promise<Object>} The recommendation object stored in Firestore.
   */
  const triggerAnalysis = async (fieldId, blockId, rowId, plantId, imageData = null) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setProviderUsed(null);

    try {
      // 1. Build the context and prompt
      const { prompt, context } = await buildAIContext(fieldId, blockId, rowId, plantId);

      // 2. Call the AI with failover
      const aiResult = await callAI(prompt, imageData);
      setProviderUsed(aiResult.provider);

      // 3. Parse the AI response (expecting JSON)
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResult.response);
      } catch (parseError) {
        // If the AI didn't return valid JSON, store the raw response and throw
        parsedResponse = { raw: aiResult.response };
        throw new Error('AI returned invalid JSON format.');
      }

      // 4. Determine the Firestore path for the plant
      let plantRef;
      if (blockId) {
        plantRef = doc(db, 'fields', fieldId, 'blocks', blockId, 'rows', rowId, 'plants', plantId);
      } else {
        plantRef = doc(db, 'fields', fieldId, 'rows', rowId, 'plants', plantId);
      }

      // 5. Store the recommendation in the aiRecommendations subcollection
      const recommendationData = {
        prompt: prompt,
        response: parsedResponse,
        rawResponse: aiResult.response,
        provider: aiResult.provider,
        status: 'pending',
        timestamp: serverTimestamp(),
        imageData: imageData || null,
        contextSnapshot: context, // snapshot of the context for audit
      };

      const recRef = doc(collection(db, plantRef.path, 'aiRecommendations'));
      await setDoc(recRef, recommendationData);

      // 6. Return the stored recommendation
      const returnedRec = {
        id: recRef.id,
        ...recommendationData,
        timestamp: new Date().toISOString(),
      };
      setResponse(returnedRec);
      return returnedRec;
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during AI analysis.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Approves a pending recommendation.
   * @param {string} fieldId - Field ID.
   * @param {string|null} blockId - Block ID (or null).
   * @param {string} rowId - Row ID.
   * @param {string} plantId - Plant ID.
   * @param {string} recId - Recommendation document ID.
   * @param {string} adminName - Name of the admin approving it.
   * @returns {Promise<void>}
   */
  const approveRecommendation = async (fieldId, blockId, rowId, plantId, recId, adminName) => {
    let recRef;
    if (blockId) {
      recRef = doc(db, 'fields', fieldId, 'blocks', blockId, 'rows', rowId, 'plants', plantId, 'aiRecommendations', recId);
    } else {
      recRef = doc(db, 'fields', fieldId, 'rows', rowId, 'plants', plantId, 'aiRecommendations', recId);
    }
    await setDoc(recRef, { status: 'approved', approvedBy: adminName, approvedAt: serverTimestamp() }, { merge: true });
  };

  /**
   * Rejects a pending recommendation.
   * @param {string} fieldId - Field ID.
   * @param {string|null} blockId - Block ID (or null).
   * @param {string} rowId - Row ID.
   * @param {string} plantId - Plant ID.
   * @param {string} recId - Recommendation document ID.
   * @param {string} adminName - Name of the admin rejecting it.
   * @param {string} rejectionReason - Optional reason for rejection.
   * @returns {Promise<void>}
   */
  const rejectRecommendation = async (fieldId, blockId, rowId, plantId, recId, adminName, rejectionReason = '') => {
    let recRef;
    if (blockId) {
      recRef = doc(db, 'fields', fieldId, 'blocks', blockId, 'rows', rowId, 'plants', plantId, 'aiRecommendations', recId);
    } else {
      recRef = doc(db, 'fields', fieldId, 'rows', rowId, 'plants', plantId, 'aiRecommendations', recId);
    }
    await setDoc(recRef, {
      status: 'rejected',
      rejectedBy: adminName,
      rejectedAt: serverTimestamp(),
      rejectionReason: rejectionReason,
    }, { merge: true });
  };

  return {
    loading,
    error,
    response,
    providerUsed,
    triggerAnalysis,
    approveRecommendation,
    rejectRecommendation,
  };
};

export default useAIPlantAnalysis;
