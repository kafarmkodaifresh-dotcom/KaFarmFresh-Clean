/**
 * healthRules.js
 * 
 * Phase 3: Health classification rules for plants.
 * Maps plant data to health status categories used in filtering.
 */

export const healthRules = {
  /**
   * Determines the health status of a plant based on its properties.
   * 
   * @param {Object} plant - Plant object with flowers, greenFruits, redFruits, defect.
   * @returns {string} Health status: 'healthy', 'issue', 'flowering', 'harvest'.
   */
  getHealthStatus: (plant) => {
    if (!plant) return 'healthy';
    if (plant.defect && plant.defect.trim() !== '') {
      return 'issue';
    }
    if (plant.redFruits > 2) {
      return 'harvest';
    }
    if (plant.flowers > 3) {
      return 'flowering';
    }
    return 'healthy';
  },
};

export default healthRules;
