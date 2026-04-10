import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { SessionInfo, HallOfFameEntry } from '../shared/types';

const DATA_DIR = path.join(homedir(), '.agentmux');
const HOF_FILE = path.join(DATA_DIR, 'hall-of-fame.json');
const MAX_ENTRIES = 100;

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function saveToHallOfFame(session: SessionInfo, cause: 'permadeath' | 'killed'): Promise<void> {
  const bs = session.battleState;
  if (!bs) return;

  await ensureDir();
  const entries = await loadHallOfFame();

  const entry: HallOfFameEntry = {
    avatarSeed: session.avatarSeed,
    battleName: bs.battleName,
    type: bs.type,
    isShiny: bs.isShiny,
    level: bs.level,
    peakLevel: bs.peakLevel,
    wins: bs.wins,
    losses: bs.losses,
    bestStreak: bs.bestStreak,
    bossKills: bs.bossKills,
    milestones: bs.milestones,
    equippedItems: bs.equippedItems,
    retiredAt: Date.now(),
    causeOfDeath: cause,
  };

  entries.push(entry);

  // Sort by level desc, prune to MAX_ENTRIES
  entries.sort((a, b) => b.level - a.level);
  const pruned = entries.slice(0, MAX_ENTRIES);

  await writeFile(HOF_FILE, JSON.stringify(pruned, null, 2));
}

export async function loadHallOfFame(): Promise<HallOfFameEntry[]> {
  try {
    const data = await readFile(HOF_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}
