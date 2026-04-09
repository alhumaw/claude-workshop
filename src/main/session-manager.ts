import * as pty from 'node-pty';
import { SessionInfo, TeamInfo, IPC } from '../shared/types';
import { parseStatus, parseContext, parseContextSize, parseCost, parseModel, parseBranch } from './parsers';
import { randomBytes, randomUUID } from 'crypto';
import { BrowserWindow, ipcMain } from 'electron';

interface ManagedSession {
  info: SessionInfo;
  pty: pty.IPty;
  buffer: string; // ring buffer of recent output
  onDataCallback?: (data: string) => void;
}

const MAX_BUFFER = 8000; // chars to keep in ring buffer

export class SessionManager {
  private sessions = new Map<string, ManagedSession>();
  private teams = new Map<string, TeamInfo>();
  private getWindow: (() => BrowserWindow | null) | null = null;

  setWindowGetter(fn: () => BrowserWindow | null): void {
    this.getWindow = fn;
  }

  /**
   * Ask the renderer to serialize the xterm buffer for a session.
   * Returns the rendered terminal text (what the user sees on screen).
   */
  getTerminalText(sessionId: string): Promise<string> {
    return new Promise((resolve) => {
      const win = this.getWindow?.();
      if (!win) return resolve('');

      const timeout = setTimeout(() => resolve(''), 5000);

      ipcMain.once(IPC.TERMINAL_TEXT_RESPONSE, (_event, payload: { sessionId: string; text: string }) => {
        clearTimeout(timeout);
        resolve(payload.text);
      });

      win.webContents.send(IPC.TERMINAL_GET_TEXT, { sessionId });
    });
  }

  spawn(name: string, cwd?: string, opts?: { resumeSessionId?: string; model?: string; teamName?: string; addDirs?: string[]; palacePath?: string }, avatarSeed?: string): SessionInfo {
    const id = randomBytes(8).toString('hex');
    // Expand ~ to home directory since node-pty doesn't do shell expansion
    const rawCwd = cwd || process.env.HOME || '/';
    const workingDir = rawCwd.startsWith('~/')
      ? rawCwd.replace('~', process.env.HOME || '')
      : rawCwd === '~'
        ? (process.env.HOME || '/')
        : rawCwd;
    const shell = process.env.SHELL || '/bin/zsh';
    const claudeSessionId = opts?.resumeSessionId ?? randomUUID();

    // Launch claude directly via login shell so PATH is set up
    let cmd = opts?.resumeSessionId
      ? `claude --resume ${claudeSessionId}`
      : `claude --session-id ${claudeSessionId}`;
    if (opts?.model) {
      cmd += ` --model '${opts.model}'`;
    }
    if (opts?.addDirs && opts.addDirs.length > 0) {
      for (const dir of opts.addDirs) {
        cmd += ` --add-dir '${dir}'`;
      }
    }
    // Team agents — auto-approve file edits
    if (opts?.teamName) {
      cmd += ' --permission-mode acceptEdits';
    }

    const env: Record<string, string | undefined> = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };
    if (opts?.teamName) {
      env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
    }
    if (opts?.palacePath) {
      env.MEMPALACE_PALACE_PATH = opts.palacePath;
    }

    console.log(`[Workshop:spawn] cmd=${cmd}`);
    console.log(`[Workshop:spawn] cwd=${workingDir}`);
    const ptyProcess = pty.spawn(shell, ['-l', '-c', cmd], {
      name: 'xterm-256color',
      cwd: workingDir,
      env: env as Record<string, string>,
      cols: 120,
      rows: 30,
    });

    const info: SessionInfo = {
      id,
      name,
      status: 'idle',
      branch: '',
      model: '',
      contextPercent: 0,
      contextSize: '',
      cost: '',
      lastActivity: Date.now(),
      cwd: workingDir,
      avatarSeed: avatarSeed ?? randomBytes(4).toString('hex'),
      claudeSessionId,
    };

    const managed: ManagedSession = {
      info,
      pty: ptyProcess,
      buffer: '',
    };

    ptyProcess.onData((data) => {
      // Append to ring buffer
      managed.buffer += data;
      if (managed.buffer.length > MAX_BUFFER) {
        managed.buffer = managed.buffer.slice(-MAX_BUFFER);
      }
      managed.info.lastActivity = Date.now();

      // Forward to renderer
      if (managed.onDataCallback) {
        managed.onDataCallback(data);
      }
    });

    ptyProcess.onExit(() => {
      managed.info.status = 'exited';
    });

