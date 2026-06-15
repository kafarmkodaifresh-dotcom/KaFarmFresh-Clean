import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { fetchWeatherForecast } from './weatherCache';

/**
 * Fetches all documents from a subcollection (unlimited).
 * @param {string} path - Firestore path to the subcollection.
 * @returns {Promise<Array>} Array of document data.
 */
const fetchAllFromSubcollection = async (path) => {
  const snap = await getDocs(collection(db, path));
  return snap.docs.map(d => d.data());
};

/**
 * Builds the AI context for a specific plant.
 * @param {string} fieldId - Field ID.
 * @param {string|null} blockId - Block ID (or null).
 * @param {string} rowId - Row ID.
 * @param {string} plantId - Plant ID (usually the index as string).
 * @returns {Promise<Object>} { prompt, context }
 */
export const buildAIContext = async (fieldId, blockId, rowId, plantId) => {
  // ─── 1. Construct the plant reference ──────────────────────
  let plantRef;
  if (blockId) {
    plantRef = doc(db, 'fields', fieldId, 'blocks', blockId, 'rows', rowId, 'plants', plantId);
  } else {
    plantRef = doc(db, 'fields', fieldId, 'rows', rowId, 'plants', plantId);
  }

  // ─── 2. Fetch plant health data ────────────────────────────
  const plantSnap = await getDoc(plantRef);
  if (!plantSnap.exists()) {
    throw new Error(`Plant not found at path: ${plantRef.path}`);
  }
  const plantData = plantSnap.data();
  const health = {
    flowers: plantData.flowers || 0,
    greenFruits: plantData.greenFruits || 0,
    redFruits: plantData.redFruits || 0,
    yieldGrams: plantData.yieldGrams || 0,
    defect: plantData.defect || 'none',
    status: plantData.status || 'healthy',
  };

  // ─── 3. Fetch ALL nutrient history (no limit) ──────────────
  const nutrientHistoryPath = plantRef.path + '/nutrientHistory';
  const nutrientHistory = await fetchAllFromSubcollection(nutrientHistoryPath);

  // ─── 4. Fetch ALL pesticide history (no limit) ──────────────
  const pestHistoryPath = plantRef.path + '/pestHistory';
  const pestHistory = await fetchAllFromSubcollection(pestHistoryPath);

  // ─── 5. Fetch weather forecast (3 days) ────────────────────
  const weather = await fetchWeatherForecast();
  const weatherSummary = weather.slice(0, 3).map(w => 
    `${w.date}: ${w.temp}°C, ${w.humidity}% humidity, ${w.wind} m/s wind, ${w.rainChance}% rain`
  ).join('\n');

  // ─── 6. Fetch product stock (all products) ──────────────────
  const productsSnap = await getDocs(collection(db, 'products'));
  const products = productsSnap.docs.map(d => ({
    name: d.data().productName,
    stock: d.data().stockQuantity || 0,
    dose: d.data().dosePer100L || 'N/A',
    PHI: d.data().PHI || 'N/A',
  }));

  // ─── 7. Build the prompt ────────────────────────────────────
  const prompt = `
You are an expert strawberry farm advisor for Kodaikanal, TN.

PLANT DATA (ID: ${plantId})
- Flowers: ${health.flowers}
- Green Fruits: ${health.greenFruits}
- Red Fruits: ${health.redFruits}
- Yield: ${health.yieldGrams}g
- Defect: ${health.defect}
- Status: ${health.status}

FULL NUTRIENT HISTORY (all past applications)
${nutrientHistory.map(n => `- ${n.nutrientName} (${n.date || 'unknown date'}) – ${n.reason || 'no reason'}`).join('\n')}

FULL PESTICIDE HISTORY (all past applications)
${pestHistory.map(p => `- ${p.pesticideName} (${p.date || 'unknown date'}) – ${p.reason || 'no reason'}`).join('\n')}

WEATHER FORECAST (next 3 days)
${weatherSummary}

AVAILABLE PRODUCTS (fertilizers & pesticides)
${products.map(p => `- ${p.name}: ${p.stock}kg stock, dose ${p.dose}, PHI ${p.PHI} days`).join('\n')}

TASK: Based on the plant's current health, full history, weather, and available products, recommend a specific fertilizer or pesticide.
Rules:
- Always recommend the **right product** even if it is out of stock (add a note: "⚠️ Currently out of stock – please restock").
- If recommending a product that is in stock, mention the stock level.
- Include: product name, dose per 100L, timing (1-4 days from today), PHI days, and a detailed reason.
- Reference the plant's defect, history, and weather in your reason.
- Output as a valid JSON object with the following keys: "product", "dose", "timing", "PHI", "reason", "stockWarning" (optional).

Return only the JSON, no extra text.
`;

  return {
    prompt,
    context: {
      plantId,
      health,
      nutrientHistory,
      pestHistory,
      weather: weather.slice(0, 3),
      products,
      timestamp: new Date().toISOString(),
    },
  };
};

export default buildAIContext;
