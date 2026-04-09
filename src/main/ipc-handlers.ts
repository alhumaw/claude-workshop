import { ipcMain, BrowserWindow, Menu, dialog } from 'electron';
import { SessionManager } from './session-manager';
import { ShellTerminal } from './shell-terminal';
import { IPC, AppConfig } from '../shared/types';
import { writeFile, unlink, stat } from 'fs/promises';
import { homedir } from 'os';
import { tmpdir } from 'os';
import path from 'path';
import { loadConfig, saveConfig } from './config';
import { exportToObsidian } from './obsidian-exporter';

export function registerIpcHandlers(
  sessionManager: SessionManager,
  getWindow: () => BrowserWindow | null,
  shellTerminal: ShellTerminal
): void {
  // Spawn a new session
  ipcMain.handle(IPC.SESSION_SPAWN, (_event, { name, cwd, avatarSeed }) => {
    const info = sessionManager.spawn(name, cwd, undefined, avatarSeed);

    // Wire up PTY data → renderer
    sessionManager.setOnData(info.id, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId: info.id, data });
      }
    });

    return info;
  });

  // Kill a session
  ipcMain.handle(IPC.SESSION_KILL, (_event, { sessionId }) => {
    sessionManager.kill(sessionId);
    return { ok: true };
  });

  // List all sessions
  ipcMain.handle(IPC.SESSION_LIST, () => {
    return sessionManager.getAllStatus();
  });

  // Get buffered output for a session (for replaying on terminal mount)
  ipcMain.handle('session:get-buffer', (_event, { sessionId }) => {
    const session = sessionManager.getSession(sessionId);
    return session ? session.buffer : '';
  });

  // Write to terminal
  ipcMain.on(IPC.TERMINAL_WRITE, (_event, { sessionId, data }) => {
    sessionManager.write(sessionId, data);
  });

  // Resize terminal
  ipcMain.on(IPC.SESSION_RESIZE, (_event, { sessionId, cols, rows }) => {
    sessionManager.resize(sessionId, cols, rows);
  });

  // Native context menu for session cards
  ipcMain.on(IPC.SESSION_CONTEXT_MENU, (_event, { sessionId }) => {
    const win = getWindow();
    if (!win) return;

    const menu = Menu.buildFromTemplate([
      { label: 'Rename Session', click: () => win.webContents.send('context-menu:action', { sessionId, action: 'rename' }) },
      { label: 'Switch to Session', click: () => win.webContents.send('context-menu:action', { sessionId, action: 'switch' }) },
      { type: 'separator' },
      { label: 'End Session', click: () => win.webContents.send('context-menu:action', { sessionId, action: 'kill' }) },
    ]);

    menu.popup({ window: win });
  });

  // Handoff: capture handoff from old session, spawn new one with handoff text
  ipcMain.handle(IPC.TOOLKIT_HANDOFF, async (_event, { sessionId }) => {
    const oldSession = sessionManager.getSession(sessionId);
    if (!oldSession) throw new Error(`Session ${sessionId} not found`);

    const { cwd, name } = oldSession.info;

    // Capture the handoff by reading the rendered xterm terminal text
    const handoffText = await sessionManager.captureHandoff(sessionId);

    // Kill the old session
    sessionManager.kill(sessionId);

    // Write the handoff to a temp file for the new session to read.
    // Pasting multi-paragraph text directly into a PTY is unreliable.
    const handoffFile = path.join(tmpdir(), `agentmux-handoff-deliver-${Date.now()}.md`);
    await writeFile(handoffFile, handoffText);

    // Spawn a new session with the same name and cwd
    const newInfo = sessionManager.spawn(name, cwd);

    // Wire up PTY data → renderer
    sessionManager.setOnData(newInfo.id, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId: newInfo.id, data });
      }
    });

    // After a brief delay for Claude to initialize, tell it to read the handoff
    setTimeout(() => {
      const prompt =
        `Read the handoff from the previous session at ${handoffFile} ` +
        `and continue the work described there.`;
      sessionManager.write(newInfo.id, prompt + '\r');
    }, 5000);

    return { newSessionId: newInfo.id, handoffText, sessionInfo: newInfo };
  });

  // Fresh session: spawn a new session with the same cwd (does not kill old)
  ipcMain.handle(IPC.TOOLKIT_FRESH_SESSION, async (_event, { sessionId }) => {
    const oldSession = sessionManager.getSession(sessionId);
    if (!oldSession) throw new Error(`Session ${sessionId} not found`);

    const { cwd, name } = oldSession.info;

    const newInfo = sessionManager.spawn(`${name} (2)`, cwd);

    // Wire up PTY data → renderer
    sessionManager.setOnData(newInfo.id, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId: newInfo.id, data });
      }
    });

    return newInfo;
  });

  // Rename a session (syncs renderer → main for persistence)
  ipcMain.on(IPC.SESSION_RENAME, (_event, { sessionId, name }: { sessionId: string; name: string }) => {
    sessionManager.rename(sessionId, name);
  });

  // Update avatar seed (syncs renderer → main for persistence)
  ipcMain.on(IPC.SESSION_UPDATE_AVATAR, (_event, { sessionId, avatarSeed }: { sessionId: string; avatarSeed: string }) => {
    sessionManager.updateAvatarSeed(sessionId, avatarSeed);
  });

  // Validate directory exists
  ipcMain.handle('validate:directory', async (_event, { path: rawPath }: { path: string }) => {
    const expanded = rawPath.startsWith('~/')
      ? rawPath.replace('~', homedir())
      : rawPath === '~'
        ? homedir()
        : rawPath;
    try {
      const s = await stat(expanded);
      return s.isDirectory();
    } catch {
      return false;
    }
  });

  // Config: get
  ipcMain.handle(IPC.CONFIG_GET, async () => {
    return loadConfig();
  });

  // Config: set (validates directory exists before saving)
  ipcMain.handle(IPC.CONFIG_SET, async (_event, config: AppConfig) => {
    const { vaultPath } = config;
    if (vaultPath) {
      const expanded = vaultPath.startsWith('~/')
        ? vaultPath.replace('~', homedir())
        : vaultPath === '~' ? homedir() : vaultPath;
      try {
        const s = await stat(expanded);
        if (!s.isDirectory()) return { ok: false, error: 'Path is not a directory' };
      } catch {
        return { ok: false, error: 'Directory not found' };
      }
    }
    await saveConfig(config);
    return { ok: true };
  });

  // Dialog: open folder picker
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Obsidian Vault',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Obsidian export
  ipcMain.handle(IPC.OBSIDIAN_EXPORT, async (_event, { projectDir }: { projectDir: string }) => {
    const config = await loadConfig();
    if (!config.vaultPath) return { ok: false, error: 'no-vault' };

    const expanded = config.vaultPath.startsWith('~/')
      ? config.vaultPath.replace('~', homedir())
      : config.vaultPath === '~' ? homedir() : config.vaultPath;
    try {
      const s = await stat(expanded);
      if (!s.isDirectory()) return { ok: false, error: 'vault-not-found' };
    } catch {
      return { ok: false, error: 'vault-not-found' };
    }

    try {
      const outDir = await exportToObsidian(projectDir, config.vaultPath);
      return { ok: true, outDir };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'Export failed' };
    }
  });

  // Shell terminal
  ipcMain.handle(IPC.SHELL_SPAWN, (_event, { cwd }: { cwd?: string }) => {
    const id = shellTerminal.spawn(cwd);
    shellTerminal.setOnData(id, (data) => {
      const win = getWindow();
      if (win) win.webContents.send(IPC.SHELL_DATA, { id, data });
    });
    return { id };
  });

  ipcMain.on(IPC.SHELL_WRITE, (_event, { id, data }: { id: string; data: string }) => {
    shellTerminal.write(id, data);
  });

  ipcMain.on(IPC.SHELL_RESIZE, (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    shellTerminal.resize(id, cols, rows);
  });

  ipcMain.handle(IPC.SHELL_KILL, (_event, { id }: { id: string }) => {
    shellTerminal.kill(id);
    return { ok: true };
  });
}
