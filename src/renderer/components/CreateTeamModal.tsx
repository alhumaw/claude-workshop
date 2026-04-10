import React, { useEffect, useState } from 'react';

interface TeamTemplateMember {
  name: string;
  model: string;
  promptPath: string;
}

interface TeamTemplate {
  id: string;
  label: string;
  description: string;
  members: TeamTemplateMember[];
}

const BUILT_IN_TEMPLATES: TeamTemplate[] = [
  {
    id: 'small-coding',
    label: 'Small Coding Team',
    description: '10 agents: coder, reviewer, QA, security, docs, testing, advocacy',
    members: [
      { name: 'coder-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'cqa-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/code-quality-analyst/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/code-reviewer/PROMPT.md' },
      { name: 'dev-advocate-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/developer-advocate/PROMPT.md' },
      { name: 'cust-advocate-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/customer-advocate/PROMPT.md' },
      { name: 'sec-analyst-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-analyst/PROMPT.md' },
      { name: 'sec-researcher-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'debugger-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/debugger/PROMPT.md' },
      { name: 'tester-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/tester/PROMPT.md' },
      { name: 'tech-writer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
    ],
  },
  {
    id: 'large-coding',
    label: 'Large Coding Team',
    description: '19 agents: coders, reviewers, QA, security, debugging, testing, docs',
    members: [
      { name: 'coder-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'coder-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'coder-3', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'coder-4', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'cqa-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/code-quality-analyst/PROMPT.md' },
      { name: 'cqa-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/code-quality-analyst/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/code-reviewer/PROMPT.md' },
      { name: 'reviewer-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/code-reviewer/PROMPT.md' },
      { name: 'sec-analyst-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-analyst/PROMPT.md' },
      { name: 'sec-analyst-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-analyst/PROMPT.md' },
      { name: 'sec-researcher-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'debugger-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/debugger/PROMPT.md' },
      { name: 'debugger-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/debugger/PROMPT.md' },
      { name: 'tester-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/tester/PROMPT.md' },
      { name: 'tester-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/tester/PROMPT.md' },
      { name: 'dev-advocate-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/developer-advocate/PROMPT.md' },
      { name: 'cust-advocate-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/customer-advocate/PROMPT.md' },
      { name: 'tech-writer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
      { name: 'sec-researcher-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
    ],
  },
  {
    id: 'writing',
    label: 'Writing Team',
    description: '8 agents: writers, technical writers, reviewers, auditors',
    members: [
      { name: 'writer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/writer/PROMPT.md' },
      { name: 'writer-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/writer/PROMPT.md' },
      { name: 'tech-writer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
      { name: 'tech-writer-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'reviewer-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'auditor-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'auditor-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
    ],
  },
  {
    id: 'small-research',
    label: 'Small Research Team',
    description: '10 agents: researchers, security researchers, data analysts, reviewers',
    members: [
      { name: 'researcher-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/research/PROMPT.md' },
      { name: 'researcher-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/research/PROMPT.md' },
      { name: 'sec-researcher-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'sec-researcher-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'data-analyst-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/data-analyst/PROMPT.md' },
      { name: 'data-analyst-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/data-analyst/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'reviewer-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'auditor-1', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'auditor-2', model: 'claude-4-6-sonnet', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
    ],
  },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTeamModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'template' | 'custom' | 'design'>('template');
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [leadCwd, setLeadCwd] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customTemplates, setCustomTemplates] = useState<TeamTemplate[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Array<{ name: string; promptPath: string }>>([]);
  const [creating, setCreating] = useState(false);

  // Design mode state
  const [designName, setDesignName] = useState('');
  const [designDesc, setDesignDesc] = useState('');
  const [designMembers, setDesignMembers] = useState<TeamTemplateMember[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTab('template');
      setTeamName('');
      setDescription('');
      setLeadCwd('');
      setSelectedTemplate('');
      setCreating(false);
      setDesignName('');
      setDesignDesc('');
      setDesignMembers([]);
      window.electronAPI.loadTeamTemplates().then(setCustomTemplates);
      window.electronAPI.scanRoles().then(setAvailableRoles);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];
  const selected = allTemplates.find((t) => t.id === selectedTemplate);

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    const members = selected?.members.map((m) => ({
      name: m.name,
      model: m.model,
      promptPath: m.promptPath,
    })) ?? [];
    await window.electronAPI.createTeam({
      teamName: teamName.trim(),
      description: description.trim(),
      leadCwd: leadCwd.trim() || '~',
      members,
    });
    setCreating(false);
    onClose();
  };

  const handleSaveTemplate = async () => {
    if (!designName.trim() || designMembers.length === 0) return;
    const template: TeamTemplate = {
      id: `custom-${Date.now()}`,
      label: designName.trim(),
      description: designDesc.trim() || `${designMembers.length} agents`,
      members: designMembers,
    };
    await window.electronAPI.saveTeamTemplate(template);
    setCustomTemplates((prev) => [...prev, template]);
    setTab('template');
  };

  const handleDeleteTemplate = async (id: string) => {
    await window.electronAPI.deleteTeamTemplate(id);
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const addDesignMember = (role: { name: string; promptPath: string }) => {
    const count = designMembers.filter((m) => m.name.startsWith(role.name)).length;
    setDesignMembers((prev) => [...prev, {
      name: `${role.name}-${count + 1}`,
      model: 'claude-4-6-sonnet',
      promptPath: role.promptPath,
    }]);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border-default)',
        width: 520,
        maxHeight: '80vh',
        overflow: 'auto',
        padding: 24,
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Create Team</h3>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['template', 'custom', 'design'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              border: tab === t ? '1px solid var(--border-active)' : '1px solid var(--border-default)',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              {t === 'template' ? 'Templates' : t === 'custom' ? 'Custom' : 'Design Template'}
            </button>
          ))}
        </div>

        {/* Common fields */}
        {tab !== 'design' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <input style={inputStyle} placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <input style={inputStyle} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Working directory (~/project)" value={leadCwd} onChange={(e) => setLeadCwd(e.target.value)} />
              <button onClick={async () => {
                const dir = await window.electronAPI.openFolderDialog();
                if (dir) setLeadCwd(dir);
              }} style={{
                padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12,
              }}>Browse</button>
            </div>
          </div>
        )}

        {/* Template picker */}
        {tab === 'template' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {allTemplates.map((t) => (
              <div key={t.id} onClick={() => setSelectedTemplate(t.id)} style={{
                padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                background: selectedTemplate === t.id ? 'var(--bg-card)' : 'transparent',
                border: selectedTemplate === t.id ? '1px solid var(--accent)' : '1px solid var(--border-default)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.label}</span>
                  {t.id.startsWith('custom-') && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                    }}>×</button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>
                {selectedTemplate === t.id && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {t.members.map((m) => m.name).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Custom — just member names */}
        {tab === 'custom' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              The lead will use Claude Code's native team tools to spawn agents. Just list the member names you want.
            </div>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              placeholder="alpha&#10;bravo&#10;charlie"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {/* Design template */}
        {tab === 'design' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <input style={inputStyle} placeholder="Template name" value={designName} onChange={(e) => setDesignName(e.target.value)} />
            <input style={inputStyle} placeholder="Template description" value={designDesc} onChange={(e) => setDesignDesc(e.target.value)} />

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Available roles ({availableRoles.length} found in ~/.claude/prompts/):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {availableRoles.map((role) => (
                <button key={role.name} onClick={() => addDesignMember(role)} style={{
                  padding: '3px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}>
                  + {role.name}
                </button>
              ))}
              {availableRoles.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  No roles found. Add prompt directories to ~/.claude/prompts/
                </span>
              )}
            </div>

            {designMembers.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Members ({designMembers.length}):
                </div>
                {designMembers.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 8px', fontSize: 11, color: 'var(--text-primary)',
                  }}>
                    <span style={{ flex: 1 }}>{m.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{m.promptPath.split('/').slice(-2, -1)}</span>
                    <button onClick={() => setDesignMembers((prev) => prev.filter((_, j) => j !== i))} style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleSaveTemplate} disabled={!designName.trim() || designMembers.length === 0} style={{
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer', marginTop: 8,
              background: designName.trim() && designMembers.length > 0 ? 'var(--accent)' : 'var(--bg-card)',
              border: 'none', color: '#000', fontWeight: 600, fontSize: 13,
              opacity: designName.trim() && designMembers.length > 0 ? 1 : 0.5,
            }}>
              Save Template
            </button>
          </div>
        )}

        {/* Create button */}
        {tab !== 'design' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', fontSize: 13,
            }}>Cancel</button>
            <button onClick={handleCreate} disabled={!teamName.trim() || creating} style={{
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
              background: teamName.trim() && !creating ? 'var(--accent)' : 'var(--bg-card)',
              border: 'none', color: '#000', fontWeight: 600, fontSize: 13,
              opacity: teamName.trim() && !creating ? 1 : 0.5,
            }}>
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
