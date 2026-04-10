import React, { useEffect, useRef, useState } from 'react';
import { SessionInfo, AgentBattleState } from '../../shared/types';
import { ContextBar } from './ContextBar';
import { AvatarPixels } from './AvatarPixels';
import { xpForLevel } from '../../shared/battle-utils';
import { getBiome } from '../../shared/biomes';

// Border tier mapping — must match battle-engine.ts getBorderTier()
function getBorderInfo(level: number): { cssClass: string; color: string } | null {
  if (level >= 100) return { cssClass: 'border-eternal', color: '' };
  if (level >= 90)  return { cssClass: 'border-ascended', color: '' };
  if (level >= 75)  return { cssClass: 'border-legendary', color: '#FFD700' };
  if (level >= 60)  return { cssClass: 'border-mythic', color: '' };
  if (level >= 50)  return { cssClass: 'border-diamond', color: '' };
  if (level >= 40)  return { cssClass: 'border-platinum', color: '#E5E4E2' };
  if (level >= 30)  return { cssClass: 'border-gold', color: '#FFD700' };
  if (level >= 20)  return { cssClass: 'border-silver', color: '#C0C0C0' };
  if (level >= 15)  return { cssClass: 'border-iron', color: '#71797E' };
  if (level >= 10)  return { cssClass: 'border-bronze', color: '#CD7F32' };
  if (level >= 5)   return { cssClass: 'border-rookie', color: '#8B6914' };
  return null;
}

interface Props {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onAvatarRightClick?: (e: React.MouseEvent) => void;
  isLead?: boolean;
}

const STATUS_CONFIG = {
  idle: { color: 'var(--status-idle)', label: 'Idle' },
  generating: { color: 'var(--status-generating)', label: 'Generating' },
  thinking: { color: 'var(--status-thinking)', label: 'Thinking' },
  exited: { color: 'var(--status-exited)', label: 'Exited' },
} as const;

const APPROVAL_COLOR = 'var(--status-approval)';

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

export function SessionCard({ session, isActive, onClick, onContextMenu, onAvatarRightClick, isLead }: Props) {
  const st = STATUS_CONFIG[session.status];
  const isWorking = session.status === 'generating' || session.status === 'thinking';
  const isAwaiting = session.awaitingApproval;
  const bs = session.battleState;

  // Derive battle visual props
  const borderInfo = bs ? getBorderInfo(bs.level) : null;
  const isWounded = bs ? (bs.lastLossTime > 0 && Date.now() - bs.lastLossTime < 120000) : false;
  const battleApproaching = bs && !bs.isDead && bs.tokensSinceLastBattle >= bs.nextBattleThreshold * 0.8;
  const biome = bs ? getBiome(bs.level) : null;

  const [levelUpAnim, setLevelUpAnim] = useState(false);
  const prevLevelRef = useRef(bs?.level ?? 0);

  // Detect level-up → trigger border sweep animation
  useEffect(() => {
    if (bs && bs.level > prevLevelRef.current && prevLevelRef.current > 0) {
      setLevelUpAnim(true);
      const t = setTimeout(() => setLevelUpAnim(false), 1500);
      return () => clearTimeout(t);
    }
    prevLevelRef.current = bs?.level ?? 0;
  }, [bs?.level]);

  // XP progress
  const xpPct = bs && !bs.isDead ? (() => {
    const cur = xpForLevel(bs.level);
    const next = xpForLevel(bs.level + 1);
    return next > cur ? ((bs.xp - cur) / (next - cur)) * 100 : 100;
  })() : 0;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={levelUpAnim ? 'level-up-sweep' : undefined}
      style={{
        marginBottom: 6,
        borderRadius: 8,
        background: isActive ? 'var(--bg-card)' : 'transparent',
        border: isAwaiting
          ? `1px solid ${APPROVAL_COLOR}`
          : isActive
            ? '1px solid rgba(255, 255, 255, 0.4)'
            : isWorking
              ? `1px solid ${st.color}`
              : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: isAwaiting
          ? undefined
          : isActive ? '0 0 10px 2px rgba(255, 255, 255, 0.15)'
          : isWorking ? `0 0 8px 1px ${st.color}33` : 'none',
        animation: isAwaiting ? 'approvalGlow 1.5s ease-in-out infinite' : 'none',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isWorking && !isAwaiting) {
          e.currentTarget.style.background = 'var(--bg-card-hover)';
          e.currentTarget.style.borderColor = 'var(--border-default)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isWorking && !isAwaiting) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      {/* Main content row */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <AvatarPixels
        seed={session.avatarSeed}
        level={bs?.level}
        peakLevel={bs?.peakLevel}
        isShiny={bs?.isShiny}
        isDead={bs?.isDead}
        isWounded={isWounded}
        borderTierClass={borderInfo?.cssClass}
        onContextMenu={(e) => {
          if (onAvatarRightClick && bs) {
            e.preventDefault();
            e.stopPropagation();
            onAvatarRightClick(e);
          }
        }}
      />

      {/* Both rows stacked next to avatar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Row 1: Name + Branch + Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontWeight: 600,
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            maxWidth: '50%',
            flexShrink: 1,
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
              flexShrink: 2,
            }}>
              &#x2387; {session.branch}
            </span>
          )}
          <div style={{ marginLeft: 'auto', flexShrink: 0, width: 80 }}>
            <ContextBar percent={session.contextPercent} />
          </div>
        </div>

        {/* Row 2: Status + Time + Model */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 11,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          <span style={{ color: isAwaiting ? APPROVAL_COLOR : st.color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isAwaiting ? APPROVAL_COLOR : st.color,
              display: 'inline-block',
              flexShrink: 0,
            }} />
            {isAwaiting ? 'Waiting' : st.label}{isWorking && <AnimatedDots />}
          </span>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            {timeSince(session.lastActivity)}
          </span>
          {session.model && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.model}</span>
          )}
        </div>

        {/* Row 3: Battle info — Biome + Streak + Cost + Sword + Fallen */}
        {bs && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            fontSize: 10,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            {biome && !bs.isDead && (
              <span style={{ color: biome.color, fontWeight: 500 }}>
                {biome.name}
              </span>
            )}
            {bs.winStreak >= 2 && !bs.isDead && (
              <span style={{
                color: bs.winStreak >= 10 ? '#ef4444' : bs.winStreak >= 5 ? '#f97316' : '#facc15',
                fontWeight: 700, fontSize: 10,
                background: 'rgba(255,255,255,0.06)', borderRadius: 3,
                padding: '0 4px', lineHeight: '16px',
              }} title={`${bs.winStreak} win streak`}>
                {bs.winStreak}W
              </span>
            )}
            {bs.isDead && (
              <span style={{ color: '#666', fontWeight: 600 }} title="This agent has fallen">
                FALLEN
              </span>
            )}
            {battleApproaching && (
              <span className="sword-pulse" style={{ fontSize: 11 }} title="Battle approaching...">
                ⚔
              </span>
            )}
          </div>
        )}
      </div>
      </div>

      {/* XP bar — full width at bottom of card */}
      {bs && !bs.isDead && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, xpPct))}%`,
            background: biome ? biome.color : '#c084fc',
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}
    </div>
  );
}
