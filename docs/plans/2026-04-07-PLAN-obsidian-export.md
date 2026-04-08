# Obsidian Mindmap Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use skills:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Export to Obsidian" toolkit button that generates an interlinked Obsidian vault folder from the active session's conversation, plus a Settings overlay to configure the vault path.

**Architecture:** A new `AppConfig` type (`vaultPath`) persists to `~/.agentmux/config.json`. A gear icon in the Sidebar header opens a blur overlay Settings modal. The export spawns `claude --print` as a background subprocess (reuses the user's existing Claude Code auth) with the session's terminal buffer, parses JSON output, and writes interlinked `.md` files to `{vault}/{date}-{name}/`. Two error states (no vault configured, vault path not found on disk) show a red shake animation in the Toolkit panel.

**Tech Stack:** Electron, TypeScript, React, `child_process.spawn`, `fs/promises`, CSS keyframe animation

## Progress

| Status | Count |
|--------|-------|
| 🔴 NOT_STARTED | 0 |
| 🟡 IN_PROGRESS | 0 |
| 🟢 COMPLETED | 8 |
| ⚪ BLOCKED | 0 |

---

## Task 1: Add AppConfig type and IPC channels 🟢 COMPLETED
<!-- deps: [] | files: ["src/shared/types.ts"] -->

**Files:**
- Modify: `src/shared/types.ts`

**Context:** `validate:directory` IPC and `validateDirectory` preload already exist — do not re-add them.

**Step 1: Add AppConfig interface**

In `src/shared/types.ts`, after the `ToolkitConfig` interface (line 24), add:

```typescript
export interface AppConfig {
  vaultPath: string; // path to Obsidian vault directory, empty string if not set
}
```

**Step 2: Add IPC channel names**

In the `IPC` const object, after `PERSIST_LOAD`, add:

```typescript
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',
  OBSIDIAN_EXPORT: 'obsidian:export',
```

**Step 3: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add AppConfig type and Obsidian IPC channel names"
```

---

## Task 2: Create config module (main process) 🟢 COMPLETED
<!-- deps: [1] | files: ["src/main/config.ts"] -->

**Files:**
- Create: `src/main/config.ts`

**Step 1: Create the config module**

Create `src/main/config.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { AppConfig } from '../shared/types';

const DATA_DIR = path.join(homedir(), '.agentmux');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  vaultPath: '',
};

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await ensureDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}
```

**Step 2: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/main/config.ts
git commit -m "feat: add config module for AppConfig persistence"
```

---

## Task 3: Wire config + folder dialog IPC 🟢 COMPLETED
<!-- deps: [1, 2] | files: ["src/main/ipc-handlers.ts", "src/main/preload.ts", "src/renderer/App.tsx"] -->

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/App.tsx`

**Step 1: Add imports and handlers to ipc-handlers.ts**

At the top of `src/main/ipc-handlers.ts`, add imports:

```typescript
import { dialog } from 'electron';
import { loadConfig, saveConfig } from './config';
import { IPC, AppConfig } from '../shared/types';
```

(Note: `IPC` is already imported — add `AppConfig` to the existing import.)

At the end of `registerIpcHandlers`, before the closing `}`, add:

```typescript
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
```

**Step 2: Expose to renderer via preload**

In `src/main/preload.ts`, after the `validateDirectory` entry (before the closing `});`), add:

```typescript
  // Config
  getConfig: () =>
    ipcRenderer.invoke(IPC.CONFIG_GET),
  setConfig: (config: any) =>
    ipcRenderer.invoke(IPC.CONFIG_SET, config),
  openFolderDialog: () =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER),
```

**Step 3: Add type declarations to App.tsx**

In `src/renderer/App.tsx`, inside the `electronAPI` interface declaration, add:

```typescript
      getConfig: () => Promise<any>;
      setConfig: (config: any) => Promise<{ ok: boolean; error?: string }>;
      openFolderDialog: () => Promise<string | null>;
```

**Step 4: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/preload.ts src/renderer/App.tsx
git commit -m "feat: wire config get/set and folder dialog IPC"
```

---

