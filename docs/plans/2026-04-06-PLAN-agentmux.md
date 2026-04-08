# agentmux Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use skills:executing-plans to implement this plan task-by-task.

**Goal:** Build a terminal UI that manages multiple Claude Code sessions in a single window with a clickable sidebar showing agent name, status, and context usage.

**Architecture:** tmux manages real terminal sessions (one window per agent). A Python Textual app runs in the right tmux pane as the sidebar/control panel. libtmux bridges Python to tmux for creating windows, swapping panes, and capturing output. The CLI bootstraps the tmux session, then launches the Textual sidebar inside it.

**Tech Stack:** Python 3.11+, Textual (TUI framework), libtmux (tmux control), tmux (system)

## Progress

| Status | Count |
|--------|-------|
| 🔴 NOT_STARTED | 8 |
| 🟡 IN_PROGRESS | 0 |
| 🟢 COMPLETED | 0 |
| ⚪ BLOCKED | 0 |

## Design Reference

See `docs/plans/2026-04-06-DESIGN-agentmux.md` for full design document.

---

### Task 1: Project Scaffolding 🔴 NOT_STARTED
<!-- deps: [] | files: ["pyproject.toml", "src/agentmux/__init__.py"] -->

> No TDD needed — scaffolding only.

**Files:**
- Create: `pyproject.toml`
- Create: `src/agentmux/__init__.py`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`

**Step 1: Create directory structure**

```bash
mkdir -p src/agentmux tests
```

**Step 2: Write `pyproject.toml`**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "agentmux"
version = "0.1.0"
description = "Terminal agent management UI for Claude Code"
requires-python = ">=3.11"
dependencies = [
    "textual>=0.89.0",
    "libtmux>=0.37.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "textual-dev>=1.0",
]

[project.scripts]
agentmux = "agentmux.cli:main"

[tool.hatch.build.targets.wheel]
packages = ["src/agentmux"]
```

**Step 3: Write `src/agentmux/__init__.py`**

```python
"""agentmux - Terminal agent management UI for Claude Code."""
__version__ = "0.1.0"
```

**Step 4: Write `tests/__init__.py`** (empty file)

**Step 5: Write `tests/conftest.py`**

```python
"""Shared test fixtures for agentmux."""
```

**Step 6: Create venv and install**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Run: `python -c "import agentmux; print(agentmux.__version__)"`
Expected: `0.1.0`

**Step 7: Initialize git and commit**

```bash
git init
cat > .gitignore << 'EOF'
.venv/
__pycache__/
*.egg-info/
dist/
.DS_Store
EOF
git add .
git commit -m "chore: scaffold agentmux project"
```

---

### Task 2: tmux Manager Module 🔴 NOT_STARTED
<!-- deps: [1] | files: ["src/agentmux/tmux.py", "tests/test_tmux.py"] -->

> **REQUIRED:** Follow skills:test-driven-development (RED-GREEN-REFACTOR cycle)

**Files:**
- Create: `src/agentmux/tmux.py`
- Create: `tests/test_tmux.py`

**Context:** This module wraps all tmux operations. The Textual sidebar app calls this to create agents, switch between them, capture pane output, and kill agents. Each agent lives in a separate tmux window. Switching agents uses `swap-pane` to exchange the hidden window's pane with the main left pane.

**Step 1: Write failing tests (RED)**

Create `tests/test_tmux.py`:

```python
"""Tests for tmux manager. Requires tmux to be installed."""
import subprocess
import pytest
from agentmux.tmux import TmuxManager, AgentInfo


def _tmux_kill_session(name: str) -> None:
    """Helper to clean up tmux sessions after tests."""
    subprocess.run(["tmux", "kill-session", "-t", name], capture_output=True)


class TestTmuxManager:
    """Integration tests — these create real tmux sessions."""

    def setup_method(self):
        self.session_name = "agentmux-test"
        _tmux_kill_session(self.session_name)

    def teardown_method(self):
        _tmux_kill_session(self.session_name)

    def test_create_session_creates_split_layout(self):
        mgr = TmuxManager(session_name=self.session_name)
        mgr.create_session("/tmp")

        # Session should exist with one window and two panes
        result = subprocess.run(
            ["tmux", "list-panes", "-t", self.session_name],
            capture_output=True, text=True,
        )
        assert result.returncode == 0
        panes = result.stdout.strip().split("\n")
        assert len(panes) == 2, f"Expected 2 panes, got {len(panes)}"

    def test_create_agent_adds_to_agents_dict(self):
        mgr = TmuxManager(session_name=self.session_name)
        mgr.create_session("/tmp")
        mgr.create_agent("test-agent", "/tmp")

        assert "test-agent" in mgr.agents
        assert mgr.active_agent == "test-agent"

    def test_switch_agent_changes_active(self):
        mgr = TmuxManager(session_name=self.session_name)
        mgr.create_session("/tmp")
        mgr.create_agent("agent-a", "/tmp")
        mgr.create_agent("agent-b", "/tmp")

        mgr.switch_to_agent("agent-a")
        assert mgr.active_agent == "agent-a"

        mgr.switch_to_agent("agent-b")
        assert mgr.active_agent == "agent-b"

    def test_capture_pane_returns_lines(self):
        mgr = TmuxManager(session_name=self.session_name)
        mgr.create_session("/tmp")
        mgr.create_agent("cap-test", "/tmp")

        lines = mgr.capture_pane("cap-test")
        assert isinstance(lines, list)

    def test_kill_agent_removes_from_dict(self):
        mgr = TmuxManager(session_name=self.session_name)
        mgr.create_session("/tmp")
        mgr.create_agent("doomed", "/tmp")

        mgr.kill_agent("doomed")
        assert "doomed" not in mgr.agents

    def test_is_pane_alive(self):
        mgr = TmuxManager(session_name=self.session_name)
        mgr.create_session("/tmp")
        mgr.create_agent("alive-test", "/tmp")

        assert mgr.is_pane_alive("alive-test") is True
```

