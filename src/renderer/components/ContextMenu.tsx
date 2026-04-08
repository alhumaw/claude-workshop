import React, { useEffect, useRef } from 'react';

interface MenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '4px 0',
        minWidth: 200,
        zIndex: 2000,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} style={{
            height: 1,
            background: 'var(--border-default)',
            margin: '4px 8px',
          }} />
        ) : (
          <div
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              color: item.danger ? '#ef4444' : 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {item.icon && <span style={{ width: 16 }}>{item.icon}</span>}
            {item.label}
          </div>
        )
      )}
    </div>
  );
}
