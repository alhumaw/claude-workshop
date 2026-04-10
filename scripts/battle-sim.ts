/**
 * Battle System Balance Simulator — Survival to Lv.100
 * Feeds every agent enough XP to reach 100. Measures who survives.
 * Run with: npx tsx scripts/battle-sim.ts
 */

import {
  hashSeedWeighted, createBattleState, processBattle, calculateLevel,
} from '../src/main/battle-engine';
import { getStatRating } from '../src/shared/battle-utils';
import { randomBytes } from 'crypto';

const NUM_AGENTS = 10000;
const XP_PER_TICK = 50000;

function simulateAgent(seed: string): { level: number; dead: boolean; wins: number; losses: number; avgMult: number; isShiny: boolean; type: string } {
  const state = createBattleState(seed);
  const mults = hashSeedWeighted(seed);
  const avgMult = mults.reduce((a, b) => a + b, 0) / 4;

  while (state.level < 100 && !state.isDead) {
    const prevLevel = state.level;
    state.xp += XP_PER_TICK;
    state.tokensSinceLastBattle += XP_PER_TICK;
    state.level = calculateLevel(state.xp);
    state.peakLevel = Math.max(state.peakLevel, state.level);

    // Boss on level milestone (every 5 levels)
    const crossedMilestone = state.level > prevLevel
      && Math.floor(state.level / 5) > Math.floor(prevLevel / 5);

    if (state.tokensSinceLastBattle >= state.nextBattleThreshold || crossedMilestone) {
      if (crossedMilestone) {
        state.battlesCompleted = Math.ceil((state.battlesCompleted + 1) / 5) * 5 - 1;
      }
      processBattle(state, seed);
    }
  }

  return {
    level: state.level,
    dead: state.isDead,
    wins: state.wins,
    losses: state.losses,
    avgMult,
    isShiny: state.isShiny,
    type: state.type,
  };
}

// ─── Run ────────────────────────────────────────────────────────────────────

console.log(`\n⚔  Survival to Lv.100 — ${NUM_AGENTS} agents\n`);

const results = Array.from({ length: NUM_AGENTS }, () => simulateAgent(randomBytes(4).toString('hex')));

function tier(avg: number): string {
  if (avg >= 1.28) return 'Elite';
  if (avg >= 1.18) return 'Great';
  if (avg >= 1.05) return 'Good';
  if (avg >= 0.90) return 'Average';
  return 'Poor';
}

// Overall
const survived = results.filter(r => !r.dead).length;
const died = results.filter(r => r.dead).length;
console.log(`  Survived to 100: ${survived}/${NUM_AGENTS} (${((survived/NUM_AGENTS)*100).toFixed(1)}%)`);
console.log(`  Died trying:     ${died}/${NUM_AGENTS} (${((died/NUM_AGENTS)*100).toFixed(1)}%)`);

// Death level distribution
const deadLevels = results.filter(r => r.dead).map(r => r.level).sort((a, b) => a - b);
if (deadLevels.length > 0) {
  const p25 = deadLevels[Math.floor(deadLevels.length * 0.25)];
  const p50 = deadLevels[Math.floor(deadLevels.length * 0.50)];
  const p75 = deadLevels[Math.floor(deadLevels.length * 0.75)];
  console.log(`  Death level:      p25=${p25} median=${p50} p75=${p75}`);
}

// By tier
console.log('\n  BY STAT TIER:');
for (const t of ['Poor', 'Average', 'Good', 'Great', 'Elite']) {
  const group = results.filter(r => tier(r.avgMult) === t);
  if (group.length === 0) continue;
  const surv = group.filter(r => !r.dead).length;
  const pct = ((surv / group.length) * 100).toFixed(1);
  console.log(`  ${t.padEnd(8)} ${String(group.length).padStart(5)} agents | ${pct}% survive to 100`);
}

// By shiny
const shiny = results.filter(r => r.isShiny);
const nonShiny = results.filter(r => !r.isShiny);
console.log('\n  SHINY:');
console.log(`  Shiny:     ${shiny.filter(r => !r.dead).length}/${shiny.length} survive (${((shiny.filter(r=>!r.dead).length/Math.max(1,shiny.length))*100).toFixed(1)}%)`);
console.log(`  Non-Shiny: ${nonShiny.filter(r => !r.dead).length}/${nonShiny.length} survive (${((nonShiny.filter(r=>!r.dead).length/Math.max(1,nonShiny.length))*100).toFixed(1)}%)`);

// By type
console.log('\n  BY TYPE:');
for (const t of ['thinker', 'generator', 'researcher', 'debugger']) {
  const group = results.filter(r => r.type === t);
  const surv = group.filter(r => !r.dead).length;
  console.log(`  ${t.padEnd(12)} ${((surv/group.length)*100).toFixed(1)}% survive (${surv}/${group.length})`);
}

console.log('');
