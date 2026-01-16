
import React from 'react';

interface ColorPaletteProps {
  colors: string[];
  selectedColor: string | null;
  onSelectColor: (color: string | null) => void;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, selectedColor, onSelectColor }) => {
  return (
    <div className="bg-gray-800/50 p-3 rounded-xl">
      <div className="flex items-center space-x-3 overflow-x-auto pb-2 -mb-2">
        <button
          onClick={() => onSelectColor(null)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            selectedColor === null
              ? 'bg-cyan-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onSelectColor(color)}
            title={color}
            className={`flex-shrink-0 w-8 h-8 rounded-full transition-transform duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-400 ${
              selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-400 scale-110' : ''
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPalette;
