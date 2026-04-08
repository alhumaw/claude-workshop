# agentmux — Terminal Agent Management UI

## Overview

A terminal multiplexer UI for managing multiple Claude Code sessions from a single window. A right sidebar shows all agents as clickable cards with name, status, and context usage. The left main pane displays the active Claude session. Built on tmux + Python Textual.

## Architecture

- **tmux** manages real terminal sessions — each agent is a tmux window
- **Textual** (Python TUI framework) runs in the right pane as the sidebar/control panel
- **libtmux** bridges the two — Python controls tmux programmatically
- Switching agents swaps tmux windows into the main left pane

### Layout

```
┌──────────────────────────────────┬──────────────────┐
│                                  │   AGENTS          │
│                                  │                   │
│   Active Claude Session          │   ┌─────────────┐ │
│   (tmux pane)                    │   │ ● API Work  │ │
│                                  │   │ ▰▰▰▰▰▱▱ 45%│ │
│                                  │   └─────────────┘ │
│                                  │   ┌─────────────┐ │
│                                  │   │ ◍ Tests     │ │
│                                  │   │ ▰▱▱▱▱▱▱ 12%│ │
│                                  │   └─────────────┘ │
│                                  │   ┌─────────────┐ │
│                                  │   │ ● Refactor  │ │
│                                  │   │ ▰▰▰▰▰▰▱ 78%│ │
│                                  │   └─────────────┘ │
│                                  │                   │
│                                  │   ┌─────────────┐ │
│                                  │   │    + New     │ │
│                                  │   └─────────────┘ │
└──────────────────────────────────┴──────────────────┘
```

- Left pane: ~80% width, real tmux terminal
- Right pane: ~20% width, Textual sidebar app

## Sidebar UI

### Agent Cards

Each agent displayed as a card with:
- **Status dot**: `●` green (active/working), `◍` yellow (waiting for input), `○` gray (exited)
- **Name**: User-provided when creating the agent
- **Context bar**: Block character progress bar with percentage (e.g. `▰▰▰▰▰▱▱ 45%`)

### Visual Style

- Dark theme, blends with terminal background
- Muted grays for chrome, soft green/yellow/red for status, white for names
- Generous padding between cards
- Active agent gets a highlighted border (accent color on left edge)
- Hover states on cards
- "+ New" button anchored to bottom of sidebar
- Keyboard shortcut hints at the very bottom

## Agent Lifecycle

### Spawning

1. Click "+ New" or press `Ctrl+N`
2. Modal appears: text input for name
3. Optional directory override (Tab to toggle, defaults to cwd)
4. Enter confirms — creates tmux window, runs `claude`, swaps to main pane, adds card

### Status Detection

Poll each agent's tmux pane buffer every ~1.5s via `libtmux` capture-pane:

| Status | Detection | Indicator |
|--------|-----------|-----------|
| Active | Spinner present or output streaming | `●` green |
| Waiting | Input prompt visible (`>`) | `◍` yellow |
| Exited | Process terminated | `○` gray |

### Context Usage

Parse Claude Code's context/status display from pane buffer via regex. Show last known value if mid-output.

### Closing

- Focus card + `Ctrl+Q` — confirmation prompt, then sends exit and removes card
- Exited agents show dimmed — click to remove or relaunch

### Switching

- Click a card or `Ctrl+1` through `Ctrl+9`
- Instant swap via tmux swap-pane
- Active card gets highlight border

## Keybindings

| Key | Action |
|-----|--------|
| `Ctrl+N` | New agent |
| `Ctrl+1`–`Ctrl+9` | Switch to agent by position |
| `Ctrl+Q` | Close focused agent |

## Project Structure

```
agentmux/
├── pyproject.toml
├── src/
│   └── agentmux/
│       ├── __init__.py
│       ├── app.py          # Textual App — sidebar UI, event handling
│       ├── widgets.py      # AgentCard, NewAgentModal, ContextBar widgets
│       ├── tmux.py         # tmux operations — create, swap, kill, capture
│       ├── monitor.py      # Status polling — reads pane buffers, parses state
│       ├── styles.tcss     # Textual CSS styling
│       └── cli.py          # Entry point, arg parsing, tmux bootstrap
```

## Dependencies

- Python 3.11+
- `textual` — TUI framework
- `libtmux` — Python tmux control
- tmux (system) — must be installed

## Install & Run

```bash
cd agentmux
pip install .
agentmux
```
