import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TerminalManager } from './TerminalManager';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { TabBar } from './TabBar';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 300;

interface Props {
  onNewSession: () => void;
  onNewTeam: () => void;
}

export function Layout({ onNewSession, onNewTeam }: Props) {
  // Committed width — only updates on mouseup, triggering one terminal resize
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  // DOM refs for direct manipulation during drag (no React re-renders)
  const sidebarWrapRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    e.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN,
        startWidth.current + (startX.current - e.clientX)
      ));
      // Move sidebar and handle via DOM — terminal container is untouched,
      // so xterm never reflows and there's no flicker during drag.
      if (sidebarWrapRef.current) sidebarWrapRef.current.style.width = `${next}px`;
      if (handleRef.current) handleRef.current.style.right = `${next}px`;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN,
        startWidth.current + (startX.current - e.clientX)
      ));
      // Commit to React state — this updates the terminal container's right
      // edge, ResizeObserver fires, debounced fit() runs once cleanly.
      setSidebarWidth(next);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-primary)',
    }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Terminal — right edge tracks committed sidebar width only */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          right: sidebarWidth + 4,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <TerminalManager />
        </div>

        {/* Drag handle — positioned via DOM ref during drag */}
        <div
          ref={handleRef}
          onMouseDown={onMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: sidebarWidth,
            width: 4,
            cursor: 'col-resize',
            background: 'var(--border-default)',
            zIndex: 10,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-active)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-default)'; }}
        />

        {/* Sidebar wrapper — width updated via DOM ref during drag */}
        <div
          ref={sidebarWrapRef}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: sidebarWidth,
          }}
        >
          <Sidebar onNewSession={onNewSession} onNewTeam={onNewTeam} />
        </div>
      </div>
      <TabBar onNewSession={onNewSession} />
    </div>
  );
}
