# Agent Battle System — Design Document

## Overview
A passive Pokemon-style battle system where agent avatars fight randomly-generated mobs as they work. Battles trigger automatically based on token consumption, play out in a brief overlay animation, and reward cosmetic upgrades. Zero user interaction required — it's a background progression system.

**Standalone sessions only.** Team agents (`teamId` set) are excluded from the battle system — no XP tracking, no battles, no level badges. They're worker bees, not fighters.

## Core Loop
```
Agent works → consumes tokens → gains XP → levels up →
battle triggers → auto-resolves → loot/cosmetics → repeat
```

---

## XP & Leveling

### XP Source
- **XP = cumulative tokens consumed.** Tracked by diffing `parseContextSize` between status polls.
- `parseContextSize` returns `"29k/1000k"` — parse the first number (current usage in k). Each poll, compute `delta = current - previous`. If delta > 0, add `delta * 1000` to lifetime XP. If delta < 0 (context compaction or /clear), ignore — XP never goes down from token tracking.
- Fallback: if `parseContextSize` is unavailable, use `parseCost` — parse the dollar amount, convert at ~$3/1M input tokens to estimate token count. Rough but directional.
- XP persists across app restarts (saved in `sessions.json` alongside existing fields).
- **XP triggers battles** — a mob encounter triggers after consuming a random amount between 15k–35k tokens (rolled after each battle). This variance prevents battles from feeling metronomic.
- **Winning any fight grants bonus XP.** Regular mobs grant `mob level × 50` bonus XP. Bosses grant `mob level × 250` (5x multiplier).
- **Leveling happens from total XP** — every fight contributes, bosses just accelerate it.

### State Persistence Rules
| Event | XP | Level | Items | Streak | Morale | Bestiary |
|-------|-----|-------|-------|--------|--------|----------|
| `/clear` | Kept | Kept | Kept | Kept | Kept | Kept |
| App restart | Kept | Kept | Kept | Reset to 0 | Kept | Kept |
| Handoff & Reset | Carried to new session | Carried | Carried | Reset to 0 | Carried | Carried |
| Fresh Session | New agent (new seed, new shiny roll) | 1 | Empty | 0 | 3 | Empty |
| Session killed | → Hall of Fame | — | — | — | — | — |
| Agent dies (0 morale) | Frozen | Frozen | Frozen | — | 0 | → Hall of Fame |

- **`/clear`**: Only resets Claude's context. XP is cumulative — already-earned XP stays. Battle state is tied to the Workshop session, not the Claude session ID.
- **App restart**: Battle state persists in `sessions.json`. Win streak resets since it's a session-level mechanic.
- **Handoff**: The old agent's battle state transfers to the new session — same `avatarSeed`, same identity. The agent gets fresh context but keeps its level, items, bestiary. Streak resets since the agent is effectively "resting."
- **Fresh Session**: A new agent with a new seed — starts from scratch. The old agent continues independently.
- **Session killed**: Final state goes to the Hall of Fame.

### Level Thresholds
| Level | Cumulative XP (tokens) |
|-------|----------------------|
| 1     | 0                    |
| 2     | 10,000               |
| 3     | 25,000               |
| 4     | 50,000               |
| 5     | 100,000              |
| 6     | 175,000              |
| 7     | 275,000              |
| 8     | 400,000              |
| 9     | 600,000              |
| 10    | 1,000,000            |

Exponential curve. Levels beyond 10 continue at +500k per level.

### Stat Derivation
Base stats are **deterministic from `avatarSeed`**. Each seed produces fixed ratios — but the distribution is **weighted toward mediocre**. Most agents are average; truly good stats are rare.

| Stat | Description                          |
|------|--------------------------------------|
| HP   | How much damage the agent can take   |
| ATK  | Damage dealt per hit                 |
| DEF  | Damage reduction per hit received    |
| SPD  | Who goes first; chance for double-hit|

