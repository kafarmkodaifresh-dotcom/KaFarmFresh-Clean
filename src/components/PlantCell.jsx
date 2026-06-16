/**
 * PlantCell.jsx
 * 
 * Phase 3: Individual plant cell with checkbox and health status.
 * Used in CropPage grid.
 */

import React from 'react';

const PlantCell = ({ plant, isSelected, onToggle, onClick, getPlantClass }) => {
  const handleCheckboxClick = (e) => {
    e.stopPropagation(); // Prevent triggering onClick for the whole cell
    onToggle();
  };

  return (
    <div
      className={`plant-cell ${getPlantClass(plant)}`}
      onClick={onClick}
      style={{ position: 'relative', cursor: 'pointer' }}
      title={`Plant #${plant.index} | 🌸${plant.flowers} 🟢${plant.greenFruits} 🍓${plant.redFruits}`}
    >
      <span style={{ fontSize: '8px' }}>{plant.index}</span>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleCheckboxClick}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '3px',
          right: '3px',
          width: '14px',
          height: '14px',
          cursor: 'pointer',
          zIndex: 1,
        }}
      />
    </div>
  );
};

export default PlantCell;