**Step 2: Run tests to verify they fail (Verify RED)**

```bash
cd /Users/amoomaw/workshop/agentmux
source .venv/bin/activate
pytest tests/test_tmux.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'agentmux.tmux'`

**Step 3: Write implementation (GREEN)**

Create `src/agentmux/tmux.py`:

```python
"""tmux session and pane management for agentmux."""
from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass, field


@dataclass
class AgentInfo:
    """Tracks a single agent's tmux state."""

    name: str
    pane_id: str
    working_dir: str
    status: str = "waiting"
    context_pct: int = 0


class TmuxManager:
    """Manages the agentmux tmux session.

    Layout:
        Window 0 (main): pane 0 = agent display (left), pane 1 = sidebar (right)
        Window N (hidden): pane 0 = agent N's claude session

    Switching agents uses swap-pane to exchange the left pane content
    with a hidden window's pane.
    """

    def __init__(self, session_name: str = "agentmux") -> None:
        self._ensure_tmux()
        self.session_name = session_name
        self.agents: dict[str, AgentInfo] = {}
        self.active_agent: str | None = None
        self._main_pane_id: str | None = None
        self._sidebar_pane_id: str | None = None

    @staticmethod
    def _ensure_tmux() -> None:
        if not shutil.which("tmux"):
            raise RuntimeError("tmux is not installed. Install with: brew install tmux")

    def _tmux(self, *args: str) -> subprocess.CompletedProcess[str]:
        """Run a tmux command and return the result."""
        return subprocess.run(
            ["tmux", *args],
            capture_output=True,
            text=True,
            check=False,
        )

    def _tmux_check(self, *args: str) -> str:
        """Run a tmux command, raise on failure, return stdout."""
        result = subprocess.run(
            ["tmux", *args],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()

    def create_session(self, working_dir: str) -> None:
        """Create the agentmux tmux session with left/right split."""
        # Kill existing session if present
        self._tmux("kill-session", "-t", self.session_name)

        # Create session (detached)
        self._tmux_check(
            "new-session", "-d",
            "-s", self.session_name,
            "-c", working_dir,
            "-x", "200", "-y", "50",
        )

        # Get the initial pane ID (this becomes the left/main pane)
        self._main_pane_id = self._tmux_check(
            "display-message", "-t", self.session_name, "-p", "#{pane_id}"
        )

        # Split right for sidebar (20%)
        self._tmux_check(
            "split-window", "-t", self._main_pane_id,
            "-h", "-l", "20%",
            "-c", working_dir,
        )

        # The new pane (sidebar) is now active; grab its ID
        self._sidebar_pane_id = self._tmux_check(
            "display-message", "-t", self.session_name, "-p", "#{pane_id}"
        )

    def get_sidebar_pane_id(self) -> str:
        """Return the sidebar pane ID for launching the Textual app."""
        assert self._sidebar_pane_id, "Session not created yet"
        return self._sidebar_pane_id

    def create_agent(self, name: str, working_dir: str) -> None:
        """Create a new hidden window running claude, then swap it into view."""
        # Create new window (detached — stays hidden)
        self._tmux_check(
            "new-window", "-t", self.session_name,
            "-d", "-n", f"agent-{name}",
            "-c", working_dir,
            "-P", "-F", "#{pane_id}",
        )

        # Get the new pane's ID
        pane_id = self._tmux_check(
            "display-message",
            "-t", f"{self.session_name}:agent-{name}",
            "-p", "#{pane_id}",
        )

        # Start claude in the new pane
        self._tmux("send-keys", "-t", pane_id, "claude", "Enter")

        self.agents[name] = AgentInfo(
            name=name,
            pane_id=pane_id,
            working_dir=working_dir,
        )

        # Auto-switch to show the new agent
        self.switch_to_agent(name)

    def switch_to_agent(self, name: str) -> None:
        """Swap the named agent's pane into the main left pane."""
        if name == self.active_agent:
            return

        agent = self.agents[name]

        # Swap the agent's hidden pane with the main left pane
        self._tmux_check(
            "swap-pane",
            "-d",
            "-s", agent.pane_id,
            "-t", self._main_pane_id,
        )

        # After swap: the agent's pane_id is now in the main position,
        # and the old main content is at agent's old location.
        # Update tracking: if there was a previously active agent,
        # it is now where the new agent used to be.
        if self.active_agent and self.active_agent in self.agents:
            old_agent = self.agents[self.active_agent]
            old_agent.pane_id = agent.pane_id

        # The new agent is now in the main pane
        agent.pane_id = self._main_pane_id
        self.active_agent = name

    def capture_pane(self, name: str) -> list[str]:
        """Capture the visible content of an agent's pane."""
        agent = self.agents[name]
        result = self._tmux("capture-pane", "-t", agent.pane_id, "-p")
        if result.returncode != 0:
            return []
        return result.stdout.split("\n")

    def kill_agent(self, name: str) -> None:
        """Terminate an agent and remove it from tracking."""
        agent = self.agents[name]

        if name == self.active_agent:
            # Send exit to the main pane
            self._tmux("send-keys", "-t", agent.pane_id, "exit", "Enter")
            self.active_agent = None
        else:
            # Kill the hidden window containing this agent
            self._tmux("kill-pane", "-t", agent.pane_id)

        del self.agents[name]

    def is_pane_alive(self, name: str) -> bool:
        """Check if an agent's pane process is still running."""
        agent = self.agents.get(name)
        if not agent:
            return False

        result = self._tmux(
            "display-message", "-t", agent.pane_id, "-p", "#{pane_dead}"
        )
        return result.returncode == 0 and result.stdout.strip() != "1"
```