    this.sessions.set(id, managed);
    return info;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.info.status !== 'exited') {
      try { session.pty.write(data); } catch {}
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session && session.info.status !== 'exited') {
      try { session.pty.resize(cols, rows); } catch {}
    }
  }

  clearBuffer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.buffer = '';
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(sessionId);
    }
  }

  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id);
    }
  }

  setOnData(sessionId: string, callback: (data: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.onDataCallback = callback;
    }
  }

  getAllStatus(): SessionInfo[] {
    const results: SessionInfo[] = [];
    for (const [, session] of this.sessions) {
      // Parse current status from buffer
      const buffer = session.buffer;
      session.info.status = parseStatus(buffer, session.info.lastActivity);
      session.info.contextPercent = parseContext(buffer) ?? session.info.contextPercent;
      session.info.contextSize = parseContextSize(buffer) ?? session.info.contextSize;
      session.info.cost = parseCost(buffer) ?? session.info.cost;
      session.info.model = parseModel(buffer) ?? session.info.model;
      session.info.branch = parseBranch(buffer) ?? session.info.branch;
      results.push({ ...session.info });
    }
    return results;
  }

  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  listIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Inject a prompt into a session after Claude boots.
   * Splits the text write from the Enter keypress -- writing them in a
   * single chunk causes Claude Code's TUI to swallow the \r.
   */
  injectPrompt(sessionId: string, prompt: string, delayMs = 8000): void {
    setTimeout(() => {
      this.write(sessionId, prompt);
      // Send Enter separately after a brief gap so the TUI processes the text first
      setTimeout(() => this.write(sessionId, '\r'), 150);
    }, delayMs);
  }

  /**
   * Inject a team-aware prompt for the lead agent.
   * Workshop owns the team infrastructure — the lead must NOT call
   * TeamCreate (it creates a conflicting duplicate). Instead the lead
   * communicates via inbox files, and Workshop auto-delivers messages.
   */
  injectLeadPrompt(
    sessionId: string,
    leadName: string,
    teamName: string,
    leadCwd: string,
    description: string,
    teammateNames: string[],
    promptFilePath?: string,
    delayMs = 8000,
  ): void {
    const inboxBase = `${leadCwd}/.workshop/${teamName}/inboxes`;
    const parts: string[] = [];
    parts.push(
      `You are '${leadName}', the lead of team '${teamName}'.`,
      `IMPORTANT: Do NOT use TeamCreate or SendMessage — the team infrastructure is managed by the Workshop UI.`,
      `IMPORTANT: Do NOT explore the codebase, scan directories, or search for context on your own. Do NOT read files outside the project directory unless explicitly instructed.`,
    );
    if (teammateNames.length > 0) {
      parts.push(
        `Your teammates (${teammateNames.join(', ')}) are running in separate terminal sessions.`,
        `Do NOT spawn them via Task — they are already active.`,
      );
    }
    parts.push(
      `To send a message, use Bash to append to the recipient's inbox (one JSON per line):`,
      `echo '{"from":"${leadName}","text":"your message"}' >> ${inboxBase}/{name}.jsonl`,
      `Messages sent to your inbox at ${inboxBase}/${leadName}.jsonl will be delivered to you automatically — no need to poll.`,
      `MEMORY: You have access to a shared MemPalace (MCP tools starting with mempalace_). Use mempalace_diary_write to journal your work. Use mempalace_search to find past knowledge. Use mempalace_diary_read to check what teammates have recorded.`,
    );
    if (promptFilePath) {
      parts.push(`Read ONLY the instructions at ${promptFilePath} and follow them. After loading your instructions, WAIT for a directive from the user. Do NOT take autonomous action until given a task.`);
    } else {
      parts.push(`WAIT for a directive from the user. Do NOT take autonomous action until given a task.`);
    }
    this.injectPrompt(sessionId, parts.join(' '), delayMs);
  }

  /**
   * Inject a team-aware prompt for a teammate agent.
   * Tells the teammate how to communicate via inbox files.
   * Workshop auto-delivers incoming messages, so no polling needed.
   */
  injectTeammatePrompt(
    sessionId: string,
    agentName: string,
    teamName: string,
    leadName: string,
    leadCwd: string,
    promptFilePath?: string,
    delayMs = 8000,
  ): void {
    const inboxBase = `${leadCwd}/.workshop/${teamName}/inboxes`;
    const parts: string[] = [];
    parts.push(
      `You are ${agentName}, a teammate in team '${teamName}'. Your lead is '${leadName}'.`,
      `IMPORTANT: Do NOT use TeamCreate or SendMessage — the team is managed by the Workshop UI.`,
      `IMPORTANT: Do NOT explore the codebase, scan directories, or search for context on your own. Do NOT read files outside the project directory unless explicitly instructed. Stay in your lane.`,
      `To send a message, use Bash to append to the recipient's inbox (one JSON per line):`,
      `echo '{"from":"${agentName}","text":"your message"}' >> ${inboxBase}/${leadName}.jsonl`,
      `For other teammates, replace the filename: ${inboxBase}/{their-name}.jsonl`,
      `Messages sent to your inbox at ${inboxBase}/${agentName}.jsonl will be delivered to you automatically — no need to poll.`,
      `MEMORY: You have access to a shared MemPalace (MCP tools starting with mempalace_). Use mempalace_diary_write with your name as agent_name to journal your work. Use mempalace_search to find past knowledge. Use mempalace_diary_read to check what teammates have recorded.`,
    );
    if (promptFilePath) {
      parts.push(`Read ONLY the instructions at ${promptFilePath} and follow them. After loading your instructions, send a ready message to '${leadName}' and WAIT. Do NOT take autonomous action — wait for assignments from the lead or the user.`);
    } else {
      parts.push(`Send a ready message to '${leadName}' and WAIT. Do NOT take autonomous action — wait for assignments from the lead or the user.`);
    }
    this.injectPrompt(sessionId, parts.join(' '), delayMs);
  }

  // Team management for persistence
  registerTeam(team: TeamInfo): void { this.teams.set(team.id, team); }
  removeTeam(teamId: string): void { this.teams.delete(teamId); }
  getAllTeams(): TeamInfo[] { return Array.from(this.teams.values()); }

  /**
   * Wait for a command to finish by monitoring PTY data flow.
   *
   * Instead of relying on parseStatus (which returns 'idle' during plain
   * text output), we track when data STOPS flowing.  When the PTY hasn't
   * sent any bytes for `quietPeriodMs`, the command has finished.
   *
   * @param minWaitMs      Minimum time before we even consider resolving.
   *                       Prevents triggering during inter-phase gaps in
   *                       multi-phase commands (e.g. skill pre-hook → AI gen).
   * @param quietPeriodMs  How long the PTY must be silent before we resolve.
   */
  private waitForQuiet(
    sessionId: string,
    timeoutMs: number,
    minWaitMs = 5000,
    quietPeriodMs = 3000,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return Promise.reject(new Error('Session not found'));

    let lastDataTime = Date.now();
    let receivedAnyData = false;
    const origCb = session.onDataCallback;
    session.onDataCallback = (data: string) => {
      lastDataTime = Date.now();
      receivedAnyData = true;
      if (origCb) origCb(data);
    };

    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;

      const check = () => {
        if (Date.now() > deadline) {
          session.onDataCallback = origCb;
          return reject(new Error('Timed out waiting for completion'));
        }
        if (session.info.status === 'exited') {
          session.onDataCallback = origCb;
          return reject(new Error('Session exited'));
        }

        const elapsed = Date.now() - startTime;
        const silence = Date.now() - lastDataTime;

        // Resolve when ALL conditions are met:
        // 1. We've received at least some data (command was processed)
        // 2. Minimum time has passed (multi-phase commands need time)
        // 3. PTY has been silent for quietPeriodMs (output finished)
        if (receivedAnyData && elapsed >= minWaitMs && silence >= quietPeriodMs) {
          session.onDataCallback = origCb;
          return resolve();
        }
        setTimeout(check, 500);
      };
      setTimeout(check, 500);
    });
  }

  async captureHandoff(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || session.info.status === 'exited') {
      throw new Error(`Session ${sessionId} not available`);
    }

    // Generate the handoff using the proven skill command.
    session.pty.write('/skills:handoff\r');

    // Wait for the command to fully complete.  The skill has multiple phases:
    //   1. Bash pre-hook (~2s)
    //   2. Gap (Claude loading skill context)
    //   3. AI generation + text output (~10-30s)
    // We use minWaitMs=10s to survive the inter-phase gap, and
    // quietPeriodMs=3s to ensure all text output has finished.
    await this.waitForQuiet(sessionId, 120_000, 10_000, 3000);

    // Read the rendered terminal text from xterm.js in the renderer.
    // This gives us exactly what the user sees — properly rendered, no
    // spinner artifacts, no ring buffer overflow issues.
    const terminalText = await this.getTerminalText(sessionId);
    return terminalText;
  }
}
