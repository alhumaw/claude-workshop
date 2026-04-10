// Biome system — new biome every 10 levels, affects mob theming and visuals

export interface Biome {
  name: string;
  minLevel: number;
  maxLevel: number;
  color: string;        // primary accent color
  bgColor: string;      // background tint
  safe: boolean;        // no morale loss in safe biomes
  description: string;
}

export const BIOMES: Biome[] = [
  { name: 'Grassy Plains',   minLevel: 1,   maxLevel: 9,   color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.08)',  safe: true,  description: 'A peaceful starting zone. No permadeath.' },
  { name: 'Dark Forest',     minLevel: 10,  maxLevel: 19,  color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.08)',   safe: false, description: 'The canopy thickens. Danger lurks.' },
  { name: 'Crystal Caverns', minLevel: 20,  maxLevel: 29,  color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.08)',  safe: false, description: 'Glowing crystals light the deep.' },
  { name: 'Volcanic Wastes', minLevel: 30,  maxLevel: 39,  color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.08)',  safe: false, description: 'Rivers of magma. Scorching heat.' },
  { name: 'Frozen Peaks',    minLevel: 40,  maxLevel: 49,  color: '#a5f3fc', bgColor: 'rgba(165, 243, 252, 0.08)', safe: false, description: 'Blizzards and ice. Bitter cold.' },
  { name: 'Desert Ruins',    minLevel: 50,  maxLevel: 59,  color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.08)',  safe: false, description: 'Ancient sands hide ancient threats.' },
  { name: 'Shadow Realm',    minLevel: 60,  maxLevel: 69,  color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.08)',  safe: false, description: 'Reality bends. Nothing is certain.' },
  { name: 'Storm Citadel',   minLevel: 70,  maxLevel: 79,  color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.08)',  safe: false, description: 'Lightning strikes without warning.' },
  { name: 'Infernal Core',   minLevel: 80,  maxLevel: 89,  color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.08)',   safe: false, description: 'The source of all corruption.' },
  { name: 'Celestial Gate',  minLevel: 90,  maxLevel: 99,  color: '#e2e8f0', bgColor: 'rgba(226, 232, 240, 0.08)', safe: false, description: 'The final ascent. Few reach this far.' },
  { name: 'Eternal Throne',  minLevel: 100, maxLevel: 999, color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.08)',   safe: false, description: 'You made it. Legend.' },
];

export function getBiome(level: number): Biome {
  for (let i = BIOMES.length - 1; i >= 0; i--) {
    if (level >= BIOMES[i].minLevel) return BIOMES[i];
  }
  return BIOMES[0];
}