**Step 4: Run tests to verify they pass (Verify GREEN)**

```bash
pytest tests/test_tmux.py -v
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/agentmux/tmux.py tests/test_tmux.py
git commit -m "feat: add tmux manager for session and pane control"
```

---

### Task 3: Status Parser (Monitor Module) 🔴 NOT_STARTED
<!-- deps: [1] | files: ["src/agentmux/monitor.py", "tests/test_monitor.py"] -->

> **REQUIRED:** Follow skills:test-driven-development (RED-GREEN-REFACTOR cycle)

**Files:**
- Create: `src/agentmux/monitor.py`
- Create: `tests/test_monitor.py`

**Context:** This module contains pure functions that parse tmux pane buffer text to determine agent status (active/waiting/exited) and context usage percentage. The functions are called by the Textual app's polling loop. Because these are pure functions operating on strings, they are highly unit-testable — no tmux needed.

**Step 1: Write failing tests (RED)**

Create `tests/test_monitor.py`:

```python
"""Tests for status and context parsing — pure unit tests, no tmux needed."""
import pytest
from agentmux.monitor import parse_status, parse_context


class TestParseStatus:
    def test_exited_when_pane_dead(self):
        assert parse_status(["some output"], pane_alive=False) == "exited"

    def test_active_when_spinner_present(self):
        lines = ["Working on it...", "⠋ Generating response"]
        assert parse_status(lines, pane_alive=True) == "active"

    def test_waiting_when_prompt_visible(self):
        lines = ["Previous output", "", "❯ "]
        assert parse_status(lines, pane_alive=True) == "waiting"

    def test_waiting_with_angle_bracket_prompt(self):
        lines = ["Previous output", "> "]
        assert parse_status(lines, pane_alive=True) == "waiting"

    def test_active_when_output_streaming(self):
        lines = ["Here is some generated code:", "```python", "def hello():"]
        assert parse_status(lines, pane_alive=True) == "active"

    def test_empty_lines_defaults_active(self):
        assert parse_status([], pane_alive=True) == "active"


class TestParseContext:
    def test_extracts_percentage_from_context_line(self):
        lines = ["some output", "Context: 45% used", "more output"]
        assert parse_context(lines) == 45

    def test_extracts_from_compact_format(self):
        lines = ["output", "ctx: 78%"]
        assert parse_context(lines) == 78

    def test_returns_none_when_no_context_found(self):
        lines = ["just regular output", "no percentages here"]
        assert parse_context(lines) is None

    def test_ignores_non_context_percentages(self):
        # Only match percentages near context-related keywords
        lines = ["Progress: 50%", "Downloading 80%"]
        # No context keyword, so falls back to scanning last 5 lines
        result = parse_context(lines)
        # May pick up a percentage — that's acceptable as a fallback
        assert result is None or (0 <= result <= 100)

    def test_extracts_from_status_bar_format(self):
        lines = ["", " 62% context remaining ", ""]
        assert parse_context(lines) == 62

    def test_empty_lines(self):
        assert parse_context([]) is None
```

**Step 2: Run tests to verify they fail (Verify RED)**

```bash
pytest tests/test_monitor.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'agentmux.monitor'`

**Step 3: Write implementation (GREEN)**

Create `src/agentmux/monitor.py`:

```python
"""Status and context parsing for agent pane buffers."""
from __future__ import annotations

import re

# Claude Code uses these spinner characters when working
SPINNER_CHARS = set("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣾⣽⣻⢿⡿⣟⣯⣷◐◓◑◒●○◉◎")

# Patterns that indicate Claude is waiting for user input
PROMPT_PATTERNS = [
    re.compile(r"[❯>]\s*$"),
    re.compile(r"^\s*\$\s*$"),
]

# Pattern to extract a percentage value
PCT_PATTERN = re.compile(r"(\d{1,3})%")

# Keywords that indicate a context-usage line
CONTEXT_KEYWORDS = {"context", "ctx", "token", "usage"}


def parse_status(lines: list[str], *, pane_alive: bool) -> str:
    """Determine agent status from pane buffer content.

    Returns: "active", "waiting", or "exited"
    """
    if not pane_alive:
        return "exited"

    if not lines:
        return "active"

    # Check last 5 lines for indicators
    tail = lines[-5:]
    tail_text = "\n".join(tail)

    # Spinner chars → actively working
    if any(c in tail_text for c in SPINNER_CHARS):
        return "active"

    # Prompt pattern → waiting for input
    for line in reversed(tail):
        stripped = line.rstrip()
        if not stripped:
            continue
        for pattern in PROMPT_PATTERNS:
            if pattern.search(stripped):
                return "waiting"
        # First non-empty line from bottom checked — stop
        break

    return "active"


