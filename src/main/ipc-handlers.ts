import { ipcMain, BrowserWindow, Menu, dialog } from 'electron';
import { SessionManager } from './session-manager';
import { ShellTerminal } from './shell-terminal';
import { TeamWatcher } from './team-watcher';
import { IPC, AppConfig } from '../shared/types';
import { writeFile, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { tmpdir } from 'os';
import path from 'path';
import { loadConfig, saveConfig } from './config';
import { exportToObsidian } from './obsidian-exporter';

export function registerIpcHandlers(
  sessionManager: SessionManager,
  getWindow: () => BrowserWindow | null,
  shellTerminal: ShellTerminal,
  teamWatcher: TeamWatcher
): void {
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

  // ── Team Management (Native Claude Code Teams) ─────────────────────

  // Create a team — spawn the lead and tell it to create the team natively
  ipcMain.handle(IPC.TEAM_CREATE, async (_event, {
    teamName, description, leadCwd, members, protocolPath,
  }: {
    teamName: string;
    description: string;
    leadCwd: string;
    members: Array<{ name: string; model?: string; promptPath?: string }>;
    protocolPath?: string;
  }) => {
    const cwd = leadCwd.startsWith('~/')
      ? leadCwd.replace('~', homedir())
      : leadCwd === '~' ? homedir() : leadCwd;

    // Spawn lead session with teams enabled
    const leadInfo = sessionManager.spawn('team-lead', cwd, {
      teamName,
    });
    wirePtyData(leadInfo.id);
    leadInfo.teamId = teamName;
    leadInfo.teamRole = 'lead';
    leadInfo.teamAgentName = 'team-lead';

    // Build the prompt with role-specific instructions for each member
    const memberInstructions = members.map((m) => {
      let instruction = `"${m.name}"`;
      if (m.promptPath) {
        // Expand ~ for the prompt path
        const expandedPath = m.promptPath.startsWith('~/')
          ? m.promptPath.replace('~', homedir())
          : m.promptPath;
        instruction += ` (role prompt: ${expandedPath} — tell this agent to read and follow that file)`;
      }
      if (m.model) {
        instruction += ` [model: ${m.model}]`;
      }
      return instruction;
    });

    const prompt = [
      `Create a team called "${teamName}".`,
      `Description: ${description}`,
      protocolPath ? `IMPORTANT: First read and internalize the protocol at ${protocolPath.startsWith('~/') ? protocolPath.replace('~', homedir()) : protocolPath}. Follow it as your operating protocol for this team.` : '',
      members.length > 0
        ? `Spawn these teammates using the Agent tool: ${memberInstructions.join(', ')}. For each agent that has a role prompt, include in its spawn prompt: "Read the instructions at <path> and follow them as your role definition."`
        : '',
      `Use TeamCreate to set up the team, then use the Agent tool to spawn each teammate.`,
      `After the team is set up, wait for instructions from the user.`,
    ].filter(Boolean).join(' ');

    sessionManager.injectPrompt(leadInfo.id, prompt);

    return { leadInfo };
  });

  // Sync team state from native configs
  ipcMain.handle(IPC.TEAM_SYNC, () => {
    return teamWatcher.getAllTeams();
  });

  // List native teams
  ipcMain.handle(IPC.TEAM_LIST, () => {
    return teamWatcher.getAllTeams();
  });

  // ── Roles & Templates ───────────────────────────────────────────────

  // Scan ~/.claude/prompts/ for available agent roles
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

  // Scan ~/.claude/protocols/ for available protocol sets
  ipcMain.handle(IPC.TEAM_SCAN_PROTOCOLS, async () => {
    const protocolsDir = path.join(homedir(), '.claude', 'protocols');
    try {
      const { readdir } = require('fs/promises');
      const entries = await readdir(protocolsDir, { withFileTypes: true });
      const protocols: Array<{ name: string; path: string; files: string[] }> = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subEntries = await readdir(path.join(protocolsDir, entry.name));
          const mdFiles = subEntries.filter((f: string) => f.endsWith('.md'));
          if (mdFiles.length > 0) {
            protocols.push({
              name: entry.name,
              path: `~/.claude/protocols/${entry.name}`,
              files: mdFiles,
            });
          }
        }
      }
      // Also check for top-level protocol files
      const topLevel = entries.filter((e: any) => !e.isDirectory() && e.name.endsWith('.md')).map((e: any) => e.name);
      if (topLevel.length > 0) {
        protocols.unshift({ name: 'root', path: '~/.claude/protocols', files: topLevel });
      }
      return protocols;
    } catch {
      return [];
    }
  });

  // Save a custom team template
  ipcMain.handle(IPC.TEAM_SAVE_TEMPLATE, async (_event, template: any) => {
    const dir = path.join(homedir(), '.agentmux');
    if (!existsSync(dir)) await require('fs/promises').mkdir(dir, { recursive: true });
    const templatesFile = path.join(dir, 'templates.json');
    let templates: any[] = [];
    try {
      const data = await readFile(templatesFile, 'utf-8');
      templates = JSON.parse(data);
    } catch {}
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