## Task 4: Create SettingsModal component 🟢 COMPLETED
<!-- deps: [3] | files: ["src/renderer/components/SettingsModal.tsx"] -->

**Files:**
- Create: `src/renderer/components/SettingsModal.tsx`

**Step 1: Create the component**

Create `src/renderer/components/SettingsModal.tsx`:

```typescript
import React, { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [vaultPath, setVaultPath] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg: any) => {
      setVaultPath(cfg.vaultPath ?? '');
    });
  }, []);

  const handleChooseFolder = async () => {
    const picked = await window.electronAPI.openFolderDialog();
    if (picked) {
      setVaultPath(picked);
      setError('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const result = await window.electronAPI.setConfig({ vaultPath });
    setSaving(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? 'Unknown error');
    }
  };

  return (
    // Full-screen overlay
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal card */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 24,
        width: 420,
        maxWidth: 'calc(100vw - 48px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Vault path field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Obsidian Vault Path
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={vaultPath}
              onChange={(e) => { setVaultPath(e.target.value); setError(''); }}
              placeholder="~/Documents/MyVault"
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: error ? '1px solid var(--status-exited)' : '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleChooseFolder}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Browse
            </button>
          </div>
          {error && (
            <span style={{ fontSize: 11, color: 'var(--status-exited)' }}>
              {error}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Exports will be saved as a dated folder inside this vault.
          </span>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--status-idle)',
            border: 'none',
            borderRadius: 6,
            padding: '10px',
            color: '#000',
            fontWeight: 600,
            fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: add SettingsModal with vault path config and blur overlay"
```

---

## Task 5: Add gear icon to Sidebar header 🟢 COMPLETED
<!-- deps: [4] | files: ["src/renderer/components/Sidebar.tsx"] -->

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`

**Step 1: Add SettingsModal import and state**

At the top of `src/renderer/components/Sidebar.tsx`, add import:

```typescript
import { SettingsModal } from './SettingsModal';
```

Inside the `Sidebar` function, after the existing `useState` calls, add:

```typescript
  const [showSettings, setShowSettings] = useState(false);
```

**Step 2: Add ⚙ button next to + in the header**

Find the header row that contains the `+` button (the `onNewSession` button). It looks like:

```typescript
        <button
          onClick={onNewSession}
          className="titlebar-no-drag"
```

Add a gear button immediately before it:

```typescript
        <button
          onClick={() => setShowSettings(true)}
          className="titlebar-no-drag"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 15,
            cursor: 'pointer',
            padding: '2px 4px',
            lineHeight: 1,
            opacity: 0.7,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          title="Settings"
        >
          ⚙
        </button>
```

**Step 3: Render SettingsModal at the bottom of the return**

Before the final closing `</div>` of the Sidebar's return, add:

```typescript
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
```

**Step 4: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 5: Manual test**

Run: `npm start`
1. Click ⚙ icon — overlay opens with blur background
2. Click "Browse" — Electron folder picker opens
3. Select a directory — path fills in
4. Click Save with a non-existent path — inline error appears
5. Click outside modal — modal closes

**Step 6: Commit**

```bash
git add src/renderer/components/Sidebar.tsx
git commit -m "feat: add settings gear icon to Sidebar header"
```

---

## Task 6: Create Obsidian exporter (main process) 🟢 COMPLETED
<!-- deps: [2] | files: ["src/main/obsidian-exporter.ts"] -->

**Files:**
- Create: `src/main/obsidian-exporter.ts`

**Context:** Spawns `claude --print "<prompt>"` as a child process — reuses the user's existing Claude Code auth, no separate API key needed. Passes the session's terminal buffer and asks for a JSON structure of hub note + concept notes with `[[wiki-links]]`.

**Step 1: Create the exporter**

Create `src/main/obsidian-exporter.ts`:

```typescript
import { spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

interface ObsidianNote {
  title: string;
  content: string;
  links: string[];
}

interface ExportSpec {
  hub: ObsidianNote;
  notes: ObsidianNote[];
}

function expandPath(p: string): string {
  if (p.startsWith('~/')) return p.replace('~', homedir());
  if (p === '~') return homedir();
  return p;
}

function slugify(title: string): string {
  return title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function buildNoteContent(note: ObsidianNote, allTitles: string[]): string {
  const linkSection = note.links
    .filter((l) => allTitles.includes(l))
    .map((l) => `- [[${l}]]`)
    .join('\n');
  return [note.content, linkSection ? '\n\n## Related\n' + linkSection : ''].join('');
}

function runClaudePrint(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', prompt], {
      shell: true,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`claude --print exited ${code}: ${stderr}`));
      else resolve(stdout);
    });
    proc.on('error', reject);
  });
}

