import React from 'react';
import { AgentBattleState } from '../../shared/types';
import { MobSprite } from './MobSprite';

interface Props {
  battleState: AgentBattleState;
  onClose: () => void;
}

// All mob species — must match battle-engine.ts
const ALL_COMMON = ['File Gremlin', 'Null Pointer', 'Syntax Error', 'Type Mismatch', 'Import Cycle', 'Stale Cache', 'Lint Violation', 'Flaky Test'];
const ALL_UNCOMMON = ['Race Condition', 'Memory Leak', 'Stack Overflow', 'Circular Dependency', 'Phantom Read'];
const ALL_BOSSES = ['The Legacy Codebase', 'The OOM Killer', 'The Deadlock', 'The Infinite Loop', 'The Segfault Demon', 'The Rate Limiter', 'The Merge Conflict From Hell'];

export function Bestiary({ battleState: bs, onClose }: Props) {
  const allMobs = [...ALL_COMMON, ...ALL_UNCOMMON];
  const discovered = Object.keys(bs.bestiary);
  const totalSpecies = allMobs.length + ALL_BOSSES.length;
  const discoveredCount = allMobs.filter(m => discovered.includes(m)).length + ALL_BOSSES.filter(m => discovered.includes(m)).length;

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
        borderRadius: 12, padding: 16, width: 420, maxHeight: '75vh',
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Bestiary</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{discoveredCount}/{totalSpecies} discovered</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>x</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Regular mobs */}
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Mobs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {allMobs.map((name) => {
              const data = bs.bestiary[name];
              const found = !!data;
              const winRate = data && data.encountered > 0 ? Math.round((data.defeated / data.encountered) * 100) : 0;
              return (
                <div key={name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: 6, borderRadius: 6, background: 'var(--bg-card)',
                  opacity: found ? 1 : 0.3,
                }}>
                  <MobSprite name={name} size={28} isRare={data?.rare} />
                  <span style={{ fontSize: 8, color: found ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                    {found ? name : '???'}
                  </span>
                  {found && (
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                      {data.encountered}x | {winRate}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bosses */}
          <div style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>Bosses</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ALL_BOSSES.map((name) => {
              const data = bs.bestiary[name];
              const found = !!data;
              return (
                <div key={name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: 8, borderRadius: 6, background: 'var(--bg-card)',
                  border: found ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                  opacity: found ? 1 : 0.3,
                }}>
                  <MobSprite name={name} size={36} isBoss />
                  <span style={{ fontSize: 8, color: found ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                    {found ? name : '???'}
                  </span>
                  {found && (
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                      {data.defeated} defeated
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
