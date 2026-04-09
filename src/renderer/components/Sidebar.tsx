import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../stores/session-store';
import { SessionCard } from './SessionCard';
import { AgentPopover } from './AgentPopover';
import { ToolkitPanel } from './ToolkitPanel';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';

interface Props {
  onNewSession: () => void;
}

export function Sidebar({ onNewSession }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActiveSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const reorderSessions = useSessionStore((s) => s.reorderSessions);
  const renameSession = useSessionStore((s) => s.renameSession);
  const updateAvatarSeed = useSessionStore((s) => s.updateAvatarSeed);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    window.electronAPI.showSessionContextMenu(sessionId);
  }, []);

  const handleKillSession = useCallback(async (sessionId: string) => {
    await window.electronAPI.killSession(sessionId);
    removeSession(sessionId);
  }, [removeSession]);

  // Handle actions from native context menu
  useEffect(() => {
    return window.electronAPI.onContextMenuAction((sessionId, action) => {
      switch (action) {
        case 'switch':
          setActive(sessionId);
          break;
        case 'kill':
          handleKillSession(sessionId);
          break;
        case 'rename':
          setRenamingId(sessionId);
          break;
      }
    });
  }, [setActive, handleKillSession]);

  const renamingSession = renamingId ? sessions.find((s) => s.id === renamingId) : null;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          Sessions
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => setShowHelp(true)}
            className="titlebar-no-drag"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            title="Help"
          >
            ?
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="titlebar-no-drag"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            title="Settings"
          >
            ⚙
          </button>
          <button
            onClick={onNewSession}
            className="titlebar-no-drag"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            title="New session"
          >
            +
          </button>
        </div>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {sessions.map((session, index) => (
          <div
            key={session.id}
            ref={(el) => {
              if (el) cardRefs.current.set(session.id, el);
              else cardRefs.current.delete(session.id);
            }}
            draggable
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              // Make the drag image semi-transparent
              if (e.currentTarget) {
                e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverIndex(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                reorderSessions(dragIndex, index);
              }
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            style={{
              opacity: dragIndex === index ? 0.4 : 1,
              borderTop: dragOverIndex === index && dragIndex !== null && dragIndex > index
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              borderBottom: dragOverIndex === index && dragIndex !== null && dragIndex < index
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              transition: 'opacity 0.15s ease, border-color 0.15s ease',
            }}
          >
            <SessionCard
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => setActive(session.id)}
              onContextMenu={(e) => handleContextMenu(e, session.id)}
            />
          </div>
        ))}
      </div>

      {/* Toolkit */}
      <ToolkitPanel activeSessionId={activeSessionId} />

      {/* Footer shortcuts */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--border-default)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Cmd+0-9 Jump | Cmd+[ Prev | Cmd+] Next
      </div>

      {/* Rename popover (portaled to body) */}
      {renamingId && renamingSession && (
        <AgentPopover
          session={renamingSession}
          anchorRef={{ current: cardRefs.current.get(renamingId) || null }}
          onRename={(name) => renameSession(renamingId, name)}
          onRandomize={() => {
            const seed = Math.random().toString(36).slice(2, 10);
            updateAvatarSeed(renamingId, seed);
          }}
          onClose={() => setRenamingId(null)}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
