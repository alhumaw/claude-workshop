import React from 'react';

interface Props {
  percent: number;
}

const pulseKeyframes = `
@keyframes contextPulseAmber {
  0%, 100% { box-shadow: 0 0 4px 1px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 10px 3px rgba(245, 158, 11, 0.6); }
}
@keyframes contextPulseRed {
  0%, 100% { box-shadow: 0 0 4px 1px rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.8); }
}
`;

export function ContextBar({ percent }: Props) {
  const color =
    percent < 50 ? 'var(--context-bar-low)' :
    percent < 80 ? 'var(--context-bar-mid)' :
    'var(--context-bar-high)';

  const animation =
    percent >= 85 ? 'contextPulseRed 1.5s ease-in-out infinite' :
    percent >= 70 ? 'contextPulseAmber 2s ease-in-out infinite' :
    'none';

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{
          width: 48,
          height: 4,
          borderRadius: 2,
          background: 'var(--context-bar-bg)',
          overflow: 'hidden',
          animation,
        }}>
          <div style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: 2,
            background: color,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color,
          minWidth: 28,
          textAlign: 'right',
        }}>
          {percent}%
        </span>
      </div>
    </>
  );
}
