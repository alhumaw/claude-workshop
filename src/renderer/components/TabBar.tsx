import React from 'react';
import { useSessionStore } from '../stores/session-store';

interface Props {
  onNewSession: () => void;
}

export function TabBar({ onNewSession }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActiveSession);
  const removeSession = useSessionStore((s) => s.removeSession);

  const handleClose = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await window.electronAPI.killSession(sessionId);
    removeSession(sessionId);
  };

  return (
    <div style={{
      height: 36,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'stretch',
      overflowX: 'auto',
      overflowY: 'hidden',
    }}>
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => setActive(session.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            fontSize: 12,
            cursor: 'pointer',
            borderRight: '1px solid var(--border-default)',
            background: session.id === activeSessionId ? 'var(--bg-card)' : 'transparent',
            color: session.id === activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {session.name}
            {session.teamId && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
                [{session.teamId}]
              </span>
            )}
          </span>
          <span
            onClick={(e) => handleClose(e, session.id)}
            style={{
              fontSize: 14,
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
        onClick={onNewSession}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 16,
          cursor: 'pointer',
          padding: '0 12px',
        }}
      >
        +
      </button>
    </div>
  );
}
