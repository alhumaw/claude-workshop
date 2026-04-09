import { ipcMain, BrowserWindow, Menu, dialog } from 'electron';
import { SessionManager } from './session-manager';
import { TeamManager } from './team-manager';
import { IPC, AppConfig, TeamMemberConfig, TeamInfo, SessionInfo } from '../shared/types';
import { readFile, writeFile, unlink, stat, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { tmpdir } from 'os';
import path from 'path';
import { loadConfig, saveConfig } from './config';
import { exportToObsidian } from './obsidian-exporter';

export function registerIpcHandlers(
  sessionManager: SessionManager,
  getWindow: () => BrowserWindow | null
): void {
  const teamManager = new TeamManager();

  // Helper: wire PTY data from a session to the renderer
  function wirePtyData(sessionId: string): void {
    sessionManager.setOnData(sessionId, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId, data });
      }
    });
  }

  // Spawn a new session
  ipcMain.handle(IPC.SESSION_SPAWN, (_event, { name, cwd, avatarSeed, model }) => {
    const info = sessionManager.spawn(name, cwd, model ? { model } : undefined, avatarSeed);
    wirePtyData(info.id);
    return info;
  });

  // Kill a session
  ipcMain.handle(IPC.SESSION_KILL, async (_event, { sessionId }) => {
    const session = sessionManager.getSession(sessionId);

    // If this session is a team member, remove it from the team config on disk
    // and notify the lead
    if (session?.info.teamId && session?.info.teamAgentName) {
      const teamId = session.info.teamId;
      const agentName = session.info.teamAgentName;

      // Find lead cwd for inbox path
      const allSessions = sessionManager.getAllStatus();
      const leadSession = allSessions.find(
        (s) => s.teamId === teamId && s.teamRole === 'lead'
      );
      const leadCwd = leadSession?.cwd || session.info.cwd;

      // No need to call teamManager.removeMember — we don't maintain ~/.claude/teams/ config

      // Notify the lead that a teammate was removed
      if (session.info.teamRole === 'teammate' && leadSession) {
        sessionManager.injectPrompt(
          leadSession.id,
          `Teammate '${agentName}' has been removed from team '${teamId}'. Update your team awareness accordingly.`,
          1000,
        );
      }
    }

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

    const session = sessionManager.getSession(sessionId);
    const isTeamMember = session?.info.teamId;

    const template: Electron.MenuItemConstructorOptions[] = [
      { label: 'Rename Session', click: () => win.webContents.send('context-menu:action', { sessionId, action: 'rename' }) },
      { label: 'Switch to Session', click: () => win.webContents.send('context-menu:action', { sessionId, action: 'switch' }) },
      { type: 'separator' },
    ];

    if (isTeamMember) {
      template.push({
        label: 'Remove from Team',
        click: () => win.webContents.send('context-menu:action', { sessionId, action: 'remove-from-team' }),
      });
      template.push({ type: 'separator' });
    }

    template.push({
      label: 'End Session',
      click: () => win.webContents.send('context-menu:action', { sessionId, action: 'kill' }),
    });

    Menu.buildFromTemplate(template).popup({ window: win });
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
    wirePtyData(newInfo.id);

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
    wirePtyData(newInfo.id);

    return newInfo;
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

  // Dialog: open file picker (for prompt files)
  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async () => {
    const win = getWindow();
    if (!win) return null;
    const promptsDir = path.join(homedir(), '.claude', 'prompts');
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select Prompt File',
      defaultPath: promptsDir,
      filters: [
        { name: 'Markdown & Text', extensions: ['md', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
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

  // ── Team Management ──────────────────────────────────────────────────

  // Create a team with lead + optional teammates
  ipcMain.handle(IPC.TEAM_CREATE, async (_event, {
    teamName, description, leadConfig, teammateConfigs,
  }: {
    teamName: string;
    description: string;
    leadConfig: TeamMemberConfig;
    teammateConfigs: TeamMemberConfig[];
  }) => {
    const rawLeadCwd = leadConfig.cwd || process.env.HOME || '/';
    const leadCwd = rawLeadCwd.startsWith('~/')
      ? rawLeadCwd.replace('~', homedir())
      : rawLeadCwd === '~' ? homedir() : rawLeadCwd;

    // Wipe any stale .workshop/ directory from a previous team with the same name
    const staleWsDir = teamManager.workshopDir(leadCwd, teamName);
    if (existsSync(staleWsDir)) {
      await rm(staleWsDir, { recursive: true });
    }

    // Create project-local infrastructure BEFORE spawning agents.
    await teamManager.addTeamPermissions(leadCwd, teamName);
    await teamManager.initPalace(leadCwd, teamName);

    // Pre-create all inboxes (project-local .workshop/ directory)
    await teamManager.createInbox(leadCwd, teamName, leadConfig.name);
    for (const tc of teammateConfigs) {
      await teamManager.createInbox(leadCwd, teamName, tc.name);
    }

    // Pre-approve directory access via --add-dir AND additionalDirectories
    const workshopDir = `${leadCwd}/.workshop/${teamName}`;
    const inboxDir = teamManager.inboxDir(leadCwd, teamName);
    const palacePath = teamManager.palacePath(leadCwd);

    // NOW spawn agents (infrastructure already on disk)
    const leadInfo = sessionManager.spawn(leadConfig.name, leadCwd, {
      model: leadConfig.model,
      teamName,
      addDirs: [workshopDir],
      palacePath,
    });
    leadInfo.teamId = teamName;
    leadInfo.teamRole = 'lead';
    leadInfo.teamAgentName = leadConfig.name;
    wirePtyData(leadInfo.id);

    // Collect teammate names for the lead prompt
    const teammateNames = teammateConfigs.map((tc) => tc.name.trim()).filter(Boolean);

    // Inject lead prompt with project-local inbox paths
    sessionManager.injectLeadPrompt(
      leadInfo.id, leadConfig.name, teamName, leadCwd, description, teammateNames,
      leadConfig.promptFile || undefined,
    );

    const memberInfos: SessionInfo[] = [leadInfo];

    // Spawn each teammate (infrastructure already created above)
    for (const tc of teammateConfigs) {
      const memberCwd = tc.cwd || leadCwd;

      const memberInfo = sessionManager.spawn(tc.name, memberCwd, {
        model: tc.model,
        teamName,
        addDirs: [workshopDir],
        palacePath,
      });
      memberInfo.teamId = teamName;
      memberInfo.teamRole = 'teammate';
      memberInfo.teamAgentName = tc.name;
      wirePtyData(memberInfo.id);

      // Stagger teammate injection so PTY writes don't overlap.
      // Each teammate gets an extra 3s per index to give the previous
      // agent time to finish booting.
      const staggerDelay = 8000 + (memberInfos.length - 1) * 3000;
      sessionManager.injectTeammatePrompt(
        memberInfo.id, tc.name, teamName,
        leadConfig.name, leadCwd,
        tc.promptFile || undefined,
        staggerDelay,
      );

      memberInfos.push(memberInfo);
    }

    // Register team in SessionManager for persistence
    const team: TeamInfo = {
      id: teamName,
      name: teamName,
      description,
      createdAt: Date.now(),
      leadSessionId: leadInfo.id,
      memberSessionIds: memberInfos.map((m) => m.id),
      collapsed: false,
    };
    sessionManager.registerTeam(team);

    return { teamName, team, members: memberInfos };
  });

  // Add a member to an existing team
  ipcMain.handle(IPC.TEAM_ADD_MEMBER, async (_event, {
    teamName, memberConfig,
  }: {
    teamName: string;
    memberConfig: TeamMemberConfig;
  }) => {
    const rawMemberCwd = memberConfig.cwd || process.env.HOME || '/';
    const memberCwd = rawMemberCwd.startsWith('~/')
      ? rawMemberCwd.replace('~', homedir())
      : rawMemberCwd === '~' ? homedir() : rawMemberCwd;

    let promptContent: string | undefined;
    if (memberConfig.promptFile) {
      try { promptContent = await readFile(memberConfig.promptFile, 'utf-8'); } catch {}
    }

    // Find the lead to get the shared cwd for messaging
    const allSessions = sessionManager.getAllStatus();
    const leadSession = allSessions.find(
      (s) => s.teamId === teamName && s.teamRole === 'lead'
    );
    const leadName = leadSession?.teamAgentName || 'team-lead';
    const leadCwd = leadSession?.cwd || memberCwd;

    // Create inbox for the new member (project-local, no ~/.claude/teams/ writes)
    await teamManager.createInbox(leadCwd, teamName, memberConfig.name);

    const addWorkshopDir = `${leadCwd}/.workshop/${teamName}`;
    const addInboxDir = teamManager.inboxDir(leadCwd, teamName);
    const addPalacePath = teamManager.palacePath(leadCwd);
    const memberInfo = sessionManager.spawn(memberConfig.name, memberCwd, {
      model: memberConfig.model,
      teamName,
      addDirs: [addWorkshopDir],
      palacePath: addPalacePath,
    });
    memberInfo.teamId = teamName;
    memberInfo.teamRole = 'teammate';
    memberInfo.teamAgentName = memberConfig.name;
    wirePtyData(memberInfo.id);

    // Always inject teammate prompt (with or without prompt file)
    sessionManager.injectTeammatePrompt(
      memberInfo.id, memberConfig.name, teamName,
      leadName, leadCwd,
      memberConfig.promptFile || undefined,
    );

    // Notify the lead about the new teammate
    if (leadSession) {
      const modelNote = memberConfig.model ? ` (model: ${memberConfig.model})` : '';
      sessionManager.injectPrompt(
        leadSession.id,
        `A new teammate '${memberConfig.name}'${modelNote} has joined team '${teamName}'. ` +
        `Update your team awareness — you can now coordinate with them.`,
        2000,
      );
    }

    return memberInfo;
  });

  // Delete a team (disk infrastructure only; sessions remain but lose team tags)
  ipcMain.handle(IPC.TEAM_DELETE, async (_event, { teamName }: { teamName: string }) => {
    // Find lead cwd from active sessions (since we don't use ~/.claude/teams/ anymore)
    const allSessions = sessionManager.getAllStatus();
    const leadSession = allSessions.find(
      (s) => s.teamId === teamName && s.teamRole === 'lead'
    );
    const leadCwd = leadSession?.cwd;

    if (leadCwd) {
      await teamManager.removeTeamPermissions(leadCwd, teamName);
      // Clean up .workshop/ inbox files
      const wsDir = teamManager.workshopDir(leadCwd, teamName);
      if (existsSync(wsDir)) {
        await rm(wsDir, { recursive: true });
      }
    }
    sessionManager.removeTeam(teamName);
    return { ok: true };
  });

  // List teams from disk
  ipcMain.handle(IPC.TEAM_LIST, async () => {
    const names = await teamManager.listTeams();
    const configs = [];
    for (const name of names) {
      const config = await teamManager.readTeamConfig(name);
      if (config) configs.push(config);
    }
    return configs;
  });

  // Scan ~/.claude/prompts/ for available roles
  ipcMain.handle(IPC.TEAM_SCAN_ROLES, async () => {
    const promptsDir = path.join(homedir(), '.claude', 'prompts');
    try {
      const { readdir } = require('fs/promises');
      const entries = await readdir(promptsDir, { withFileTypes: true });
      const roles: Array<{ name: string; promptPath: string }> = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const promptFile = path.join(promptsDir, entry.name, 'PROMPT.md');
          if (existsSync(promptFile)) {
            roles.push({
              name: entry.name,
              promptPath: `~/.claude/prompts/${entry.name}/PROMPT.md`,
            });
          }
        }
      }
      return roles.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  });

  // Save a custom team template
  ipcMain.handle(IPC.TEAM_SAVE_TEMPLATE, async (_event, template: any) => {
    const templatesFile = path.join(homedir(), '.agentmux', 'templates.json');
    let templates: any[] = [];
    try {
      const data = await readFile(templatesFile, 'utf-8');
      templates = JSON.parse(data);
    } catch {}
    // Replace if same id exists, otherwise append
    const idx = templates.findIndex((t: any) => t.id === template.id);
    if (idx >= 0) templates[idx] = template;
    else templates.push(template);
    await writeFile(templatesFile, JSON.stringify(templates, null, 2));
    return { ok: true };
  });

  // Load custom team templates
  ipcMain.handle(IPC.TEAM_LOAD_TEMPLATES, async () => {
    const templatesFile = path.join(homedir(), '.agentmux', 'templates.json');
    try {
      const data = await readFile(templatesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  });

  // Delete a custom team template
  ipcMain.handle(IPC.TEAM_DELETE_TEMPLATE, async (_event, { templateId }: { templateId: string }) => {
    const templatesFile = path.join(homedir(), '.agentmux', 'templates.json');
    try {
      const data = await readFile(templatesFile, 'utf-8');
      const templates = JSON.parse(data).filter((t: any) => t.id !== templateId);
      await writeFile(templatesFile, JSON.stringify(templates, null, 2));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
}
