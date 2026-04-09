# Version 0.2.0
## Added features and functionality
+ Added: __Permission prompt detection__ — session cards glow purple when Claude Code is waiting for user approval.
    - Detects `"Do you want to..."` permission prompts, interactive numbered menus, and `AskUserQuestion` skill prompts.
    - Status label changes to "Waiting" with purple dot and animated glow border.
    - `src/main/parsers/index.ts`
    - `src/renderer/components/SessionCard.tsx`
    - `src/renderer/index.css`
    - `src/shared/types.ts`

+ Added: __Scroll-to-bottom overlay button__ — a `↓` button appears at the bottom-right of the terminal when scrolled up, clicking it jumps to the latest output.
    - `src/renderer/components/TerminalManager.tsx`

+ Added: __User shell terminal panel__ — a general-purpose shell terminal at the bottom of the left pane for running commands without leaving the app.
    - Multiple tabbed terminals with `+` to add and `×` to close. Closing the last tab hides the panel; toggling it back spawns a fresh terminal.
    - Resizable via horizontal drag handle between Claude terminals and shell panel.
    - Toggle visibility from the tab bar button or `Cmd+\`` keyboard shortcut.
    - Nerd Font support (MesloLGS NF, Hack Nerd Font, FiraCode Nerd Font) for Powerlevel9k/10k prompts.
    - Shell PTY killed on app quit.
    - `src/main/shell-terminal.ts` _(new)_
    - `src/renderer/components/ShellPanel.tsx` _(new)_
    - `src/renderer/components/Layout.tsx`
    - `src/renderer/components/TabBar.tsx`
    - `src/main/ipc-handlers.ts`
    - `src/main/preload.ts`
    - `src/main/index.ts`
    - `src/shared/types.ts`
    - `src/renderer/App.tsx`

+ Added: __Selected + working visual distinction__ — active session cards now show a white border and white glow, clearly distinct from status-colored borders on inactive working cards.
    - `src/renderer/components/SessionCard.tsx`

+ Added: __Drag-to-reorder session cards__ — click and drag session cards in the sidebar to reorder them. Dragged card fades, gold indicator line shows drop position. Order preserved across status polling.
    - `src/renderer/components/Sidebar.tsx`
    - `src/renderer/stores/session-store.ts`

+ Added: __Auto-focus terminal on session switch__ — clicking a session card in the sidebar automatically focuses the terminal so you can start typing immediately.
    - `src/renderer/components/TerminalManager.tsx`

+ Added: __Git branch from filesystem__ — branch name is now read directly via `git rev-parse` in the session's working directory instead of parsing pipe-delimited text from the terminal buffer. Updates live when the agent switches branches.
    - `src/main/session-manager.ts`

## Issues resolved
+ Fixed: __ANSI stripping drops all content__ — Claude Code uses `\x1b[1C` (cursor forward) instead of literal spaces between words and `\r\r\n` (double CR + LF) line endings. The `stripAnsi` function now replaces cursor-forward sequences with spaces and strips trailing carriage returns correctly.
    - `src/main/parsers/index.ts`

+ Fixed: __Status shows "idle" during thinking__ — `parseStatus` checked for the `❯` idle prompt before checking for spinner activity. Reordered so spinner/activity detection takes precedence over idle prompt detection.
    - `src/main/parsers/index.ts`

+ Fixed: __Missing spinner characters__ — Claude Code cycles through spinner glyphs (`·`, `✻`, `✽`, etc.) that were not in the detection set. Expanded `SPINNER_CHARS` with additional dingbat/flower/star characters.
    - `src/main/parsers/index.ts`

+ Fixed: __Parser buffer window too small__ — `parseStatus` and `parseAwaitingApproval` used `slice(-800)` which was insufficient for ANSI-heavy terminal output. Bumped all parsers to `slice(-3000)` consistently.
    - `src/main/parsers/index.ts`

+ Fixed: __Stale permission prompts cause false positives__ — after a user approves a prompt, the old text lingered in the buffer and continued triggering the "Waiting" state. Now scans only the bottom 8 non-empty lines so any new output immediately clears the detection.
    - `src/main/parsers/index.ts`

+ Fixed: __Session name and avatar lost on restart__ — renames and avatar changes only lived in the renderer's Zustand store and were never synced to the main process. On quit, `saveSessions` read stale data. Added `session:rename` and `session:update-avatar` IPC channels to keep main process in sync. Also fixed restore to pass `avatarSeed` directly to `spawn()`.
    - `src/main/session-manager.ts`
    - `src/main/ipc-handlers.ts`
    - `src/main/preload.ts`
    - `src/main/index.ts`
    - `src/renderer/stores/session-store.ts`
    - `src/renderer/App.tsx`
    - `src/shared/types.ts`

+ Fixed: __Terminal scrolls to top on resize__ — `fit()` resets the xterm viewport position. Now always scrolls to bottom after fitting with a re-entrancy guard to prevent double-fire from ResizeObserver. Applies to both window resize and tab switching.
    - `src/renderer/components/TerminalManager.tsx`

+ Fixed: __Terminal jumps to top on new data__ — added scroll pinning so the viewport stays at the bottom when new PTY data arrives, unless the user has intentionally scrolled up.
    - `src/renderer/components/TerminalManager.tsx`

+ Fixed: __Context reverts after /clear on restart__ — `/clear` resets the in-memory context but the session ID was preserved, causing `--resume` to reload pre-clear history. Now detects `/clear` and assigns a new session ID so the next restore starts fresh.
    - `src/main/session-manager.ts`

+ Fixed: __Branch field shows non-branch text__ — `parseBranch` matched any `| text |` in the terminal buffer, picking up table cells, model names, and other pipe-delimited output. Replaced with direct `git rev-parse` from the session's working directory.
    - `src/main/session-manager.ts`

## Other
+ Aligned `?`, `⚙`, and `+` header buttons — normalized to 24x24 flex-centered boxes for consistent alignment.
    - `src/renderer/components/Sidebar.tsx`

+ Aligned context bars across session cards — gave the context bar a fixed width and made session names truncate with ellipsis (max 50%) so bars line up at the same right edge regardless of name length.
    - `src/renderer/components/SessionCard.tsx`

# Version 0.1.0
## Added features and functionality
+ Initial release: Desktop app for managing multiple Claude Code terminal sessions.
