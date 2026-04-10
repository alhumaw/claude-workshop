import React from 'react';

interface Props {
  name: string;
  size?: number;
  isBoss?: boolean;
  isRare?: boolean;
}

function hashName(name: string): number {
  return Array.from(name).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
}

/**
 * Procedural 5x5 pixel mob sprite. Color and pattern derived from mob name.
 * Bosses get a red tint, rare mobs get a gold tint.
 */
export function MobSprite({ name, size = 36, isBoss, isRare }: Props) {
  const hash = hashName(name);
  let hue = Math.abs(hash) % 360;
  if (isBoss) hue = 0;  // Red-shifted boss
  if (isRare) hue = 48; // Gold-shifted rare

  const saturation = isBoss ? 70 : isRare ? 80 : 50;
  const lightness = 55;

  // Generate mirrored pixel pattern (like AvatarPixels but different seed)
  const pixels: boolean[][] = [];
  let val = Math.abs(hash + 7919); // offset to differentiate from agent sprites
  for (let y = 0; y < 5; y++) {
    pixels[y] = [];
    for (let x = 0; x < 3; x++) {
      val = (val * 48271 + 1) & 0x7fffffff;
      pixels[y][x] = val % 3 !== 0;
    }
    pixels[y][3] = pixels[y][1];
    pixels[y][4] = pixels[y][0];
  }

  const pad = Math.round(size * 0.08);
  const gap = Math.max(1, Math.round(size * 0.03));

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.16),
      background: `hsl(${hue}, ${saturation - 30}%, 20%)`,
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gridTemplateRows: 'repeat(5, 1fr)',
      padding: pad,
      gap,
      flexShrink: 0,
      border: isBoss ? '1px solid rgba(255, 80, 80, 0.5)' : isRare ? '1px solid rgba(255, 215, 0, 0.5)' : 'none',
    }}>
      {pixels.flat().map((on, i) => (
        <div
          key={i}
          style={{
            borderRadius: Math.max(1, Math.round(size * 0.03)),
            background: on ? `hsl(${hue}, ${saturation}%, ${lightness}%)` : 'transparent',
          }}
        />
      ))}
    </div>
  );
}
