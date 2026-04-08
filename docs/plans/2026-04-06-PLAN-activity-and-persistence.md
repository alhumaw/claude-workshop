# Activity Pane + Session Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use skills:executing-plans to implement this plan task-by-task.

**Goal:** Add a live Activity pane showing tool call history across all sessions, and persist sessions across app restarts.

**Architecture:** Parse tool call patterns (`⏺ Read(...)`, `⏺ Bash`, etc.) from the PTY data stream in main process, emit structured events to renderer via IPC. Activity pane replaces the dead "Activity" tab in the sidebar. Session persistence saves metadata (including Claude conversation UUID) to `~/.agentmux/sessions.json` on quit. On launch, each session is restored via `claude --resume <uuid>`. On initial spawn, we generate a UUID and pass it via `claude --session-id <uuid>` so we always know the conversation ID.

**Tech Stack:** Electron, TypeScript, React, Zustand, node-pty, xterm.js

## Progress

| Status | Count |
|--------|-------|
| 🔴 NOT_STARTED | 0 |
| 🟡 IN_PROGRESS | 0 |
| 🟢 COMPLETED | 8 |
| ⚪ BLOCKED | 0 |

---

## Part 1: Activity Tracking Infrastructure

### Task 1: Add ActivityEvent type and IPC channels 🟢 COMPLETED
<!-- deps: [] | files: ["src/shared/types.ts"] -->

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add the ActivityEvent interface and IPC channels**

In `src/shared/types.ts`, add `claudeSessionId` to the `SessionInfo` interface (after the `avatarSeed` field):

```typescript
  claudeSessionId: string; // UUID passed to claude --session-id, used for --resume
```

Then add after the `ToolkitConfig` interface (line 19):

```typescript
export interface ActivityEvent {
  id: string;
  sessionId: string;
  sessionName: string;
  timestamp: number;
  tool: string;
  summary: string;
}
```

Then add to the `IPC` const object (after `TOOLKIT_FRESH_SESSION`):

```typescript
  ACTIVITY_EVENT: 'activity:event',
  ACTIVITY_LIST: 'activity:list',
  PERSIST_SAVE: 'persist:save',
  PERSIST_LOAD: 'persist:load',
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: No new errors from this change.

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add ActivityEvent type and new IPC channels"
```

---

### Task 2: Create ActivityTracker module (main process) 🟢 COMPLETED
<!-- deps: [1] | files: ["src/main/activity-tracker.ts"] -->

**Files:**
- Create: `src/main/activity-tracker.ts`

**Context:** This module receives raw PTY data per session, strips ANSI codes, and regex-matches Claude Code tool call patterns. Tool calls in Claude Code terminal output look like:

```
⏺ Read(src/foo.ts)
⏺ Edit(src/foo.ts)
⏺ Write(src/foo.ts)
⏺ Bash
  npm test
⏺ Grep
⏺ Glob
⏺ WebFetch(https://...)
⏺ Agent
```

The `⏺` character (U+23FA) marks the start of a tool call line. The tool name follows, and arguments may be in parentheses or on the next line (for Bash).

**Step 1: Create the ActivityTracker**

Create `src/main/activity-tracker.ts`:

