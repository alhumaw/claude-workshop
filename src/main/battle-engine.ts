// Battle Engine — pure game logic, no UI or Electron dependencies.
// All functions are deterministic given the same seed/inputs (except combat rolls).

import { AgentBattleState, BattleResultInfo, LootItem } from '../shared/types';
import { getBiome } from '../shared/biomes';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentType = 'thinker' | 'generator' | 'researcher' | 'debugger';
export type MobType = AgentType;
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type EquipSlot = 'weapon' | 'armor' | 'accessory';

export interface AgentStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface Mob {
  name: string;
  level: number;
  type: MobType;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
  isRare: boolean;
}

export interface CombatRound {
  attacker: 'agent' | 'mob';
  damage: number;
  passive?: string;
  agentHp: number;
  mobHp: number;
}

export interface BattleResult {
  won: boolean;
  rounds: CombatRound[];
  agentHpRemaining: number;
  mobHpRemaining: number;
  xpGained: number;
  xpLost: number;
  mob: Mob;
}

export interface BorderTier {
  name: string;
  title: string;
  color: string;
  cssClass: string;
}

// AgentBattleState is imported from shared/types

// ─── Constants ──────────────────────────────────────────────────────────────

const ADJECTIVES = [
  'Shadow', 'Blazing', 'Frozen', 'Silent', 'Rogue',
  'Iron', 'Mystic', 'Crimson', 'Phantom', 'Void',
  'Emerald', 'Thunder', 'Obsidian', 'Astral', 'Neon',
];

const NOUNS = [
  'Fang', 'Spark', 'Wraith', 'Golem', 'Cipher',
  'Sentinel', 'Shade', 'Flux', 'Drift', 'Byte',
  'Pulse', 'Core', 'Shard', 'Viper', 'Specter',
];

export const COMMON_MOBS: { name: string; type: MobType }[] = [
  { name: 'File Gremlin', type: 'debugger' },
  { name: 'Null Pointer', type: 'generator' },
  { name: 'Syntax Error', type: 'thinker' },
  { name: 'Type Mismatch', type: 'researcher' },
  { name: 'Import Cycle', type: 'debugger' },
  { name: 'Stale Cache', type: 'thinker' },
  { name: 'Lint Violation', type: 'generator' },
  { name: 'Flaky Test', type: 'debugger' },
];

export const UNCOMMON_MOBS: { name: string; type: MobType }[] = [
  { name: 'Race Condition', type: 'debugger' },
  { name: 'Memory Leak', type: 'researcher' },
  { name: 'Stack Overflow', type: 'generator' },
  { name: 'Circular Dependency', type: 'thinker' },
  { name: 'Phantom Read', type: 'debugger' },
];

export const BOSS_MOBS: { name: string; type: MobType }[] = [
  { name: 'The Legacy Codebase', type: 'researcher' },
  { name: 'The OOM Killer', type: 'generator' },
  { name: 'The Deadlock', type: 'thinker' },
  { name: 'The Infinite Loop', type: 'researcher' },
  { name: 'The Segfault Demon', type: 'generator' },
  { name: 'The Rate Limiter', type: 'debugger' },
  { name: 'The Merge Conflict From Hell', type: 'thinker' },
];

const LEVEL_THRESHOLDS = [
  0,        // Lv.1
  10000,    // Lv.2
  25000,    // Lv.3
  50000,    // Lv.4
  100000,   // Lv.5
  175000,   // Lv.6
  275000,   // Lv.7
  400000,   // Lv.8
  600000,   // Lv.9
  1000000,  // Lv.10
];

// Type matchup: attacker[defender] = multiplier
const TYPE_MATCHUP: Record<AgentType, Record<MobType, number>> = {
  thinker:    { thinker: 1.0, generator: 1.4, researcher: 0.75, debugger: 1.0 },
  generator:  { thinker: 0.75, generator: 1.0, researcher: 1.0, debugger: 1.4 },
  researcher: { thinker: 1.0, generator: 0.75, researcher: 1.0, debugger: 1.4 },
  debugger:   { thinker: 1.4, generator: 1.0, researcher: 0.75, debugger: 1.0 },
};

