import React from 'react';

const SHAPES = ['Square', 'Round', 'Diamond', 'Shield', 'Hex'];
const PALETTES = ['Mono', 'Warm', 'Cool', 'Neon', 'Earth'];
const FACES = ['Grin', 'Smirk', 'Stoic', 'Wink', 'Glare'];
const EXTRAS = ['Cape', 'Crown', 'Horns', 'Halo', 'None'];

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
}

export function getAvatarTraits(seed: string): string {
  const hash = Math.abs(hashSeed(seed));
  let v = hash;
  const pick = (arr: string[]) => { v = (v * 16807 + 1) & 0x7fffffff; return arr[v % arr.length]; };
  return [pick(SHAPES), pick(PALETTES), pick(FACES), pick(EXTRAS)].join(' / ');
}

interface Props {
  seed: string;
  size?: number;
}

export function AvatarPixels({ seed, size = 36 }: Props) {
  const hash = hashSeed(seed);
  const hue = Math.abs(hash) % 360;
  const pixels: boolean[][] = [];
  let val = Math.abs(hash);
  for (let y = 0; y < 5; y++) {
    pixels[y] = [];
    for (let x = 0; x < 3; x++) {
      val = (val * 16807 + 1) & 0x7fffffff;
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
      background: `hsl(${hue}, 30%, 25%)`,
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gridTemplateRows: 'repeat(5, 1fr)',
      padding: pad,
      gap,
      flexShrink: 0,
    }}>
      {pixels.flat().map((on, i) => (
        <div
          key={i}
          style={{
            borderRadius: Math.max(1, Math.round(size * 0.03)),
            background: on ? `hsl(${hue}, 60%, 65%)` : 'transparent',
          }}
        />
      ))}
    </div>
  );
}