```typescript
import { ActivityEvent } from '../shared/types';
import { randomBytes } from 'crypto';

// Strip ANSI escape sequences (reuse same pattern as parsers/index.ts)
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\r/g, '');
}

// Match tool call lines: ⏺ ToolName or ⏺ ToolName(args)
const TOOL_CALL_RE = /⏺\s+(\w+)(?:\(([^)]*)\))?/;

export class ActivityTracker {
  private events: ActivityEvent[] = [];
  private listeners: ((event: ActivityEvent) => void)[] = [];
  // Per-session partial line buffer for multi-line tool parsing (e.g. Bash command on next line)
  private lineBuffers = new Map<string, string>();

  /** Feed raw PTY data for a session. Call this from the onData callback. */
  feed(sessionId: string, sessionName: string, rawData: string): void {
    const prev = this.lineBuffers.get(sessionId) ?? '';
    const text = stripAnsi(prev + rawData);

    const lines = text.split('\n');
    // Keep the last incomplete line in the buffer
    this.lineBuffers.set(sessionId, lines.pop() ?? '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = TOOL_CALL_RE.exec(line);
      if (!match) continue;

      const tool = match[1];
      let summary = match[2] ?? '';

      // For Bash/Grep/Glob, the summary may be on the next line if no parens
      if (!summary && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Only grab next line if it looks like a command (not another tool call)
        if (nextLine && !TOOL_CALL_RE.test(nextLine)) {
          summary = nextLine.slice(0, 120);
        }
      }

      const event: ActivityEvent = {
        id: randomBytes(6).toString('hex'),
        sessionId,
        sessionName,
        timestamp: Date.now(),
        tool,
        summary,
      };

      this.events.push(event);
      for (const listener of this.listeners) {
        listener(event);
      }
    }
  }

  /** Register a listener for new events (used to forward to renderer via IPC). */
  onEvent(listener: (event: ActivityEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Get all accumulated events. */
  getAll(): ActivityEvent[] {
    return [...this.events];
  }

  /** Restore events from persistence. */
  restore(events: ActivityEvent[]): void {
    this.events = [...events];
  }

  /** Clear events for a removed session. */
  clearSession(sessionId: string): void {
    this.events = this.events.filter((e) => e.sessionId !== sessionId);
    this.lineBuffers.delete(sessionId);
  }
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/main/activity-tracker.ts
git commit -m "feat: add ActivityTracker for parsing tool calls from PTY stream"
```

---

### Task 3: Wire ActivityTracker into session manager and IPC 🟢 COMPLETED
<!-- deps: [1, 2] | files: ["src/main/index.ts", "src/main/ipc-handlers.ts", "src/main/session-manager.ts"] -->

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc-handlers.ts`

**Step 1: Integrate ActivityTracker in main process entry**

In `src/main/index.ts`, add import at top:

```typescript
import { ActivityTracker } from './activity-tracker';
```

After `let sessionManager: SessionManager;` (line 10), add:

```typescript
let activityTracker: ActivityTracker;
```

In the `app.whenReady()` block, after `sessionManager = new SessionManager();` (line 108), add:

```typescript
  activityTracker = new ActivityTracker();
```

Pass `activityTracker` to `registerIpcHandlers`:

Change line 110 from:
```typescript
  registerIpcHandlers(sessionManager, () => mainWindow);
```
to:
```typescript
  registerIpcHandlers(sessionManager, activityTracker, () => mainWindow);
```

Add after `registerShortcuts();` (line 112), before the status polling interval:

```typescript
  // Forward activity events to renderer
  activityTracker.onEvent((event) => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC.ACTIVITY_EVENT, event);
    }
  });
```

Add the IPC import at the top if not already there:
```typescript
import { IPC } from '../shared/types';
```

**Step 2: Update registerIpcHandlers signature and wire activity feed**

In `src/main/ipc-handlers.ts`, change the function signature (line 8-11) from:

```typescript
export function registerIpcHandlers(
  sessionManager: SessionManager,
  getWindow: () => BrowserWindow | null
): void {
```

to:

```typescript
export function registerIpcHandlers(
  sessionManager: SessionManager,
  activityTracker: ActivityTracker,
  getWindow: () => BrowserWindow | null
): void {
```

Add import at top:
```typescript
import { ActivityTracker } from './activity-tracker';
import { ActivityEvent, IPC } from '../shared/types';
```

(Update the existing IPC import to also import ActivityEvent.)

In the `SESSION_SPAWN` handler (line 13-25), after `sessionManager.setOnData(info.id, (data) => {` block, update the onData callback to also feed the activity tracker. Replace the entire `setOnData` block:

```typescript
    sessionManager.setOnData(info.id, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId: info.id, data });
      }
      activityTracker.feed(info.id, info.name, data);
    });
```

Do the same for the `TOOLKIT_HANDOFF` handler's `setOnData` block (around line 91-95):

```typescript
    sessionManager.setOnData(newInfo.id, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId: newInfo.id, data });
      }
      activityTracker.feed(newInfo.id, newInfo.name, data);
    });
```

And the `TOOLKIT_FRESH_SESSION` handler's `setOnData` block (around line 119-123):

```typescript
    sessionManager.setOnData(newInfo.id, (data) => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC.TERMINAL_DATA, { sessionId: newInfo.id, data });
      }
      activityTracker.feed(newInfo.id, newInfo.name, data);
    });
