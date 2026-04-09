import React from 'react';
import { SessionInfo, TeamInfo } from '../../shared/types';
import { SessionCard } from './SessionCard';

interface Props {
  team: TeamInfo;
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onToggleCollapse: () => void;
  onSelectSession: (id: string) => void;
  onAddMember: () => void;
  onDeleteTeam: () => void;
  onContextMenu: (e: React.MouseEvent, sessionId: string) => void;
}

export function TeamSection({
  team, sessions, activeSessionId,
  onToggleCollapse, onSelectSession, onAddMember, onDeleteTeam, onContextMenu,
}: Props) {
  const leadSession = sessions.find((s) => s.teamRole === 'lead');
  const teammates = sessions.filter((s) => s.teamRole === 'teammate');

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Team header */}
      <div
        onClick={onToggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          borderRadius: 6,
          userSelect: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          fontSize: 9,
          transition: 'transform 0.15s',
          transform: team.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>
          ▼
        </span>
        <span style={{ flex: 1 }}>{team.name}</span>
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
          {sessions.length}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onAddMember(); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          title="Add teammate"
        >
          +
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (sessions.length === 0) onDeleteTeam();
          }}
          disabled={sessions.length > 0}
          style={{
            background: 'none',
            border: 'none',
            color: sessions.length > 0 ? 'var(--border-default)' : 'var(--text-muted)',
            fontSize: 13,
            cursor: sessions.length > 0 ? 'not-allowed' : 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { if (sessions.length === 0) e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = sessions.length > 0 ? 'var(--border-default)' : 'var(--text-muted)'; }}
          title={sessions.length > 0 ? 'End all sessions first' : 'Delete team'}
        >
          ✕
        </button>
      </div>

      {/* Team members */}
      {!team.collapsed && (
        <div style={{ paddingLeft: 8 }}>
          {leadSession && (
            <SessionCard
              session={leadSession}
              isActive={leadSession.id === activeSessionId}
              onClick={() => onSelectSession(leadSession.id)}
              onContextMenu={(e) => onContextMenu(e, leadSession.id)}
              isLead
            />
          )}
          {teammates.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => onSelectSession(s.id)}
              onContextMenu={(e) => onContextMenu(e, s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