export async function exportToObsidian(
  sessionName: string,
  conversationText: string,
  vaultPath: string
): Promise<string> {
  const expanded = expandPath(vaultPath);
  const date = new Date().toISOString().slice(0, 10);
  const folderName = `${date}-${slugify(sessionName)}`;
  const outDir = path.join(expanded, folderName);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const prompt = `You are generating an Obsidian vault mindmap from a Claude Code session.

Session name: ${sessionName}

Conversation (terminal output):
<conversation>
${conversationText.slice(-8000)}
</conversation>

Output ONLY valid JSON (no markdown fences, no explanation) matching this exact structure:
{
  "hub": {
    "title": "string — session name or overarching topic",
    "content": "string — 2-3 sentence overview",
    "links": ["title1", "title2"]
  },
  "notes": [
    {
      "title": "string — concept or decision name (2-5 words)",
      "content": "string — 2-4 sentences from the conversation",
      "links": ["other title", "hub title"]
    }
  ]
}

Rules:
- Extract 4-8 distinct concepts or decisions
- Every note MUST link back to the hub
- Notes link to each other when genuinely related
- Output raw JSON only`;

  const raw = await runClaudePrint(prompt);
  const jsonText = raw.replace(/^` + '```' + `(?:json)?\n?/m, '').replace(/\n?` + '```' + `$/m, '').trim();
  const spec: ExportSpec = JSON.parse(jsonText);
  const allTitles = [spec.hub.title, ...spec.notes.map((n) => n.title)];

  await writeFile(path.join(outDir, `${slugify(spec.hub.title)}.md`), buildNoteContent(spec.hub, allTitles));
  for (const note of spec.notes) {
    await writeFile(path.join(outDir, `${slugify(note.title)}.md`), buildNoteContent(note, allTitles));
  }
  return outDir;
}
```

**Step 2: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/main/obsidian-exporter.ts
git commit -m "feat: add Obsidian exporter using claude --print subprocess"
```

---

## Task 7: Wire Obsidian export IPC handler 🟢 COMPLETED
<!-- deps: [1, 6] | files: ["src/main/ipc-handlers.ts", "src/main/preload.ts", "src/renderer/App.tsx"] -->

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/App.tsx`

**Step 1: Add import and handler to ipc-handlers.ts**

Add import at the top:

```typescript
import { exportToObsidian } from './obsidian-exporter';
```

At the end of `registerIpcHandlers` (before closing `}`), add:

```typescript
  ipcMain.handle(IPC.OBSIDIAN_EXPORT, async (_event, { sessionId }: { sessionId: string }) => {
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

    const win = getWindow();
    if (!win) return { ok: false, error: 'no-window' };

    const text: string = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(''), 3000);
      ipcMain.once(IPC.TERMINAL_TEXT_RESPONSE, (_e, payload: { sessionId: string; text: string }) => {
        if (payload.sessionId === sessionId) {
          clearTimeout(timeout);
          resolve(payload.text);
        }
      });
      win.webContents.send(IPC.TERMINAL_GET_TEXT, { sessionId });
    });

    const session = sessionManager.getSession(sessionId);
    const name = session?.info.name ?? 'session';

    try {
      const outDir = await exportToObsidian(name, text, config.vaultPath);
      return { ok: true, outDir };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'Export failed' };
    }
  });
```

**Step 2: Expose to renderer via preload**

In `src/main/preload.ts`, after `openFolderDialog`, add:

```typescript
  exportToObsidian: (sessionId: string) =>
    ipcRenderer.invoke(IPC.OBSIDIAN_EXPORT, { sessionId }),