def parse_context(lines: list[str]) -> int | None:
    """Extract context usage percentage from pane buffer.

    Returns percentage (0-100) or None if not found.
    """
    if not lines:
        return None

    # Search from bottom up for lines containing context keywords
    search_lines = lines[-30:]
    for line in reversed(search_lines):
        lower = line.lower()
        if any(kw in lower for kw in CONTEXT_KEYWORDS):
            match = PCT_PATTERN.search(line)
            if match:
                val = int(match.group(1))
                if 0 <= val <= 100:
                    return val

    return None
```

**Step 4: Run tests to verify they pass (Verify GREEN)**

```bash
pytest tests/test_monitor.py -v
```

Expected: All 12 tests PASS.

**Step 5: Commit**

```bash
git add src/agentmux/monitor.py tests/test_monitor.py
git commit -m "feat: add status and context parsing for pane buffers"
```

---

### Task 4: Textual Widgets — ContextBar and AgentCard 🔴 NOT_STARTED
<!-- deps: [1] | files: ["src/agentmux/widgets.py", "tests/test_widgets.py"] -->

> **REQUIRED:** Follow skills:test-driven-development (RED-GREEN-REFACTOR cycle)

**Files:**
- Create: `src/agentmux/widgets.py`
- Create: `tests/test_widgets.py`

**Context:** These are the core visual components of the sidebar. `ContextBar` renders a block-character progress bar. `AgentCard` is a clickable container showing status dot, agent name, and context bar. The card posts an `AgentSelected` message when clicked so the app can switch tmux panes.

**Step 1: Write failing tests (RED)**

Create `tests/test_widgets.py`:

```python
"""Tests for Textual widgets using the Textual test framework."""
import pytest
from textual.app import App, ComposeResult
from textual.widgets import Static

from agentmux.widgets import AgentCard, ContextBar, AgentSelected


class ContextBarTestApp(App):
    def compose(self) -> ComposeResult:
        yield ContextBar(percent=45, id="bar")


class AgentCardTestApp(App):
    def compose(self) -> ComposeResult:
        yield AgentCard(agent_name="Test Agent", id="card")


class TestContextBar:
    @pytest.mark.asyncio
    async def test_renders_bar_with_percentage(self):
        async with ContextBarTestApp().run_test() as pilot:
            bar = pilot.app.query_one("#bar", ContextBar)
            rendered = bar.render()
            assert "45%" in str(rendered)

    @pytest.mark.asyncio
    async def test_updates_when_percent_changes(self):
        async with ContextBarTestApp().run_test() as pilot:
            bar = pilot.app.query_one("#bar", ContextBar)
            bar.percent = 80
            rendered = bar.render()
            assert "80%" in str(rendered)


class TestAgentCard:
    @pytest.mark.asyncio
    async def test_shows_agent_name(self):
        async with AgentCardTestApp().run_test() as pilot:
            card = pilot.app.query_one("#card", AgentCard)
            # The card should contain the agent name somewhere
            header = card.query_one("#card-header", Static)
            assert "Test Agent" in str(header.renderable)

    @pytest.mark.asyncio
    async def test_click_posts_agent_selected(self):
        messages = []

        class CapturingApp(App):
            def compose(self) -> ComposeResult:
                yield AgentCard(agent_name="Clicked", id="card")

            def on_agent_selected(self, event: AgentSelected) -> None:
                messages.append(event.agent_name)

        async with CapturingApp().run_test() as pilot:
            await pilot.click("#card")
            assert "Clicked" in messages

    @pytest.mark.asyncio
    async def test_status_updates_visual(self):
        async with AgentCardTestApp().run_test() as pilot:
            card = pilot.app.query_one("#card", AgentCard)
            card.status = "active"
            header = card.query_one("#card-header", Static)
            # Should show green dot
            assert "●" in str(header.renderable)

    @pytest.mark.asyncio
    async def test_active_card_gets_highlight_class(self):
        async with AgentCardTestApp().run_test() as pilot:
            card = pilot.app.query_one("#card", AgentCard)
            card.is_active = True
            assert card.has_class("-active")
