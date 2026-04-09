<div align="center">
  <img src="assets/icon.png" width="96" alt="Claude Workshop">
  <h1>Claude Workshop</h1>
  <p>A desktop app for running and managing multiple Claude Code sessions without drowning in terminal windows.</p>
</div>

## What it does

Claude Workshop gives you a single window to launch, switch between, and monitor multiple Claude Code agents — each running in its own session with its own working directory. See status, model, context usage, and cost at a glance. When a session fills up, hand it off or spin up a fresh one without losing your place.

## Features

- **Multiple sessions** — run as many Claude Code agents as you need, each with its own terminal and working directory
- **Agent teams** — create teams with a lead and teammates that communicate via inbox files, with optional shared memory
- **Session sidebar** — switch between agents instantly, see live status, model, context, and cost at a glance
- **Permission prompt detection** — session cards glow purple when an agent is waiting for user approval
- **Shell terminal panel** — tabbed shell terminals at the bottom of the window for running commands without leaving the app
- **Pixel avatars** — each session gets a unique generated avatar so you can tell them apart
- **Drag-to-reorder** — rearrange session cards in the sidebar by dragging
- **Live title bar** — model, context size, cost, branch, and time since last activity for the active session
- **Persistent sessions** — sessions are saved and restored between launches using `claude --resume`
- **Full terminal** — complete xterm-compatible terminal per session with Nerd Font support
- **Handoff & Reset** — when context fills up, Claude writes a handoff summary and a fresh session picks up where it left off
- **Fresh Session** — spawn a new session in the same working directory without closing the old one
- **Generate Mindmap** — export any session's conversation to an interlinked Obsidian vault folder; opens as a graph mindmap in Obsidian
- **Settings** — configure your Obsidian vault path via the gear icon in the sidebar
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
2. Name the team, set a working directory, and configure a lead agent
3. Add teammate agents — each gets its own session and inbox
4. The lead communicates with teammates via inbox files that Workshop auto-delivers
5. Teammates show grouped under their team in the sidebar

### Shell Terminal

A tabbed shell panel lives at the bottom of the window:
- Toggle with the **>_ Terminal** button in the tab bar or `` Cmd+` ``
- Click **+** to add tabs, **x** to close them
- Closing the last tab hides the panel

### Obsidian Mindmap

1. Click the gear icon in the sidebar and set your Obsidian vault path
2. In the Toolkit panel, click **Generate Mindmap**
3. Pick the project directory you want mapped
4. Claude reads the source files and writes interlinked `.md` notes to a dated folder in your vault
5. Open Obsidian and switch to Graph View to see the mindmap

### Handoff

When a session is running low on context, click **Handoff & Reset** in the Toolkit panel. Claude will write a structured summary of the current work, spawn a fresh session, and feed it the handoff — continuing seamlessly from where it left off.

## Optional: MemPalace Integration

[MemPalace](https://github.com/milla-jovovich/mempalace) provides shared persistent memory for agent teams. When installed, team agents automatically get access to 19 MCP tools for searching past conversations, writing diary entries, and sharing knowledge across sessions.

**Install:**

```bash
pipx install mempalace
```

That's it. Workshop auto-detects the installation and configures everything when you create a team. No manual MCP setup required.

MemPalace is entirely optional — teams work without it using the built-in inbox messaging system. If mempalace isn't installed, agents simply don't get the memory tools and no errors are thrown.

Supports `pipx`, `uv tool install`, or global `pip` installs. See the [MemPalace README](https://github.com/milla-jovovich/mempalace) for details.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New session |
| `Cmd+W` | Close active session |
| `Cmd+1-9` | Switch to session by index |
| `Cmd+[` | Previous session |
| `Cmd+]` | Next session |
| `` Cmd+` `` | Toggle shell panel |
