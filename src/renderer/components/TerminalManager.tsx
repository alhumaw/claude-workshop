import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useSessionStore } from '../stores/session-store';
import 'xterm/css/xterm.css';

// Global registry of xterm instances so we can extract rendered text
const terminalRegistry = new Map<string, Terminal>();

/** Serialize the rendered content of an xterm Terminal to plain text. */
function serializeTerminal(term: Terminal): string {
  const buf = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buf.length; i++) {
    const line = buf.getLine(i);
    if (line) lines.push(line.translateToString(true));
  }
  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return lines.join('\n');
}

interface TerminalViewProps {
  sessionId: string;
  visible: boolean;
}

function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const registerCallback = useSessionStore((s) => s.registerTerminalCallback);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#444444',
        black: '#1a1a1a',
        red: '#ef4444',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e0e0e0',
        brightBlack: '#666666',
        brightRed: '#f87171',
        brightGreen: '#86efac',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    // Defer the initial fit — calling it synchronously here measures the
    // container before the browser has finished its first layout pass,
    // resulting in a terminal that's too small until the user resizes.
    // Two rAFs are enough to outlast React's commit + browser layout.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fit.fit();
      window.electronAPI.resizeTerminal(sessionId, term.cols, term.rows);
    }));

    // Send Shift+Enter as the modifyOtherKeys sequence so Claude Code
    // treats it as "newline without submit" rather than plain Enter.
    // Block both keydown and keypress to prevent xterm from sending \r.
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.key === 'Enter' && ev.shiftKey) {
        if (ev.type === 'keydown') {
          window.electronAPI.writeToTerminal(sessionId, '\x1b[27;2;13~');
        }
        return false; // block both keydown and keypress
      }
      return true;
    });

    termRef.current = term;
    fitRef.current = fit;
    terminalRegistry.set(sessionId, term);

    // Send user input to PTY
    term.onData((data) => {
      window.electronAPI.writeToTerminal(sessionId, data);
    });

    // Notify main process of size
    const { cols, rows } = term;
    window.electronAPI.resizeTerminal(sessionId, cols, rows);

    // Handle resize — debounced to avoid per-pixel PTY redraws during sidebar
    // drag (each resizeTerminal IPC call triggers a full terminal repaint).
    // Guard against display:none giving 0 dimensions (~1 col reflow).
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width < 50 || height < 50) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fit.fit();
        window.electronAPI.resizeTerminal(sessionId, term.cols, term.rows);
      }, 60);
    });
    observer.observe(containerRef.current);

    // xterm's internal wheel handler breaks after /clear — whether from
    // _currentRowHeight being zeroed by viewport.reset(), or from mouse
    // tracking mode being left active (routing wheel events to the PTY).
    // Rather than patching internal state, intercept wheel events in the
    // capture phase (before they reach xterm) and call term.scrollLines()
    // directly.  This is reliable regardless of xterm's internal state.
    const containerEl = containerRef.current;
    const handleWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Ensure _currentRowHeight is valid so getLinesScrolled works
      const core = (term as any)._core;
      const viewport = core?.viewport;
      if (viewport && viewport._currentRowHeight === 0) {
        const dpr = core._coreBrowserService?.dpr || window.devicePixelRatio || 1;
        const cellH = core._renderService?.dimensions?.device?.cell?.height;
        if (cellH > 0) {
          viewport._currentRowHeight = cellH / dpr;
          viewport._currentDeviceCellHeight = cellH;
        }
      }

      let lines: number;
      if (viewport?.getLinesScrolled) {
        lines = viewport.getLinesScrolled(ev);
      } else {
        lines = ev.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? Math.round(ev.deltaY)
          : ev.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? Math.round(ev.deltaY * term.rows)
            : Math.round(ev.deltaY / (viewport?._currentRowHeight || 20));
      }
      if (lines !== 0) term.scrollLines(lines);
    };
    containerEl.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    // Listen for PTY data
    const unsub = registerCallback(sessionId, (data: string) => {
      term.write(data);
    });

    // Replay buffered output that arrived before we mounted
    window.electronAPI.getSessionBuffer(sessionId).then((buf: string) => {
      if (buf) term.write(buf);
    });

    return () => {
      unsub();
      if (resizeTimer) clearTimeout(resizeTimer);
      containerEl.removeEventListener('wheel', handleWheel, { capture: true });
      observer.disconnect();
      terminalRegistry.delete(sessionId);
      term.dispose();
    };
  }, [sessionId]);

  // Re-fit when visibility changes and sync size to PTY
  useEffect(() => {
    if (!visible) return;
    const doFit = () => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      window.electronAPI.resizeTerminal(sessionId, termRef.current.cols, termRef.current.rows);
    };
    // Two rAFs to outlast React commit + browser layout; 150ms timeout as
    // belt-and-suspenders for absolute-positioned containers that need an
    // extra paint cycle to finalize their dimensions.
    requestAnimationFrame(() => requestAnimationFrame(doFit));
    const t = setTimeout(doFit, 150);
    return () => clearTimeout(t);
  }, [visible, sessionId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
      }}
    />
  );
}

export function TerminalManager() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const getCallbacks = useSessionStore((s) => s.getTerminalCallbacks);

  // Route incoming terminal data to the right callbacks
  useEffect(() => {
    const unsub = window.electronAPI.onTerminalData((sessionId, data) => {
      const cbs = getCallbacks(sessionId);
      for (const cb of cbs) cb(data);
    });
    return unsub;
  }, [getCallbacks]);

  // Handle text extraction requests from main process
  useEffect(() => {
    return window.electronAPI.onTerminalTextRequest((sessionId: string) => {
      const term = terminalRegistry.get(sessionId);
      if (!term) return '';
      return serializeTerminal(term);
    });
  }, []);

  if (sessions.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}>
        No sessions. Press Cmd+N to create one.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            inset: 0,
            display: s.id === activeSessionId ? 'block' : 'none',
          }}
        >
          <TerminalView sessionId={s.id} visible={s.id === activeSessionId} />
        </div>
      ))}
    </div>
  );
}