// ─── Seed Hashing ───────────────────────────────────────────────────────────

/** Simple 32-bit hash (FNV-1a variant) */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/** Generate multiple hash values from a seed by appending index */
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
  if (uniform < 0.40) {
    return 0.75 + (uniform / 0.40) * 0.15;          // 0.75-0.90
  } else if (uniform < 0.70) {
    return 0.90 + ((uniform - 0.40) / 0.30) * 0.15; // 0.90-1.05
  } else if (uniform < 0.90) {
    return 1.05 + ((uniform - 0.70) / 0.20) * 0.13; // 1.05-1.18
  } else if (uniform < 0.99) {
    return 1.18 + ((uniform - 0.90) / 0.09) * 0.10; // 1.18-1.28
  } else {
    return 1.28 + ((uniform - 0.99) / 0.01) * 0.07; // 1.28-1.35
  }
}

/**
 * Derive 4 weighted stat multipliers from a seed.
 * Returns [hp, atk, def, spd] each in range 0.70-1.45.
 */
export function hashSeedWeighted(seed: string): [number, number, number, number] {
  const hashes = multiHash(seed, 4);
  return hashes.map(h => {
    const uniform = (h % 10000) / 10000; // 0.0000-0.9999
    return weightedStatValue(uniform);
  }) as [number, number, number, number];
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/** Check if agent is shiny — last 6 bits of hash are all 0 (~1/64) */
export function isShiny(seed: string): boolean {
  const hash = fnv1a(seed + ':shiny');
  return (hash & 0x3F) === 0;
}

/** Get agent type from dominant stat. Tiebreak: ATK > SPD > DEF > HP */
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

  // Apply type bonus (+25%) and penalty (-15%)
  const mults = { hp: hpMult, atk: atkMult, def: defMult, spd: spdMult };
  const statKeys: (keyof typeof mults)[] = ['hp', 'atk', 'def', 'spd'];

  // Find dominant and weakest stat (by raw multiplier)
  const dominantStat: keyof typeof mults =
    type === 'researcher' ? 'hp' :
    type === 'generator' ? 'atk' :
    type === 'thinker' ? 'def' : 'spd';

  // Find lowest stat (excluding dominant)
  let lowestKey: keyof typeof mults = 'hp';
  let lowestVal = Infinity;
  for (const k of statKeys) {
    if (k !== dominantStat && mults[k] < lowestVal) {
      lowestVal = mults[k];
      lowestKey = k;
    }
  }

  // Apply bonuses
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

/** Generate a deterministic battle name from seed */
export function generateBattleName(seed: string): string {
  const hashes = multiHash(seed, 2);
  const adj = ADJECTIVES[hashes[0] % ADJECTIVES.length];
  const noun = NOUNS[hashes[1] % NOUNS.length];
  return `${adj} ${noun}`;
}

/** Calculate level from total XP */
export function calculateLevel(xp: number): number {
  // Beyond level 10: +125k per level (calibrated for byte-based XP, ~7-8h to Lv.100)
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      if (i === LEVEL_THRESHOLDS.length - 1) {
        const excess = xp - LEVEL_THRESHOLDS[i];
        return i + 1 + Math.floor(excess / 150000);
      }
      return i + 1;
    }
  }
  return 1;
}

/** Get XP needed for a specific level */
export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  // Beyond level 10: last threshold + (level - 10) * 500k
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 150000;
}

/** Get win streak XP multiplier */
export function getStreakMultiplier(streak: number): number {
  if (streak <= 1) return 1.0;
  if (streak <= 4) return 1.5;
  if (streak <= 9) return 2.0;
  if (streak <= 19) return 3.0;
  return 5.0;
}

/** Roll next battle threshold (15k-35k tokens) */
export function rollNextBattleThreshold(): number {
  return 10000 + Math.floor(Math.random() * 15001);
}

// ─── Border Tiers ───────────────────────────────────────────────────────────