```

Add an IPC handler for fetching the full activity list (at the end of `registerIpcHandlers`):

```typescript
  // Activity: get all events
  ipcMain.handle(IPC.ACTIVITY_LIST, () => {
    return activityTracker.getAll();
  });
```

**Step 3: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/main/index.ts src/main/ipc-handlers.ts
git commit -m "feat: wire ActivityTracker into PTY data flow and IPC"
```

---

## Part 2: Activity Pane UI

### Task 4: Expose activity IPC to renderer via preload 🟢 COMPLETED
<!-- deps: [1] | files: ["src/main/preload.ts", "src/renderer/App.tsx"] -->

**Files:**
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/App.tsx` (type declarations)

**Step 1: Add activity APIs to preload bridge**

In `src/main/preload.ts`, add inside the `contextBridge.exposeInMainWorld('electronAPI', {` block, after the `onShortcut` method (before the closing `});`):

```typescript
  // Activity
  getActivityEvents: () =>
    ipcRenderer.invoke(IPC.ACTIVITY_LIST),
  onActivityEvent: (callback: (event: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, activityEvent: any) => {
      callback(activityEvent);
    };
    ipcRenderer.on(IPC.ACTIVITY_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.ACTIVITY_EVENT, listener);
  },
```

**Step 2: Update type declarations in App.tsx**

In `src/renderer/App.tsx`, add to the `electronAPI` interface (inside the `Window` declaration, after the `onShortcut` line):

```typescript
      getActivityEvents: () => Promise<any[]>;
      onActivityEvent: (callback: (event: any) => void) => () => void;
```

**Step 3: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/main/preload.ts src/renderer/App.tsx
git commit -m "feat: expose activity event IPC to renderer"
```

---

### Task 5: Create activity store slice 🟢 COMPLETED
<!-- deps: [4] | files: ["src/renderer/stores/activity-store.ts"] -->

**Files:**
- Create: `src/renderer/stores/activity-store.ts`

**Step 1: Create the Zustand store for activity events**

Create `src/renderer/stores/activity-store.ts`:

```typescript
import { create } from 'zustand';
import { ActivityEvent } from '../../shared/types';

interface ActivityStore {
  events: ActivityEvent[];
  filterSessionId: string | null;
  addEvent: (event: ActivityEvent) => void;
  setEvents: (events: ActivityEvent[]) => void;
  setFilter: (sessionId: string | null) => void;
}

const MAX_EVENTS = 500;

export const useActivityStore = create<ActivityStore>((set) => ({
  events: [],
  filterSessionId: null,

  addEvent: (event) =>
    set((state) => {
      const events = [event, ...state.events];
      if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
      return { events };
    }),

  setEvents: (events) => set({ events }),

  setFilter: (sessionId) => set({ filterSessionId: sessionId }),
}));
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/renderer/stores/activity-store.ts
git commit -m "feat: add Zustand activity store"
```

---

### Task 6: Create ActivityPanel component and wire into Sidebar 🟢 COMPLETED
<!-- deps: [5] | files: ["src/renderer/components/ActivityPanel.tsx", "src/renderer/components/Sidebar.tsx", "src/renderer/App.tsx"] -->

**Files:**
- Create: `src/renderer/components/ActivityPanel.tsx`
- Modify: `src/renderer/components/Sidebar.tsx`
- Modify: `src/renderer/App.tsx`

**Step 1: Create the ActivityPanel component**

Create `src/renderer/components/ActivityPanel.tsx`:

