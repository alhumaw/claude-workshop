import React, { useEffect, useState } from 'react';
import { SessionInfo } from '../../shared/types';
import { ContextBar } from './ContextBar';
import { AvatarPixels } from './AvatarPixels';

interface Props {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isLead?: boolean;
}

const STATUS_CONFIG = {
  idle: { color: 'var(--status-idle)', label: 'Idle' },
  generating: { color: 'var(--status-generating)', label: 'Generating' },
  thinking: { color: 'var(--status-thinking)', label: 'Thinking' },
  exited: { color: 'var(--status-exited)', label: 'Exited' },
};

function timeSince(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const DOTS = ['', '.', '..', '...'];

function AnimatedDots() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % DOTS.length), 400);
    return () => clearInterval(id);
  }, []);
  return <span style={{ display: 'inline-block', width: 18, textAlign: 'left' }}>{DOTS[i]}</span>;
}

export function SessionCard({ session, isActive, onClick, onContextMenu, isLead }: Props) {
  const st = STATUS_CONFIG[session.status];
  const isWorking = session.status === 'generating' || session.status === 'thinking';

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        padding: '10px 12px',
        marginBottom: 6,
        borderRadius: 8,
        background: isActive ? 'var(--bg-card)' : 'transparent',
        border: isWorking
          ? `1px solid ${st.color}`
          : isActive
            ? '1px solid var(--border-active)'
            : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: isWorking ? `0 0 8px 1px ${st.color}33` : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isWorking) {
          e.currentTarget.style.background = 'var(--bg-card-hover)';
          e.currentTarget.style.borderColor = 'var(--border-default)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isWorking) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      <AvatarPixels seed={session.avatarSeed} />

      {/* Both rows stacked next to avatar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Row 1: Name + Branch + Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontWeight: 600,
            fontSize: 13,
            flexShrink: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {isLead && <span title="Team Lead" style={{ fontSize: 10, color: 'var(--accent)' }}>★</span>}
            {session.name}
          </span>
          {session.branch && (
            <span style={{
              color: 'var(--text-muted)',
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flexShrink: 1,
            }}>
              &#x2387; {session.branch}
            </span>
          )}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <ContextBar percent={session.contextPercent} />
          </div>
        </div>

        {/* Row 2: Status + Time + Model + Cost */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 11,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          <span style={{ color: st.color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: st.color,
              display: 'inline-block',
              flexShrink: 0,
            }} />
            {st.label}{isWorking && <AnimatedDots />}
          </span>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {timeSince(session.lastActivity)}
          </span>
          {session.model && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.model}</span>
          )}
          {session.cost && (
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              {session.cost}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
