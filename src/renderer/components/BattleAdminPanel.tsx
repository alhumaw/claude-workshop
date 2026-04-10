import React, { useState } from 'react';
import { AgentBattleState } from '../../shared/types';

interface Props {
  sessionId: string;
  battleState: AgentBattleState;
  onClose: () => void;
}

const LEVEL_PRESETS = [
  { label: 'Lv.1', xp: 0 },
  { label: 'Lv.5 (Rookie)', xp: 100000 },
  { label: 'Lv.10 (Bronze)', xp: 1000000 },
  { label: 'Lv.15 (Iron)', xp: 1750000 },
  { label: 'Lv.20 (Silver)', xp: 2500000 },
  { label: 'Lv.30 (Gold)', xp: 4000000 },
  { label: 'Lv.40 (Platinum)', xp: 5500000 },
  { label: 'Lv.50 (Diamond)', xp: 7000000 },
  { label: 'Lv.60 (Mythic)', xp: 8500000 },
  { label: 'Lv.75 (Legendary)', xp: 10750000 },
  { label: 'Lv.90 (Ascended)', xp: 13000000 },
  { label: 'Lv.100 (Eternal)', xp: 14500000 },
];

export function BattleAdminPanel({ sessionId, battleState: bs, onClose }: Props) {
  const [xpInput, setXpInput] = useState(String(bs.xp));
  const [status, setStatus] = useState('');

  const run = async (cmd: string, value?: number) => {
    setStatus(`${cmd}...`);
    const res = await window.electronAPI.battleAdmin(sessionId, cmd, value);
    setStatus(res.ok ? `${cmd} OK` : `${cmd} failed: ${res.error}`);
  };

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 10,
    borderRadius: 4,
    border: '1px solid var(--border-default)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 500,
  };

  const dangerBtn: React.CSSProperties = { ...btnStyle, borderColor: '#ef4444', color: '#ef4444' };
  const successBtn: React.CSSProperties = { ...btnStyle, borderColor: '#4ade80', color: '#4ade80' };
  const accentBtn: React.CSSProperties = { ...btnStyle, borderColor: 'var(--accent)', color: 'var(--accent)' };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: 16,
        width: 340,
        maxHeight: '80vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            Battle Admin
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>
            x
          </button>
        </div>

        {/* Current state summary */}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: 8, borderRadius: 6 }}>
          Lv.{bs.level} | {bs.xp.toLocaleString()} XP | Morale {bs.morale}/3 | {bs.wins}W-{bs.losses}L
          {bs.isShiny && ' | SHINY'}{bs.isDead && ' | DEAD'}
        </div>

        {/* XP Controls */}
        <Section title="XP / Level">
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={xpInput}
              onChange={(e) => setXpInput(e.target.value)}
              style={{
                flex: 1, padding: '4px 6px', fontSize: 11, borderRadius: 4,
                border: '1px solid var(--border-default)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button style={accentBtn} onClick={() => run('set-xp', parseInt(xpInput) || 0)}>Set XP</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {LEVEL_PRESETS.map((p) => (
              <button
                key={p.label}
                style={{ ...btnStyle, fontSize: 9, padding: '2px 5px' }}
                onClick={() => { setXpInput(String(p.xp)); run('set-xp', p.xp); }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Morale */}
        <Section title="Morale">
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3].map((m) => (
              <button
                key={m}
                style={m === 0 ? dangerBtn : btnStyle}
                onClick={() => run('set-morale', m)}
              >
                {m}
              </button>
            ))}
          </div>
        </Section>

        {/* Actions */}
        <Section title="Actions">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button style={accentBtn} onClick={() => run('trigger-battle')}>Trigger Battle</button>
            <button style={{ ...accentBtn, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => run('trigger-boss')}>Trigger Boss</button>
            <button style={btnStyle} onClick={() => run('toggle-shiny')}>
              {bs.isShiny ? 'Remove Shiny' : 'Make Shiny'}
            </button>
            <button style={btnStyle} onClick={() => run('reveal-stats')}>Reveal Stats</button>
            <button style={btnStyle} onClick={() => run('reroll')}>Reroll Stats</button>
            <button style={dangerBtn} onClick={() => run('kill')}>Kill Agent</button>
            <button style={successBtn} onClick={() => run('revive')}>Revive Agent</button>
            <button style={dangerBtn} onClick={() => run('reset')}>Reset All</button>
          </div>
        </Section>

        {/* Status */}
        {status && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
