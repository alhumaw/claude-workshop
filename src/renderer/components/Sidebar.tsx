import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../stores/session-store';
import { SessionCard } from './SessionCard';
import { AgentPopover } from './AgentPopover';
import { ToolkitPanel } from './ToolkitPanel';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';
import { BattleToastStack, BattleToast } from './BattleOverlay';
import { AgentProfileCard } from './AgentProfileCard';
import { BattleLog } from './BattleLog';
import { Bestiary } from './Bestiary';
import { HallOfFame } from './HallOfFame';
import { SessionInfo } from '../../shared/types';
import { getBiome } from '../../shared/biomes';

interface Props {
  onNewSession: () => void;
  onNewTeam: () => void;
}

export function Sidebar({ onNewSession, onNewTeam }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const activeTeamId = useSessionStore((s) => s.activeTeamId);
  const setActive = useSessionStore((s) => s.setActiveSession);
  const setActiveTeam = useSessionStore((s) => s.setActiveTeam);
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
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<string | null>(null);
  const deleteButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [activeBattleToasts, setActiveBattleToasts] = useState<BattleToast[]>([]);
  const toastIdRef = useRef(0);
  const [profileCard, setProfileCard] = useState<{ sessionId: string; position: { x: number; y: number } } | null>(null);
  const [battleLogSession, setBattleLogSession] = useState<string | null>(null);
  const [bestiarySession, setBestiarySession] = useState<string | null>(null);
  const [showHallOfFame, setShowHallOfFame] = useState(false);

  // Listen for battle results from main process — add to toast stack
  useEffect(() => {
    return window.electronAPI.onBattleResult((sessionId, result) => {
      const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
      const biome = session?.battleState ? getBiome(session.battleState.level) : null;
      const toast: BattleToast = {
        id: ++toastIdRef.current,
        sessionId,
        avatarSeed: session?.avatarSeed || '',
        sessionName: session?.name || 'Agent',
        result,
        biomeColor: biome?.color,
        biomeName: biome?.name,
      };
      setActiveBattleToasts(prev => [...prev.slice(-4), toast]);
    });
  }, []);

  // Listen for milestone events — show as distinct notification (not a fake battle toast)
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  useEffect(() => {
    return window.electronAPI.onMilestoneEarned((sessionId, milestone, battleName) => {
      const BADGES: Record<string, string> = {
        'First Blood': '⚔', 'Untouchable': '🛡', 'Streak Master': '🔥',
        'Completionist': '📖', 'Dragon Slayer': '🐉', 'Shiny Hunter': '✨', 'Centurion': '👑',
      };
      setMilestoneToast(`${BADGES[milestone] || '🏆'} ${battleName} earned ${milestone}!`);
      setTimeout(() => setMilestoneToast(null), 4000);
    });
  }, []);

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
        case 'battle-log':
          setBattleLogSession(sessionId);
          break;
        case 'bestiary':
          setBestiarySession(sessionId);
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
      position: 'relative',
    }}>
      {/* Battle toast notifications */}
      <BattleToastStack
        toasts={activeBattleToasts}
        onDismiss={(id) => setActiveBattleToasts(prev => prev.filter(t => t.id !== id))}
      />

      {/* Milestone notification — distinct from battle toasts */}
      {milestoneToast && (
        <div style={{
          position: 'absolute',
          top: 50,
          left: 8,
          right: 8,
          zIndex: 200,
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid rgba(250, 204, 21, 0.5)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: '#facc15',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(250, 204, 21, 0.3)',
          animation: 'battleFlash 0.5s ease-in-out 3',
        }}>
          {milestoneToast}
        </div>
      )}
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
            onClick={onNewTeam}
            className="titlebar-no-drag"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              opacity: 0.7,
              fontWeight: 700,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            title="Create Team"
          >
            T+
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
        {/* Standalone sessions */}
        {sessions.filter((s) => !s.teamId).map((session, index) => (
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
            <div style={{ position: 'relative' }}>
              <SessionCard
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => setActive(session.id)}
                onContextMenu={(e) => handleContextMenu(e, session.id)}
                onAvatarRightClick={(e) => setProfileCard({ sessionId: session.id, position: { x: e.clientX, y: e.clientY } })}
              />
            </div>
          </div>
        ))}

        {/* Team groups — auto-detected from native Claude Code teams */}
        {(() => {
          const teamIds = [...new Set(sessions.filter((s) => s.teamId).map((s) => s.teamId!))];
          return teamIds.map((teamId) => {
            const teamSessions = sessions.filter((s) => s.teamId === teamId);
            const lead = teamSessions.find((s) => s.teamRole === 'lead');
            return (
              <div key={teamId} style={{ marginTop: 8 }}>
                <div
                onClick={() => setActiveTeam(teamId)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: activeTeamId === teamId ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '6px 8px',
                  borderBottom: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  background: activeTeamId === teamId ? 'var(--bg-card)' : 'transparent',
                  borderRadius: 4,
                  border: activeTeamId === teamId ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                }}>
                  <span style={{ color: 'var(--accent)' }}>T</span>
                  {teamId}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    ({teamSessions.length})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedTeams((prev) => {
                        const next = new Set(prev);
                        if (next.has(teamId)) next.delete(teamId);
                        else next.add(teamId);
                        return next;
                      });
                    }}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: '0 2px',
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                    title={collapsedTeams.has(teamId) ? 'Expand team' : 'Collapse team'}
                  >
                    {collapsedTeams.has(teamId) ? '+' : '−'}
                  </button>
                  <button
                    ref={(el) => { if (el) deleteButtonRefs.current.set(teamId, el); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteTeam(confirmDeleteTeam === teamId ? null : teamId);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1,
                      padding: '0 2px',
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    title="Delete team"
                  >
                    ×
                  </button>
                </div>
                {/* Confirm delete popover */}
                {confirmDeleteTeam === teamId && (() => {
                  const btnEl = deleteButtonRefs.current.get(teamId);
                  const rect = btnEl?.getBoundingClientRect();
                  return (
                    <div style={{
                      position: 'relative',
                      margin: '0 8px 4px',
                      padding: '8px 10px',
                      background: 'var(--bg-card)',
                      border: '1px solid #ef4444',
                      borderRadius: 6,
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span>Delete team and kill all agents?</span>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        // Kill all team sessions
                        for (const s of teamSessions) {
                          await window.electronAPI.killSession(s.id);
                          removeSession(s.id);
                        }
                        setConfirmDeleteTeam(null);
                      }} style={{
                        padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                        background: '#ef4444', border: 'none', color: '#fff',
                        fontSize: 11, fontWeight: 600,
                      }}>Yes</button>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteTeam(null);
                      }} style={{
                        padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                        background: 'transparent', border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)', fontSize: 11,
                      }}>No</button>
                    </div>
                  );
                })()}
                {!collapsedTeams.has(teamId) && teamSessions.map((session) => (
                  <div
                    key={session.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(session.id, el);
                      else cardRefs.current.delete(session.id);
                    }}
                    style={{ paddingLeft: 8 }}
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
            );
          });
        })()}
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onShowHallOfFame={() => setShowHallOfFame(true)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {profileCard && (() => {
        const liveSession = sessions.find(s => s.id === profileCard.sessionId);
        if (!liveSession) return null;
        return (
          <AgentProfileCard
            session={liveSession}
            position={profileCard.position}
            onClose={() => setProfileCard(null)}
          />
        );
      })()}
      {battleLogSession && (() => {
        const s = sessions.find(s => s.id === battleLogSession);
        return s?.battleState ? <BattleLog battleState={s.battleState} onClose={() => setBattleLogSession(null)} /> : null;
      })()}
      {bestiarySession && (() => {
        const s = sessions.find(s => s.id === bestiarySession);
        return s?.battleState ? <Bestiary battleState={s.battleState} onClose={() => setBestiarySession(null)} /> : null;
      })()}
      {showHallOfFame && <HallOfFame onClose={() => setShowHallOfFame(false)} />}
    </div>
  );
}
