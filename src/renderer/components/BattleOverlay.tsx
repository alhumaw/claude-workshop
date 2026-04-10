import React, { useEffect, useRef, useState } from 'react';
import { BattleResultInfo } from '../../shared/types';
import { AvatarPixels } from './AvatarPixels';
import { MobSprite } from './MobSprite';

export interface BattleToast {
  id: number;
  sessionId: string;
  avatarSeed: string;
  sessionName: string;
  result: BattleResultInfo;
  biomeColor?: string;
  biomeName?: string;
}

interface Props {
  toasts: BattleToast[];
  onDismiss: (id: number) => void;
}

/**
 * Fixed-position toast stack at the bottom of the sidebar.
 * Each toast slides up, shows for 5 seconds, then fades out.
 */
export function BattleToastStack({ toasts, onDismiss }: Props) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 48, // above the footer shortcuts bar
      left: 8,
      right: 8,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 6,
      pointerEvents: 'none',
      zIndex: 200,
    }}>
      {toasts.map((toast) => (
        <BattleToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function BattleToastItem({ toast, onDismiss }: { toast: BattleToast; onDismiss: (id: number) => void }) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'hit1' | 'hit2' | 'result' | 'exit'>('enter');
  const [agentHpPct, setAgentHpPct] = useState(100);
  const [mobHpPct, setMobHpPct] = useState(100);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const idRef = useRef(toast.id);

  const { result } = toast;

  useEffect(() => {
    const agentFinal = result.won ? Math.max(8, (result.agentHpRemaining / result.agentHpMax) * 100) : 0;
    const mobFinal = result.won ? 0 : Math.max(8, 40);

    // Timeline: enter → visible → hit1 (agent attacks) → hit2 (mob attacks) → result → exit
    const t0 = setTimeout(() => setPhase('visible'), 50);
    const t1 = setTimeout(() => {
      setPhase('hit1');
      setMobHpPct(result.won ? mobFinal + 30 : Math.min(100, mobFinal + 50));
    }, 800);
    const t2 = setTimeout(() => {
      setPhase('hit2');
      setAgentHpPct(result.won ? Math.min(100, agentFinal + 20) : agentFinal);
      setMobHpPct(result.won ? mobFinal : Math.min(100, mobFinal + 20));
    }, 2000);
    const t3 = setTimeout(() => {
      setAgentHpPct(agentFinal);
      setMobHpPct(mobFinal);
    }, 3200);
    const t4 = setTimeout(() => setPhase('result'), 3800);
    const t5 = setTimeout(() => setPhase('exit'), 5500);
    const t6 = setTimeout(() => onDismissRef.current(idRef.current), 6000);

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const won = result.won;
  const accentColor = toast.biomeColor
    ? `${toast.biomeColor}80` // biome color with 50% alpha
    : won ? 'rgba(74, 222, 128, 0.5)' : 'rgba(239, 68, 68, 0.5)';
  const textColor = won ? '#4ade80' : '#ef4444';

  const isHit1 = phase === 'hit1';
  const isHit2 = phase === 'hit2';
  const showResult = phase === 'result' || phase === 'exit';

  return (
    <div style={{
      background: 'rgba(20, 20, 20, 0.95)',
      borderRadius: 8,
      padding: '8px 10px',
      border: `1px solid ${accentColor}`,
      boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 12px ${accentColor}`,
      pointerEvents: 'auto',
      opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
      transform: phase === 'enter' ? 'translateY(20px)' : isHit1 || isHit2 ? 'translateX(1px)' : 'translateY(0)',
      transition: 'opacity 0.3s ease, transform 0.15s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      {/* Top row: type tag + agent name */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: 0.8,
          color: result.mobIsBoss ? '#ef4444' : result.mobIsRare ? '#FFD700' : 'var(--text-muted)',
          textTransform: 'uppercase',
        }}>
          {result.mobIsBoss ? 'Boss' : result.mobIsRare ? 'Rare' : toast.biomeName || 'Battle'}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          {toast.sessionName}
        </span>
      </div>

      {/* Main row: agent sprite + HP bars + mob sprite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          filter: isHit2 ? 'brightness(2)' : 'none',
          transition: 'filter 0.15s ease',
        }}>
          <AvatarPixels seed={toast.avatarSeed} size={22} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <HpBar pct={agentHpPct} color="#4ade80" />
          <HpBar pct={mobHpPct} color="#ef4444" />
        </div>

        <div style={{
          filter: isHit1 ? 'brightness(2)' : 'none',
          transition: 'filter 0.15s ease',
        }}>
          <MobSprite name={result.mobName} size={22} isBoss={result.mobIsBoss} isRare={result.mobIsRare} />
        </div>
      </div>

      {/* Bottom row: result + mob name + XP */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {showResult ? (
          <>
            <span style={{
              fontSize: 12, fontWeight: 700, color: textColor,
              textShadow: `0 0 8px ${textColor}`,
              animation: 'battleFlash 0.4s ease-in-out 2',
            }}>
              {won ? 'Victory!' : 'Defeated'}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: won ? '#4ade80' : '#ef4444' }}>
              {won ? `+${result.xpGained}` : `-${result.xpLost}`} XP
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              Lv.{result.mobLevel} {result.mobName}
            </span>
            {(isHit1 || isHit2) && (
              <span style={{ fontSize: 10, fontWeight: 700, color: isHit1 ? '#ef4444' : '#facc15', animation: 'battleFlash 0.2s ease-in-out' }}>
                HIT
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HpBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      width: '100%',
      height: 3,
      background: 'rgba(255,255,255,0.08)',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: color,
        borderRadius: 2,
        transition: 'width 0.8s ease-out',
      }} />
    </div>
  );
}