const BORDER_TIERS: { minLevel: number; tier: BorderTier }[] = [
  { minLevel: 100, tier: { name: 'eternal', title: 'Eternal', color: '', cssClass: 'border-eternal' } },
  { minLevel: 90, tier: { name: 'ascended', title: 'Ascended', color: '', cssClass: 'border-ascended' } },
  { minLevel: 75, tier: { name: 'legendary', title: 'Legendary', color: '', cssClass: 'border-legendary' } },
  { minLevel: 60, tier: { name: 'mythic', title: 'Mythic', color: '', cssClass: 'border-mythic' } },
  { minLevel: 50, tier: { name: 'diamond', title: 'Diamond', color: '', cssClass: 'border-diamond' } },
  { minLevel: 40, tier: { name: 'platinum', title: 'Platinum', color: '#E5E4E2', cssClass: 'border-platinum' } },
  { minLevel: 30, tier: { name: 'gold', title: 'Gold', color: '#FFD700', cssClass: 'border-gold' } },
  { minLevel: 20, tier: { name: 'silver', title: 'Silver', color: '#C0C0C0', cssClass: 'border-silver' } },
  { minLevel: 15, tier: { name: 'iron', title: 'Iron', color: '#71797E', cssClass: 'border-iron' } },
  { minLevel: 10, tier: { name: 'bronze', title: 'Bronze', color: '#CD7F32', cssClass: 'border-bronze' } },
  { minLevel: 5, tier: { name: 'rookie', title: 'Rookie', color: '#8B6914', cssClass: 'border-rookie' } },
  { minLevel: 1, tier: { name: 'none', title: '', color: '', cssClass: '' } },
];

/** Get border tier for a given level */
export function getBorderTier(level: number): BorderTier {
  for (const { minLevel, tier } of BORDER_TIERS) {
    if (level >= minLevel) return tier;
  }
  return BORDER_TIERS[BORDER_TIERS.length - 1].tier;
}

/** Get full display name with title prefix */
export function getDisplayName(battleName: string, level: number, shiny: boolean): string {
  const tier = getBorderTier(level);
  const prefix = shiny ? 'Shiny ' : '';
  const title = tier.title ? tier.title + ' ' : '';
  return `${prefix}${title}${battleName}`;
}

// ─── Mob Generation ─────────────────────────────────────────────────────────

/** Generate a mob for a given agent level and battle count */
export function generateMob(agentLevel: number, battleCount: number, wins: number = 0, losses: number = 0): Mob {
  const isBoss = battleCount > 0 && battleCount % 5 === 0;
  const isRare = !isBoss && Math.random() < 0.05;

  let template: { name: string; type: MobType };
  let level: number;

  if (isBoss) {
    template = BOSS_MOBS[Math.floor(Math.random() * BOSS_MOBS.length)];
    level = agentLevel + 1; // bosses 1 above agent level
  } else if (isRare) {
    // Rare: uncommon mob with Shiny prefix, +3 levels
    const pool = [...COMMON_MOBS, ...UNCOMMON_MOBS];
    const base = pool[Math.floor(Math.random() * pool.length)];
    template = { name: `Shiny ${base.name}`, type: base.type };
    level = agentLevel + 3;
  } else {
    // Normal: weighted toward common, some uncommon
    const roll = Math.random();
    const pool = roll < 0.7 ? COMMON_MOBS : UNCOMMON_MOBS;
    template = pool[Math.floor(Math.random() * pool.length)];
    // Dynamic difficulty: aggressive rubber-banding on win rate
    // >90% = mobs ABOVE agent level, 85-90% = at level, <70% = big gap below
    const totalFights = wins + losses;
    const winRate = totalFights > 10 ? wins / totalFights : 0.80;
    const baseGap = Math.max(1, Math.floor(agentLevel * 0.05));
    if (winRate > 0.90) {
      level = agentLevel + Math.floor(Math.random() * 8) + 4; // 4-11 ABOVE agent
    } else if (winRate > 0.87) {
      level = agentLevel + Math.floor(Math.random() * 5) + 3; // 3-7 ABOVE
    } else if (winRate > 0.75) {
      level = agentLevel; // at agent level — no free gap
    } else {
      const baseGap = Math.max(1, Math.floor(agentLevel * 0.03));
      level = Math.max(1, agentLevel - Math.floor(Math.random() * baseGap));
    }
  }

  // Base stats for mob
  const base = 10 + level * 3;
  const variance = () => 0.9 + Math.random() * 0.2; // ±10%

  // Type bonus/penalty for mobs same as agents
  const statMults = { hp: variance(), atk: variance(), def: variance(), spd: variance() };
  const dominantStat: keyof typeof statMults =
    template.type === 'researcher' ? 'hp' :
    template.type === 'generator' ? 'atk' :
    template.type === 'thinker' ? 'def' : 'spd';
  const statKeys = ['hp', 'atk', 'def', 'spd'] as const;
  let lowestKey: keyof typeof statMults = 'hp';
  let lowestVal = Infinity;
  for (const k of statKeys) {
    if (k !== dominantStat && statMults[k] < lowestVal) {
      lowestVal = statMults[k];
      lowestKey = k;
    }
  }
  statMults[dominantStat] *= 1.25;
  statMults[lowestKey] *= 0.85;

  const bossMultiplier = isBoss ? 1.2 : 1.0; // bosses get 20% more HP
  const rareMultiplier = isRare ? 1.2 : 1.0;

  return {
    name: template.name,
    level,
    type: template.type,
    hp:  Math.floor(base * 3 * statMults.hp * bossMultiplier * rareMultiplier),
    atk: Math.floor(base * statMults.atk * rareMultiplier),
    def: Math.floor(base * statMults.def * rareMultiplier),
    spd: Math.floor(base * statMults.spd * rareMultiplier),
    isBoss,
    isRare,
  };
}

