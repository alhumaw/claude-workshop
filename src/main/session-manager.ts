import * as pty from 'node-pty';
import { SessionInfo, IPC } from '../shared/types';
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

  spawn(name: string, cwd?: string, opts?: { resumeSessionId?: string }, avatarSeed?: string): SessionInfo {
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
    const cmd = opts?.resumeSessionId
      ? `claude --resume ${claudeSessionId}`
      : `claude --session-id ${claudeSessionId}`;
    const ptyProcess = pty.spawn(shell, ['-l', '-c', cmd], {
      name: 'xterm-256color',
      cwd: workingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
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
      session.info.status = parseStatus(buffer);
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
