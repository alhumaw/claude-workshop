# Version 0.2.0
## Added features and functionality
+ Added: __Native agent teams__ — create teams using Claude Code's built-in TeamCreate, SendMessage, and Agent tools. Workshop auto-detects new teammates via a file watcher on `~/.claude/teams/` and gives each agent its own terminal.
    - TeamWatcher monitors native team configs and spawns Workshop terminals for new members.
    - Workshop kills tmux panes and respawns agents natively with `--agent-id`, `--team-name`, `--parent-session-id` flags.
    - Lead session auto-tagged into team group.
    - `src/main/team-watcher.ts` _(new)_
    - `src/main/session-manager.ts`
    - `src/main/ipc-handlers.ts`
    - `src/main/index.ts`

+ Added: __Team templates__ — built-in templates for Small Coding (10 agents), Large Coding (19), Writing (8), and Research (10) teams. Custom templates can be designed and saved.
    - `src/renderer/components/CreateTeamModal.tsx` _(new)_
    - `src/main/ipc-handlers.ts`

+ Added: __CFID role prompts__ — auto-scans `~/.claude/prompts/` for agent roles (coder, reviewer, security-analyst, debugger, tester, etc.) and passes prompt paths to spawned agents. Template designer lets you compose teams from discovered roles.
    - `src/main/ipc-handlers.ts`

+ Added: __Smart team grid view__ — click a team header to see all agents simultaneously: 1 agent full-screen, 2 side-by-side, 3 in a 1+2 layout, 4 in a 2x2 grid, 5+ paginated in groups of 4. Click the header again to cycle pages.
    - `src/renderer/components/TerminalManager.tsx`

+ Added: __Team management UI__ — collapse teams with `−`, delete with `×` (confirmation prompt). Shell panel auto-hides in team view for more space.
    - `src/renderer/components/Sidebar.tsx`
    - `src/renderer/components/Layout.tsx`

+ Added: __Permission prompt detection__ — session cards glow purple when Claude Code is waiting for user approval.
    - Detects `"Do you want to..."` permission prompts, interactive numbered menus, and `AskUserQuestion` skill prompts.
    - Status label changes to "Waiting" with purple dot and animated glow border.
    - `src/main/parsers/index.ts`
    - `src/renderer/components/SessionCard.tsx`
    - `src/renderer/index.css`

+ Added: __User shell terminal panel__ — tabbed shell terminals at the bottom of the left pane.
    - Multiple tabs with `+` to add and `×` to close. Closing the last tab hides the panel.
    - Resizable via horizontal drag handle. Toggle with tab bar button or `Cmd+\``.
    - Nerd Font support for Powerlevel9k/10k prompts.
    - `src/main/shell-terminal.ts` _(new)_
    - `src/renderer/components/ShellPanel.tsx` _(new)_

+ Added: __Scroll-to-bottom overlay button__ — `↓` button appears at bottom-right of terminal when scrolled up.
    - `src/renderer/components/TerminalManager.tsx`

+ Added: __Drag-to-reorder session cards__ — click and drag to reorder. Gold indicator line shows drop position.
    - `src/renderer/components/Sidebar.tsx`
    - `src/renderer/stores/session-store.ts`

+ Added: __Auto-focus terminal on session switch__ — clicking a session card focuses the terminal immediately.
    - `src/renderer/components/TerminalManager.tsx`

+ Added: __Git branch from filesystem__ — reads branch via `git rev-parse` instead of parsing terminal output.
    - `src/main/session-manager.ts`

+ Added: __Selected session distinction__ — white border and glow for the active session card.
    - `src/renderer/components/SessionCard.tsx`

## Issues resolved
+ Fixed: __ANSI stripping drops all content__ — Claude Code uses `\x1b[1C` (cursor forward) instead of spaces and `\r\r\n` line endings. `stripAnsi` now handles both correctly.
    - `src/main/parsers/index.ts`

+ Fixed: __Status shows "idle" during thinking__ — reordered `parseStatus` so spinner detection takes precedence over idle prompt detection.
    - `src/main/parsers/index.ts`

+ Fixed: __Missing spinner characters__ — expanded `SPINNER_CHARS` with `·`, `✻`, `✽`, and other dingbat glyphs.
    - `src/main/parsers/index.ts`

+ Fixed: __Parser buffer window too small__ — bumped all parsers from `slice(-800)` to `slice(-3000)`.
    - `src/main/parsers/index.ts`

+ Fixed: __Stale permission prompts cause false positives__ — now scans only the bottom 8 non-empty lines.
    - `src/main/parsers/index.ts`

+ Fixed: __Session name and avatar lost on restart__ — added IPC sync between renderer and main process.
    - `src/main/session-manager.ts`
    - `src/main/ipc-handlers.ts`
    - `src/renderer/stores/session-store.ts`

+ Fixed: __Terminal scrolls to top on resize__ — added re-entrancy guard and scroll-to-bottom after `fit()`.
    - `src/renderer/components/TerminalManager.tsx`

+ Fixed: __Context reverts after /clear on restart__ — detects `/clear` and assigns a new session ID.
    - `src/main/session-manager.ts`

+ Fixed: __Branch field shows non-branch text__ — replaced buffer parsing with `git rev-parse`.
    - `src/main/session-manager.ts`

## Other
+ Aligned header buttons and context bars across session cards.
+ Removed custom inbox relay and prompt injection in favor of native Claude Code team messaging.

# Version 0.1.0
## Added features and functionality
+ Initial release: Desktop app for managing multiple Claude Code terminal sessions.
