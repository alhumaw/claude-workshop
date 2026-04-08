import React from 'react';

interface Props {
  onClose: () => void;
}

interface Section {
  title: string;
  items: { label: string; description: string }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Sessions',
    items: [
      { label: 'New session', description: 'Click + in the sidebar header or press Cmd+N. Choose a name and working directory for the new Claude Code session.' },
      { label: 'Switch session', description: 'Click any session card in the sidebar, or press Cmd+1–9 to jump by index, Cmd+[ for previous, Cmd+] for next.' },
      { label: 'Rename / customize', description: 'Right-click a session card and choose Rename Session. You can also randomize its pixel avatar from the same popover.' },
      { label: 'End session', description: 'Right-click a session card and choose End Session, or press Cmd+W to close the active session.' },
      { label: 'Resize sidebar', description: 'Drag the divider between the terminal and sidebar left or right.' },
    ],
  },
  {
    title: 'Toolkit',
    items: [
      { label: 'Handoff & Reset', description: 'Captures the active session\'s terminal buffer, asks Claude to write a handoff summary, kills the session, then spawns a fresh one in the same directory with the handoff loaded in.' },
      { label: 'Fresh Session', description: 'Spawns a second session in the same working directory without ending the current one. Useful for running parallel tasks.' },
      { label: 'Generate Mindmap', description: 'Opens a dialog pre-filled with the active session\'s working directory. Confirm or change the path, then click Generate. Claude reads the project\'s source files and writes interlinked Markdown notes to your Obsidian vault covering entry points, execution flow, module dependencies, and key data structures — giving you a navigable visual map of how the codebase works.' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Obsidian vault path', description: 'Open Settings (⚙) and enter the path to your Obsidian vault directory, or click Browse to pick one. Saved to ~/.agentmux/config.json. Used by Generate Mindmap.' },
    ],
  },
  {
    title: 'Context bar',
    items: [
      { label: 'What it shows', description: 'Each session card displays a small bar showing how full Claude\'s context window is. Green = plenty of room, amber = getting full, red (pulsing) = nearly exhausted.' },
      { label: 'When to handoff', description: 'When the bar hits ~80–90%, use Handoff & Reset to continue the work in a fresh session before Claude starts losing earlier context.' },
    ],
  },
  {
    title: 'Keyboard shortcuts',
    items: [
      { label: 'Cmd+N', description: 'Open new session dialog.' },
      { label: 'Cmd+W', description: 'Close the active session.' },
      { label: 'Cmd+1–9', description: 'Jump to session by position in the list.' },
      { label: 'Cmd+[', description: 'Switch to the previous session.' },
      { label: 'Cmd+]', description: 'Switch to the next session.' },
    ],
  },
];

export function HelpModal({ onClose }: Props) {
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
        width: 480,
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 96px)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header — fixed */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Help
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

        {/* Scrollable content */}
        <div style={{
          overflowY: 'auto',
          padding: '16px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}>
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.items.map((item) => (
                  <div key={item.label} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
