import React, { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [vaultPath, setVaultPath] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg: any) => {
      setVaultPath(cfg.vaultPath ?? '');
    });
  }, []);

  const handleChooseFolder = async () => {
    const picked = await window.electronAPI.openFolderDialog();
    if (picked) {
      setVaultPath(picked);
      setError('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const result = await window.electronAPI.setConfig({ vaultPath });
    setSaving(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? 'Unknown error');
    }
  };

  return (
    // Full-screen overlay
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
      {/* Modal card */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 24,
        width: 420,
        maxWidth: 'calc(100vw - 48px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Settings
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

        {/* Vault path field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Obsidian Vault Path
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={vaultPath}
              onChange={(e) => { setVaultPath(e.target.value); setError(''); }}
              placeholder="~/Documents/MyVault"
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: error ? '1px solid var(--status-exited)' : '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleChooseFolder}
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
          {error && (
            <span style={{ fontSize: 11, color: 'var(--status-exited)' }}>
              {error}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Exports will be saved as a dated folder inside this vault.
          </span>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--status-idle)',
            border: 'none',
            borderRadius: 6,
            padding: '10px',
            color: '#000',
            fontWeight: 600,
            fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
