import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../stores/session-store';

interface Props {
  teamName: string;
  defaultCwd: string;
  onClose: () => void;
}

function suggestPromptPath(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const role = trimmed.replace(/-\d+$/, '').toLowerCase();
  return `~/.claude/prompts/${role}/PROMPT.md`;
}

const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'claude-4-6-opus', label: 'Opus 4.6' },
  { value: 'claude-4-6-opus[1m]', label: 'Opus 4.6 Long Context' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'claude-4-6-sonnet[1m]', label: 'Sonnet Long Context' },
  { value: 'haiku', label: 'Haiku' },
];

export function AddTeamMemberModal({ teamName, defaultCwd, onClose }: Props) {
  const addTeamMember = useSessionStore((s) => s.addTeamMember);
  const [name, setName] = useState('');
  const [model, setModel] = useState('sonnet');
  const [cwd, setCwd] = useState(defaultCwd);
  const [promptFile, setPromptFile] = useState('');
  const [promptManual, setPromptManual] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setName('');
    setModel('sonnet');
    setCwd(defaultCwd);
    setPromptFile('');
    setPromptManual(false);
    setPromptFile('');
    setAdding(false);
  }, [defaultCwd]);

  const handleBrowse = async () => {
    const picked = await window.electronAPI.openFileDialog();
    if (picked) { setPromptFile(picked); setPromptManual(true); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await addTeamMember(teamName, {
        name: name.trim(),
        agentType: 'general-purpose',
        model: model || undefined,
        cwd: cwd.trim() || defaultCwd,
        promptFile: promptFile.trim() || undefined,
      });
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-default)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 380,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Add to {teamName}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
          }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Agent Name
            </label>
            <input value={name} onChange={(e) => {
              setName(e.target.value);
              if (!promptManual) setPromptFile(suggestPromptPath(e.target.value));
            }}
              placeholder="writer-1" style={inputStyle} autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Model
            </label>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle}>
              {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Working Directory
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={cwd} onChange={(e) => setCwd(e.target.value)}
                placeholder={defaultCwd} style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={async () => {
                const picked = await window.electronAPI.openFolderDialog();
                if (picked) setCwd(picked);
              }} style={{
                padding: '8px 12px', background: 'var(--bg-card)',
                border: '1px solid var(--border-default)', borderRadius: 6,
                color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', flexShrink: 0,
              }}>Browse</button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Prompt File (optional)
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={promptFile} onChange={(e) => { setPromptFile(e.target.value); setPromptManual(true); }}
                placeholder="path/to/prompt.md" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} />
              <button type="button" onClick={handleBrowse} style={{
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
              }}>
                Browse
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={adding || !name.trim()} style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: '#1a1a1a',
              fontSize: 13,
              fontWeight: 600,
              cursor: (adding || !name.trim()) ? 'not-allowed' : 'pointer',
              opacity: (adding || !name.trim()) ? 0.5 : 1,
            }}>
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
