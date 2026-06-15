/**
 * PlantFilterBar.jsx
 * 
 * Phase 3: Health Filter component for CropPage.
 * Provides dropdown filter and "Select All" checkbox.
 */

import React from 'react';

const PlantFilterBar = ({ filterType, onFilterChange, selectAll, onSelectAllChange, totalCount, filteredCount }) => {
  const filterOptions = [
    { value: 'all', label: '🌱 All Plants' },
    { value: 'healthy', label: '✅ Healthy' },
    { value: 'issue', label: '⚠️ Issues' },
    { value: 'flowering', label: '🌸 Flowering' },
    { value: 'harvest', label: '🍓 Harvest Ready' },
  ];

  return (
    <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Filter:</label>
        <select
          value={filterType}
          onChange={(e) => onFilterChange(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
        <input
          type="checkbox"
          id="selectAll"
          checked={selectAll}
          onChange={(e) => onSelectAllChange(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <label htmlFor="selectAll" style={{ fontSize: '12px', cursor: 'pointer', color: 'var(--muted)' }}>
          Select All ({filteredCount} visible)
        </label>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>
        {filteredCount} / {totalCount} plants
      </div>
    </div>
  );
};

export default PlantFilterBar;
