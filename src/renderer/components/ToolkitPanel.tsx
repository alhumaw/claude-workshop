import React, { useState } from 'react';
import { useSessionStore } from '../stores/session-store';
import { MindmapModal } from './MindmapModal';

interface Props {
  activeSessionId: string | null;
}

export function ToolkitPanel({ activeSessionId }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const handoffSession = useSessionStore((s) => s.handoffSession);
  const freshSession = useSessionStore((s) => s.freshSession);
  const [handingOff, setHandingOff] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId)
    : null;
  const isExited = activeSession?.status === 'exited';
  const handoffDisabled = !activeSessionId || isExited || handingOff;
  const freshDisabled = !activeSessionId;

  const handleHandoff = async () => {
    if (!activeSessionId || handoffDisabled) return;
    setHandingOff(true);
    try {
      await handoffSession(activeSessionId);
    } finally {
      setHandingOff(false);
    }
  };

  const handleFresh = async () => {
    if (!activeSessionId || freshDisabled) return;
    await freshSession(activeSessionId);
  };

  const handleMindmapGenerate = async (projectDir: string) => {
    setGenerating(true);
    setExportError(null);
    try {
      const result = await window.electronAPI.exportToObsidian(projectDir);
      if (!result.ok) {
        if (result.error === 'no-vault') {
          setExportError('No vault configured — open ⚙ Settings to set your Obsidian vault path.');
        } else if (result.error === 'vault-not-found') {
          setExportError('Vault directory not found. Check your path in ⚙ Settings.');
        } else {
          setExportError(result.error ?? 'Export failed.');
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border-default)',
      padding: '12px',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        Toolkit
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
      }}>
        <ToolkitButton
          label={handingOff ? 'Handing off...' : 'Handoff & Reset'}
          icon="⤴"
          disabled={handoffDisabled}
          onClick={handleHandoff}
        />
        <ToolkitButton
          label="Fresh Session"
          icon="+"
          disabled={freshDisabled}
          onClick={handleFresh}
        />
        <ToolkitButton
          label={generating ? 'Generating...' : 'Generate Mindmap'}
          disabled={!activeSessionId || generating}
          onClick={() => { setExportError(null); setShowMindmap(true); }}
        />
      </div>

      {exportError && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: 'var(--status-exited)',
          lineHeight: 1.5,
        }}>
          {exportError}
        </div>
      )}

      {showMindmap && (
        <MindmapModal
          defaultDir={activeSession?.cwd ?? ''}
          onClose={() => setShowMindmap(false)}
          onGenerate={handleMindmapGenerate}
        />
      )}
    </div>
  );
}

function ToolkitButton({ label, icon, disabled, onClick }: {
  label: string;
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 10px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 6,
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s, opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--bg-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
