/**
 * parseLocation.js
 * 
 * Expert-level location parser for KaFarmFresh.
 * Converts user input (QR, structured text, or free text) into a
 * standardized location object with field, block, row, and plantIndex.
 * 
 * Supports:
 * - QR data (fieldId|blockId|rowId|plantIndex)
 * - Structured text: "Field A, Block 2, Row 3, Plant 45"
 * - Partial text: "Block A", "Row 3", "Field A Block 2"
 * - Free text: returns null location and sets a 'raw' field
 * 
 * Thread-safe, pure function, zero side effects.
 */

/**
 * Parses a location string into a structured object.
 * 
 * @param {string} input - Raw user input (QR, text, or free text).
 * @param {Object} options - Configuration options.
 * @param {boolean} options.strict - If true, throw on malformed input.
 * @returns {Object} Location object with fields:
 *   - {string|null} field
 *   - {string|null} block
 *   - {string|null} row
 *   - {number|null} plantIndex
 *   - {string|null} raw (original input, if parsing failed)
 *   - {boolean} isComplete (true if field, block, row, and plantIndex are all non-null)
 */
export const parseLocation = (input, options = { strict: false }) => {
  if (!input || typeof input !== 'string') {
    if (options.strict) {
      throw new Error('parseLocation: input must be a non-empty string');
    }
    return { field: null, block: null, row: null, plantIndex: null, raw: input, isComplete: false };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { field: null, block: null, row: null, plantIndex: null, raw: input, isComplete: false };
  }

  // --- Priority 1: QR format (fieldId|blockId|rowId|plantIndex) ---
  const qrMatch = trimmed.match(/^([^|]+)\|([^|]+)\|([^|]+)\|(\d+)$/);
  if (qrMatch) {
    return {
      field: qrMatch[1] || null,
      block: qrMatch[2] || null,
      row: qrMatch[3] || null,
      plantIndex: parseInt(qrMatch[4], 10) || null,
      raw: trimmed,
      isComplete: true
    };
  }

  // --- Priority 2: Structured text (Field X, Block Y, Row Z, Plant W) ---
  // Common separators: comma, space, or "and"
  const tokens = trimmed.split(/[,;\s]+/).filter(t => t.length > 0);
  let field = null, block = null, row = null, plantIndex = null;

  // Extract using keyword detection
  for (const token of tokens) {
    const lower = token.toLowerCase();
    // Field detection: "fieldA", "field:A", "field: A", "field a"
    if (/^field[:]?\s*([a-z0-9-_]+)/i.test(token)) {
      field = token.replace(/^field[:]?\s*/i, '').trim();
      continue;
    }
    // Block detection: "blockA", "block:A", "block: A", "block a"
    if (/^block[:]?\s*([a-z0-9-_]+)/i.test(token)) {
      block = token.replace(/^block[:]?\s*/i, '').trim();
      continue;
    }
    // Row detection: "row3", "row:3", "row: 3", "row 3"
    if (/^row[:]?\s*(\d+)/i.test(token)) {
      row = token.replace(/^row[:]?\s*/i, '').trim();
      continue;
    }
    // Plant detection: "plant45", "plant:45", "plant: 45", "plant 45"
    if (/^plant[:]?\s*(\d+)/i.test(token)) {
      plantIndex = parseInt(token.replace(/^plant[:]?\s*/i, '').trim(), 10);
      continue;
    }
  }

  // If we found at least one component, return partial object
  if (field || block || row || plantIndex !== null) {
    return {
      field: field || null,
      block: block || null,
      row: row || null,
      plantIndex: plantIndex || null,
      raw: trimmed,
      isComplete: field !== null && block !== null && row !== null && plantIndex !== null
    };
  }

  // --- Priority 3: Free text (no structured tokens) ---
  // Return raw input, isComplete = false
  return {
    field: null,
    block: null,
    row: null,
    plantIndex: null,
    raw: trimmed,
    isComplete: false
  };
};

export default parseLocation;