```

**Step 2: Run tests to verify they fail (Verify RED)**

```bash
pytest tests/test_widgets.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'agentmux.widgets'`

**Step 3: Write implementation (GREEN)**

Create `src/agentmux/widgets.py`:

```python
"""Textual widgets for the agentmux sidebar."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.message import Message
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static


class AgentSelected(Message):
    """Posted when an agent card is clicked."""

    def __init__(self, agent_name: str) -> None:
        super().__init__()
        self.agent_name = agent_name


class ContextBar(Widget):
    """A compact progress bar showing context usage percentage."""

    DEFAULT_CSS = """
    ContextBar {
        height: 1;
        width: 100%;
    }
    """

    percent: reactive[int] = reactive(0)

    def __init__(self, percent: int = 0, **kwargs) -> None:
        super().__init__(**kwargs)
        self.percent = percent

    def render(self) -> str:
        filled = round(self.percent / 100 * 7)
        bar = "▰" * filled + "▱" * (7 - filled)
        return f"{bar} {self.percent}%"

    def watch_percent(self, value: int) -> None:
        self.refresh()


STATUS_DOTS = {
    "active": ("●", "green"),
    "waiting": ("◍", "yellow"),
    "exited": ("○", "grey"),
}


class AgentCard(Widget):
    """A clickable card representing a single agent."""

    DEFAULT_CSS = """
    AgentCard {
        height: 4;
        width: 100%;
        border: solid $surface-lighten-2;
        padding: 0 1;
        margin: 0 0 1 0;
    }
    AgentCard:hover {
        border: solid $accent;
    }
    AgentCard.-active {
        border: solid $success;
    }
    """

    status: reactive[str] = reactive("waiting")
    context_pct: reactive[int] = reactive(0)
    is_active: reactive[bool] = reactive(False)

    def __init__(self, agent_name: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self.agent_name = agent_name

    def compose(self) -> ComposeResult:
        dot, color = STATUS_DOTS.get(self.status, ("○", "grey"))
        yield Static(
            f"[{color}]{dot}[/] {self.agent_name}",
            id="card-header",
        )
        yield ContextBar(percent=self.context_pct, id="card-context")

    def on_click(self) -> None:
        self.post_message(AgentSelected(self.agent_name))

    def watch_status(self, new_status: str) -> None:
        dot, color = STATUS_DOTS.get(new_status, ("○", "grey"))
        try:
            header = self.query_one("#card-header", Static)
            header.update(f"[{color}]{dot}[/] {self.agent_name}")
        except Exception:
            pass

    def watch_context_pct(self, pct: int) -> None:
        try:
            bar = self.query_one("#card-context", ContextBar)
            bar.percent = pct
        except Exception:
            pass

    def watch_is_active(self, active: bool) -> None:
        if active:
            self.add_class("-active")
        else:
            self.remove_class("-active")
```

**Step 4: Run tests to verify they pass (Verify GREEN)**

```bash
pytest tests/test_widgets.py -v
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/agentmux/widgets.py tests/test_widgets.py
git commit -m "feat: add AgentCard and ContextBar widgets"
```

---

### Task 5: NewAgentModal Widget 🔴 NOT_STARTED
<!-- deps: [1] | files: ["src/agentmux/widgets.py", "tests/test_modal.py"] -->

> **REQUIRED:** Follow skills:test-driven-development (RED-GREEN-REFACTOR cycle)

**Files:**
- Modify: `src/agentmux/widgets.py` (append NewAgentModal class)
- Create: `tests/test_modal.py`

**Context:** Modal dialog that appears when creating a new agent. Has a text input for the agent name and an optional directory field. Dismisses with `(name, dir)` tuple on submit, or `None` on cancel.

**Step 1: Write failing tests (RED)**

Create `tests/test_modal.py`:

```python
"""Tests for the NewAgentModal."""
import pytest
from textual.app import App, ComposeResult
from textual.widgets import Input

from agentmux.widgets import NewAgentModal


class ModalTestApp(App):
    result = None

    def on_mount(self) -> None:
        self.push_screen(NewAgentModal(), callback=self.on_modal_result)

    def on_modal_result(self, result) -> None:
        self.result = result


class TestNewAgentModal:
    @pytest.mark.asyncio
    async def test_submit_returns_name_and_dir(self):
        async with ModalTestApp().run_test() as pilot:
            name_input = pilot.app.query_one("#agent-name", Input)
            name_input.value = "My Agent"
            await pilot.click("#create-btn")
            assert pilot.app.result is not None
            assert pilot.app.result[0] == "My Agent"

    @pytest.mark.asyncio
    async def test_cancel_returns_none(self):
        async with ModalTestApp().run_test() as pilot:
            await pilot.click("#cancel-btn")
            assert pilot.app.result is None

    @pytest.mark.asyncio
    async def test_empty_name_does_not_submit(self):
        async with ModalTestApp().run_test() as pilot:
            # Don't type anything, just click create
            await pilot.click("#create-btn")
            # Modal should still be visible (not dismissed)
            assert pilot.app.result is None
```

**Step 2: Run tests to verify they fail (Verify RED)**

```bash
pytest tests/test_modal.py -v
```

Expected: FAIL — `ImportError: cannot import name 'NewAgentModal'`

**Step 3: Write implementation (GREEN)**

Append to `src/agentmux/widgets.py`:

```python
from textual.containers import Vertical, Horizontal
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Label


class NewAgentModal(ModalScreen):
    """Modal dialog for creating a new agent."""

    DEFAULT_CSS = """
    NewAgentModal {
        align: center middle;
    }
    #modal-container {
        width: 50;
        height: auto;
        max-height: 16;
        border: solid $accent;
        background: $surface;
        padding: 1 2;
    }
    #modal-title {
        text-align: center;
        text-style: bold;
        margin-bottom: 1;
    }
    #modal-container Input {
        margin-bottom: 1;
    }
    #button-row {
        align: center middle;
        height: 3;
    }
    #button-row Button {
        margin: 0 1;
    }
    """

    def compose(self) -> ComposeResult:
        with Vertical(id="modal-container"):
            yield Label("New Agent", id="modal-title")
            yield Input(placeholder="Agent name", id="agent-name")
            yield Input(
                placeholder="Working directory (optional)",
                id="agent-dir",
            )
            with Horizontal(id="button-row"):
                yield Button("Create", variant="success", id="create-btn")
                yield Button("Cancel", id="cancel-btn")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "create-btn":
            name = self.query_one("#agent-name", Input).value.strip()
            if not name:
                return  # Don't dismiss with empty name
            directory = self.query_one("#agent-dir", Input).value.strip()
            self.dismiss((name, directory or None))
        elif event.button.id == "cancel-btn":
            self.dismiss(None)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Allow Enter key in name field to submit."""
        if event.input.id == "agent-name":
            name = event.value.strip()
            if name:
                directory = self.query_one("#agent-dir", Input).value.strip()
                self.dismiss((name, directory or None))
