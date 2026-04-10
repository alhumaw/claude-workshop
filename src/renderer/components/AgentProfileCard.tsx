import React, { useEffect, useRef, useState } from 'react';
import { SessionInfo, AgentBattleState } from '../../shared/types';
import { deriveStats, getRawStatMultipliers, getStatRating } from '../../shared/battle-utils';
import { AvatarPixels } from './AvatarPixels';

interface Props {
  session: SessionInfo;
  position: { x: number; y: number };
  onClose: () => void;
}

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

function getTitlePrefix(level: number): string {
  if (level >= 100) return 'Eternal';
  if (level >= 90)  return 'Ascended';
  if (level >= 75)  return 'Legendary';
  if (level >= 60)  return 'Mythic';
  if (level >= 50)  return 'Diamond';
  if (level >= 40)  return 'Platinum';
  if (level >= 30)  return 'Gold';
  if (level >= 20)  return 'Silver';
  if (level >= 15)  return 'Iron';
  if (level >= 10)  return 'Bronze';
  if (level >= 5)   return 'Rookie';
  return '';
}

const LEVEL_THRESHOLDS = [0, 10000, 25000, 50000, 100000, 175000, 275000, 400000, 600000, 1000000];

function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 500000;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  thinker:    { label: 'Thinker',    icon: '🧠', desc: 'DEF dominant — outlasts opponents' },
  generator:  { label: 'Generator',  icon: '⚡', desc: 'ATK dominant — hits hard' },
  researcher: { label: 'Researcher', icon: '📚', desc: 'HP dominant — absorbs damage' },
  debugger:   { label: 'Debugger',   icon: '🐛', desc: 'SPD dominant — fast and tricky' },
};

const MILESTONE_BADGES: Record<string, string> = {
  'First Blood': '⚔',
  'Untouchable': '🛡',
  'Streak Master': '🔥',
  'Completionist': '📖',
  'Dragon Slayer': '🐉',
  'Shiny Hunter': '✨',
  'Centurion': '👑',
};

