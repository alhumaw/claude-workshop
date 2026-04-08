import React from 'react';
import { useSessionStore } from '../stores/session-store';

function ClaudeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path clipRule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fillRule="evenodd" />
    </svg>
  );
}

export function TitleBar() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const active = sessions.find((s) => s.id === activeSessionId);

  const statusColor = {
    idle: 'var(--status-idle)',
    generating: 'var(--status-generating)',
    thinking: 'var(--status-thinking)',
    exited: 'var(--status-exited)',
  };

  const statusLabel = {
    idle: 'Idle',
    generating: 'Generating',
    thinking: 'Thinking',
    exited: 'Exited',
  };

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="titlebar-drag" style={{
      height: 40,
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 80px 0 80px', /* space for traffic lights */
      gap: 12,
      fontSize: 12,
      userSelect: 'none',
    }}>
      {active ? (
        <>
          <ClaudeIcon size={16} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {active.name}
          </span>
          {active.branch && (
            <span style={{ color: 'var(--text-secondary)' }}>
              &#x2387; {active.branch}
            </span>
          )}
          <span style={{
            color: statusColor[active.status],
            fontWeight: 500,
            marginLeft: 8,
          }}>
            {statusLabel[active.status]}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {timeSince(active.lastActivity)}
          </span>
          <div style={{ flex: 1 }} />
          {active.model && (
            <span style={{ color: 'var(--text-secondary)' }}>
              {active.model}
            </span>
          )}
          {active.contextSize && (
            <span style={{ color: 'var(--text-muted)' }}>
              ({active.contextSize})
            </span>
          )}
          {active.cost && (
            <span style={{ color: 'var(--text-muted)' }}>
              {active.cost}
            </span>
          )}
        </>
      ) : (
        <>
          <ClaudeIcon size={16} />
          <span style={{ color: 'var(--text-muted)' }}>Claude Workshop</span>
          <div style={{ flex: 1 }} />
        </>
      )}
    </div>
  );
}