```

**Step 4: Run tests to verify they pass (Verify GREEN)**

```bash
pytest tests/test_modal.py -v
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/agentmux/widgets.py tests/test_modal.py
git commit -m "feat: add NewAgentModal for creating agents"
```

---

### Task 6: Textual CSS Stylesheet 🔴 NOT_STARTED
<!-- deps: [4, 5] | files: ["src/agentmux/styles.tcss"] -->

> No TDD needed — visual styling only.

**Files:**
- Create: `src/agentmux/styles.tcss`

**Context:** This is the Textual CSS file controlling the sidebar's visual appearance. Dark theme, muted colors, generous spacing, clean borders. Referenced by the App class via `CSS_PATH = "styles.tcss"`.

**Step 1: Write the stylesheet**

Create `src/agentmux/styles.tcss`:

```css
/* agentmux sidebar stylesheet — dark, clean, minimal */

Screen {
    background: $surface;
}

/* Header */
#header {
    dock: top;
    height: 3;
    padding: 1 2;
    text-style: bold;
    color: $text-muted;
    text-align: center;
    border-bottom: solid $surface-lighten-1;
}

/* Scrollable agent list */
#agent-list {
    height: 1fr;
    padding: 1 1;
    scrollbar-size: 1 1;
}

/* Footer area with button and shortcuts */
#footer {
    dock: bottom;
    height: auto;
    padding: 0 1;
}

#new-btn {
    width: 100%;
    margin: 0 0 1 0;
    text-align: center;
    border: solid $surface-lighten-2;
    background: $surface;
    color: $text;
    height: 3;
}

#new-btn:hover {
    background: $surface-lighten-1;
    border: solid $accent;
}

#shortcuts {
    height: 2;
    color: $text-disabled;
    text-align: center;
    padding: 0 1;
}

/* Agent card overrides (base styles in widget DEFAULT_CSS) */
AgentCard {
    background: $surface;
}

AgentCard:hover {
    background: $surface-lighten-1;
}

AgentCard.-active {
    background: $surface-lighten-1;
    border: solid $success;
}

/* Context bar color coding */
ContextBar {
    color: $text-muted;
}

/* Modal styling */
NewAgentModal {
    background: $surface 80%;
}
```

**Step 2: Verify file loads without errors**

```bash
python -c "from pathlib import Path; p = Path('src/agentmux/styles.tcss'); print(f'{p}: {len(p.read_text())} bytes')"
```

Expected: File exists with reasonable size.

**Step 3: Commit**

```bash
git add src/agentmux/styles.tcss
git commit -m "feat: add sidebar stylesheet"
```

---

### Task 7: Sidebar App — Main Textual Application 🔴 NOT_STARTED
<!-- deps: [2, 3, 4, 5, 6] | files: ["src/agentmux/app.py", "tests/test_app.py"] -->

> **REQUIRED:** Follow skills:test-driven-development (RED-GREEN-REFACTOR cycle)

**Files:**
- Create: `src/agentmux/app.py`
- Create: `tests/test_app.py`

**Context:** This is the main Textual `App` subclass that composes the sidebar. It mounts the header, agent list, new-agent button, and shortcut hints. It connects to `TmuxManager` for agent operations and runs a polling timer to update agent status/context via the monitor module. Keybindings: `ctrl+n` (new agent), `ctrl+q` (close agent), `1`-`9` (switch by position).

**Step 1: Write failing tests (RED)**

Create `tests/test_app.py`:

```python
"""Tests for the sidebar Textual app."""
import pytest
from unittest.mock import MagicMock, patch
from textual.widgets import Static, Button

from agentmux.app import AgentMuxSidebar
from agentmux.widgets import AgentCard


def _make_app(working_dir: str = "/tmp") -> AgentMuxSidebar:
    """Create an app with a mocked TmuxManager."""
    with patch("agentmux.app.TmuxManager") as MockTmux:
        mock_mgr = MagicMock()
        mock_mgr.agents = {}
        mock_mgr.active_agent = None
        MockTmux.return_value = mock_mgr
        app = AgentMuxSidebar(session_name="test", working_dir=working_dir)
        app._tmux = mock_mgr
        return app


