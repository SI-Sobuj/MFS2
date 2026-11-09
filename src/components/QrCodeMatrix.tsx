import React from 'react';

interface QrCodeMatrixProps {
  value: string;
  size?: number;
}

export const QrCodeMatrix: React.FC<QrCodeMatrixProps> = ({ value, size = 176 }) => {
  const gridSize = 21;

  // Deterministic bit generator from value string
  const isModuleDark = (row: number, col: number): boolean => {
    // Finder pattern top-left
    if (row < 7 && col < 7) {
      if (row === 0 || row === 6 || col === 0 || col === 6) return true;
      if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
      return false;
    }
    // Finder pattern top-right
    if (row < 7 && col >= gridSize - 7) {
      const c = col - (gridSize - 7);
      if (row === 0 || row === 6 || c === 0 || c === 6) return true;
      if (row >= 2 && row <= 4 && c >= 2 && c <= 4) return true;
      return false;
    }
    // Finder pattern bottom-left
    if (row >= gridSize - 7 && col < 7) {
      const r = row - (gridSize - 7);
      if (r === 0 || r === 6 || col === 0 || col === 6) return true;
      if (r >= 2 && r <= 4 && col >= 2 && col <= 4) return true;
      return false;
    }
    // Quiet timing lines
    if (row === 6 || col === 6) {
      return (row + col) % 2 === 0;
    }
    // Leave center 5x5 for TakaPay emblem
    if (row >= 8 && row <= 12 && col >= 8 && col <= 12) {
      return false;
    }

    const idx = row * gridSize + col;
    const charCode = value.charCodeAt(idx % value.length) || 73;
    const mix = ((charCode * 37 + row * 19 + col * 53 + idx * 11) ^ (charCode << 2)) & 0xff;
    return mix % 2 === 0;
  };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (isModuleDark(r, c)) {
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width={0.92}
            height={0.92}
            rx={0.2}
            className="fill-slate-900 dark:fill-slate-100"
          />
        );
      }
    }
  }

  return (
    <div
      className="relative inline-flex items-center justify-center p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${gridSize} ${gridSize}`}
        className="w-full h-full"
        aria-label={`QR Code for ${value}`}
      >
        {cells}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 rounded-lg bg-rose-600 text-white font-display font-bold text-xs flex items-center justify-center shadow-sm">
          ৳
        </div>
      </div>
    </div>
  );
};
