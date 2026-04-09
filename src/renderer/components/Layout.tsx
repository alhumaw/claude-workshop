import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TerminalManager } from './TerminalManager';
import { ShellPanel } from './ShellPanel';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { TabBar } from './TabBar';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 300;

const SHELL_MIN = 80;
const SHELL_DEFAULT = 200;

interface Props {
  onNewSession: () => void;
}

export function Layout({ onNewSession }: Props) {
  // Sidebar drag state
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const sidebarWrapRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // Shell panel state
  const [shellHeight, setShellHeight] = useState(SHELL_DEFAULT);
  const [shellVisible, setShellVisible] = useState(true);
  const shellDragging = useRef(false);
  const shellStartY = useRef(0);
  const shellStartHeight = useRef(0);
  const shellWrapRef = useRef<HTMLDivElement>(null);
  const shellHandleRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);

  // Sidebar drag
  const onSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    e.preventDefault();
  }, [sidebarWidth]);

  // Shell panel drag
  const onShellMouseDown = useCallback((e: React.MouseEvent) => {
    shellDragging.current = true;
    shellStartY.current = e.clientY;
    shellStartHeight.current = shellHeight;
    e.preventDefault();
  }, [shellHeight]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN,
          startWidth.current + (startX.current - e.clientX)
        ));
        if (sidebarWrapRef.current) sidebarWrapRef.current.style.width = `${next}px`;
        if (handleRef.current) handleRef.current.style.right = `${next}px`;
      }
      if (shellDragging.current) {
        const maxHeight = leftPaneRef.current
          ? leftPaneRef.current.getBoundingClientRect().height * 0.6
          : 500;
        const next = Math.min(maxHeight, Math.max(SHELL_MIN,
          shellStartHeight.current + (shellStartY.current - e.clientY)
        ));
        if (shellWrapRef.current) shellWrapRef.current.style.height = `${next}px`;
        if (shellHandleRef.current) shellHandleRef.current.style.bottom = `${next}px`;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (dragging.current) {
        dragging.current = false;
        const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN,
          startWidth.current + (startX.current - e.clientX)
        ));
        setSidebarWidth(next);
      }
      if (shellDragging.current) {
        shellDragging.current = false;
        const maxHeight = leftPaneRef.current
          ? leftPaneRef.current.getBoundingClientRect().height * 0.6
          : 500;
        const next = Math.min(maxHeight, Math.max(SHELL_MIN,
          shellStartHeight.current + (shellStartY.current - e.clientY)
        ));
        setShellHeight(next);
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Cmd+` toggle
  useEffect(() => {
    const handler = (_e: Electron.IpcRendererEvent, ...args: any[]) => {
      setShellVisible((v) => !v);
    };
    return window.electronAPI.onShortcut('shortcut:toggle-shell', handler);
  }, []);

  const shellTotal = shellVisible ? shellHeight + 4 : 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-primary)',
    }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Left pane: Claude terminals + shell panel */}
        <div
          ref={leftPaneRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            right: sidebarWidth + 4,
          }}
        >
          {/* Claude terminals — above shell panel */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: shellTotal,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <TerminalManager />
          </div>

          {/* Shell horizontal drag handle */}
          {shellVisible && (
            <div
              ref={shellHandleRef}
              onMouseDown={onShellMouseDown}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: shellHeight,
                height: 4,
                cursor: 'row-resize',
                background: 'var(--border-default)',
                zIndex: 10,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-active)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-default)'; }}
            />
          )}

          {/* Shell panel */}
          {shellVisible && (
            <div
              ref={shellWrapRef}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: shellHeight,
              }}
            >
              <ShellPanel visible={shellVisible} onClose={() => setShellVisible(false)} />
            </div>
          )}
        </div>

        {/* Sidebar drag handle */}
        <div
          ref={handleRef}
          onMouseDown={onSidebarMouseDown}
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

        {/* Sidebar */}
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
          <Sidebar onNewSession={onNewSession} />
        </div>
      </div>
      <TabBar onNewSession={onNewSession} onToggleShell={() => setShellVisible((v) => !v)} shellVisible={shellVisible} />
    </div>
  );
}
