import React, { useState, useRef, useEffect } from 'react';
import { AvatarPixels } from './AvatarPixels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, cwd?: string, avatarSeed?: string) => void;
}

export function NewSessionModal({ isOpen, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36));
  const [cwdInvalid, setCwdInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cwdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCwd('');
      setCwdInvalid(false);
      setAvatarSeed(Math.random().toString(36));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedCwd = cwd.trim();
    if (trimmedCwd) {
      const valid = await window.electronAPI.validateDirectory(trimmedCwd);
      if (!valid) {
        setCwdInvalid(true);
        cwdRef.current?.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-6px)' },
            { transform: 'translateX(6px)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(4px)' },
            { transform: 'translateX(-2px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 350, easing: 'ease-out' },
        );
        return;
      }
    }

    onCreate(name.trim(), trimmedCwd || undefined, avatarSeed);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AvatarPixels seed={avatarSeed} size={96} />
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 4,
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          {avatarSeed.slice(0, 8)}
        </div>

        <button
          onClick={() => setAvatarSeed(Math.random().toString(36))}
          style={{
            display: 'block',
            margin: '0 auto 20px',
            padding: '4px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          🎲 Randomize
        </button>

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Agent Name
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-project"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-active)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Working Directory (optional)
          </label>
          <input
            ref={cwdRef}
            value={cwd}
            onChange={(e) => { setCwd(e.target.value); setCwdInvalid(false); }}
            placeholder="~/dev/my-project"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-primary)',
              border: `1px solid ${cwdInvalid ? '#e53935' : 'var(--border-default)'}`,
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              marginBottom: 20,
              transition: 'border-color 0.2s',
            }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 6,
                color: '#1a1a1a',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: name.trim() ? 1 : 0.5,
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
