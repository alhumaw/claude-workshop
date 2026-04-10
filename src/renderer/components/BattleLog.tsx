import React from 'react';
import { AgentBattleState, BattleResultInfo } from '../../shared/types';

interface Props {
  battleState: AgentBattleState;
  onClose: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#888',
  uncommon: '#4ade80',
  rare: '#c084fc',
  legendary: '#FFD700',
};

export function BattleLog({ battleState: bs, onClose }: Props) {
  const log = [...(bs.battleLog || [])].reverse();

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
        borderRadius: 12, padding: 16, width: 380, maxHeight: '70vh',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Battle Log</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>x</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              No battles yet
            </div>
          )}
          {log.map((entry, i) => (
            <div key={i} style={{
              padding: '6px 8px', borderRadius: 6, fontSize: 11,
              background: 'var(--bg-card)', border: '1px solid var(--border-default)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: entry.won ? '#4ade80' : '#ef4444' }}>
                  {entry.won ? 'Victory' : 'Defeated'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                  {entry.mobIsBoss ? 'BOSS' : entry.mobIsRare ? 'RARE' : ''}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                vs Lv.{entry.mobLevel} {entry.mobName}
              </div>
              <div style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: 10 }}>
                {entry.won && <span style={{ color: '#4ade80' }}>+{entry.xpGained} XP</span>}
                {!entry.won && entry.xpLost > 0 && <span style={{ color: '#ef4444' }}>-{entry.xpLost} XP</span>}
                <span>HP: {entry.agentHpRemaining}/{entry.agentHpMax}</span>
                <span>{entry.roundCount} rounds</span>
                {entry.lootDrop && (
                  <span style={{ color: RARITY_COLORS[entry.lootDrop.rarity] || '#888' }}>
                    +{entry.lootDrop.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
