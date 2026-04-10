import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { SessionInfo } from '../shared/types';

const DATA_DIR = path.join(homedir(), '.agentmux');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

interface PersistedState {
  version: 1;
  sessions: Array<{
    name: string;
    cwd: string;
    avatarSeed: string;
    claudeSessionId: string;
    contextPercent: number;
    cost: string;
    model: string;
    branch: string;
    teamId?: string;
    teamRole?: 'lead' | 'teammate';
    teamAgentName?: string;
  }>;
  activeSessionIndex: number;
}

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function saveSessions(sessions: SessionInfo[], activeSessionId: string | null): Promise<void> {
  await ensureDir();
  const activeIndex = activeSessionId
    ? sessions.findIndex((s) => s.id === activeSessionId)
    : 0;

  const state: PersistedState = {
    version: 1,
    sessions: sessions
      .filter((s) => s.status !== 'exited')
      .map((s) => ({
        name: s.name,
        cwd: s.cwd,
        avatarSeed: s.avatarSeed,
        claudeSessionId: s.claudeSessionId,
        contextPercent: s.contextPercent,
        cost: s.cost,
        model: s.model,
        branch: s.branch,
        teamId: s.teamId,
        teamRole: s.teamRole,
        teamAgentName: s.teamAgentName,
      })),
    activeSessionIndex: Math.max(0, activeIndex),
  };

  await writeFile(SESSIONS_FILE, JSON.stringify(state, null, 2));
}

export async function loadSessions(): Promise<PersistedState | null> {
  try {
    const data = await readFile(SESSIONS_FILE, 'utf-8');
    const state = JSON.parse(data) as PersistedState;
    if (state.version !== 1) return null;
    return state;
  } catch {
    return null;
  }
}

export async function clearSessions(): Promise<void> {
  try {
    await writeFile(SESSIONS_FILE, JSON.stringify({ version: 1, sessions: [], activeSessionIndex: 0 }));
  } catch {}
}