**Stat Distribution (per stat):**
| Range | Probability | Rating |
|-------|------------|--------|
| 0.70–0.85 | 40% | Poor |
| 0.85–1.00 | 30% | Average |
| 1.00–1.15 | 20% | Good |
| 1.15–1.30 | 9% | Great |
| 1.30–1.45 | 1% | Elite |

A "perfect" agent (all 4 stats in the Great+ range) has roughly a **0.01%** chance of rolling naturally. Most agents will have 1-2 decent stats and 1-2 weak ones.

**Formula:**
```typescript
function deriveStats(seed: string, level: number, isShiny: boolean) {
  // Hash seed to 4 values using weighted distribution (skewed toward low)
  const hash = hashSeedWeighted(seed); // deterministic hash → 4 floats (0.7-1.45)
  const shinyBoost = isShiny ? 1.25 : 1.0;
  const base = 10 + level * 3;
  return {
    hp:  Math.floor(base * 3 * hash[0] * shinyBoost),
    atk: Math.floor(base * hash[1] * shinyBoost),
    def: Math.floor(base * hash[2] * shinyBoost),
    spd: Math.floor(base * hash[3] * shinyBoost),
  };
}
```

### Shiny Agents
**1 in 64 chance** on session creation. Determined by `avatarSeed` — if the last 6 bits of the seed hash are all 0, the agent is shiny.

**Visual:**
- Pixels shimmer with a subtle animation (alternating brightness)
- Secondary hue appears from Lv.1 (not Lv.50)
- Star icon (✦) next to the level badge
- Battle name prefixed with "Shiny" (e.g., `Shiny Blazing Cipher`)

**Stats:**
- All base stats multiplied by **1.25x** — a significant edge
- A shiny agent with average stats performs like a normal agent with great stats
- A shiny agent with great stats is a monster — genuinely elite

**Rarity context:**
- 1/64 chance to roll shiny × good stats being rare = a shiny with good stats is roughly **1 in 600**
- A shiny with Elite stats across the board is roughly **1 in 640,000**
- These agents are the ones that actually have a shot at Lv.100

Some agents are naturally tanky (high HP/DEF), some are glass cannons (high ATK/SPD). The user can't control this — it's baked into the seed they got when they created the session. You either rolled well or you didn't.

### Hidden Stats & Progressive Reveal
Stats are **hidden at spawn.** You don't know what you rolled until you fight.

