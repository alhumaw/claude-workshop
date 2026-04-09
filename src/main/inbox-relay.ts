import { readFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { SessionManager } from './session-manager';
import { SessionInfo } from '../shared/types';
import { parseStatus } from './parsers';

interface InboxMessage {
  from: string;
  text: string;
  timestamp: string;
  read: boolean;
  summary?: string;
}

/**
 * Polls team inbox files and delivers new messages to recipient terminals.
 *
 * Messages are only delivered when the recipient agent is IDLE (sitting
 * at the prompt). This prevents disrupting active work or colliding
 * with user input. Undelivered messages are queued and retried on the
 * next poll cycle.
 */
export class InboxRelay {
  private sessionManager: SessionManager;
  // Track how many messages we've already delivered per inbox file
  private deliveredCounts = new Map<string, number>();
  // Queue of messages waiting for an idle recipient
  private pendingDeliveries: Array<{ sessionId: string; text: string }> = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  start(pollIntervalMs = 3000): void {
    if (this.intervalId) return;
    this.initCounts();
    this.intervalId = setInterval(() => this.poll(), pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Snapshot existing inbox line counts so old messages aren't re-delivered on restart */
  private initCounts(): void {
    const sessions = this.sessionManager.getAllStatus();
    const teamSessions = sessions.filter((s) => s.teamId && s.teamAgentName);

    for (const session of teamSessions) {
      const leadCwd = this.getLeadCwd(session.teamId!);
      if (!leadCwd) continue;

      const inboxPath = path.join(
        leadCwd, '.workshop', session.teamId!,
        'inboxes', `${session.teamAgentName}.jsonl`,
      );

      if (!existsSync(inboxPath)) continue;

      try {
        const content = readFileSync(inboxPath, 'utf-8');
        const lineCount = content.split('\n').filter((l) => l.trim()).length;
        this.deliveredCounts.set(inboxPath, lineCount);
      } catch {}
    }
  }

  private async poll(): Promise<void> {
    // First, try to deliver any queued messages to now-idle agents
    await this.drainPending();

    // Then check for new messages in inbox files
    const sessions = this.sessionManager.getAllStatus();
    const teamSessions = sessions.filter((s) => s.teamId && s.teamAgentName);

    for (const session of teamSessions) {
      await this.checkInbox(session);
    }
  }

  private async drainPending(): Promise<void> {
    const remaining: typeof this.pendingDeliveries = [];

    for (const delivery of this.pendingDeliveries) {
      const session = this.sessionManager.getSession(delivery.sessionId);
      if (!session || session.info.status === 'exited') continue;

      const status = parseStatus(session.buffer, session.info.lastActivity);
      // Deliver when idle. Also deliver when detected as 'thinking'
      // since that's often a false positive (idle timer misdetection).
      // Only hold back during 'generating' (active tool output).
      if (status !== 'generating') {
        this.sessionManager.injectPrompt(delivery.sessionId, delivery.text, 0);
        // Brief pause so the PTY processes the injection
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        remaining.push(delivery);
      }
    }

    this.pendingDeliveries = remaining;
  }

  private async checkInbox(session: SessionInfo): Promise<void> {
    const leadCwd = this.getLeadCwd(session.teamId!);
    if (!leadCwd) return;

    const inboxPath = path.join(
      leadCwd, '.workshop', session.teamId!,
      'inboxes', `${session.teamAgentName}.jsonl`,
    );

    if (!existsSync(inboxPath)) return;

    let lines: string[];
    try {
      const raw = await readFile(inboxPath, 'utf-8');
      lines = raw.split('\n').filter((l) => l.trim());
    } catch {
      return;
    }

    const prevCount = this.deliveredCounts.get(inboxPath) ?? 0;
    if (lines.length <= prevCount) return;

    const newLines = lines.slice(prevCount);
    this.deliveredCounts.set(inboxPath, lines.length);
    console.log(`[Workshop:relay] ${session.teamAgentName}: ${newLines.length} new msg(s), prevCount=${prevCount}, total=${lines.length}`);

    for (const line of newLines) {
      let msg: InboxMessage;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      if (msg.from === session.teamAgentName) continue;

      const formatted = `[Team message from ${msg.from}]: ${msg.text}`;

      // Check if agent is idle right now
      const managed = this.sessionManager.getSession(session.id);
      if (!managed || managed.info.status === 'exited') continue;

      const status = parseStatus(managed.buffer, managed.info.lastActivity);
      console.log(`[Workshop:relay] Delivering to ${session.teamAgentName} (status=${status}): from=${msg.from}`);
      // Deliver when not actively generating
      if (status !== 'generating') {
        this.sessionManager.injectPrompt(session.id, formatted, 0);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        this.pendingDeliveries.push({ sessionId: session.id, text: formatted });
      }
    }
  }

  resetTeam(teamName: string): void {
    for (const key of this.deliveredCounts.keys()) {
      if (key.includes(`/.workshop/${teamName}/`)) {
        this.deliveredCounts.delete(key);
      }
    }
  }

  private getLeadCwd(teamId: string): string | null {
    const sessions = this.sessionManager.getAllStatus();
    const lead = sessions.find(
      (s) => s.teamId === teamId && s.teamRole === 'lead'
    );
    return lead?.cwd ?? null;
  }
}
