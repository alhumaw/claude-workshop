<div align="center">
  <img src="assets/icon.png" width="96" alt="Claude Workshop">
  <h1>Claude Workshop</h1>
  <p>A desktop app for running and managing multiple Claude Code sessions without drowning in terminal windows.</p>
</div>

## What it does

Claude Workshop gives you a single window to launch, switch between, and monitor multiple Claude Code agents — each running in its own session with its own working directory. See status, model, context usage, and cost at a glance. When a session fills up, hand it off or spin up a fresh one without losing your place.

## Features

- **Multiple sessions** — run as many Claude Code agents as you need, each with its own terminal and working directory
- **Native agent teams** — create teams that use Claude Code's built-in TeamCreate, SendMessage, and Agent tools. Workshop auto-detects teammates and gives each one its own terminal
- **Team templates** — spawn a coding team, research team, or writing team from built-in templates. Design your own templates from discovered roles
- **CFID role prompts** — auto-scans `~/.claude/prompts/` for agent roles (coder, reviewer, security-analyst, etc.) and passes them to spawned agents
- **Smart grid view** — click a team to see all agents at once: 2 side-by-side, 3 in a 1+2 layout, 4 in a 2x2 grid, 5+ paginated
- **Permission prompt detection** — session cards glow purple when an agent is waiting for user approval
- **Shell terminal panel** — tabbed shell terminals at the bottom of the window for running commands without leaving the app
- **Session sidebar** — switch between agents instantly, see live status, model, context, and cost at a glance
- **Pixel avatars** — each session gets a unique generated avatar so you can tell them apart
- **Drag-to-reorder** — rearrange session cards in the sidebar by dragging
- **Persistent sessions** — sessions are saved and restored between launches using `claude --resume`
- **Full terminal** — complete xterm-compatible terminal per session with Nerd Font support
- **Handoff & Reset** — when context fills up, Claude writes a handoff summary and a fresh session picks up where it left off
- **Generate Mindmap** — export any session's conversation to an interlinked Obsidian vault
- **Keyboard shortcuts** — `Cmd+N` new session, `Cmd+W` close, `Cmd+[` / `Cmd+]` navigate, `` Cmd+` `` toggle shell

## Requirements

- macOS 13+
- [Claude Code](https://claude.ai/code) installed and authenticated (`claude` in your PATH)

## Install

Download the latest `.zip` from [Releases](../../releases), unzip it, and drag **Claude Workshop.app** to your Applications folder.

**First launch:** macOS will block the app since it isn't code-signed. Run this once in Terminal:

```bash
xattr -cr /Applications/Claude\ Workshop.app
```

Then open it normally.

## Build from source

```bash
npm install
npm start          # development
npm run make       # build distributable (.zip)
```

Output is in `out/make/`.

## Usage

1. Launch Claude Workshop
2. Click **+** in the sidebar (or `Cmd+N`) to create a new session
3. Give it a name, pick a working directory, and choose an avatar
4. Claude Code starts automatically in that session
5. Repeat for as many agents as you need

### Teams

1. Click **T+** in the sidebar to create a team
2. Pick a template (Small Coding, Large Coding, Writing, Research) or build a custom team
3. Set a working directory — the lead agent spawns and creates the team using Claude Code's native team infrastructure
4. Workshop auto-detects teammates as they join and gives each one its own terminal
5. Click the team header in the sidebar to see all agents in a split grid view
6. Use **−** to collapse a team or **×** to delete it and kill all agents

### Agent Roles

Place role prompts at `~/.claude/prompts/{role-name}/PROMPT.md`. Workshop auto-discovers them in the template designer. Available CFID roles include: coder, code-reviewer, security-analyst, debugger, tester, technical-writer, and more.

### Shell Terminal

A tabbed shell panel lives at the bottom of the window:
- Toggle with the **>_ Terminal** button in the tab bar or `` Cmd+` ``
- Click **+** to add tabs, **×** to close them
- Closing the last tab hides the panel
- Auto-hides when viewing a team grid

### Handoff

When a session is running low on context, click **Handoff & Reset** in the Toolkit panel. Claude will write a structured summary of the current work, spawn a fresh session, and feed it the handoff — continuing seamlessly from where it left off.

### Obsidian Mindmap

1. Click the gear icon in the sidebar and set your Obsidian vault path
2. In the Toolkit panel, click **Generate Mindmap**
3. Pick the project directory you want mapped
4. Open Obsidian and switch to Graph View to see the mindmap

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New session |
| `Cmd+W` | Close active session |
| `Cmd+1-9` | Switch to session by index |
| `Cmd+[` | Previous session |
| `Cmd+]` | Next session |
| `` Cmd+` `` | Toggle shell panel |
