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
  level?: number;
  peakLevel?: number;
  isShiny?: boolean;
  isDead?: boolean;
  isWounded?: boolean;
  borderTierClass?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * Generate a 5x5 pixel grid with evolution mutations.
 * Returns a flat array of 25 entries: 0 = off, 1 = primary hue, 2 = secondary hue.
 *
 * Evolution stages (based on peakLevel, permanent once earned):
 *  - Base:   standard symmetric pattern
 *  - Lv.25+: 2 extra pixels light up (previously dark cells become active)
 *  - Lv.50+: some pixels switch to secondary hue (hue + 120)
 *  - Lv.75+: saturation boost applied externally (60% → 80%)
 *  - Lv.100: full dual-tone — alternating pixels use secondary hue
 */
function generatePixels(seed: string, peakLevel: number, isShiny: boolean): number[] {
  const hash = hashSeed(seed);
  let val = Math.abs(hash);
  const grid: number[][] = [];

  for (let y = 0; y < 5; y++) {
    grid[y] = [];
    for (let x = 0; x < 3; x++) {
      val = (val * 16807 + 1) & 0x7fffffff;
      grid[y][x] = val % 3 !== 0 ? 1 : 0;
    }
    // Mirror for symmetry
    grid[y][3] = grid[y][1];
    grid[y][4] = grid[y][0];
  }

  // Lv.25+: Light up 2 extra pixels (deterministic from seed)
  if (peakLevel >= 25) {
    // Find dark pixels and light up 2 of them symmetrically
    let extra = Math.abs(hashSeed(seed + ':evo25'));
    const darkCells: [number, number][] = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        if (grid[y][x] === 0) darkCells.push([y, x]);
      }
    }
    if (darkCells.length > 0) {
      const pick = darkCells[extra % darkCells.length];
      grid[pick[0]][pick[1]] = 1;
      grid[pick[0]][4 - pick[1]] = 1; // mirror
    }
  }

  // Lv.50+ (or shiny from Lv.1): Some pixels become secondary hue
  if (peakLevel >= 50 || isShiny) {
    let evo50 = Math.abs(hashSeed(seed + ':evo50'));
    // Convert ~30% of active pixels to secondary color
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (grid[y][x] === 1) {
          evo50 = (evo50 * 48271 + 1) & 0x7fffffff;
          if (evo50 % 100 < 30) {
            grid[y][x] = 2;
          }
        }
      }
    }
  }

  // Lv.100: Full dual-tone — alternate even more pixels to secondary
  if (peakLevel >= 100) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (grid[y][x] === 1 && (y + x) % 2 === 0) {
          grid[y][x] = 2;
        }
      }
    }
  }

  return grid.flat();
}

export function AvatarPixels({ seed, size = 36, level, peakLevel, isShiny, isDead, isWounded, borderTierClass, onContextMenu }: Props) {
  const hash = hashSeed(seed);
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 120) % 360; // complementary hue for evolutions

  const evoLevel = peakLevel ?? level ?? 0;
  const pixels = generatePixels(seed, evoLevel, !!isShiny);

  const pad = Math.round(size * 0.08);
  const gap = Math.max(1, Math.round(size * 0.03));

  // Determine visual state
  // Lv.75+ evolution: saturation boost (60% → 80%)
  const evoSaturation = evoLevel >= 75 ? 80 : 60;
  const saturation = isDead ? 0 : isWounded ? 30 : evoSaturation;
  const bgLightness = isDead ? 15 : 25;
  const pixelLightness = isDead ? 35 : 65;
  const bgSaturation = isDead ? 0 : 30;

  const hasBorder = !!borderTierClass;
  const borderRadius = Math.round(size * 0.22);

  return (
    // Outer wrapper creates a stacking context so ::before z-index:-1 stays visible
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0, isolation: 'isolate' }}
      onContextMenu={onContextMenu}
    >
      {/* Pixel grid — border tier class applied here (like the HTML preview).
          For gradient tiers (diamond+), background-clip: padding-box keeps the
          grid background inside the border, letting ::before gradients show through. */}
      <div
        className={borderTierClass || undefined}
        style={{
          width: size,
          height: size,
          borderRadius,
          background: `hsl(${hue}, ${bgSaturation}%, ${bgLightness}%)`,
          backgroundClip: hasBorder ? 'padding-box' : undefined,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gridTemplateRows: 'repeat(5, 1fr)',
          padding: pad,
          gap,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {pixels.map((val, i) => {
          let bg = 'transparent';
          if (val === 1) {
            bg = `hsl(${hue}, ${saturation}%, ${pixelLightness}%)`;
          } else if (val === 2) {
            bg = `hsl(${hue2}, ${saturation}%, ${pixelLightness}%)`;
          }
          return (
            <div
              key={i}
              className={val > 0 && isShiny && !isDead ? 'shiny-pixel' : undefined}
              style={{
                borderRadius: Math.max(1, Math.round(size * 0.03)),
                background: bg,
              }}
            />
          );
        })}
      </div>

      {/* Level badge */}
      {level !== undefined && level > 0 && (
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          background: isDead ? '#444' : 'rgba(0, 0, 0, 0.85)',
          color: isDead ? '#666' : '#fff',
          fontSize: Math.max(8, Math.round(size * 0.22)),
          fontWeight: 700,
          padding: '0px 3px',
          borderRadius: 4,
          lineHeight: 1.4,
          border: '1px solid rgba(255,255,255,0.15)',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 5,
        }}>
          {isShiny && !isDead && <span style={{ color: '#FFD700', fontSize: Math.max(6, Math.round(size * 0.18)) }}>✦</span>}
          Lv.{level}
        </div>
      )}
    </div>
  );
}
