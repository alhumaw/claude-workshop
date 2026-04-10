import { watch, existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { BrowserWindow } from 'electron';

export interface NativeTeamMember {
  agentId: string;
  name: string;
  agentType: string;
  model?: string;
  prompt?: string;
  color?: string;
  tmuxPaneId?: string;
  cwd: string;
  isActive?: boolean;
  backendType?: string;
  joinedAt: number;
}

export interface NativeTeamConfig {
  name: string;
  description: string;
  createdAt: number;
  leadAgentId: string;
  leadSessionId: string;
  members: NativeTeamMember[];
}

const TEAMS_DIR = path.join(homedir(), '.claude', 'teams');

/**
 * Watches ~/.claude/teams/ for native Claude Code team config changes.
 * When new members appear, emits events so Workshop can attach terminals.
 */
export class TeamWatcher {
  private getWindow: (() => BrowserWindow | null) | null = null;
  private watcher: ReturnType<typeof watch> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private knownMembers = new Map<string, Set<string>>();
  private onMemberAdded: ((config: NativeTeamConfig, member: NativeTeamMember) => void) | null = null;

  setWindowGetter(fn: () => BrowserWindow | null): void {
    this.getWindow = fn;
  }

  /** Register callback for when a new team member is detected */
  setOnMemberAdded(fn: (config: NativeTeamConfig, member: NativeTeamMember) => void): void {
    this.onMemberAdded = fn;
  }

  /** Find the claude-swarm-* tmux socket for a team by matching all its pane IDs */
  findSwarmSocketForTeam(config: NativeTeamConfig): string | null {
    const paneIds = config.members
      .map((m) => m.tmuxPaneId)
      .filter((id) => id && id.length > 0);
    if (paneIds.length === 0) return null;

    const tmpDir = `/tmp/tmux-${process.getuid?.() ?? 501}`;
    try {
      const { readdirSync } = require('fs');
      const { execFileSync } = require('child_process');
      const files = readdirSync(tmpDir);
      const swarmSockets = files.filter((f: string) => f.startsWith('claude-swarm-'));

      for (const socket of swarmSockets) {
        try {
          const output = execFileSync('tmux', ['-L', socket, 'list-panes', '-a', '-F', '#{pane_id}'], {
            encoding: 'utf-8',
            timeout: 2000,
            stdio: ['pipe', 'pipe', 'ignore'],
          });
          const socketPanes = new Set(output.split('\n').map((l: string) => l.trim()));
          if (paneIds.every((id) => socketPanes.has(id))) {
            return socket;
          }
        } catch {}
      }
    } catch {}
    return null;
  }

  start(): void {
    if (!existsSync(TEAMS_DIR)) return;

    // Initial snapshot
    this.scanAll();

    // Watch for file changes (fs.watch is unreliable for nested dirs, so also poll)
    try {
      this.watcher = watch(TEAMS_DIR, { recursive: true }, (_event, filename) => {
        if (filename && filename.endsWith('config.json')) {
          const teamName = filename.split(path.sep)[0];
          this.checkTeam(teamName);
        }
      });
    } catch {}

    // Poll every 5 seconds as backup (fs.watch misses some events)
    this.pollInterval = setInterval(() => this.scanAll(), 5000);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /** Read all team configs and detect changes */
  private scanAll(): void {
    if (!existsSync(TEAMS_DIR)) return;

    try {
      const dirs = readdirSync(TEAMS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const teamName of dirs) {
        this.checkTeam(teamName);
      }
    } catch {}
  }

  /** Check a single team config for new members */
  private checkTeam(teamName: string): void {
    const configPath = path.join(TEAMS_DIR, teamName, 'config.json');
    if (!existsSync(configPath)) return;

    let config: NativeTeamConfig;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return;
    }

    const known = this.knownMembers.get(teamName) ?? new Set();
    const currentIds = new Set(config.members.map((m) => m.agentId));

    // Detect new members
    for (const member of config.members) {
      if (!known.has(member.agentId)) {
        console.log(`[TeamWatcher] new member detected: ${member.name} in ${teamName}`);
        if (this.onMemberAdded) {
          this.onMemberAdded(config, member);
        }
        this.emitMemberAdded(config, member);
      }
    }

    // Detect removed members
    for (const id of known) {
      if (!currentIds.has(id)) {
        console.log(`[TeamWatcher] member removed: ${id} from ${teamName}`);
        this.emitMemberRemoved(teamName, id);
      }
    }

    this.knownMembers.set(teamName, currentIds);

    // Always emit full team state for UI sync
    this.emitTeamUpdate(config);
  }

  private emitMemberAdded(config: NativeTeamConfig, member: NativeTeamMember): void {
    const win = this.getWindow?.();
    if (!win) return;
    win.webContents.send('team:member-added', {
      teamName: config.name,
      leadSessionId: config.leadSessionId,
      member,
    });
  }

  private emitMemberRemoved(teamName: string, agentId: string): void {
    const win = this.getWindow?.();
    if (!win) return;
    win.webContents.send('team:member-removed', { teamName, agentId });
  }

  private emitTeamUpdate(config: NativeTeamConfig): void {
    const win = this.getWindow?.();
    if (!win) return;
    win.webContents.send('team:config-update', config);
  }

  /** Get all current team configs */
  getAllTeams(): NativeTeamConfig[] {
    if (!existsSync(TEAMS_DIR)) return [];

    const teams: NativeTeamConfig[] = [];
    try {
      const dirs = readdirSync(TEAMS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const teamName of dirs) {
        const configPath = path.join(TEAMS_DIR, teamName, 'config.json');
        if (!existsSync(configPath)) continue;
        try {
          teams.push(JSON.parse(readFileSync(configPath, 'utf-8')));
        } catch {}
      }
    } catch {}
    return teams;
  }

  /** Get a specific team config */
  getTeam(teamName: string): NativeTeamConfig | null {
    const configPath = path.join(TEAMS_DIR, teamName, 'config.json');
    if (!existsSync(configPath)) return null;
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return null;
    }
  }
}