| Milestone | What's Revealed |
|-----------|----------------|
| Spawn | Shiny status visible (can't hide the sparkle), but no stat info |
| 1st battle | Agent type revealed (Thinker/Generator/Researcher/Debugger) |
| 5th battle | One random stat rating shown (e.g., "ATK: Great") |
| 10th battle | Second stat revealed |
| 15th battle | Third stat revealed |
| 25th battle | All stats visible |

By 25 battles you know your full build. Early enough to make an informed decision about keeping the agent, late enough that you're already attached.

### Agent Battle Name
Each agent gets a randomly-generated battle name derived from `avatarSeed`. Two-part name: adjective + noun.

**Adjectives:** `Shadow`, `Blazing`, `Frozen`, `Silent`, `Rogue`, `Iron`, `Mystic`, `Crimson`, `Phantom`, `Void`, `Emerald`, `Thunder`, `Obsidian`, `Astral`, `Neon`

**Nouns:** `Fang`, `Spark`, `Wraith`, `Golem`, `Cipher`, `Sentinel`, `Shade`, `Flux`, `Drift`, `Byte`, `Pulse`, `Core`, `Shard`, `Viper`, `Specter`

Example: `Blazing Cipher`, `Void Sentinel`, `Neon Wraith`

The battle name is persistent (same seed = same name). Title prefix and avatar border upgrade at level milestones. **Border tiers track current level, not peak** — deleveling strips your border. You have to earn it back.

- Lv.1-4: bare name (`Blazing Cipher`) — no border
- Lv.5-9: `Rookie Blazing Cipher` — thin wood-brown border (`#8B6914`)
- Lv.10-14: `Bronze Blazing Cipher` — bronze border (`#CD7F32`)
- Lv.15-19: `Iron Blazing Cipher` — dark iron border (`#71797E`)
- Lv.20-29: `Silver Blazing Cipher` — silver border with faint shine (`#C0C0C0`)
- Lv.30-39: `Gold Blazing Cipher` — gold border with shimmer (`#FFD700`)
- Lv.40-49: `Platinum Blazing Cipher` — bright platinum border with glow (`#E5E4E2`)
- Lv.50-59: `Diamond Blazing Cipher` — animated ice-blue gradient border
- Lv.60-74: `Mythic Blazing Cipher` — slow-shifting rainbow gradient border
- Lv.75-89: `Legendary Blazing Cipher` — pulsing golden glow with outer halo
- Lv.90-99: `Ascended Blazing Cipher` — radiant animated aura, shifting colors
- Lv.100: `Eternal Blazing Cipher` — full pulsing aura with spinning gradient, max tier

### Agent Types
Derived from the dominant stat. The dominant stat gets a **+25% bonus**, and the lowest stat gets a **-15% penalty** (like Pokemon natures). Every agent has a clear strength and a clear weakness.

- **Thinker** (DEF dominant) — outlasts opponents. Strong defense, weak somewhere else.
  - Passive: `Overthink` — 20% chance to fully negate a hit
- **Generator** (ATK dominant) — hits hard. High damage, pays for it in durability or speed.
  - Passive: `Burst Output` — 15% chance to hit twice in one turn
- **Researcher** (HP dominant) — absorbs damage. Huge HP pool, but can't dish it out as well.
  - Passive: `Deep Dive` — regenerates 10% max HP at the end of each round
- **Debugger** (SPD dominant) — fast. Gets extra turns, but fragile.
  - Passive: `Breakpoint` — 25% chance to stun the mob for 1 turn

This means a Thinker with poor stats still has decent DEF (poor × 1.25 ≈ average) and genuinely bad lowest stat (poor × 0.85 = awful). The type always matters.

**Tied stats:** If two stats tie for highest, type is determined by priority order: ATK > SPD > DEF > HP. Ties are rare since the weighted distribution produces floats, but the tiebreaker is deterministic.

---

## Battle System

### Trigger
- A battle triggers after consuming a random amount between **15,000–35,000 tokens** (new threshold rolled after each battle). Keeps encounters unpredictable.
- Every 5th battle is a **boss encounter**.
- Battle trigger shown as a subtle sword icon pulse on the session card before the overlay plays.

### Mob Generation
Mobs are procedurally generated:

```typescript
interface Mob {
  name: string;       // e.g. "Null Pointer", "Race Condition"
  level: number;      // agent level ± variance
  type: MobType;      // determines matchup + stat spread
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
  isRare: boolean;    // shiny mob — boosted stats, better loot
}
```

**Mob names** (themed around programming pain):
- Common: `File Gremlin`, `Null Pointer`, `Syntax Error`, `Type Mismatch`, `Import Cycle`, `Stale Cache`, `Lint Violation`, `Flaky Test`
- Uncommon: `Race Condition`, `Memory Leak`, `Stack Overflow`, `Circular Dependency`, `Phantom Read`
- Rare (5% spawn chance): `Shiny` prefix variant — golden sprite, +3 levels above normal, guaranteed uncommon+ loot. Bestiary tracks rare encounters separately.
- Boss: `The Legacy Codebase`, `The OOM Killer`, `The Deadlock`, `The Infinite Loop`, `The Segfault Demon`, `The Rate Limiter`, `The Merge Conflict From Hell`

**Mob level scaling:**
- Normal mobs: `agentLevel + random(-2, +2)` (clamped to minimum 1)
- Bosses: `agentLevel + 2` (always harder)
- Rare mobs: `agentLevel + 3` (dangerous)

**Mob types & stat spreads:**
Each mob species has a fixed type that determines its stat emphasis. Mobs get the same +25%/-15% type curve as agents.

| Mob | Type | Strength | Weakness | Danger |
|-----|------|----------|----------|--------|
| File Gremlin | Debugger | Fast, stunny | Low HP | Low |
| Null Pointer | Generator | Hits hard | Fragile | Medium |
| Syntax Error | Thinker | Tanky | Slow | Low |
| Type Mismatch | Researcher | High HP | Low damage | Low |
| Import Cycle | Debugger | Fast | Glass cannon | Medium |
| Stale Cache | Thinker | Won't die | Barely hurts | Low |
| Lint Violation | Generator | Surprising damage | Paper thin | Low |
| Flaky Test | Debugger | Unpredictable | Inconsistent | Medium |
| Race Condition | Debugger | Extremely fast, double-hits | Very fragile | High |
| Memory Leak | Researcher | Massive HP, regens | Almost no damage | Medium |
| Stack Overflow | Generator | Huge burst damage | Dies if it doesn't kill fast | High |
| Circular Dependency | Thinker | Very high DEF | Slow, low ATK | Medium |
| Phantom Read | Debugger | Insane speed | 1 hit kills it | High |

**Boss stat multiplier:** Bosses get **1.5x all stats** on top of their +2 level advantage. No special mechanics for v1 — bosses are just stat-checked fights. Special mechanics (per-boss abilities) are a Phase 2 addition once the core loop proves fun.

**v2 Boss Mechanics (deferred):**

| Boss | Type | Special Mechanic |
|------|------|-----------------|
| The Legacy Codebase | Researcher | Massive HP. Spawns +1 DEF per round (stacks). Kill fast or lose. |
| The OOM Killer | Generator | One-shot mechanic: if your HP drops below 20%, instant kill. |
| The Deadlock | Thinker | Both sides stunned for 1 turn every 3 rounds. Favors high ATK. |
| The Infinite Loop | Researcher | Regenerates 15% HP per round. Must out-damage the regen. |
| The Segfault Demon | Generator | Random damage: hits for 0.5x-2.5x normal. Unpredictable. |
| The Rate Limiter | Debugger | Reduces your SPD to base for 3 turns. Negates speed advantage. |
| The Merge Conflict From Hell | Thinker | Copies your highest stat. Mirror match. |

**Mob stat variance:** Within their type curve, mobs also roll stats with slight variance (±10%). Two Null Pointers at the same level won't have identical stats. This prevents battles from being fully predictable.

**Mob type matchup:**
| Attacker → Defender | Thinker | Generator | Researcher | Debugger |
|---------------------|---------|-----------|------------|----------|
| Thinker             | 1.0x    | 1.3x     | 0.8x       | 1.0x     |
| Generator           | 0.8x    | 1.0x     | 1.0x       | 1.3x     |
| Researcher          | 1.0x    | 0.8x     | 1.0x       | 1.3x     |
| Debugger            | 1.3x    | 1.0x     | 0.8x       | 1.0x     |

### Combat Resolution
Turn-based, fully automatic. Kept simple — one damage formula, no layered multipliers.

```
1. Determine turn order by SPD (higher goes first)
   - If SPD difference > 50%, faster combatant gets 2 hits per round
2. Each turn:
   a. damage = (ATK - DEF/2) * typeMultiplier * random(0.8, 1.2)
   b. damage = max(1, floor(damage))
   c. Passive may trigger (single roll per turn)
   d. Subtract from defender HP
3. Repeat until one side reaches 0 HP
4. Typically resolves in 3-6 rounds
```

**Type advantage is flat:** 1.3x for advantage, 0.8x for disadvantage, 1.0x for neutral. One lookup, no table needed beyond the 4x4 matchup grid.

### Battle Outcome
- **Win:** Agent gets bonus XP (mob level × 50). Bosses give 5x XP. Chance for cosmetic loot drop. +1 morale (capped at 3).
- **Lose:**
  - Lose **10% of total XP**. You CAN delevel. A Lv.8 that loses hard drops back to Lv.7.
  - Win streak resets to 0.
  - −1 morale.
  - "Damaged" visual (desaturated avatar) for 2 minutes.
  - Lose 3 in a row → "Wounded" debuff: −20% all stats on next battle.

### Morale & Permadeath
Agents have a **morale counter** (0–3). Starts at 3.

| Event | Morale Change |
|-------|--------------|
| Win a battle | +1 (capped at 3) |
| Lose a battle | −1 |

**At 0 morale → Agent dies.** No recovery. No fainted state. Dead is dead.
- Avatar goes permanently grey.
- Final state saved to Hall of Fame.
- Battle state frozen — the agent's combat career is over.
- The session still works (it's just Claude Code), but the avatar is marked as fallen.
- To get a new fighter, spawn a new session (new seed = new roll).

**Why permadeath works despite no player agency:**
- The user's agency is in **which sessions they keep alive.** A session that's actively working earns tokens, levels up, and wins fights. A neglected session stagnates and eventually loses.
- Permadeath creates attachment. You care more about an agent that can die.
- The stats, matchups, and damage rolls create genuine narrative — "my Lv.42 Blazing Cipher survived a boss by 3 HP" is a story. "My Lv.42 agent incremented a counter" isn't.
- If it proves too punishing in practice, soften to: morale 0 = "fainted" for 50k tokens of work before recovery. But start with permadeath and see.

**What this means for reaching Lv.100:**
- You need a good seed (rare stats) + shiny (1/64) for a real shot
- You need to avoid 3 consecutive losses at any point in the entire journey
- Bad type matchups can end a run — a Lv.80 agent hitting 3 bad matchups in a row dies
- Bosses every 5th fight are +2 levels and genuinely dangerous
- Most agents die in the 20-50 range. Getting past 75 is exceptional. 100 is legendary.
- A Lv.100 Eternal Shiny agent is a once-in-a-lifetime achievement

---

## Loot System

### Drop Rates
| Rarity    | Normal Mob | Boss  |
|-----------|-----------|-------|
| Common    | 40%       | —     |
| Uncommon  | 10%       | 60%   |
| Rare      | 2%        | 25%   |
| Legendary | —         | 10%   |

### Item Types
Items are cosmetic modifications to the pixel art avatar:

**Equip Slots:**
- `Weapon` — visual overlay on the avatar (sword, wand, wrench, etc.)
- `Armor` — border/frame style on the session card
- `Accessory` — particle effect or color tint

**Examples:**
| Item | Rarity | Slot | Visual Effect |
|------|--------|------|---------------|
| Rusty Sword | Common | Weapon | Small sword pixel overlay |
| Debug Monocle | Common | Accessory | Single bright pixel near eye |
| Firewall Shield | Uncommon | Armor | Orange border glow |
| Golden Keyboard | Uncommon | Weapon | Gold pixel overlay |
| Chromatic Shell | Rare | Armor | Rainbow-shifting border |
| Void Cloak | Rare | Accessory | Dark particle trail |
| Crown of the Codebase | Legendary | Accessory | Animated crown + sparkle |
| Excalibash | Legendary | Weapon | Glowing sword + light rays |

### Storage
Items stored per-agent in the persistence layer:
```typescript
interface AgentBattleState {
  xp: number;
  level: number;
  battleName: string;     // deterministic from seed, e.g. "Blazing Cipher"
  type: 'thinker' | 'generator' | 'researcher' | 'debugger';
  isShiny: boolean;       // 1/64 chance — 25% stat boost, shimmer visual
  isDead: boolean;        // true when morale hits 0 — permadeath
  morale: number;         // 0-3, starts at 3, 0 = dead
  wins: number;
  losses: number;
  winStreak: number;      // current consecutive wins, resets on loss
  bestStreak: number;     // all-time best streak
  bossKills: number;
  equippedItems: { weapon?: string; armor?: string; accessory?: string };
  inventory: string[];
  pendingBoss: string | null;
  bestiary: Record<string, { encountered: number; defeated: number; rare: boolean }>;
  milestones: string[];
}
```

---

## Win Streak Multiplier

Consecutive wins stack a bonus XP multiplier:
| Streak | Multiplier |
|--------|-----------|
| 1      | 1.0x      |
| 2-4    | 1.5x      |
| 5-9    | 2.0x      |
| 10-19  | 3.0x      |
| 20+    | 5.0x      |

- Losing a fight resets streak to 0
- Streak count shown on the Agent Profile Card
- Active streak shown as a small flame icon on the session card (e.g. `🔥5`)

---

## Mob Bestiary

A collection log of every mob species encountered, accessible via context menu → "Bestiary":
- Grid of mob sprites with names underneath
- Each entry shows: times encountered, times defeated, win rate %
- Unencountered mobs shown as dark silhouettes (completionist bait)
- Bosses get a separate section with larger sprites and defeat count
- Total completion percentage at the top: `"42/67 discovered"`

---

## Avatar Evolution

At every 25 levels, the avatar's pixel art gets a deterministic mutation. **Mutations are permanent once earned** — deleveling doesn't remove them. If you hit Lv.50 and drop back to 48, you keep the dual-hue. This prevents visual flickering and rewards peak achievement.

- **Lv.25:** +1 active pixel (a new block lights up in the grid)
- **Lv.50:** secondary hue added — a second color appears in some pixels (`hsl(hue + 120, ...)`)
- **Lv.75:** saturation boost — all pixels become more vivid (60% → 80% saturation)
- **Lv.100:** full dual-tone — half pixels use primary hue, half use complementary, creating a striking pattern

The mutation is deterministic from the seed + level, so the same agent at the same level always looks the same. The change is subtle enough to notice over weeks, not minutes.

---

## Hall of Fame

When an agent's session ends (killed/exited), their final battle state is preserved:
- Accessible from Settings or a sidebar icon
- Shows a scrollable list of retired agents sorted by level (highest first)
- Each entry displays:
  - Avatar (at their final evolution state) with border tier
  - Battle name with title prefix
  - Final level
  - W-L record and win rate
  - Total tokens consumed (lifetime)
  - Best win streak
  - Boss kills
  - Time active (session duration)
- Hall of Fame persists in `~/.agentmux/hall-of-fame.json`
- Capped at 100 entries (oldest low-level agents pruned first)

---

## Milestones

One-time achievements that unlock a small badge on the Agent Profile Card. Tracked per-agent.

| Milestone | Condition | Badge |
|-----------|-----------|-------|
| First Blood | Win your first battle | ⚔ |
| Untouchable | Win a fight without taking damage | 🛡 |
| Streak Master | Reach a 20 win streak | 🔥 |
| Completionist | Discover all mob species in the bestiary | 📖 |
| Dragon Slayer | Defeat every boss type at least once | 🐉 |
| Shiny Hunter | Defeat 10 rare (Shiny) mobs | ✨ |
| Centurion | Reach Lv.100 | 👑 |

- Badges render as a small row of icons under the battle name on the profile card
- Earning a milestone triggers a toast notification: "🏆 Blazing Cipher earned Untouchable!"
- Milestones persist across restarts and carry into the Hall of Fame

---

## UI

### Battle Overlay
- **Size:** ~200×120px, floats over the session card
- **Duration:** 4 seconds
- **Content:**
  - Left: agent pixel sprite (from existing `AvatarPixels`)
  - Right: mob pixel sprite (generated from mob name hash)
  - Center: HP bars for both
  - Simple hit animations (flash white on damage)
  - Result text: "Victory!" or "Defeated..."
- **Auto-dismiss:** fades out after 4 seconds, never blocks work
- **Missed it?** Battle log accessible from session context menu

### Session Card Additions
- Tiny level badge: `Lv.7` in corner of avatar
- Equipped item visuals render on/around the avatar
- Sword icon pulses when a battle is about to trigger
- Brief muted colors after a loss (60 seconds)

### Agent Profile Card (Right-Click Avatar)
Right-clicking an agent's avatar opens a profile popover:
- **Avatar** — large pixel art sprite with equipped items
- **Battle name** — randomly-generated name with title prefix (e.g. `Elite Blazing Cipher`)
- **Type** — Thinker / Generator / Researcher / Debugger
- **Level** — current level + XP bar to next boss gate
- **W-L Ratio** — wins and losses displayed as `47W - 12L` with win rate percentage
- **Stats** — HP / ATK / DEF / SPD bars
- **Equipped items** — weapon, armor, accessory slots with item names
- **Boss kills** — count of bosses defeated (since level = boss kills)

### Battle Log (Context Menu → "Battle Log")
- Scrollable list of recent battles
- Each entry: `Lv.7 Blazing Cipher vs Lv.6 Null Pointer — Victory (+300 XP)`
- Shows current stats, equipped items, inventory

---

## Settings

### Disable Battle System
The entire battle system can be toggled off in Settings (`SettingsModal`):
- **Setting:** `enableBattleSystem` (boolean, default: `true`)
- **Stored in:** `AppConfig` (persisted via `config.ts`)
- **When disabled:**
  - No XP tracking, no battles trigger, no overlays
  - Level badge hidden from avatars
  - Battle-related context menu items hidden
  - Profile card shows standard session info only (no battle stats)
  - Existing battle state preserved (not deleted) — re-enabling restores progress
- **Toggle location:** Settings modal, checkbox labeled "Agent Battles"

---

## Implementation Plan

### Files to Create
- `src/main/battle-engine.ts` — core game logic (stats, combat, mob generation, loot, name generation, bestiary)
- `src/renderer/components/BattleOverlay.tsx` — battle animation overlay
- `src/renderer/components/BattleLog.tsx` — battle history modal
- `src/renderer/components/AgentProfileCard.tsx` — right-click avatar profile popover
- `src/renderer/components/MobSprite.tsx` — procedural mob pixel art from name hash
- `src/renderer/components/Bestiary.tsx` — mob collection grid modal
- `src/renderer/components/HallOfFame.tsx` — retired agent gallery modal

### Files to Modify
- `src/shared/types.ts` — add `AgentBattleState` to `SessionInfo`, add `enableBattleSystem` to `AppConfig`
- `src/main/session-manager.ts` — track tokens, trigger battles in `getAllStatus()`
- `src/main/persistence.ts` — save/restore battle state + hall of fame
- `src/main/config.ts` — add battle system toggle
- `src/renderer/components/SessionCard.tsx` — level badge, item visuals, battle trigger indicator, streak flame
- `src/renderer/components/AvatarPixels.tsx` — render border tiers, evolution mutations, right-click handler
- `src/renderer/components/Sidebar.tsx` — mount battle overlay, profile card, add battle log / bestiary to context menu
- `src/renderer/components/SettingsModal.tsx` — add "Agent Battles" toggle, Hall of Fame link

### Implementation Phases

**Phase 1 — Core Loop (MVP):**
1. `battle-engine.ts` — stats, combat, mob generation, name generator
2. State integration — add battle state to SessionInfo, XP accumulator from token tracking, persist
3. Settings toggle — enable/disable from SettingsModal
4. Session card visuals — level badge, border tiers
5. Battle overlay — 4-second auto-battle animation
6. Agent profile card — right-click avatar popover with stats, W-L, name

**Phase 2 — Depth (after MVP proves fun):**
7. Loot system — drop tables, equip slots, inventory
8. Item rendering — weapon/armor/accessory overlays on avatar
9. Avatar evolution — pixel mutations at Lv.25/50/75/100
10. Win streak flame icon + XP multiplier
11. Battle log — history modal

**Phase 3 — Collection (if engagement warrants):**
12. Mob bestiary — collection grid with silhouettes
13. Milestone badges — achievement tracking + toasts
14. Hall of Fame — retired agent gallery
15. Boss special mechanics — per-boss unique abilities
16. Shiny mob variants
