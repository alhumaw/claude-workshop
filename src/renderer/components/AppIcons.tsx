import React from 'react';

// Design A: Visor Bot — sleek horizontal visor eyes, segmented mouth
export function BotVisor({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill="#0f0f1a" />
      {/* Antenna */}
      <rect x="30.5" y="5" width="3" height="9" rx="1.5" fill="#6d28d9" />
      <circle cx="32" cy="4" r="3" fill="#8b5cf6" />
      <circle cx="32" cy="4" r="1.5" fill="#c4b5fd" />
      {/* Head */}
      <rect x="10" y="14" width="44" height="34" rx="8" fill="#1a1a2e" stroke="#3730a3" strokeWidth="1.5" />
      {/* Visor strip */}
      <rect x="14" y="23" width="36" height="10" rx="4" fill="#0f0f1a" />
      <rect x="15" y="24" width="34" height="8" rx="3" fill="#1e1b4b" />
      {/* Visor glow */}
      <rect x="15" y="24" width="34" height="8" rx="3" fill="#7c3aed" opacity="0.15" />
      <rect x="16" y="25" width="32" height="6" rx="2.5" fill="#a78bfa" opacity="0.6" />
      {/* Visor highlight */}
      <rect x="17" y="26" width="14" height="2" rx="1" fill="white" opacity="0.15" />
      {/* Segmented mouth */}
      <rect x="19" y="38" width="5" height="4" rx="1.5" fill="#4c1d95" />
      <rect x="26" y="38" width="5" height="4" rx="1.5" fill="#6d28d9" />
      <rect x="33" y="38" width="5" height="4" rx="1.5" fill="#6d28d9" />
      <rect x="40" y="38" width="5" height="4" rx="1.5" fill="#4c1d95" />
      {/* Chin plate */}
      <rect x="22" y="48" width="20" height="5" rx="2.5" fill="#1a1a2e" stroke="#3730a3" strokeWidth="1" />
      <circle cx="28" cy="50.5" r="1.2" fill="#7c3aed" opacity="0.8" />
      <circle cx="32" cy="50.5" r="1.2" fill="#a78bfa" />
      <circle cx="36" cy="50.5" r="1.2" fill="#7c3aed" opacity="0.8" />
    </svg>
  );
}

// Design B: Round Bot — big circular eyes, friendly smile, soft look
export function BotRound({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="32" fill="#0f1923" />
      {/* Antenna */}
      <rect x="30.5" y="5" width="3" height="8" rx="1.5" fill="#0ea5e9" />
      <circle cx="32" cy="4" r="3.5" fill="#38bdf8" />
      <circle cx="32" cy="4" r="2" fill="#e0f2fe" />
      {/* Head */}
      <circle cx="32" cy="34" r="20" fill="#0c1a2e" stroke="#0369a1" strokeWidth="1.5" />
      {/* Left eye */}
      <circle cx="23" cy="30" r="6" fill="#082f49" stroke="#0369a1" strokeWidth="1" />
      <circle cx="23" cy="30" r="4" fill="#0ea5e9" opacity="0.9" />
      <circle cx="23" cy="30" r="2.5" fill="#7dd3fc" />
      <circle cx="21.5" cy="28.5" r="1" fill="white" opacity="0.6" />
      {/* Right eye */}
      <circle cx="41" cy="30" r="6" fill="#082f49" stroke="#0369a1" strokeWidth="1" />
      <circle cx="41" cy="30" r="4" fill="#0ea5e9" opacity="0.9" />
      <circle cx="41" cy="30" r="2.5" fill="#7dd3fc" />
      <circle cx="39.5" cy="28.5" r="1" fill="white" opacity="0.6" />
      {/* Smile */}
      <path d="M22 40 Q32 47 42 40" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Cheek blush */}
      <circle cx="17" cy="37" r="4" fill="#0ea5e9" opacity="0.1" />
      <circle cx="47" cy="37" r="4" fill="#0ea5e9" opacity="0.1" />
    </svg>
  );
}

// Design C: Pixel Bot — fixed pixel art on a 7x9 grid, symmetric
export function BotPixel({ size = 64 }: { size?: number }) {
  const GRID_W = 7;
  const GRID_H = 9;
  // 0 = off, 1 = body, 2 = eye, 3 = accent
  const grid = [
    [0, 0, 0, 1, 0, 0, 0], // antenna
    [0, 0, 0, 3, 0, 0, 0], // antenna base
    [0, 1, 1, 1, 1, 1, 0], // head top
    [1, 1, 1, 1, 1, 1, 1], // head
    [1, 1, 2, 1, 2, 1, 1], // eyes
    [1, 1, 1, 1, 1, 1, 1], // head
    [1, 3, 1, 3, 1, 3, 1], // mouth
    [0, 1, 1, 1, 1, 1, 0], // chin
    [0, 0, 1, 0, 1, 0, 0], // neck
  ];
  const colors = { 0: 'transparent', 1: '#166534', 2: '#4ade80', 3: '#86efac' } as Record<number, string>;
  const pad = size * 0.08;
  const cellW = (size - pad * 2) / GRID_W;
  const cellH = (size - pad * 2) / GRID_H;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} rx={size * 0.16} fill="#052e16" />
      {grid.map((row, y) =>
        row.map((val, x) => val === 0 ? null : (
          <rect
            key={`${x}-${y}`}
            x={pad + x * cellW + 1}
            y={pad + y * cellH + 1}
            width={cellW - 2}
            height={cellH - 2}
            rx={2}
            fill={colors[val]}
          />
        ))
      )}
    </svg>
  );
}

// Design D: Trio Bot — three small bots representing multiple sessions
export function BotTrio({ size = 64 }: { size?: number }) {
  const Bot = ({ x, y, hue, scale = 1 }: { x: number; y: number; hue: number; scale?: number }) => {
    const s = scale;
    return (
      <g transform={`translate(${x}, ${y}) scale(${s})`}>
        {/* Head */}
        <rect x="-9" y="-10" width="18" height="14" rx="4" fill={`hsl(${hue}, 60%, 15%)`} stroke={`hsl(${hue}, 70%, 35%)`} strokeWidth="1" />
        {/* Eyes */}
        <rect x="-6" y="-7" width="4" height="3" rx="1" fill={`hsl(${hue}, 80%, 55%)`} />
        <rect x="2" y="-7" width="4" height="3" rx="1" fill={`hsl(${hue}, 80%, 55%)`} />
        {/* Mouth */}
        <rect x="-4" y="-2" width="8" height="2" rx="1" fill={`hsl(${hue}, 60%, 40%)`} />
        {/* Antenna */}
        <line x1="0" y1="-10" x2="0" y2="-14" stroke={`hsl(${hue}, 70%, 45%)`} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="0" cy="-15" r="2" fill={`hsl(${hue}, 80%, 60%)`} />
      </g>
    );
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill="#0f0f1a" />
      {/* Center (slightly larger) */}
      <Bot x={32} y={36} hue={270} scale={1.2} />
      {/* Left */}
      <Bot x={14} y={40} hue={200} scale={0.9} />
      {/* Right */}
      <Bot x={50} y={40} hue={320} scale={0.9} />
    </svg>
  );
}
