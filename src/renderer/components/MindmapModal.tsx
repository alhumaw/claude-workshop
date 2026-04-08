import React, { useState } from 'react';

interface Props {
  defaultDir: string;
  onClose: () => void;
  onGenerate: (projectDir: string) => void;
}

export function MindmapModal({ defaultDir, onClose, onGenerate }: Props) {
  const [projectDir, setProjectDir] = useState(defaultDir);

  const handleBrowse = async () => {
    const picked = await window.electronAPI.openFolderDialog();
    if (picked) setProjectDir(picked);
  };

  const handleGenerate = () => {
    if (!projectDir) return;
    onGenerate(projectDir);
    onClose();
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
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 24,
        width: 460,
        maxWidth: 'calc(100vw - 48px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Generate Mindmap
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Project directory field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Project Directory
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={projectDir}
              onChange={(e) => setProjectDir(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={handleBrowse}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Browse
            </button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Claude will read the source files and generate interlinked notes covering
            entry points, execution flow, module dependencies, and key data structures.
          </span>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!projectDir}
          style={{
            background: 'var(--status-idle)',
            border: 'none',
            borderRadius: 6,
            padding: '10px',
            color: '#000',
            fontWeight: 600,
            fontSize: 13,
            cursor: !projectDir ? 'not-allowed' : 'pointer',
            opacity: !projectDir ? 0.7 : 1,
          }}
        >
          Generate
        </button>
      </div>
    </div>
  );
}