```typescript
import React from 'react';
import { useActivityStore } from '../stores/activity-store';
import { useSessionStore } from '../stores/session-store';
import { ActivityEvent } from '../../shared/types';

const TOOL_ICONS: Record<string, string> = {
  Read: '📄',
  Edit: '✏️',
  Write: '📝',
  Bash: '⬛',
  Grep: '🔍',
  Glob: '📁',
  WebFetch: '🌐',
  Agent: '🤖',
  LSP: '🔗',
};

function timeSince(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function EventRow({ event }: { event: ActivityEvent }) {
  const setActive = useSessionStore((s) => s.setActiveSession);

  return (
    <div
      onClick={() => setActive(event.sessionId)}
      style={{
        padding: '6px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-default)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ flexShrink: 0 }}>{TOOL_ICONS[event.tool] ?? '⏺'}</span>
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{event.tool}</span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0, fontSize: 10 }}>
          {timeSince(event.timestamp)}
        </span>
      </div>
      {event.summary && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingLeft: 22,
        }}>
          {event.summary}
        </div>
      )}
      <div style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        marginTop: 1,
        paddingLeft: 22,
      }}>
        {event.sessionName}
      </div>
    </div>
  );
}

export function ActivityPanel() {
  const events = useActivityStore((s) => s.events);
  const filterSessionId = useActivityStore((s) => s.filterSessionId);
  const setFilter = useActivityStore((s) => s.setFilter);
  const sessions = useSessionStore((s) => s.sessions);

  const filtered = filterSessionId
    ? events.filter((e) => e.sessionId === filterSessionId)
    : events;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter dropdown */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)' }}>
        <select
          value={filterSessionId ?? ''}
          onChange={(e) => setFilter(e.target.value || null)}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
          }}
        >
          <option value="">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
          }}>
            No activity yet
          </div>
        ) : (
          filtered.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add tab toggle to Sidebar**

In `src/renderer/components/Sidebar.tsx`, add imports at top:

```typescript
import { ActivityPanel } from './ActivityPanel';
```

Add state for the active tab inside the `Sidebar` function, after the existing `useState` calls:

```typescript
  const [activeTab, setActiveTab] = useState<'sessions' | 'activity'>('sessions');
