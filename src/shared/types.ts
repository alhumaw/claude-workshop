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
  teamId?: string; // team name if part of a team
  teamRole?: 'lead' | 'teammate';
  teamAgentName?: string; // agent name within the team (e.g., "writer-1")
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
  PERSIST_SAVE: 'persist:save',
  PERSIST_LOAD: 'persist:load',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  OBSIDIAN_EXPORT: 'obsidian:export',
  TEAM_CREATE: 'team:create',
  TEAM_DELETE: 'team:delete',
  TEAM_LIST: 'team:list',
  TEAM_ADD_MEMBER: 'team:add-member',
} as const;
