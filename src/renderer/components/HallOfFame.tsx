import React, { useEffect, useState } from 'react';
import { HallOfFameEntry } from '../../shared/types';
import { AvatarPixels } from './AvatarPixels';

interface Props {
  onClose: () => void;
}

function getTitlePrefix(level: number): string {
  if (level >= 100) return 'Eternal';
  if (level >= 90) return 'Ascended';
  if (level >= 75) return 'Legendary';
  if (level >= 60) return 'Mythic';
  if (level >= 50) return 'Diamond';
  if (level >= 40) return 'Platinum';
  if (level >= 30) return 'Gold';
  if (level >= 20) return 'Silver';
  if (level >= 15) return 'Iron';
  if (level >= 10) return 'Bronze';
  if (level >= 5) return 'Rookie';
  return '';
}

export function HallOfFame({ onClose }: Props) {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.loadHallOfFame().then((data: HallOfFameEntry[]) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
        borderRadius: 12, padding: 16, width: 400, maxHeight: '75vh',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Hall of Fame</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>x</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Loading...</div>}
          {!loading && entries.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              No retired agents yet
            </div>
          )}
          {entries.map((entry, i) => {
            const title = getTitlePrefix(entry.level);
            const winRate = entry.wins + entry.losses > 0 ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) : 0;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
              }}>
                <AvatarPixels seed={entry.avatarSeed} size={36} level={entry.level} peakLevel={entry.peakLevel} isShiny={entry.isShiny} isDead />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.isShiny && '✦ '}{title ? `${title} ` : ''}{entry.battleName}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    <span>Lv.{entry.level}</span>
                    <span>{entry.wins}W-{entry.losses}L ({winRate}%)</span>
                    <span>Bosses: {entry.bossKills}</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {entry.causeOfDeath === 'permadeath' ? 'Fell in battle' : 'Session ended'}
                    {entry.milestones.length > 0 && ` | ${entry.milestones.join(', ')}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