// ─── Loot Table ─────────────────────────────────────────────────────────────

const LOOT_TABLE: LootItem[] = [
  { id: 'rusty-sword', name: 'Rusty Sword', rarity: 'common', slot: 'weapon', statBoost: { stat: 'atk', pct: 3 }, description: 'Small sword pixel overlay' },
  { id: 'debug-monocle', name: 'Debug Monocle', rarity: 'common', slot: 'accessory', statBoost: { stat: 'spd', pct: 3 }, description: 'Single bright pixel near eye' },
  { id: 'bit-shield', name: 'Bit Shield', rarity: 'common', slot: 'armor', statBoost: { stat: 'def', pct: 3 }, description: 'Faint border glow' },
  { id: 'health-potion', name: 'Health Patch', rarity: 'common', slot: 'accessory', statBoost: { stat: 'hp', pct: 3 }, description: 'Green tint on pixels' },
  { id: 'firewall-shield', name: 'Firewall Shield', rarity: 'uncommon', slot: 'armor', statBoost: { stat: 'def', pct: 5 }, description: 'Orange border glow' },
  { id: 'golden-keyboard', name: 'Golden Keyboard', rarity: 'uncommon', slot: 'weapon', statBoost: { stat: 'atk', pct: 5 }, description: 'Gold pixel overlay' },
  { id: 'ram-stick', name: 'RAM Stick', rarity: 'uncommon', slot: 'accessory', statBoost: { stat: 'hp', pct: 5 }, description: 'Cyan tint on pixels' },
  { id: 'overclock-chip', name: 'Overclock Chip', rarity: 'uncommon', slot: 'accessory', statBoost: { stat: 'spd', pct: 5 }, description: 'Yellow spark effect' },
  { id: 'chromatic-shell', name: 'Chromatic Shell', rarity: 'rare', slot: 'armor', statBoost: { stat: 'def', pct: 8 }, description: 'Rainbow-shifting border' },
  { id: 'void-cloak', name: 'Void Cloak', rarity: 'rare', slot: 'accessory', statBoost: { stat: 'spd', pct: 8 }, description: 'Dark particle trail' },
  { id: 'plasma-blade', name: 'Plasma Blade', rarity: 'rare', slot: 'weapon', statBoost: { stat: 'atk', pct: 8 }, description: 'Glowing blade overlay' },
  { id: 'crown-of-codebase', name: 'Crown of the Codebase', rarity: 'legendary', slot: 'accessory', statBoost: { stat: 'hp', pct: 12 }, description: 'Animated crown + sparkle' },
  { id: 'excalibash', name: 'Excalibash', rarity: 'legendary', slot: 'weapon', statBoost: { stat: 'atk', pct: 12 }, description: 'Glowing sword + light rays' },
  { id: 'aegis-protocol', name: 'Aegis Protocol', rarity: 'legendary', slot: 'armor', statBoost: { stat: 'def', pct: 12 }, description: 'Radiant shield aura' },
];