class TestAgentMuxSidebar:
    @pytest.mark.asyncio
    async def test_app_mounts_header_and_button(self):
        app = _make_app()
        async with app.run_test() as pilot:
            header = pilot.app.query_one("#header", Static)
            assert "AGENTS" in str(header.renderable)
            btn = pilot.app.query_one("#new-btn", Button)
            assert "New" in str(btn.label)

    @pytest.mark.asyncio
    async def test_new_agent_creates_card(self):
        app = _make_app()
        async with app.run_test() as pilot:
            # Simulate creating an agent via the app method directly
            pilot.app._on_new_agent_result(("Test Agent", None))
            cards = pilot.app.query(AgentCard)
            assert len(list(cards)) == 1

    @pytest.mark.asyncio
    async def test_clicking_card_switches_agent(self):
        app = _make_app()
        async with app.run_test() as pilot:
            pilot.app._on_new_agent_result(("Agent A", None))
            pilot.app._on_new_agent_result(("Agent B", None))

            # Click Agent A's card
            cards = list(pilot.app.query(AgentCard))
            await pilot.click(f"#{cards[0].id}")

            pilot.app._tmux.switch_to_agent.assert_called_with("Agent A")
```

**Step 2: Run tests to verify they fail (Verify RED)**

```bash
pytest tests/test_app.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'agentmux.app'`

**Step 3: Write implementation (GREEN)**

Create `src/agentmux/app.py`:

```python
"""Main Textual application for the agentmux sidebar."""
from __future__ import annotations

import os
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Vertical, VerticalScroll
from textual.widgets import Button, Footer, Static

from agentmux.monitor import parse_context, parse_status
from agentmux.tmux import TmuxManager
from agentmux.widgets import AgentCard, AgentSelected, NewAgentModal


class AgentMuxSidebar(App):
    """The sidebar application for managing Claude Code agents."""

    CSS_PATH = "styles.tcss"

    BINDINGS = [
        Binding("ctrl+n", "new_agent", "New Agent"),
        Binding("ctrl+q", "close_agent", "Close Agent"),
        *[
            Binding(str(i), f"switch_{i}", f"Agent {i}", show=False)
            for i in range(1, 10)
        ],
    ]

    def __init__(
        self,
        session_name: str = "agentmux",
        working_dir: str | None = None,
    ) -> None:
        super().__init__()
        self._session_name = session_name
        self._working_dir = working_dir or os.getcwd()
        self._tmux = TmuxManager(session_name=session_name)
        self._agent_counter = 0

    def compose(self) -> ComposeResult:
        yield Static("AGENTS", id="header")
        yield VerticalScroll(id="agent-list")
        with Vertical(id="footer"):
            yield Button("+ New", id="new-btn")
            yield Static("ctrl+n new · 1-9 switch · ctrl+q close", id="shortcuts")

    def on_mount(self) -> None:
        self.set_interval(1.5, self._poll_agents)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "new-btn":
            self.action_new_agent()

    def action_new_agent(self) -> None:
        self.push_screen(NewAgentModal(), callback=self._on_new_agent_result)

    def _on_new_agent_result(self, result: tuple[str, str | None] | None) -> None:
        if result is None:
            return
        name, directory = result
        work_dir = directory or self._working_dir

        # Create the agent in tmux
        self._tmux.create_agent(name, work_dir)

        # Add a card to the sidebar
        self._agent_counter += 1
        card = AgentCard(agent_name=name, id=f"agent-card-{self._agent_counter}")
        self.query_one("#agent-list").mount(card)

        # Mark it as active
        self._set_active_card(name)

    def on_agent_selected(self, event: AgentSelected) -> None:
        self._tmux.switch_to_agent(event.agent_name)
        self._set_active_card(event.agent_name)

    def _set_active_card(self, name: str) -> None:
        for card in self.query(AgentCard):
            card.is_active = card.agent_name == name

    def action_close_agent(self) -> None:
        active = self._tmux.active_agent
        if not active:
            return
        self._tmux.kill_agent(active)
        # Remove the card
        for card in self.query(AgentCard):
            if card.agent_name == active:
                card.remove()
                break

    async def _poll_agents(self) -> None:
        for card in self.query(AgentCard):
            name = card.agent_name
            if name not in self._tmux.agents:
                continue

            lines = self._tmux.capture_pane(name)
            alive = self._tmux.is_pane_alive(name)

            card.status = parse_status(lines, pane_alive=alive)
            ctx = parse_context(lines)
            if ctx is not None:
                card.context_pct = ctx

    def _switch_to_index(self, index: int) -> None:
        cards = list(self.query(AgentCard))
        if 0 <= index < len(cards):
            name = cards[index].agent_name
            self._tmux.switch_to_agent(name)
            self._set_active_card(name)

    # Number key handlers
    def action_switch_1(self) -> None: self._switch_to_index(0)
    def action_switch_2(self) -> None: self._switch_to_index(1)
    def action_switch_3(self) -> None: self._switch_to_index(2)
    def action_switch_4(self) -> None: self._switch_to_index(3)
    def action_switch_5(self) -> None: self._switch_to_index(4)
    def action_switch_6(self) -> None: self._switch_to_index(5)
    def action_switch_7(self) -> None: self._switch_to_index(6)
    def action_switch_8(self) -> None: self._switch_to_index(7)
    def action_switch_9(self) -> None: self._switch_to_index(8)
