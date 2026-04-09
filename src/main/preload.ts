import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Session management
  spawnSession: (name: string, cwd?: string, avatarSeed?: string, model?: string) =>
    ipcRenderer.invoke(IPC.SESSION_SPAWN, { name, cwd, avatarSeed, model }),
  killSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC.SESSION_KILL, { sessionId }),
  listSessions: () =>
    ipcRenderer.invoke(IPC.SESSION_LIST),
  getSessionBuffer: (sessionId: string) =>
    ipcRenderer.invoke('session:get-buffer', { sessionId }),

  // Terminal I/O
  writeToTerminal: (sessionId: string, data: string) =>
    ipcRenderer.send(IPC.TERMINAL_WRITE, { sessionId, data }),
  onTerminalData: (callback: (sessionId: string, data: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; data: string }) => {
      callback(payload.sessionId, payload.data);
    };
    ipcRenderer.on(IPC.TERMINAL_DATA, listener);
    return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, listener);
  },

  // Terminal resize
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send(IPC.SESSION_RESIZE, { sessionId, cols, rows }),

  // Native context menu
  showSessionContextMenu: (sessionId: string) =>
    ipcRenderer.send(IPC.SESSION_CONTEXT_MENU, { sessionId }),
  onContextMenuAction: (callback: (sessionId: string, action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; action: string }) => {
      callback(payload.sessionId, payload.action);
    };
    ipcRenderer.on('context-menu:action', listener);
    return () => ipcRenderer.removeListener('context-menu:action', listener);
  },

  // Status updates
  onStatusUpdate: (callback: (sessions: any[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sessions: any[]) => {
      callback(sessions);
    };
    ipcRenderer.on(IPC.SESSION_STATUS_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC.SESSION_STATUS_UPDATE, listener);
  },

  // Toolkit
  loadToolkit: (cwd: string) =>
    ipcRenderer.invoke(IPC.TOOLKIT_LOAD, { cwd }),
  executeToolkitAction: (sessionId: string, command: string) =>
    ipcRenderer.invoke(IPC.TOOLKIT_EXECUTE, { sessionId, command }),
  handoffSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC.TOOLKIT_HANDOFF, { sessionId }),
  freshSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC.TOOLKIT_FRESH_SESSION, { sessionId }),

  // Sync renderer state → main for persistence
  renameSession: (sessionId: string, name: string) =>
    ipcRenderer.send(IPC.SESSION_RENAME, { sessionId, name }),
  updateAvatarSeed: (sessionId: string, avatarSeed: string) =>
    ipcRenderer.send(IPC.SESSION_UPDATE_AVATAR, { sessionId, avatarSeed }),

  // Terminal text extraction — main process asks renderer to serialize
  // the xterm buffer for a session.  The renderer calls getTerminalText
  // handler (set by TerminalManager), and sends the result back.
  onTerminalTextRequest: (callback: (sessionId: string) => string) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string }) => {
      const text = callback(payload.sessionId);
      ipcRenderer.send(IPC.TERMINAL_TEXT_RESPONSE, { sessionId: payload.sessionId, text });
    };
    ipcRenderer.on(IPC.TERMINAL_GET_TEXT, listener);
    return () => ipcRenderer.removeListener(IPC.TERMINAL_GET_TEXT, listener);
  },

  // Shortcuts from main process
  onShortcut: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => {
      callback(...args);
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // Session restoration
  onSessionRestored: (callback: (session: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, session: any) => {
      callback(session);
    };
    ipcRenderer.on('session:restored', listener);
    return () => ipcRenderer.removeListener('session:restored', listener);
  },

  // Validation
  validateDirectory: (path: string) =>
    ipcRenderer.invoke('validate:directory', { path }),

  // Config
  getConfig: () =>
    ipcRenderer.invoke(IPC.CONFIG_GET),
  setConfig: (config: any) =>
    ipcRenderer.invoke(IPC.CONFIG_SET, config),
  openFolderDialog: () =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER),

  // Obsidian export
  exportToObsidian: (projectDir: string) =>
    ipcRenderer.invoke(IPC.OBSIDIAN_EXPORT, { projectDir }),

  // Shell terminal
  spawnShell: (cwd?: string) =>
    ipcRenderer.invoke(IPC.SHELL_SPAWN, { cwd }),
  writeShell: (id: string, data: string) =>
    ipcRenderer.send(IPC.SHELL_WRITE, { id, data }),
  resizeShell: (id: string, cols: number, rows: number) =>
    ipcRenderer.send(IPC.SHELL_RESIZE, { id, cols, rows }),
  killShell: (id: string) =>
    ipcRenderer.invoke(IPC.SHELL_KILL, { id }),
  onShellData: (callback: (id: string, data: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) => {
      callback(payload.id, payload.data);
    };
    ipcRenderer.on(IPC.SHELL_DATA, listener);
    return () => ipcRenderer.removeListener(IPC.SHELL_DATA, listener);
  },

  // File dialog
  openFileDialog: () =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE),

  // Team management
  createTeam: (params: { teamName: string; description: string; leadConfig: any; teammateConfigs: any[] }) =>
    ipcRenderer.invoke(IPC.TEAM_CREATE, params),
  addTeamMember: (params: { teamName: string; memberConfig: any }) =>
    ipcRenderer.invoke(IPC.TEAM_ADD_MEMBER, params),
  deleteTeam: (teamName: string) =>
    ipcRenderer.invoke(IPC.TEAM_DELETE, { teamName }),
  listTeams: () =>
    ipcRenderer.invoke(IPC.TEAM_LIST),

  // Team restoration
  onTeamRestored: (callback: (team: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, team: any) => {
      callback(team);
    };
    ipcRenderer.on('team:restored', listener);
    return () => ipcRenderer.removeListener('team:restored', listener);
  },
});
