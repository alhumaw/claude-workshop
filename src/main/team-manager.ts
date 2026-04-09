import { mkdir, writeFile, readFile, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { homedir } from 'os';
import { TeamMemberConfig } from '../shared/types';

const CLAUDE_DIR = path.join(homedir(), '.claude');
const TEAMS_DIR = path.join(CLAUDE_DIR, 'teams');
const TASKS_DIR = path.join(CLAUDE_DIR, 'tasks');

export interface ClaudeTeamMember {
  agentId: string;
  name: string;
  agentType: string;
  model: string;
  joinedAt: number;
  tmuxPaneId: string;
  cwd: string;
  subscriptions: string[];
  prompt?: string;
  color?: string;
  planModeRequired?: boolean;
  backendType?: string;
  isActive?: boolean;
}

export interface ClaudeTeamConfig {
  name: string;
  description: string;
  createdAt: number;
  leadAgentId: string;
  leadSessionId: string;
  members: ClaudeTeamMember[];
}

export class TeamManager {
  /** Get the project-local workshop directory for a team's messaging */
  workshopDir(leadCwd: string, teamName: string): string {
    return path.join(leadCwd, '.workshop', teamName);
  }

  /** Get the inbox directory — inside the project for containment */
  inboxDir(leadCwd: string, teamName: string): string {
    return path.join(this.workshopDir(leadCwd, teamName), 'inboxes');
  }

  async createTeam(
    teamName: string,
    description: string,
    leadConfig: TeamMemberConfig,
    leadCwd: string,
    leadClaudeSessionId: string,
  ): Promise<ClaudeTeamConfig> {
    // Claude Code team config (at ~/.claude/teams/ — Workshop writes, agents don't)
    const teamDir = path.join(TEAMS_DIR, teamName);
    await mkdir(teamDir, { recursive: true });

    const now = Date.now();
    const leadMember: ClaudeTeamMember = {
      agentId: `${leadConfig.name}@${teamName}`,
      name: leadConfig.name,
      agentType: 'team-lead',
      model: leadConfig.model || 'claude-4-6-opus[1m]',
      joinedAt: now,
      tmuxPaneId: '',
      cwd: leadCwd,
      subscriptions: [],
    };

    const config: ClaudeTeamConfig = {
      name: teamName,
      description,
      createdAt: now,
      leadAgentId: leadMember.agentId,
      leadSessionId: leadClaudeSessionId,
      members: [leadMember],
    };

    await writeFile(
      path.join(teamDir, 'config.json'),
      JSON.stringify(config, null, 2),
    );

    // Project-local messaging directory (at {cwd}/.workshop/{teamName}/)
    const inboxPath = this.inboxDir(leadCwd, teamName);
    await mkdir(inboxPath, { recursive: true });

    // Create lead inbox
    await this.createInbox(leadCwd, teamName, leadConfig.name);

    return config;
  }

  async addMember(
    teamName: string,
    memberConfig: TeamMemberConfig,
    memberCwd: string,
    leadCwd: string,
    promptContent?: string,
  ): Promise<ClaudeTeamMember> {
    const config = await this.readTeamConfig(teamName);
    if (!config) throw new Error(`Team ${teamName} not found`);

    const member: ClaudeTeamMember = {
      agentId: `${memberConfig.name}@${teamName}`,
      name: memberConfig.name,
      agentType: memberConfig.agentType || 'general-purpose',
      model: memberConfig.model || 'sonnet',
      joinedAt: Date.now(),
      tmuxPaneId: '',
      cwd: memberCwd,
      subscriptions: [],
      color: memberConfig.color,
      planModeRequired: false,
      backendType: 'iterm2',
      isActive: true,
    };

    if (promptContent) {
      member.prompt = promptContent;
    }

    config.members.push(member);
    await writeFile(
      path.join(TEAMS_DIR, teamName, 'config.json'),
      JSON.stringify(config, null, 2),
    );

    await this.createInbox(leadCwd, teamName, memberConfig.name);
    return member;
  }

  async createInbox(leadCwd: string, teamName: string, agentName: string): Promise<void> {
    const inboxPath = this.inboxDir(leadCwd, teamName);
    await mkdir(inboxPath, { recursive: true });
    const inboxFile = path.join(inboxPath, `${agentName}.jsonl`);
    if (!existsSync(inboxFile)) {
      await writeFile(inboxFile, '');
    }
  }

  async initTaskDir(teamName: string): Promise<void> {
    const taskDir = path.join(TASKS_DIR, teamName);
    await mkdir(taskDir, { recursive: true });

    const hwm = path.join(taskDir, '.highwatermark');
    if (!existsSync(hwm)) {
      await writeFile(hwm, '0');
    }

    const lock = path.join(taskDir, '.lock');
    if (!existsSync(lock)) {
      await writeFile(lock, '');
    }
  }

  async readTeamConfig(teamName: string): Promise<ClaudeTeamConfig | null> {
    const configPath = path.join(TEAMS_DIR, teamName, 'config.json');
    try {
      const data = await readFile(configPath, 'utf-8');
      return JSON.parse(data) as ClaudeTeamConfig;
    } catch {
      return null;
    }
  }

  async deleteTeam(teamName: string, leadCwd?: string): Promise<void> {
    const teamDir = path.join(TEAMS_DIR, teamName);
    const taskDir = path.join(TASKS_DIR, teamName);
    if (existsSync(teamDir)) await rm(teamDir, { recursive: true });
    if (existsSync(taskDir)) await rm(taskDir, { recursive: true });

    // Remove project-local workshop dir
    if (leadCwd) {
      const wsDir = this.workshopDir(leadCwd, teamName);
      if (existsSync(wsDir)) await rm(wsDir, { recursive: true });
    }
  }

  async removeMember(teamName: string, agentName: string, leadCwd?: string): Promise<void> {
    const config = await this.readTeamConfig(teamName);
    if (!config) return;

    config.members = config.members.filter((m) => m.name !== agentName);
    await writeFile(
      path.join(TEAMS_DIR, teamName, 'config.json'),
      JSON.stringify(config, null, 2),
    );

    // Remove inbox from project-local dir
    if (leadCwd) {
      const inboxFile = path.join(this.inboxDir(leadCwd, teamName), `${agentName}.jsonl`);
      if (existsSync(inboxFile)) await rm(inboxFile);
    }
  }

  async listTeams(): Promise<string[]> {
    try {
      const entries = await readdir(TEAMS_DIR, { withFileTypes: true });
      const teams: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = path.join(TEAMS_DIR, entry.name, 'config.json');
          if (existsSync(configPath)) teams.push(entry.name);
        }
      }
      return teams;
    } catch {
      return [];
    }
  }

  // Write additionalDirectories to project's .claude/settings.local.json
  // This pre-approves directory access so agents don't get prompted.
  async addTeamPermissions(leadCwd: string, teamName: string): Promise<void> {
    const dir = this.workshopDir(leadCwd, teamName);
    const settingsDir = path.join(leadCwd, '.claude');
    const settingsFile = path.join(settingsDir, 'settings.local.json');
    await mkdir(settingsDir, { recursive: true });

    let settings: any = {};
    try {
      const data = await readFile(settingsFile, 'utf-8');
      settings = JSON.parse(data);
    } catch {}

    if (!settings.permissions) settings.permissions = {};
    if (!Array.isArray(settings.permissions.additionalDirectories)) {
      settings.permissions.additionalDirectories = [];
    }

    // Enable project-level MCP servers (required for .mcp.json to be loaded)
    settings.enableAllProjectMcpServers = true;
    if (!Array.isArray(settings.enabledMcpjsonServers)) {
      settings.enabledMcpjsonServers = [];
    }
    if (!settings.enabledMcpjsonServers.includes('mempalace')) {
      settings.enabledMcpjsonServers.push('mempalace');
    }

    // Pre-approve all mempalace MCP tools
    if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
    const mempalaceTools = [
      'mcp__mempalace__mempalace_status',
      'mcp__mempalace__mempalace_list_wings',
      'mcp__mempalace__mempalace_list_rooms',
      'mcp__mempalace__mempalace_get_taxonomy',
      'mcp__mempalace__mempalace_get_aaak_spec',
      'mcp__mempalace__mempalace_kg_query',
      'mcp__mempalace__mempalace_kg_add',
      'mcp__mempalace__mempalace_kg_invalidate',
      'mcp__mempalace__mempalace_kg_timeline',
      'mcp__mempalace__mempalace_kg_stats',
      'mcp__mempalace__mempalace_traverse',
      'mcp__mempalace__mempalace_find_tunnels',
      'mcp__mempalace__mempalace_graph_stats',
      'mcp__mempalace__mempalace_search',
      'mcp__mempalace__mempalace_check_duplicate',
      'mcp__mempalace__mempalace_add_drawer',
      'mcp__mempalace__mempalace_delete_drawer',
      'mcp__mempalace__mempalace_diary_write',
      'mcp__mempalace__mempalace_diary_read',
    ];
    const existingAllow = new Set(settings.permissions.allow);
    for (const tool of mempalaceTools) {
      if (!existingAllow.has(tool)) settings.permissions.allow.push(tool);
    }

    if (!settings.permissions.additionalDirectories.includes(dir)) {
      settings.permissions.additionalDirectories.push(dir);
    }

    await writeFile(settingsFile, JSON.stringify(settings, null, 2));
  }

  async removeTeamPermissions(leadCwd: string, teamName: string): Promise<void> {
    const dir = this.workshopDir(leadCwd, teamName);

    // Clean additionalDirectories from settings.local.json
    const settingsFile = path.join(leadCwd, '.claude', 'settings.local.json');
    if (existsSync(settingsFile)) {
      try {
        const settings = JSON.parse(await readFile(settingsFile, 'utf-8'));
        if (Array.isArray(settings.permissions?.additionalDirectories)) {
          settings.permissions.additionalDirectories =
            settings.permissions.additionalDirectories.filter((d: string) => d !== dir);
          await writeFile(settingsFile, JSON.stringify(settings, null, 2));
        }
      } catch {}
    }

    // Remove mempalace MCP server from .mcp.json (at project root)
    const mcpFile = path.join(leadCwd, '.mcp.json');
    if (existsSync(mcpFile)) {
      try {
        const mcpConfig = JSON.parse(await readFile(mcpFile, 'utf-8'));
        if (mcpConfig.mcpServers?.mempalace) {
          delete mcpConfig.mcpServers.mempalace;
          await writeFile(mcpFile, JSON.stringify(mcpConfig, null, 2));
        }
      } catch {}
    }
  }

  // ── MemPalace integration ────────────────────────────────────────────

  /** Palace data path for a team's project */
  palacePath(leadCwd: string): string {
    return path.join(leadCwd, '.mempalace', 'palace');
  }

  /** Initialize a MemPalace in the project directory and register the MCP server */
  async initPalace(leadCwd: string, _teamName: string): Promise<void> {
    console.log(`[Workshop:mempalace] initPalace called: leadCwd=${leadCwd}`);
    const palace = this.palacePath(leadCwd);
    await mkdir(palace, { recursive: true });
    console.log(`[Workshop:mempalace] palace dir created: ${palace}`);

    const pythonPath = this.getMempalacePython();

    // Write .mcp.json at the PROJECT ROOT (not inside .claude/)
    // Claude Code reads project MCP configs from {cwd}/.mcp.json
    const mcpFile = path.join(leadCwd, '.mcp.json');

    let mcpConfig: any = {};
    try {
      const data = await readFile(mcpFile, 'utf-8');
      mcpConfig = JSON.parse(data);
    } catch {}

    if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    mcpConfig.mcpServers.mempalace = {
      command: pythonPath,
      args: ['-m', 'mempalace.mcp_server', '--palace', palace],
    };

    await writeFile(mcpFile, JSON.stringify(mcpConfig, null, 2));
    console.log(`[Workshop:mempalace] .mcp.json written: python=${pythonPath} palace=${palace}`);

    // Initialize the ChromaDB collection so mempalace_status works immediately
    try {
      execFileSync(pythonPath, [
        '-c',
        `import chromadb; c=chromadb.PersistentClient(path="${palace}"); c.get_or_create_collection("mempalace_drawers"); print("collection ready")`,
      ], { stdio: 'pipe', timeout: 15000 });
      console.log(`[Workshop:mempalace] ChromaDB collection initialized`);
    } catch (e: any) {
      console.log(`[Workshop:mempalace] ChromaDB init warning: ${e.message}`);
    }
  }

  /** Find the mempalace venv Python, falling back to system python3 */
  private getMempalacePython(): string {
    // 1. Check for dev venv (local development)
    const cwd = process.cwd();
    const devVenv = path.join(cwd, 'working', 'mempalace', '.venv', 'bin', 'python');
    if (existsSync(devVenv)) {
      console.log(`[Workshop:mempalace] using dev venv: ${devVenv}`);
      return devVenv;
    }

    // 2. Check for pipx-installed mempalace (recommended for users)
    const pipxVenv = path.join(homedir(), '.local', 'pipx', 'venvs', 'mempalace', 'bin', 'python');
    if (existsSync(pipxVenv)) {
      console.log(`[Workshop:mempalace] using pipx: ${pipxVenv}`);
      return pipxVenv;
    }

    // 3. Check for uv tool install
    const uvTool = path.join(homedir(), '.local', 'share', 'uv', 'tools', 'mempalace', 'bin', 'python');
    if (existsSync(uvTool)) {
      console.log(`[Workshop:mempalace] using uv tool: ${uvTool}`);
      return uvTool;
    }

    // 4. Try system python with mempalace available
    for (const py of ['python3.13', 'python3', 'python']) {
      try {
        execFileSync(py, ['-c', 'import mempalace'], { stdio: 'pipe', timeout: 5000 });
        console.log(`[Workshop:mempalace] using system ${py}`);
        return py;
      } catch {}
    }

    console.log('[Workshop:mempalace] WARNING: mempalace not found — install with: pipx install mempalace');
    return 'python3';
  }
}
