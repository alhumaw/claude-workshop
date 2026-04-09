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
  OBSIDIAN_EXPORT: 'obsidian:export',
  SHELL_SPAWN: 'shell:spawn',
  SHELL_WRITE: 'shell:write',
  SHELL_RESIZE: 'shell:resize',
  SHELL_KILL: 'shell:kill',
  SHELL_DATA: 'shell:data',
} as const;
