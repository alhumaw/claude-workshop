<div align="center">
  <img src="assets/icon.png" width="96" alt="Claude Workshop">
  <h1>Claude Workshop</h1>
  <p>A desktop app for running and managing multiple Claude Code sessions without drowning in terminal windows.</p>
</div>

## What it does

Claude Workshop gives you a single window to launch, switch between, and monitor multiple Claude Code agents — each running in its own session with its own working directory. See status, model, context usage, and cost at a glance. When a session fills up, hand it off or spin up a fresh one without losing your place.

## Features

- **Multiple sessions** — run as many Claude Code agents as you need, each with its own terminal and working directory
- **Session sidebar** — switch between agents instantly, see live status, model, context, and cost at a glance
- **Pixel avatars** — each session gets a unique generated avatar so you can tell them apart
- **Live title bar** — model, context size, cost, branch, and time since last activity for the active session
- **Persistent sessions** — sessions are saved and restored between launches using `claude --resume`
- **Full terminal** — complete xterm-compatible terminal per session
- **Handoff & Reset** — when context fills up, Claude writes a handoff summary and a fresh session picks up where it left off
- **Fresh Session** — spawn a new session in the same working directory without closing the old one
- **Generate Mindmap** — export any session's conversation to an interlinked Obsidian vault folder; opens as a graph mindmap in Obsidian
- **Settings** — configure your Obsidian vault path via the ⚙ gear icon in the sidebar
- **Keyboard shortcuts** — `Cmd+N` new session, `Cmd+W` close, `Cmd+[` / `Cmd+]` navigate

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

### Obsidian Mindmap

1. Click **⚙** in the sidebar and set your Obsidian vault path
2. In the Toolkit panel, click **Generate Mindmap**
3. Pick the project directory you want mapped
4. Claude reads the source files and writes interlinked `.md` notes to a dated folder in your vault
5. Open Obsidian → switch to Graph View to see the mindmap

### Handoff

When a session is running low on context, click **Handoff & Reset** in the Toolkit panel. Claude will write a structured summary of the current work, spawn a fresh session, and feed it the handoff — continuing seamlessly from where it left off.
