import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage } from 'electron';
import path from 'path';
import { SessionManager } from './session-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { InboxRelay } from './inbox-relay';
import { TeamManager } from './team-manager';
import { IPC } from '../shared/types';
import { saveSessions, loadSessions, clearSessions } from './persistence';

app.setName('Claude Workshop');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let sessionManager: SessionManager;

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
  registerIpcHandlers(sessionManager, () => mainWindow);
  createWindow();
  registerShortcuts();

  // Start inbox relay for team message delivery
  const inboxRelay = new InboxRelay(sessionManager);
  inboxRelay.start(3000);

  // Restore persisted sessions — spawn PTY processes now, but wait
  // until the renderer finishes loading before sending IPC
  const savedState = await loadSessions();
  const restoredSessions: import('../shared/types').SessionInfo[] = [];
  const restoredTeams: import('../shared/types').TeamInfo[] = [];

  if (savedState) {
    // Restore teams to SessionManager
    for (const team of savedState.teams ?? []) {
      sessionManager.registerTeam(team);
      restoredTeams.push(team);
    }

    // Restore sessions
    for (const saved of savedState.sessions) {
      const info = sessionManager.spawn(saved.name, saved.cwd, {
        resumeSessionId: saved.claudeSessionId,
        model: saved.model || undefined,
        teamName: saved.teamId || undefined,
      });
      info.avatarSeed = saved.avatarSeed;
      info.cost = saved.cost;
      info.model = saved.model;
      info.branch = saved.branch;
      info.contextPercent = saved.contextPercent;
      info.teamId = saved.teamId;
      info.teamRole = saved.teamRole;
      info.teamAgentName = saved.teamAgentName;

      // Clear the ring buffer after a short delay so Claude's startup
      // spinner output doesn't make parseStatus return 'thinking'.
      // The buffer will rebuild from fresh output after the delay.
      setTimeout(() => sessionManager.clearBuffer(info.id), 3000);

      sessionManager.setOnData(info.id, (data) => {
        if (mainWindow) {
          mainWindow.webContents.send(IPC.TERMINAL_DATA, { sessionId: info.id, data });
        }
      });

      restoredSessions.push(info);
    }

    // Re-create inbox files for team sessions so the relay can poll them
    const teamMgr = new TeamManager();
    const teamCwds = new Map<string, string>(); // teamId → leadCwd
    for (const s of restoredSessions) {
      if (s.teamId && s.teamRole === 'lead') teamCwds.set(s.teamId, s.cwd);
    }
    for (const s of restoredSessions) {
      if (s.teamId && s.teamAgentName) {
        const leadCwd = teamCwds.get(s.teamId) ?? s.cwd;
        await teamMgr.createInbox(leadCwd, s.teamId, s.teamAgentName);
      }
    }
    await clearSessions();

    // Re-init relay counts NOW that sessions are restored with team fields
    // (the initial initCounts ran before sessions existed, so it was empty)
    inboxRelay.reinitCounts();
  }

  // Once the renderer is ready, push restored sessions and teams
  if (mainWindow && (restoredSessions.length > 0 || restoredTeams.length > 0)) {
    mainWindow.webContents.once('did-finish-load', () => {
      for (const team of restoredTeams) {
        mainWindow!.webContents.send('team:restored', team);
      }
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
  const teams = sessionManager.getAllTeams();
  Promise.all([
    saveSessions(sessions, teams, null),
  ]).finally(() => {
    globalShortcut.unregisterAll();
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