```

Replace the header `<div>` that contains Sessions/Activity spans (lines 68-71):

```typescript
        <div style={{ display: 'flex', gap: 16 }}>
          <span
            onClick={() => setActiveTab('sessions')}
            style={{
              fontWeight: activeTab === 'sessions' ? 600 : 400,
              color: activeTab === 'sessions' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Sessions
          </span>
          <span
            onClick={() => setActiveTab('activity')}
            style={{
              fontWeight: activeTab === 'activity' ? 600 : 400,
              color: activeTab === 'activity' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Activity
          </span>
        </div>
```

Replace the session list `<div>` (lines 89-110) with a conditional:

```typescript
      {/* Content area — switches between tabs */}
      <div style={{ flex: 1, overflowY: 'auto', padding: activeTab === 'sessions' ? '8px' : '0' }}>
        {activeTab === 'sessions' ? (
          sessions.map((session) => (
            <div
              key={session.id}
              ref={(el) => {
                if (el) cardRefs.current.set(session.id, el);
                else cardRefs.current.delete(session.id);
              }}
            >
              <SessionCard
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => setActive(session.id)}
                onContextMenu={(e) => handleContextMenu(e, session.id)}
              />
            </div>
          ))
        ) : (
          <ActivityPanel />
        )}
      </div>
```

**Step 3: Wire up activity event listener in App.tsx**

In `src/renderer/App.tsx`, add import:

```typescript
import { useActivityStore } from './stores/activity-store';
```

Inside the `App` component, add:

```typescript
  const addActivityEvent = useActivityStore((s) => s.addEvent);
  const setActivityEvents = useActivityStore((s) => s.setEvents);

  // Load existing activity events on mount
  useEffect(() => {
    window.electronAPI.getActivityEvents().then(setActivityEvents);
  }, [setActivityEvents]);

  // Listen for new activity events
  useEffect(() => {
    return window.electronAPI.onActivityEvent((event) => {
      addActivityEvent(event);
    });
  }, [addActivityEvent]);
```

**Step 4: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`

**Step 5: Manual test**

Run: `cd /Users/amoomaw/workshop/agentmux && npm start`

1. Spawn a session and ask Claude to do something (e.g., "read package.json")
2. Click the "Activity" tab in the sidebar
3. Verify tool calls appear in the feed with tool name, summary, timestamp, and session name
4. Verify the session filter dropdown works
5. Click an event row — should switch to that session's terminal

**Step 6: Commit**

```bash
git add src/renderer/components/ActivityPanel.tsx src/renderer/components/Sidebar.tsx src/renderer/App.tsx
git commit -m "feat: add Activity pane with tool call feed and session filter"
```

---

## Part 3: Session Persistence

### Task 7: Create persistence module (main process) 🟢 COMPLETED
<!-- deps: [1] | files: ["src/main/persistence.ts"] -->

**Files:**
- Create: `src/main/persistence.ts`

**Step 1: Create the persistence module**

Create `src/main/persistence.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { SessionInfo, ActivityEvent } from '../shared/types';

const DATA_DIR = path.join(homedir(), '.agentmux');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');

interface PersistedState {
  version: 1;
  sessions: Array<{
    name: string;
    cwd: string;
    avatarSeed: string;
    claudeSessionId: string;
    contextPercent: number;
    cost: string;
    model: string;
    branch: string;
  }>;
  activeSessionIndex: number;
}

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function saveSessions(sessions: SessionInfo[], activeSessionId: string | null): Promise<void> {
  await ensureDir();
  const activeIndex = activeSessionId
    ? sessions.findIndex((s) => s.id === activeSessionId)
    : 0;

  const state: PersistedState = {
    version: 1,
    sessions: sessions
      .filter((s) => s.status !== 'exited')
      .map((s) => ({
        name: s.name,
        cwd: s.cwd,
        avatarSeed: s.avatarSeed,
        claudeSessionId: s.claudeSessionId,
        contextPercent: s.contextPercent,
        cost: s.cost,
        model: s.model,
        branch: s.branch,
      })),
    activeSessionIndex: Math.max(0, activeIndex),
  };

  await writeFile(SESSIONS_FILE, JSON.stringify(state, null, 2));
}

export async function loadSessions(): Promise<PersistedState | null> {
  try {
    const data = await readFile(SESSIONS_FILE, 'utf-8');
    const state = JSON.parse(data) as PersistedState;
    if (state.version !== 1) return null;
    return state;
  } catch {
    return null;
  }
}

export async function clearSessions(): Promise<void> {
  try {
    await writeFile(SESSIONS_FILE, JSON.stringify({ version: 1, sessions: [], activeSessionIndex: 0 }));
  } catch {}
}

export async function saveActivity(events: ActivityEvent[]): Promise<void> {
  await ensureDir();
  // Keep only the last 500 events
  const trimmed = events.slice(0, 500);
  await writeFile(ACTIVITY_FILE, JSON.stringify(trimmed));
}

export async function loadActivity(): Promise<ActivityEvent[]> {
  try {
    const data = await readFile(ACTIVITY_FILE, 'utf-8');
    return JSON.parse(data) as ActivityEvent[];
  } catch {
    return [];
  }
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/main/persistence.ts
git commit -m "feat: add persistence module for sessions and activity"
```

---

### Task 8: Wire persistence into app lifecycle 🟢 COMPLETED
<!-- deps: [3, 7] | files: ["src/main/index.ts", "src/main/ipc-handlers.ts", "src/main/session-manager.ts"] -->

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/session-manager.ts`

**Step 1: Add `resume` option to SessionManager.spawn()**

In `src/main/session-manager.ts`, change the `spawn` method signature (line 44) from:

```typescript
  spawn(name: string, cwd?: string): SessionInfo {
```

to:

```typescript
  spawn(name: string, cwd?: string, opts?: { resumeSessionId?: string }): SessionInfo {
```

After the `const workingDir` line, add UUID generation:

```typescript
    const claudeSessionId = opts?.resumeSessionId ?? crypto.randomUUID();
```

(Add `import crypto from 'crypto';` at top if not already imported — note: `randomBytes` is already imported, but `randomUUID` is on the `crypto` module directly. Use `import { randomBytes, randomUUID } from 'crypto';`)

Change the pty.spawn call (line 50) from:

```typescript
    const ptyProcess = pty.spawn(shell, ['-l', '-c', 'claude'], {
```

to:

```typescript
    const cmd = opts?.resumeSessionId
      ? `claude --resume ${claudeSessionId}`
      : `claude --session-id ${claudeSessionId}`;
    const ptyProcess = pty.spawn(shell, ['-l', '-c', cmd], {
```

Add `claudeSessionId` to the `info` object (after `avatarSeed`):

```typescript
      claudeSessionId,
```

**Step 2: Wire persistence into app lifecycle in index.ts**

In `src/main/index.ts`, add imports:

```typescript
import { saveSessions, loadSessions, clearSessions, saveActivity, loadActivity } from './persistence';
import { IPC } from '../shared/types';
```

Replace the `app.whenReady()` block with session restoration logic. After `activityTracker = new ActivityTracker();`, add:

```typescript
  // Restore persisted activity
  const savedActivity = await loadActivity();
  if (savedActivity.length > 0) {
    activityTracker.restore(savedActivity);
  }
```

After `registerShortcuts();` and the activity event forwarding, add session restoration:

```typescript
  // Restore persisted sessions
  const savedState = await loadSessions();
  if (savedState && savedState.sessions.length > 0) {
    for (const saved of savedState.sessions) {
      const info = sessionManager.spawn(saved.name, saved.cwd, { resumeSessionId: saved.claudeSessionId });
      // Restore metadata
      info.avatarSeed = saved.avatarSeed;
      info.cost = saved.cost;
      info.model = saved.model;
      info.branch = saved.branch;
      info.contextPercent = saved.contextPercent;

      // Wire PTY data
      sessionManager.setOnData(info.id, (data) => {
        if (mainWindow) {
          mainWindow.webContents.send(IPC.TERMINAL_DATA, { sessionId: info.id, data });
        }
        activityTracker.feed(info.id, info.name, data);
      });

      // Notify renderer of restored session
      if (mainWindow) {
        mainWindow.webContents.send('session:restored', info);
      }
    }
    // Clear the persisted state now that we've restored
    await clearSessions();
  }
```

**Step 3: Save state on quit**

Replace the `app.on('window-all-closed', ...)` handler (lines 123-127) with:

```typescript
app.on('window-all-closed', async () => {
  globalShortcut.unregisterAll();

  // Save state before killing sessions
  const sessions = sessionManager.getAllStatus();
  await saveSessions(sessions, null);
  await saveActivity(activityTracker.getAll());

  sessionManager.killAll();
  app.quit();
});
```

Note: The `app.whenReady()` callback needs to become `async`. Change line 72 from:

```typescript
app.whenReady().then(() => {
```

to:

```typescript
app.whenReady().then(async () => {
```

**Step 4: Handle restored sessions in renderer**

In `src/main/preload.ts`, add to the exposed API:

```typescript
  onSessionRestored: (callback: (session: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, session: any) => {
      callback(session);
    };
    ipcRenderer.on('session:restored', listener);
    return () => ipcRenderer.removeListener('session:restored', listener);
  },
```

In `src/renderer/App.tsx`, add to the `electronAPI` type:

```typescript
      onSessionRestored: (callback: (session: any) => void) => () => void;
```

Add a useEffect in the App component to handle restored sessions:

```typescript
  // Handle restored sessions from persistence
  useEffect(() => {
    return window.electronAPI.onSessionRestored((session) => {
      addSession(session);
    });
  }, [addSession]);
```

**Step 5: Verify no TypeScript errors**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`

**Step 6: Manual test**

1. Run: `npm start`
2. Spawn a session, interact with Claude briefly
3. Quit the app (Cmd+Q)
4. Verify `~/.agentmux/sessions.json` exists and contains session data
5. Run `npm start` again
6. Verify the session reappears in the sidebar with its name and avatar
7. Verify the terminal shows Claude resuming (via `--resume <uuid>`) with the previous conversation
8. Verify spawning multiple sessions in the same cwd restores correctly (each gets its own conversation)
8. Click Activity tab — verify previous activity events are restored

**Step 7: Commit**

```bash
git add src/main/index.ts src/main/session-manager.ts src/main/ipc-handlers.ts src/main/preload.ts src/renderer/App.tsx
git commit -m "feat: persist and restore sessions and activity across app restarts"
```

---

## Execution Handoff

After completing all 8 tasks, run the app end-to-end:

1. `npm start`
2. Spawn 2-3 sessions, interact with Claude in each
3. Check Activity tab — tool calls appear from all sessions
4. Filter by session — only that session's events show
5. Quit and relaunch — sessions restore, activity history persists
6. Verify `claude --resume <uuid>` picks up the correct conversation for each session (even multiple sessions in same cwd)
