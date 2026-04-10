export interface LootItem {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  slot: 'weapon' | 'armor' | 'accessory';
  statBoost: { stat: string; pct: number };
  description: string;
}

export interface BattleResultInfo {
  won: boolean;
  mobName: string;
  mobLevel: number;
  mobIsBoss: boolean;
  mobIsRare: boolean;
  xpGained: number;
  xpLost: number;
  agentHpRemaining: number;
  agentHpMax: number;
  mobHpMax: number;
  roundCount: number;
  lootDrop?: LootItem;
}

export interface AgentBattleState {
  xp: number;
  level: number;
  battleName: string;
  type: 'thinker' | 'generator' | 'researcher' | 'debugger';
  isShiny: boolean;
  isDead: boolean;
  morale: number;
  wins: number;
  losses: number;
  winStreak: number;
  bestStreak: number;
  bossKills: number;
  consecutiveLosses: number;
  battlesCompleted: number;
  equippedItems: { weapon?: LootItem; armor?: LootItem; accessory?: LootItem };
  inventory: LootItem[];
  bestiary: Record<string, { encountered: number; defeated: number; rare: boolean }>;
  milestones: string[];
  tokensSinceLastBattle: number;
  nextBattleThreshold: number;
  revealedStats: ('hp' | 'atk' | 'def' | 'spd')[];
  pendingBattle: BattleResultInfo | null;
  pendingMilestone: string | null;
  lastLossTime: number;
  peakLevel: number;
  battleLog: BattleResultInfo[];
}

export interface HallOfFameEntry {
  avatarSeed: string;
  battleName: string;
  type: string;
  isShiny: boolean;
  level: number;
  peakLevel: number;
  wins: number;
  losses: number;
  bestStreak: number;
  bossKills: number;
  milestones: string[];
  equippedItems: { weapon?: LootItem; armor?: LootItem; accessory?: LootItem };
  retiredAt: number;
  causeOfDeath: 'permadeath' | 'killed';
}

export interface SessionInfo {
  id: string;
  name: string;
  status: 'idle' | 'generating' | 'thinking' | 'exited';
  branch: string;
  model: string;
  contextPercent: number;
  contextSize: string;
  cost: string;
  lastActivity: number; // timestamp
  cwd: string;
  avatarSeed: string; // seed for pixel art generation
  claudeSessionId: string; // UUID passed to claude --session-id, used for --resume
  awaitingApproval: boolean; // true when permission prompt ("Do you want to proceed?") is visible
  teamId?: string; // team name if part of a team
  teamRole?: 'lead' | 'teammate';
  teamAgentName?: string; // agent name within the team (e.g., "writer-1")
  battleState?: AgentBattleState;
}

export interface ToolkitAction {
  label: string;
  icon: string;
  command: string;
}

export interface ToolkitConfig {
  actions: ToolkitAction[];
}

export interface AppConfig {
  vaultPath: string; // path to Obsidian vault directory, empty string if not set
  enableBattleSystem: boolean;
}

export interface TeamMemberConfig {
  name: string;        // agent name (e.g., "team-lead", "writer-1")
  agentType: string;   // e.g., "team-lead", "general-purpose"
  model?: string;      // e.g., "claude-4-6-opus", "sonnet"
  cwd?: string;        // per-agent working directory
  promptFile?: string; // absolute path to prompt file to inject on startup
  color?: string;      // optional terminal color
}

export interface TeamInfo {
  id: string;                     // matches team-name used in file paths
  name: string;                   // display name
  description: string;
  createdAt: number;
  leadSessionId: string | null;   // Workshop session ID of lead agent
  memberSessionIds: string[];     // Workshop session IDs of all members (including lead)
  collapsed: boolean;             // sidebar UI state
}

// IPC channel names
export const IPC = {
  SESSION_SPAWN: 'session:spawn',
  SESSION_KILL: 'session:kill',
  SESSION_LIST: 'session:list',
  SESSION_RESIZE: 'session:resize',
  SESSION_STATUS_UPDATE: 'session:status-update',
  SESSION_CONTEXT_MENU: 'session:context-menu',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_GET_TEXT: 'terminal:get-text',
  TERMINAL_TEXT_RESPONSE: 'terminal:text-response',
  TOOLKIT_LOAD: 'toolkit:load',
  TOOLKIT_EXECUTE: 'toolkit:execute',
  TOOLKIT_HANDOFF: 'toolkit:handoff',
  TOOLKIT_FRESH_SESSION: 'toolkit:fresh-session',
  SESSION_RENAME: 'session:rename',
  SESSION_UPDATE_AVATAR: 'session:update-avatar',
  PERSIST_SAVE: 'persist:save',
  PERSIST_LOAD: 'persist:load',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  OBSIDIAN_EXPORT: 'obsidian:export',
  SHELL_SPAWN: 'shell:spawn',
  SHELL_WRITE: 'shell:write',
  SHELL_RESIZE: 'shell:resize',
  SHELL_KILL: 'shell:kill',
  SHELL_DATA: 'shell:data',
  TEAM_CREATE: 'team:create',
  TEAM_LIST: 'team:list',
  TEAM_SYNC: 'team:sync',
  TEAM_SCAN_ROLES: 'team:scan-roles',
  TEAM_SCAN_PROTOCOLS: 'team:scan-protocols',
  TEAM_SAVE_TEMPLATE: 'team:save-template',
  TEAM_LOAD_TEMPLATES: 'team:load-templates',
  TEAM_DELETE_TEMPLATE: 'team:delete-template',
  BATTLE_RESULT: 'battle:result',
  BATTLE_ADMIN: 'battle:admin',
  MILESTONE_EARNED: 'battle:milestone',
  HALL_OF_FAME_LOAD: 'hall-of-fame:load',
} as const;
