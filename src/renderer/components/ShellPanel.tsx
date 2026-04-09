import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

interface ShellTab {
  id: string;
  name: string;
}

interface ShellTermViewProps {
  shellId: string;
  visible: boolean;
}

function ShellTermView({ shellId, visible }: ShellTermViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

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
      fontFamily: "'MesloLGS NF', 'Hack Nerd Font', 'FiraCode Nerd Font', 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);

    const fitShell = () => {
      fit.fit();
      window.electronAPI.resizeShell(shellId, term.cols, term.rows);
    };

    requestAnimationFrame(() => requestAnimationFrame(fitShell));
    document.fonts.ready.then(fitShell);

    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      window.electronAPI.writeShell(shellId, data);
    });

    // Route data for this shell
    const unsub = window.electronAPI.onShellData((id, data) => {
      if (id === shellId) term.write(data);
    });

    // Resize handling
    let fitting = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (!containerRef.current || fitting) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width < 50 || height < 30) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitting = true;
        fitShell();
        term.scrollToBottom();
        requestAnimationFrame(() => { fitting = false; });
      }, 60);
    });
    observer.observe(containerRef.current);

    return () => {
      unsub();
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      term.dispose();
    };
  }, [shellId]);

  // Re-fit on visibility change
  useEffect(() => {
    if (!visible || !fitRef.current || !termRef.current) return;
    const doFit = () => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      window.electronAPI.resizeShell(shellId, termRef.current.cols, termRef.current.rows);
      termRef.current.scrollToBottom();
      termRef.current.focus();
    };
    requestAnimationFrame(() => requestAnimationFrame(doFit));
    const t = setTimeout(doFit, 150);
    return () => clearTimeout(t);
  }, [visible, shellId]);

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

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ShellPanel({ visible, onClose }: Props) {
  const [tabs, setTabs] = useState<ShellTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const nextIndex = useRef(1);

  // Spawn initial tab when becoming visible with no tabs
  useEffect(() => {
    if (visible && tabs.length === 0) {
      addTab();
    }
  }, [visible]);

  const addTab = useCallback(async () => {
    const { id } = await window.electronAPI.spawnShell();
    const name = `Terminal ${nextIndex.current++}`;
    setTabs((prev) => [...prev, { id, name }]);
    setActiveTab(id);
  }, []);

  const closeTab = useCallback(async (id: string) => {
    await window.electronAPI.killShell(id);
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        onClose();
      }
      return next;
    });
    setActiveTab((current) => {
      if (current !== id) return current;
      const remaining = tabs.filter((t) => t.id !== id);
      return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
    });
  }, [tabs, onClose]);

  if (!visible) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{
        height: 28,
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        borderTop: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              fontSize: 11,
              cursor: 'pointer',
              borderRight: '1px solid var(--border-default)',
              background: tab.id === activeTab ? 'var(--bg-card)' : 'transparent',
              color: tab.id === activeTab ? 'var(--text-primary)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.name}</span>
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{
                fontSize: 13,
                lineHeight: 1,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0 2px',
              }}
            >
              ×
            </span>
          </div>
        ))}
        <button
          onClick={addTab}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          +
        </button>
      </div>

      {/* Terminal views */}
      <div style={{ flex: 1, position: 'relative' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              position: 'absolute',
              inset: 0,
              display: tab.id === activeTab ? 'block' : 'none',
            }}
          >
            <ShellTermView shellId={tab.id} visible={tab.id === activeTab && visible} />
          </div>
        ))}
      </div>
    </div>
  );
}