export function rollLoot(isBoss: boolean): LootItem | null {
  const roll = Math.random() * 100;
  let rarity: LootItem['rarity'];

  if (isBoss) {
    if (roll < 10) rarity = 'legendary';
    else if (roll < 35) rarity = 'rare';
    else if (roll < 95) rarity = 'uncommon';
    else return null;
  } else {
    if (roll < 2) rarity = 'rare';
    else if (roll < 12) rarity = 'uncommon';
    else if (roll < 52) rarity = 'common';
    else return null;
  }

  const pool = LOOT_TABLE.filter(i => i.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Combat Resolution ──────────────────────────────────────────────────────

/** Resolve a full combat encounter */
export function resolveCombat(
  agentStats: AgentStats,
  agentType: AgentType,
  mob: Mob,
  winStreak: number,
  hasWoundedDebuff: boolean,
  level: number = 1,
): BattleResult {
  const rounds: CombatRound[] = [];

  // Apply wounded debuff (-20% all stats if 3 consecutive losses)
  const woundedMult = hasWoundedDebuff ? 0.80 : 1.0;
  // No home advantage — combat math stands on its own
  let agentHp = Math.floor(agentStats.hp * woundedMult);
  const agentAtk = Math.floor(agentStats.atk * woundedMult);
  const agentDef = Math.floor(agentStats.def * woundedMult);
  const agentSpd = Math.floor(agentStats.spd * woundedMult);

  let mobHp = mob.hp;
  const maxAgentHp = agentHp;

  const typeMultAgent = TYPE_MATCHUP[agentType][mob.type];
  const typeMultMob = TYPE_MATCHUP[mob.type][agentType];

  // Determine turn order and double-hit
  const agentFirst = agentSpd >= mob.spd;
  const spdRatio = agentFirst ? agentSpd / Math.max(1, mob.spd) : mob.spd / Math.max(1, agentSpd);
  const fasterGetsDouble = spdRatio > 1.5;

  const MAX_ROUNDS = 20; // safety cap

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (agentHp <= 0 || mobHp <= 0) break;

    const firstIsAgent = agentFirst;
    const hitsForFirst = (firstIsAgent && fasterGetsDouble) ? 2 : 1;
    const hitsForSecond = (!firstIsAgent && fasterGetsDouble) ? 2 : 1;

    // First attacker's turns
    for (let hit = 0; hit < hitsForFirst; hit++) {
      if (agentHp <= 0 || mobHp <= 0) break;
      if (firstIsAgent) {
        const result = doAgentAttack(agentAtk, mob.def, typeMultAgent, agentType, agentHp, maxAgentHp, mobHp, level);
        agentHp = result.agentHp;
        mobHp = result.mobHp;
        rounds.push({ attacker: 'agent', damage: result.damage, passive: result.passive, agentHp, mobHp });
      } else {
        const result = doMobAttack(mob.atk, agentDef, typeMultMob, mob.type, agentHp, mobHp, agentType);
        agentHp = result.agentHp;
        mobHp = result.mobHp;
        rounds.push({ attacker: 'mob', damage: result.damage, passive: result.passive, agentHp, mobHp });
      }
    }

    // Second attacker's turns
    for (let hit = 0; hit < hitsForSecond; hit++) {
      if (agentHp <= 0 || mobHp <= 0) break;
      if (!firstIsAgent) {
        const result = doAgentAttack(agentAtk, mob.def, typeMultAgent, agentType, agentHp, maxAgentHp, mobHp, level);
        agentHp = result.agentHp;
        mobHp = result.mobHp;
        rounds.push({ attacker: 'agent', damage: result.damage, passive: result.passive, agentHp, mobHp });
      } else {
        const result = doMobAttack(mob.atk, agentDef, typeMultMob, mob.type, agentHp, mobHp, agentType);
        agentHp = result.agentHp;
        mobHp = result.mobHp;
        rounds.push({ attacker: 'mob', damage: result.damage, passive: result.passive, agentHp, mobHp });
      }
    }

    // End-of-round: Researcher passive (Deep Dive: regen 3% max HP)
    if (agentType === 'researcher' && agentHp > 0) {
      const regen = Math.floor(maxAgentHp * 0.01);
      agentHp = Math.min(maxAgentHp, agentHp + regen);
    }
  }

  const won = agentHp > 0 && mobHp <= 0;
  const streakMult = getStreakMultiplier(winStreak);
  // Battle XP: flat reward, doesn't scale with level (prevents runaway feedback loop)
  const baseXp = mob.isBoss ? 2000 : 500;
  const xpGained = won ? Math.floor(baseXp * streakMult) : 0;
  const xpLost = won ? 0 : 0; // XP loss is calculated by the caller (10% of total)

  return {
    won,
    rounds,
    agentHpRemaining: Math.max(0, agentHp),
    mobHpRemaining: Math.max(0, mobHp),
    xpGained,
    xpLost: 0, // placeholder — caller applies 10% total XP loss
    mob,
  };
}

function doAgentAttack(
  atk: number, mobDef: number, typeMult: number, agentType: AgentType,
  agentHp: number, maxAgentHp: number, mobHp: number, level: number,
): { damage: number; agentHp: number; mobHp: number; passive?: string } {
  let damage = Math.max(1, Math.floor((atk - mobDef / 2) * typeMult * (0.8 + Math.random() * 0.4)));
  let passive: string | undefined;

  // Critical hit — scales with level: 10% base + 0.1% per level, caps at 25%
  const critChance = Math.min(0.25, 0.10 + level * 0.001);
  if (Math.random() < critChance) {
    damage = Math.floor(damage * 1.5);
    passive = 'CRIT';
  }

  // Generator passive: Burst Output — 15% chance to hit twice (stacks with crit)
  if (agentType === 'generator' && Math.random() < 0.15) {
    damage *= 2;
    passive = passive === 'CRIT' ? 'CRIT + Burst Output' : 'Burst Output';
  }

  mobHp -= damage;
  return { damage, agentHp, mobHp, passive };
}

function doMobAttack(
  mobAtk: number, agentDef: number, typeMult: number, mobType: MobType,
  agentHp: number, mobHp: number, agentType: AgentType,
): { damage: number; agentHp: number; mobHp: number; passive?: string; stunned?: boolean } {
  let passive: string | undefined;

  // Agent defensive passives trigger before mob damage
  // Thinker: Overthink — 20% chance to negate hit AND reflect mob's ATK as damage
  if (agentType === 'thinker' && Math.random() < 0.20) {
    const reflectDmg = Math.max(1, Math.floor(mobAtk * 0.5));
    return { damage: 0, agentHp, mobHp: mobHp - reflectDmg, passive: 'Overthink', stunned: false };
  }
  // Debugger: Breakpoint — 25% chance to stun mob AND counter-attack
  if (agentType === 'debugger' && Math.random() < 0.25) {
    const counterDmg = Math.max(1, Math.floor(mobAtk * 0.5));
    return { damage: 0, agentHp, mobHp: mobHp - counterDmg, passive: 'Breakpoint', stunned: true };
  }

  let damage = Math.max(1, Math.floor((mobAtk - agentDef / 2) * typeMult * (0.8 + Math.random() * 0.4)));

  // Mob type passives mirror agent types
  if (mobType === 'generator' && Math.random() < 0.15) {
    damage *= 2;
    passive = 'Burst Output';
  }

  agentHp -= damage;
  return { damage, agentHp, mobHp, passive, stunned: false };
}

// ─── Agent Defensive Passives (checked before mob damage applies) ───────────

/**
 * Check if agent's defensive passive triggers.
 * Called separately so combat can show the passive in the round log.
 * Thinker: 20% negate; Debugger: 25% stun (skip mob turn).
 */
export function checkAgentDefensivePassive(agentType: AgentType): { triggers: boolean; name: string } {
  if (agentType === 'thinker' && Math.random() < 0.30) {
    return { triggers: true, name: 'Overthink' };
  }
  if (agentType === 'debugger' && Math.random() < 0.35) {
    return { triggers: true, name: 'Breakpoint' };
  }
  return { triggers: false, name: '' };
}

// ─── Battle State Management ────────────────────────────────────────────────

/** Create initial battle state for a new agent */
export function createBattleState(seed: string): AgentBattleState {
  return {
    xp: 0,
    level: 1,
    battleName: generateBattleName(seed),
    type: getAgentType(seed),
    isShiny: isShiny(seed),
    isDead: false,
    morale: 3,
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestStreak: 0,
    bossKills: 0,
    consecutiveLosses: 0,
    battlesCompleted: 0,
    equippedItems: {},
    inventory: [],
    bestiary: {},
    milestones: [],
    tokensSinceLastBattle: 0,
    nextBattleThreshold: rollNextBattleThreshold(),
    revealedStats: [],
    pendingBattle: null,
    pendingMilestone: null,
    lastLossTime: 0,
    peakLevel: 1,
    battleLog: [],
  };
}

/**
 * Process a battle and update agent state.
 * Returns the serializable battle result (also stored on state.pendingBattle for the renderer).
 */
export function processBattle(state: AgentBattleState, seed: string): BattleResultInfo | null {
  if (state.isDead) return null;

  // Clamp morale to current max (handles legacy state from earlier iterations)
  state.morale = Math.min(3, state.morale);

  state.battlesCompleted++;
  const mob = generateMob(state.level, state.battlesCompleted, state.wins, state.losses);

  // Bonus pool: items only, capped at +25% total (no veteran bonus — prevents snowball)
  const itemBoostMap = { hp: 0, atk: 0, def: 0, spd: 0 };
  let itemPct = 0;
  for (const item of state.inventory) {
    if (typeof item === 'object' && item.statBoost) {
      const stat = item.statBoost.stat as keyof typeof itemBoostMap;
      if (stat in itemBoostMap) itemBoostMap[stat] += item.statBoost.pct / 100;
      itemPct += item.statBoost.pct / 100;
    }
  }
  const bonusCap = 0.25;
  const cappedItemPct = Math.min(bonusCap, itemPct);
  const itemScale = itemPct > 0 ? cappedItemPct / itemPct : 1;

  const rawStats = deriveStats(seed, state.level, state.isShiny);
  const agentStats: AgentStats = {
    hp:  Math.floor(rawStats.hp  * (1 + itemBoostMap.hp * itemScale)),
    atk: Math.floor(rawStats.atk * (1 + itemBoostMap.atk * itemScale)),
    def: Math.floor(rawStats.def * (1 + itemBoostMap.def * itemScale)),
    spd: Math.floor(rawStats.spd * (1 + itemBoostMap.spd * itemScale)),
  };

  const hasWoundedDebuff = state.consecutiveLosses >= 5;
  const result = resolveCombat(agentStats, state.type, mob, state.winStreak, hasWoundedDebuff, state.level);

  // Update bestiary
  const mobKey = mob.name.replace('Shiny ', '');
  if (!state.bestiary[mobKey]) {
    state.bestiary[mobKey] = { encountered: 0, defeated: 0, rare: mob.isRare };
  }
  state.bestiary[mobKey].encountered++;

  let xpLost = 0;

  if (result.won) {
    state.xp += result.xpGained;
    state.wins++;
    state.winStreak++;
    state.consecutiveLosses = 0;
    state.bestStreak = Math.max(state.bestStreak, state.winStreak);
    state.morale = Math.min(3, state.morale + 1);
    state.bestiary[mobKey].defeated++;
    if (mob.isBoss) state.bossKills++;

    // Loot drop
    const loot = rollLoot(mob.isBoss);
    if (loot && state.inventory.length < 8) {
      state.inventory.push(loot);
      // Auto-equip if slot is empty
      if (!state.equippedItems[loot.slot]) {
        state.equippedItems[loot.slot] = loot;
      }
    }
  } else {
    // Defeat: lose XP. Morale loss only after grace period.
    xpLost = Math.floor(state.xp * 0.02);
    state.xp = Math.max(0, state.xp - xpLost);
    state.losses++;
    state.winStreak = 0;
    state.consecutiveLosses++;
    state.lastLossTime = Date.now();

    // Morale loss only in unsafe biomes (Grassy Plains is safe)
    const biome = getBiome(state.level);
    if (!biome.safe) {
      state.morale = Math.max(0, state.morale - 1);
      if (state.morale <= 0) {
        state.isDead = true;
      }
    }
  }

  // Recalculate level
  state.level = calculateLevel(state.xp);
  state.peakLevel = Math.max(state.peakLevel, state.level);

  // Progressive stat reveal
  updateStatReveal(state);

  // Check milestones
  checkMilestones(state, result, mob);

  // Build serializable result for renderer
  const info: BattleResultInfo = {
    won: result.won,
    mobName: mob.name,
    mobLevel: mob.level,
    mobIsBoss: mob.isBoss,
    mobIsRare: mob.isRare,
    xpGained: result.xpGained,
    xpLost,
    agentHpRemaining: result.agentHpRemaining,
    agentHpMax: agentStats.hp,
    mobHpMax: mob.hp,
    roundCount: result.rounds.length,
    lootDrop: result.won ? (state.inventory.length > 0 ? state.inventory[state.inventory.length - 1] : undefined) : undefined,
  };

  // Battle log (keep last 50)
  state.battleLog.push(info);
  if (state.battleLog.length > 50) state.battleLog.shift();

  // Reset battle threshold
  state.tokensSinceLastBattle = 0;
  state.nextBattleThreshold = rollNextBattleThreshold();
  state.pendingBattle = info;

  return info;
}

function updateStatReveal(state: AgentBattleState): void {
  const allStats: ('hp' | 'atk' | 'def' | 'spd')[] = ['hp', 'atk', 'def', 'spd'];
  const count = state.battlesCompleted;
  let shouldReveal = 0;

  if (count >= 25) shouldReveal = 4;
  else if (count >= 15) shouldReveal = 3;
  else if (count >= 10) shouldReveal = 2;
  else if (count >= 5) shouldReveal = 1;

  // Deterministic reveal order based on existing state
  while (state.revealedStats.length < shouldReveal) {
    const unrevealed = allStats.filter(s => !state.revealedStats.includes(s));
    if (unrevealed.length === 0) break;
    // Pick the first unrevealed (deterministic order)
    state.revealedStats.push(unrevealed[0]);
  }
}

function checkMilestones(state: AgentBattleState, result: BattleResult, mob: Mob): void {
  const ms = state.milestones;
  const before = ms.length;

  if (result.won && state.wins === 1 && !ms.includes('First Blood')) {
    ms.push('First Blood');
  }
  if (result.won && !ms.includes('Untouchable')) {
    const tookDamage = result.rounds.some(r => r.attacker === 'mob' && r.damage > 0);
    if (!tookDamage) ms.push('Untouchable');
  }
  if (state.bestStreak >= 20 && !ms.includes('Streak Master')) {
    ms.push('Streak Master');
  }
  if (state.level >= 100 && !ms.includes('Centurion')) {
    ms.push('Centurion');
  }

  // Set pending milestone for toast notification
  if (ms.length > before) {
    state.pendingMilestone = ms[ms.length - 1];
  }
}

// ─── Token Parsing Helper ───────────────────────────────────────────────────

/** Parse "29k/1000k" → 29000 */
export function parseTokenCount(contextSize: string): number {
  const match = contextSize.match(/^(\d+)k/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 1000;
}

/** Parse "$0.42" or "<$0.01" → 0.42 or 0.01 */
export function parseCostValue(costStr: string): number {
  if (!costStr) return 0;
  const match = costStr.match(/\$?([\d.]+)/);
  if (!match) return 0;
  return parseFloat(match[1]) || 0;
}

/** Get stat rating label from multiplier value */
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
