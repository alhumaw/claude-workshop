# Design: Activity Pane + Session Persistence

## Feature 1: Activity Pane (Command History)

### What it does

The Activity tab in the sidebar shows a chronological feed of tool calls / commands Claude executes across all sessions. Each entry is expandable to show details. This gives you a single view into "what are my agents doing" without switching terminals.

### Data source: PTY stream parsing

Claude Code emits recognizable patterns in terminal output for tool calls. The PTY data already flows through `session-manager.ts` → `onData` callback. We intercept there and regex-match tool use patterns.

Tool call patterns in Claude Code terminal output:
- Tool headers: lines starting with `⏺` followed by tool name (e.g., `⏺ Read(src/foo.ts)`, `⏺ Bash`)
- Tool results: lines starting with `⎿` (tool result marker)

### Architecture

**Main process — `ActivityTracker`** (new module: `src/main/activity-tracker.ts`)
- Receives raw PTY data per session (tapped from the existing `onData` flow)
- Strips ANSI, regex-matches tool call patterns
- Accumulates `ActivityEvent[]` in memory per session
- Emits new events to renderer via IPC channel `activity:event`
- On app quit, serializes to disk (ties into persistence feature)

```typescript
interface ActivityEvent {
  id: string;           // unique event ID
  sessionId: string;
  sessionName: string;
  timestamp: number;
  tool: string;         // "Read", "Bash", "Edit", "Write", "Grep", "Glob", etc.
  summary: string;      // e.g. "src/main/index.ts" or "npm test"
  status: 'running' | 'done';
}
```

**Renderer — `ActivityPanel`** (new component: `src/renderer/components/ActivityPanel.tsx`)
- Zustand store slice: `activityEvents: ActivityEvent[]`
- Renders a scrollable list grouped by session, newest first
- Each entry shows: session avatar + name, tool icon, summary, relative timestamp
- Click to expand: no expansion needed initially — just the one-line summary
- Filter dropdown: all sessions vs. specific session
- Clicking an event switches to that session's terminal

**Sidebar integration**
- The Sessions/Activity tab headers become a real toggle
- Active tab state stored in sidebar local state
- Sessions tab shows session list (current behavior)
- Activity tab shows ActivityPanel

### Parsing strategy

We don't need perfect parsing. The key patterns:

```
⏺ Read(filepath)           → tool="Read", summary=filepath
⏺ Edit(filepath)           → tool="Edit", summary=filepath
⏺ Write(filepath)          → tool="Write", summary=filepath
⏺ Bash                     → tool="Bash", summary=next line (the command)
⏺ Grep                     → tool="Grep", summary extracted from args
⏺ Glob                     → tool="Glob", summary extracted from args
⏺ WebFetch(url)            → tool="WebFetch", summary=url
```

We parse these from the stripped-ANSI PTY stream. Imperfect matches are fine — this is informational, not functional.

---

## Feature 2: Session Persistence

### What it does

When AgentMux quits, session metadata is saved to disk. On relaunch, sessions are restored by spawning new PTY processes with `claude --resume <conversation-id>`.

### Conversation ID capture

Claude Code prints a conversation ID that we can capture from the PTY buffer. On startup, the welcome banner includes the conversation identifier. We parse this the same way we parse model/branch — regex on the buffer.

Alternatively, Claude Code stores conversations in `~/.claude/projects/`. We can match by working directory and timestamp to find the most recent conversation for a session.

The simplest reliable approach: use `claude --continue` with the correct `--cwd`, which resumes the most recent conversation in that directory. This avoids needing to capture conversation IDs at all.

### Persistence file

`~/.agentmux/sessions.json`:

```json
{
  "version": 1,
  "sessions": [
    {
      "name": "agent-1",
      "cwd": "/Users/foo/project",
      "avatarSeed": "a1b2c3d4",
      "contextPercent": 42,
      "cost": "$0.15",
      "model": "claude-4-6-sonnet",
      "branch": "main"
    }
  ],
  "activeSessionIndex": 0
}
```

### Lifecycle

**On quit** (`window-all-closed` or `before-quit`):
1. Serialize current session metadata to `~/.agentmux/sessions.json`
2. Serialize activity events to `~/.agentmux/activity.jsonl`
3. Kill all PTY processes (existing behavior)

**On launch** (`app.whenReady`):
1. Read `~/.agentmux/sessions.json`
2. If file exists and has sessions:
   - For each saved session, spawn PTY with `claude --continue` in the saved cwd
   - Restore name, avatarSeed, and other metadata
   - Send restored sessions to renderer
3. If no file or empty: normal fresh start
4. Read `~/.agentmux/activity.jsonl` to restore activity history

### Conversation ID strategy

Claude Code supports `--session-id <uuid>` to set a conversation UUID on spawn, and `--resume <uuid>` to resume it later. We generate a UUID when spawning each session and store it in `SessionInfo.claudeSessionId`. This avoids the problem where `--continue` would resume the same (most recent) conversation for multiple sessions sharing a cwd.

### Spawn modification

`SessionManager.spawn()` gains an optional `resumeSessionId` parameter:

```typescript
spawn(name: string, cwd?: string, opts?: { resumeSessionId?: string }): SessionInfo
```

- **New session**: `claude --session-id <generated-uuid>`
- **Restored session**: `claude --resume <saved-uuid>`

---

## What we're NOT building

- Terminal buffer serialization/restoration (xterm scrollback). The resumed Claude conversation has full context; the terminal just starts fresh.
- Activity event expansion/details. Just one-line summaries to start.
- Cost aggregation dashboard. Per-session cost is already on SessionCard.
