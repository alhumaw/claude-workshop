import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SessionInfo } from '../../shared/types';
import { AvatarPixels, getAvatarTraits } from './AvatarPixels';

interface Props {
  session: SessionInfo;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onRename: (name: string) => void;
  onRandomize: () => void;
  onClose: () => void;
}

export function AgentPopover({ session, anchorRef, onRename, onRandomize, onClose }: Props) {
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position relative to anchor element
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.top,
        left: rect.left - 228, // 220 width + 8 margin
      });
    }
  }, [anchorRef]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        commit();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [draft]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    onClose();
  };

  const traits = getAvatarTraits(session.avatarSeed);

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: Math.max(8, pos.left),
        width: 220,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 16,
        zIndex: 2000,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Large avatar */}
      <AvatarPixels seed={session.avatarSeed} size={140} />

      {/* Trait description */}
      <span style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        {traits}
      </span>

      {/* Randomize button */}
      <button
        onClick={onRandomize}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          fontSize: 12,
          padding: '5px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
      >
        Randomize
      </button>

      {/* Agent name input */}
      <div style={{ width: '100%' }}>
        <label style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 4,
        }}>
          Agent Name
        </label>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') onClose();
          }}
          style={{
            width: '100%',
            background: 'var(--bg-primary)',
            border: '1px solid var(--accent)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 13,
            padding: '6px 8px',
            outline: 'none',
          }}
        />
      </div>
    </div>,
    document.body
  );
}