```

**Step 3: Add type declaration in App.tsx**

In the `electronAPI` interface, add:

```typescript
      exportToObsidian: (sessionId: string) => Promise<{ ok: boolean; outDir?: string; error?: string }>;
```

**Step 4: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/preload.ts src/renderer/App.tsx
git commit -m "feat: wire Obsidian export IPC handler"
```

---

## Task 8: Add Export button + shake error to ToolkitPanel 🟢 COMPLETED
<!-- deps: [7] | files: ["src/renderer/components/ToolkitPanel.tsx"] -->

**Files:**
- Modify: `src/renderer/components/ToolkitPanel.tsx`

**Step 1: Inject shake keyframe CSS**

At the top of `src/renderer/components/ToolkitPanel.tsx`, after imports, add:

```typescript
const SHAKE_STYLE_ID = 'agentmux-shake-style';
if (typeof document !== 'undefined' && !document.getElementById(SHAKE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = SHAKE_STYLE_ID;
  style.textContent = `
    @keyframes agentmux-shake {
      0%, 100% { transform: translateX(0); }
      15%       { transform: translateX(-6px); }
      30%       { transform: translateX(6px); }
      45%       { transform: translateX(-5px); }
      60%       { transform: translateX(5px); }
      75%       { transform: translateX(-3px); }
      90%       { transform: translateX(3px); }
    }
  `;
  document.head.appendChild(style);
}
```

**Step 2: Add export state inside ToolkitPanel**

After the existing state declarations, add:

```typescript
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);

  const showError = (msg: string) => {
    setExportError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 450);
  };

  const handleExport = async () => {
    if (!activeSessionId || exporting) return;
    setExportError(null);
    setExporting(true);
    try {
      const result = await window.electronAPI.exportToObsidian(activeSessionId);
      if (!result.ok) {
        if (result.error === 'no-vault') {
          showError('No vault configured — click ⚙ to set your Obsidian vault.');
        } else if (result.error === 'vault-not-found') {
          showError('Vault directory not found. Check your path in ⚙ Settings.');
        } else {
          showError(result.error ?? 'Export failed.');
        }
      }
    } finally {
      setExporting(false);
    }
  };
```

**Step 3: Add button and error display to render**

Inside the button grid, add a third button:

```typescript
        <ToolkitButton
          label={exporting ? 'Exporting...' : 'Obsidian Map'}
          icon="🗺"
          disabled={!activeSessionId || exporting}
          onClick={handleExport}
        />
```

After the closing `</div>` of the grid, add:

```typescript
      {exportError && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--status-exited)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--status-exited)',
            fontSize: 11,
            lineHeight: 1.4,
            animation: shaking ? 'agentmux-shake 0.45s ease' : 'none',
          }}
        >
          {exportError}
        </div>
      )}
```

**Step 4: Verify TypeScript**

Run: `cd /Users/amoomaw/workshop/agentmux && npx tsc --noEmit`
Expected: no errors.

**Step 5: Manual test**

Run: `npm start`

1. Click "Obsidian Map" with no vault configured → red shake box: *"No vault configured — click ⚙ to set your Obsidian vault."*
2. Click ⚙, set a valid vault path, Save → modal closes
3. Click "Obsidian Map" → button shows "Exporting..." while `claude --print` runs
4. Open Obsidian → dated folder appears with hub note + concept notes linked via `[[]]`
5. Open Graph View → star/web mindmap renders
6. Delete the vault directory, click "Obsidian Map" → *"Vault directory not found"* shake error

**Step 6: Commit**

```bash
git add src/renderer/components/ToolkitPanel.tsx
git commit -m "feat: add Obsidian Map button with shake error states to Toolkit"
```

---

## Execution Handoff

Suggested order (Tasks 1 unblocks all; then pairs can run in parallel):
1. Task 1 (types)
2. Tasks 2 + 6 in parallel
3. Tasks 3 + 7 in parallel
4. Tasks 4 + 5 in parallel
5. Task 8 last
