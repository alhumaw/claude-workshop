// Shared battle utility functions — pure math, no Node/Electron dependencies.
// Importable from both main process and renderer.

/** Simple 32-bit hash (FNV-1a variant) */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

function multiHash(seed: string, count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(fnv1a(seed + ':' + i));
  }
  return result;
}

/**
 * Map a uniform 0-1 value to a weighted stat multiplier.
 * Wide range — stats matter. Poor agents struggle, elite agents dominate.
 * 40% poor (0.75-0.90), 30% avg (0.90-1.05),
 * 20% good (1.05-1.18), 9% great (1.18-1.28), 1% elite (1.28-1.35)
 */
function weightedStatValue(uniform: number): number {
  if (uniform < 0.40) return 0.75 + (uniform / 0.40) * 0.15;
  if (uniform < 0.70) return 0.90 + ((uniform - 0.40) / 0.30) * 0.15;
  if (uniform < 0.90) return 1.05 + ((uniform - 0.70) / 0.20) * 0.13;
  if (uniform < 0.99) return 1.18 + ((uniform - 0.90) / 0.09) * 0.10;
  return 1.28 + ((uniform - 0.99) / 0.01) * 0.07;
}

export type AgentType = 'thinker' | 'generator' | 'researcher' | 'debugger';

export interface AgentStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Derive 4 weighted stat multipliers from a seed (0.70-1.45 each) */
export function hashSeedWeighted(seed: string): [number, number, number, number] {
  const hashes = multiHash(seed, 4);
  return hashes.map(h => {
    const uniform = (h % 10000) / 10000;
    return weightedStatValue(uniform);
  }) as [number, number, number, number];
}

/** Get agent type from dominant stat */
export function getAgentType(seed: string): AgentType {
  const [hp, atk, def, spd] = hashSeedWeighted(seed);
  const stats: { type: AgentType; value: number; priority: number }[] = [
    { type: 'generator', value: atk, priority: 0 },
    { type: 'debugger', value: spd, priority: 1 },
    { type: 'thinker', value: def, priority: 2 },
    { type: 'researcher', value: hp, priority: 3 },
  ];
  stats.sort((a, b) => b.value - a.value || a.priority - b.priority);
  return stats[0].type;
}

/** Derive computed stats for an agent at a given level */
export function deriveStats(seed: string, level: number, shiny: boolean): AgentStats {
  const [hpMult, atkMult, defMult, spdMult] = hashSeedWeighted(seed);
  const shinyBoost = shiny ? 1.15 : 1.0;
  const base = 10 + level * 3;
  const type = getAgentType(seed);

  const mults = { hp: hpMult, atk: atkMult, def: defMult, spd: spdMult };
  const statKeys: (keyof typeof mults)[] = ['hp', 'atk', 'def', 'spd'];

  const dominantStat: keyof typeof mults =
    type === 'researcher' ? 'hp' :
    type === 'generator' ? 'atk' :
    type === 'thinker' ? 'def' : 'spd';

  let lowestKey: keyof typeof mults = 'hp';
  let lowestVal = Infinity;
  for (const k of statKeys) {
    if (k !== dominantStat && mults[k] < lowestVal) {
      lowestVal = mults[k];
      lowestKey = k;
    }
  }

  const finalMults = { ...mults };
  finalMults[dominantStat] *= 1.25;
  finalMults[lowestKey] *= 0.85;

  return {
    hp:  Math.floor(base * 3 * finalMults.hp * shinyBoost),
    atk: Math.floor(base * finalMults.atk * shinyBoost),
    def: Math.floor(base * finalMults.def * shinyBoost),
    spd: Math.floor(base * finalMults.spd * shinyBoost),
  };
}

/** Get stat rating label from raw multiplier value */
export function getStatRating(multiplier: number): string {
  if (multiplier >= 1.28) return 'Elite';
  if (multiplier >= 1.18) return 'Great';
  if (multiplier >= 1.05) return 'Good';
  if (multiplier >= 0.90) return 'Average';
  return 'Poor';
}

/** Get raw stat multipliers for display purposes */
export function getRawStatMultipliers(seed: string): { hp: number; atk: number; def: number; spd: number } {
  const [hp, atk, def, spd] = hashSeedWeighted(seed);
  return { hp, atk, def, spd };
}

const LEVEL_THRESHOLDS = [0, 10000, 25000, 50000, 100000, 175000, 275000, 400000, 600000, 1000000];

/** Get XP needed for a specific level */
export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 150000;
}