export function AgentProfileCard({ session, position, onClose }: Props) {
  const bs = session.battleState;
  const ref = useRef<HTMLDivElement>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (!bs) {
    return (
      <div ref={ref} style={{
        position: 'fixed', left: position.x, top: position.y, zIndex: 2000,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
        borderRadius: 10, padding: 16, fontSize: 12, color: 'var(--text-muted)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        No battle data (team agent or battles disabled)
      </div>
    );
  }

  const borderInfo = getBorderInfo(bs.level);
  const titlePrefix = getTitlePrefix(bs.level);
  const typeInfo = TYPE_LABELS[bs.type] || TYPE_LABELS.thinker;
  const winRate = bs.wins + bs.losses > 0 ? Math.round((bs.wins / (bs.wins + bs.losses)) * 100) : 0;

  // XP progress to next level
  const currentLevelXp = xpForLevel(bs.level);
  const nextLevelXp = xpForLevel(bs.level + 1);
  const xpProgress = nextLevelXp > currentLevelXp
    ? ((bs.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
    : 100;

  const moraleDisplay = `${Math.min(3, bs.morale)}/3`;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 280),
        top: Math.min(position.y, window.innerHeight - 400),
        zIndex: 2000,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 16,
        width: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header: Avatar + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => setShowAvatarPreview(true)}
          style={{ cursor: 'pointer' }}
          title="Click to enlarge"
        >
          <AvatarPixels
            seed={session.avatarSeed}
            size={48}
            level={bs.level}
            peakLevel={bs.peakLevel}
            isShiny={bs.isShiny}
            isDead={bs.isDead}
            borderTierClass={borderInfo?.cssClass}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: 13, color: bs.isDead ? '#666' : 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {bs.isShiny && '✦ '}
            {titlePrefix ? `${titlePrefix} ` : ''}{bs.battleName}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{typeInfo.icon}</span>
            <span>{typeInfo.label}</span>
            {bs.isDead && <span style={{ color: '#ef4444', fontWeight: 600 }}>FALLEN</span>}
          </div>
        </div>
      </div>

      {/* Type description */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {typeInfo.desc}
      </div>

      {/* Level + XP bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Level {bs.level}</span>
          <span style={{ color: 'var(--text-muted)' }}>{bs.xp.toLocaleString()} XP</span>
        </div>
        <div style={{
          height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${Math.min(100, xpProgress)}%`,
            background: 'var(--status-idle)', borderRadius: 2,
          }} />
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
          {(nextLevelXp - bs.xp).toLocaleString()} XP to Lv.{bs.level + 1}
        </div>
      </div>

      {/* W-L Record */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--text-primary)' }}>
          {bs.wins}W - {bs.losses}L
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({winRate}%)</span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Morale: {moraleDisplay}
        </span>
      </div>

      {/* Stats (shown progressively) */}
      {bs.battlesCompleted > 0 && (() => {
        const stats = deriveStats(session.avatarSeed, bs.level, bs.isShiny);
        const rawMults = getRawStatMultipliers(session.avatarSeed);
        // Max possible stat at this level (for bar scaling): elite (1.45) * type bonus (1.25) * shiny (1.25)
        const maxBase = (10 + bs.level * 3);
        const maxHp = Math.floor(maxBase * 3 * 1.45 * 1.25 * (bs.isShiny ? 1.25 : 1));
        const maxOther = Math.floor(maxBase * 1.45 * 1.25 * (bs.isShiny ? 1.25 : 1));

        const statDefs = [
          { key: 'hp' as const, label: 'HP', value: stats.hp, max: maxHp, color: '#4ade80', mult: rawMults.hp },
          { key: 'atk' as const, label: 'ATK', value: stats.atk, max: maxOther, color: '#ef4444', mult: rawMults.atk },
          { key: 'def' as const, label: 'DEF', value: stats.def, max: maxOther, color: '#60a5fa', mult: rawMults.def },
          { key: 'spd' as const, label: 'SPD', value: stats.spd, max: maxOther, color: '#facc15', mult: rawMults.spd },
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Stats {bs.revealedStats.length < 4 ? `(${bs.revealedStats.length}/4 revealed)` : ''}
            </div>
            {statDefs.map(({ key, label, value, max, color, mult }) => {
              const revealed = bs.revealedStats.includes(key);
              const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
              const rating = getStatRating(mult);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ width: 26, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {label}
                  </span>
                  <div style={{
                    flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden',
                  }}>
                    {revealed ? (
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 2, background: color,
                        transition: 'width 0.3s ease',
                      }} />
                    ) : (
                      <div style={{
                        height: '100%', width: '100%', borderRadius: 2,
                        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 4px, transparent 4px, transparent 8px)',
                      }} />
                    )}
                  </div>
                  <span style={{ width: 50, textAlign: 'right', fontSize: 9, color: revealed ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {revealed ? `${value} ${rating}` : '???'}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Extra stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        <span>Streak: {bs.winStreak} (best: {bs.bestStreak})</span>
        <span>Bosses: {bs.bossKills}</span>
      </div>

      {/* Milestones */}
      {bs.milestones.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {bs.milestones.map((m) => (
            <span
              key={m}
              title={m}
              style={{ fontSize: 14, cursor: 'default' }}
            >
              {MILESTONE_BADGES[m] || '🏆'}
            </span>
          ))}
        </div>
      )}

      {/* Battles completed */}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
        {bs.battlesCompleted} battles fought
      </div>
      {/* Full-size avatar preview overlay */}
      {showAvatarPreview && (
        <div
          onClick={() => setShowAvatarPreview(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            cursor: 'pointer',
          }}
        >
          <AvatarPixels
            seed={session.avatarSeed}
            size={200}
            peakLevel={bs.peakLevel}
            isShiny={bs.isShiny}
            isDead={bs.isDead}
            borderTierClass={borderInfo?.cssClass}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: bs.isDead ? '#666' : 'var(--text-primary)',
            }}>
              {bs.isShiny && '✦ '}
              {titlePrefix ? `${titlePrefix} ` : ''}{bs.battleName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Lv.{bs.level} {typeInfo.icon} {typeInfo.label}
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            click anywhere to close
          </div>
        </div>
      )}
    </div>
  );
}
