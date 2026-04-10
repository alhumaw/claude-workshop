import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage } from 'electron';
import path from 'path';
import { SessionManager } from './session-manager';
import { ShellTerminal } from './shell-terminal';
import { registerIpcHandlers } from './ipc-handlers';
import { TeamWatcher } from './team-watcher';
import { IPC } from '../shared/types';
import { saveSessions, loadSessions, clearSessions } from './persistence';

app.setName('Claude Workshop');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let sessionManager: SessionManager;
let shellTerminal: ShellTerminal;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

function registerShortcuts() {
  // Cmd+N — new session
  globalShortcut.register('CommandOrControl+N', () => {
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:new-session');
    }
  });

  // Cmd+W — close active session
  globalShortcut.register('CommandOrControl+W', () => {
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:close-session');
    }
  });

  // Cmd+1 through Cmd+9 — switch to session by index
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      if (mainWindow) {
        mainWindow.webContents.send('shortcut:switch-session', i - 1);
      }
    });
  }

  // Cmd+[ and Cmd+] — prev/next session
  globalShortcut.register('CommandOrControl+[', () => {
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:prev-session');
    }
  });
  globalShortcut.register('CommandOrControl+]', () => {
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:next-session');
    }
  });

  // Cmd+` — toggle shell panel
  globalShortcut.register('CommandOrControl+`', () => {
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:toggle-shell');
    }
  });
}

app.whenReady().then(async () => {
  // Set dock icon at runtime to bypass macOS icon cache
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.resolve(__dirname, '../../assets/icon.icns');
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }

  // Set a minimal menu to suppress macOS representedObject warnings
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Claude Workshop',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]));

  sessionManager = new SessionManager();
  sessionManager.setWindowGetter(() => mainWindow);
  shellTerminal = new ShellTerminal();
  const teamWatcher = new TeamWatcher();
  teamWatcher.setWindowGetter(() => mainWindow);
  registerIpcHandlers(sessionManager, () => mainWindow, shellTerminal, teamWatcher);
  createWindow();
  registerShortcuts();

  // Start watching native team configs — attach terminals when new members appear
  teamWatcher.setOnMemberAdded((config, member) => {
    // Check if we already have a session for this agent
    const existing = sessionManager.getAllStatus().find(
      (s) => s.teamId === config.name && s.teamAgentName === member.name
    );
    if (existing) return;

    // For the lead, find the existing Workshop session and tag it
    if (member.agentId === config.leadAgentId) {
      const allSessions = sessionManager.getAllStatus();
      // Try matching by claudeSessionId first
      let leadSession = allSessions.find(
        (s) => s.claudeSessionId === config.leadSessionId
      );
      // Fallback: find any untagged session in the same cwd
      if (!leadSession) {
        leadSession = allSessions.find(
          (s) => !s.teamId && s.cwd === member.cwd
        );
      }
      // Last resort: find any session without a team
      if (!leadSession) {
        leadSession = allSessions.find((s) => !s.teamId && s.status !== 'exited');
      }
      if (leadSession) {
        const managed = sessionManager.getSession(leadSession.id);
        if (managed) {
          managed.info.teamId = config.name;
          managed.info.teamRole = 'lead';
          managed.info.teamAgentName = member.name;
          console.log(`[Workshop] tagged lead ${leadSession.name} → ${member.name}@${config.name} (matched by ${leadSession.claudeSessionId === config.leadSessionId ? 'sessionId' : 'fallback'})`);
        }
      } else {
        console.log(`[Workshop] could not find lead session for ${config.name}, leadSessionId=${config.leadSessionId}`);
      }
      return;
    }

    // Kill the tmux pane so there's no duplicate agent
    if (member.tmuxPaneId) {
      const socketName = teamWatcher.findSwarmSocketForTeam(config);
      if (socketName) {
        try {
          require('child_process').execFileSync('tmux', ['-L', socketName, 'kill-pane', '-t', member.tmuxPaneId], {
            stdio: 'ignore', timeout: 3000,
          });
          console.log(`[Workshop] killed tmux pane ${member.tmuxPaneId} on ${socketName}`);
        } catch {}
      }
    }

    // Spawn the agent natively in a Workshop terminal
    console.log(`[Workshop] spawning ${member.name}@${config.name} as Workshop terminal`);
    const info = sessionManager.spawnTeamAgent({
      agentId: member.agentId,
      agentName: member.name,
      teamName: config.name,
      parentSessionId: config.leadSessionId,
      model: member.model,
      color: member.color,
      cwd: member.cwd,
    });

    // Wire PTY data to renderer
    sessionManager.setOnData(info.id, (data) => {
      if (mainWindow) {
        mainWindow.webContents.send(IPC.TERMINAL_DATA, { sessionId: info.id, data });
      }
    });

    // Notify renderer
    if (mainWindow) {
      mainWindow.webContents.send('session:restored', info);
    }
  });
  teamWatcher.start();

  // Restore persisted sessions — spawn PTY processes now, but wait
  // until the renderer finishes loading before sending IPC
  const savedState = await loadSessions();
  const restoredSessions: import('../shared/types').SessionInfo[] = [];

  if (savedState && savedState.sessions.length > 0) {
    for (const saved of savedState.sessions) {
      const info = sessionManager.spawn(saved.name, saved.cwd, {
        resumeSessionId: saved.claudeSessionId,
        model: saved.model || undefined,
        teamName: saved.teamId || undefined,
      }, saved.avatarSeed);
      info.cost = saved.cost;
      info.model = saved.model;
      info.branch = saved.branch;
      info.contextPercent = saved.contextPercent;
      info.teamId = saved.teamId;
      info.teamRole = saved.teamRole;
      info.teamAgentName = saved.teamAgentName;

      setTimeout(() => sessionManager.clearBuffer(info.id), 3000);

      sessionManager.setOnData(info.id, (data) => {
        if (mainWindow) {
          mainWindow.webContents.send(IPC.TERMINAL_DATA, { sessionId: info.id, data });
        }
      });

      restoredSessions.push(info);
    }
    await clearSessions();
  }

  // Once the renderer is ready, push restored sessions
  if (mainWindow && restoredSessions.length > 0) {
    mainWindow.webContents.once('did-finish-load', () => {
      for (const info of restoredSessions) {
        mainWindow!.webContents.send('session:restored', info);
      }
    });
  }

  // Status polling
  setInterval(() => {
    if (mainWindow) {
      const sessions = sessionManager.getAllStatus();
      mainWindow.webContents.send('session:status-update', sessions);
    }
  }, 2000);
});

// Save state before quit — use before-quit so the async writes finish
// before Electron tears down the process.  Prevent the default quit,
// do our saves, then quit for real.
let isQuitting = false;
app.on('before-quit', (event) => {
  if (isQuitting) return; // already saving, let it through
  event.preventDefault();
  isQuitting = true;

  const sessions = sessionManager.getAllStatus();
  Promise.all([
    saveSessions(sessions, null),
  ]).finally(() => {
    globalShortcut.unregisterAll();
    shellTerminal.killAll();
    sessionManager.killAll();
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