```

**Step 4: Run tests to verify they pass (Verify GREEN)**

```bash
pytest tests/test_app.py -v
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/agentmux/app.py tests/test_app.py
git commit -m "feat: add sidebar Textual app with keybindings and polling"
```

---

### Task 8: CLI Entry Point — Bootstrap and Launch 🔴 NOT_STARTED
<!-- deps: [7] | files: ["src/agentmux/cli.py", "tests/test_cli.py"] -->

> **REQUIRED:** Follow skills:test-driven-development (RED-GREEN-REFACTOR cycle)

**Files:**
- Create: `src/agentmux/cli.py`
- Create: `tests/test_cli.py`

**Context:** This is the user-facing entry point. When a user runs `agentmux`, this module:
1. Parses args (`--dir` for working directory)
2. If `--sidebar` flag: runs the Textual app (we're inside the tmux right pane)
3. Otherwise: creates the tmux session with split layout, launches `agentmux --sidebar` in the right pane, and attaches the user's terminal to the session

The two-phase approach (bootstrap → sidebar) means the Textual app runs inside tmux and can control it directly via libtmux — no IPC needed.

**Step 1: Write failing tests (RED)**

Create `tests/test_cli.py`:

```python
"""Tests for CLI argument parsing."""
import pytest
from unittest.mock import patch, MagicMock
from agentmux.cli import parse_args


class TestParseArgs:
    def test_default_args(self):
        args = parse_args([])
        assert args.sidebar is False
        assert args.dir is None

    def test_sidebar_flag(self):
        args = parse_args(["--sidebar"])
        assert args.sidebar is True

    def test_dir_flag(self):
        args = parse_args(["--dir", "/tmp/project"])
        assert args.dir == "/tmp/project"

    def test_combined_flags(self):
        args = parse_args(["--sidebar", "--dir", "/home/user/code"])
        assert args.sidebar is True
        assert args.dir == "/home/user/code"
```

**Step 2: Run tests to verify they fail (Verify RED)**

```bash
pytest tests/test_cli.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'agentmux.cli'`

**Step 3: Write implementation (GREEN)**

Create `src/agentmux/cli.py`:

```python
"""CLI entry point for agentmux."""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

from agentmux.tmux import TmuxManager


SESSION_NAME = "agentmux"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Terminal agent management UI for Claude Code",
    )
    parser.add_argument(
        "--sidebar",
        action="store_true",
        help=argparse.SUPPRESS,  # Internal flag — runs the Textual sidebar app
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=None,
        help="Working directory for new agents (default: current directory)",
    )
    return parser.parse_args(argv)


def _run_sidebar(working_dir: str) -> None:
    """Launch the Textual sidebar app (runs inside tmux right pane)."""
    from agentmux.app import AgentMuxSidebar

    app = AgentMuxSidebar(session_name=SESSION_NAME, working_dir=working_dir)
    app.run()


def _bootstrap(working_dir: str) -> None:
    """Create tmux session, launch sidebar in right pane, attach."""
    if not shutil.which("tmux"):
        print("Error: tmux is not installed. Install with: brew install tmux")
        sys.exit(1)

    mgr = TmuxManager(session_name=SESSION_NAME)
    mgr.create_session(working_dir)

    # Find the agentmux command path
    agentmux_cmd = shutil.which("agentmux") or f"{sys.executable} -m agentmux.cli"
    sidebar_cmd = f"{agentmux_cmd} --sidebar --dir {working_dir}"

    # Launch the sidebar app in the right pane
    sidebar_pane_id = mgr.get_sidebar_pane_id()
    subprocess.run(
        ["tmux", "send-keys", "-t", sidebar_pane_id, sidebar_cmd, "Enter"],
        check=True,
    )

    # Clear the left pane and show welcome
    subprocess.run(
        ["tmux", "send-keys", "-t", mgr._main_pane_id,
         "clear && echo 'agentmux ready — create an agent with + or Ctrl+N'",
         "Enter"],
        check=True,
    )

    # Attach to the session (replaces current process)
    os.execvp("tmux", ["tmux", "attach-session", "-t", SESSION_NAME])


def main() -> None:
    args = parse_args()
    working_dir = args.dir or os.getcwd()

    if args.sidebar:
        _run_sidebar(working_dir)
    else:
        _bootstrap(working_dir)


if __name__ == "__main__":
    main()
```

**Step 4: Run tests to verify they pass (Verify GREEN)**

```bash
pytest tests/test_cli.py -v
```

Expected: All 4 tests PASS.

**Step 5: Run full test suite**

```bash
pytest tests/ -v --tb=short
```

Expected: All tests across all files PASS.

**Step 6: Manual smoke test**

```bash
pip install -e .
agentmux --dir /tmp
```

Expected behavior:
1. tmux session opens with two panes
2. Right pane shows the Textual sidebar with "AGENTS" header and "+ New" button
3. Left pane shows welcome message
4. Press `Ctrl+N` — modal appears asking for agent name
5. Type a name and hit Enter — Claude starts in the left pane, card appears in sidebar
6. Create a second agent — sidebar shows two cards
7. Click the first card — left pane switches to first agent
8. Press `Ctrl+Q` — active agent closes and card is removed

**Step 7: Commit**

```bash
git add src/agentmux/cli.py tests/test_cli.py
git commit -m "feat: add CLI entry point with tmux bootstrap"
```

---

## Execution Notes

### Task Dependencies

```
Task 1 (scaffolding)
  ├── Task 2 (tmux manager)     ← can run in parallel
  ├── Task 3 (status parser)    ← can run in parallel
  ├── Task 4 (widgets)          ← can run in parallel
  └── Task 5 (modal)            ← can run in parallel
         │
         ▼
      Task 6 (CSS)
         │
         ▼
      Task 7 (app)
         │
         ▼
      Task 8 (CLI + integration)
