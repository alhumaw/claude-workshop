import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../stores/session-store';
import { TeamMemberConfig } from '../../shared/types';

/** Derive a prompt file suggestion from an agent name.
 *  "coder-1" → "~/.claude/prompts/coder/PROMPT.md"
 *  "code-quality-analyst" → "~/.claude/prompts/code-quality-analyst/PROMPT.md"
 *  "proto-spec" → "~/.claude/prompts/proto-spec/PROMPT.md"
 *  "auditor-bob" → "~/.claude/prompts/auditor-bob/PROMPT.md"
 *  Strips trailing -N (instance numbers) but keeps the full role name.
 */
function suggestPromptPath(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const role = trimmed.replace(/-\d+$/, '').toLowerCase();
  return `~/.claude/prompts/${role}/PROMPT.md`;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'claude-4-6-opus', label: 'Opus 4.6' },
  { value: 'claude-4-6-opus[1m]', label: 'Opus 4.6 Long Context' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'claude-4-6-sonnet[1m]', label: 'Sonnet Long Context' },
  { value: 'haiku', label: 'Haiku' },
];

// ── Team Templates ──────────────────────────────────────────────────

interface TemplateMember {
  name: string;
  model: string;
  promptPath: string;
}

interface TeamTemplate {
  id: string;
  label: string;
  description: string;
  members: TemplateMember[];
}

const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'audit',
    label: 'Audit Team',
    description: '3 auditors + 1 synthesizer for code review and analysis',
    members: [
      { name: 'auditor-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'auditor-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'auditor-3', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'synthesizer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/synthesizer/PROMPT.md' },
    ],
  },
  {
    id: 'small-coding',
    label: 'Small Coding Team',
    description: '10 agents: coder, reviewer, QA, security, docs, testing, advocacy',
    members: [
      { name: 'coder-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'cqa-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/code-quality-analyst/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/code-reviewer/PROMPT.md' },
      { name: 'dev-advocate-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/developer-advocate/PROMPT.md' },
      { name: 'cust-advocate-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/customer-advocate/PROMPT.md' },
      { name: 'sec-analyst-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-analyst/PROMPT.md' },
      { name: 'sec-researcher-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'debugger-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/debugger/PROMPT.md' },
      { name: 'tester-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/tester/PROMPT.md' },
      { name: 'tech-writer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
    ],
  },
  {
    id: 'large-coding',
    label: 'Large Coding Team',
    description: '19 agents: coders, reviewers, QA, security, debugging, testing, docs, advocacy',
    members: [
      { name: 'coder-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'coder-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'coder-3', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'coder-4', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/coder/PROMPT.md' },
      { name: 'cqa-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/code-quality-analyst/PROMPT.md' },
      { name: 'cqa-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/code-quality-analyst/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/code-reviewer/PROMPT.md' },
      { name: 'reviewer-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/code-reviewer/PROMPT.md' },
      { name: 'sec-analyst-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-analyst/PROMPT.md' },
      { name: 'sec-analyst-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-analyst/PROMPT.md' },
      { name: 'sec-researcher-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'sec-researcher-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'debugger-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/debugger/PROMPT.md' },
      { name: 'debugger-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/debugger/PROMPT.md' },
      { name: 'tester-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/tester/PROMPT.md' },
      { name: 'tester-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/tester/PROMPT.md' },
      { name: 'dev-advocate-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/developer-advocate/PROMPT.md' },
      { name: 'cust-advocate-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/customer-advocate/PROMPT.md' },
      { name: 'tech-writer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
    ],
  },
  {
    id: 'writing',
    label: 'Writing Team',
    description: '8 agents: writers, technical writers, reviewers, auditors',
    members: [
      { name: 'writer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/writer/PROMPT.md' },
      { name: 'writer-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/writer/PROMPT.md' },
      { name: 'tech-writer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
      { name: 'tech-writer-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/technical-writer/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'reviewer-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'auditor-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'auditor-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
    ],
  },
  {
    id: 'small-research',
    label: 'Small Research Team',
    description: '10 agents: researchers, security researchers, data analysts, reviewers, auditors',
    members: [
      { name: 'researcher-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/research/PROMPT.md' },
      { name: 'researcher-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/research/PROMPT.md' },
      { name: 'sec-researcher-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'sec-researcher-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/security-researcher/PROMPT.md' },
      { name: 'data-analyst-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/data-analyst/PROMPT.md' },
      { name: 'data-analyst-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/data-analyst/PROMPT.md' },
      { name: 'reviewer-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'reviewer-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/reviewer/PROMPT.md' },
      { name: 'auditor-1', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
      { name: 'auditor-2', model: 'claude-4-6-sonnet[1m]', promptPath: '~/.claude/prompts/auditor/PROMPT.md' },
    ],
  },
];

function ModelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        flex: 1,
        padding: '6px 8px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 6,
        color: 'var(--text-primary)',
        fontSize: 12,
        outline: 'none',
      }}
    >
      {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function FileInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleBrowse = async () => {
    const picked = await window.electronAPI.openFileDialog();
    if (picked) onChange(picked);
  };
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="path/to/prompt.md"
        style={{
          flex: 1,
          padding: '6px 8px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          fontSize: 12,
          outline: 'none',
          fontFamily: 'monospace',
        }}
      />
      <button
        onClick={handleBrowse}
        type="button"
        style={{
          padding: '6px 10px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          color: 'var(--text-secondary)',
          fontSize: 11,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Browse
      </button>
    </div>
  );
}

interface TeammateRow {
  name: string;
  model: string;
  cwd: string;
  promptFile: string;
  promptManual: boolean;
}

export function CreateTeamModal({ isOpen, onClose }: Props) {
  const createTeam = useSessionStore((s) => s.createTeam);
  const [mode, setMode] = useState<'custom' | 'template'>('custom');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [designMode, setDesignMode] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<TeamTemplate[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Array<{ name: string; promptPath: string }>>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [leadName, setLeadName] = useState('team-lead');
  const [leadModel, setLeadModel] = useState('claude-4-6-opus[1m]');
  const [leadCwd, setLeadCwd] = useState('');
  const [leadPrompt, setLeadPrompt] = useState('');
  const [leadPromptManual, setLeadPromptManual] = useState(false);
  const [teammates, setTeammates] = useState<TeammateRow[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('custom');
      setSelectedTemplate('');
      setDesignMode(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      setTeamName('');
      setDescription('');
      setLeadName('team-lead');
      setLeadModel('claude-4-6-opus[1m]');
      setLeadCwd('');
      setLeadPrompt('~/.claude/protocols/lead/protocol.md');
      setLeadPromptManual(false);
      setTeammates([]);
      setCreating(false);
      // Load custom templates and available roles
      window.electronAPI.loadTeamTemplates().then(setCustomTemplates);
      window.electronAPI.scanRoles().then(setAvailableRoles);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allTemplates = [...TEAM_TEMPLATES, ...customTemplates];

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    setDesignMode(false);
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template) { setTeammates([]); return; }
    setTeammates(template.members.map((m) => ({
      name: m.name,
      model: m.model,
      cwd: '',
      promptFile: m.promptPath,
      promptManual: true, // template paths are intentional, don't auto-suggest
    })));
    if (!teamName) setTeamName(template.id);
    if (!description) setDescription(template.description);
  };

  const addFromRole = (role: { name: string; promptPath: string }) => {
    // Count existing members with this role to auto-number
    const existing = teammates.filter((t) => t.name.replace(/-\d+$/, '') === role.name);
    const num = existing.length + 1;
    const name = `${role.name}-${num}`;
    setTeammates([...teammates, {
      name,
      model: 'claude-4-6-sonnet[1m]',
      cwd: '',
      promptFile: role.promptPath,
      promptManual: true,
    }]);
  };

  const saveCustomTemplate = async () => {
    if (!newTemplateName.trim() || teammates.length === 0) return;
    const id = newTemplateName.trim().toLowerCase().replace(/\s+/g, '-');
    const template: TeamTemplate = {
      id,
      label: newTemplateName.trim(),
      description: newTemplateDesc.trim() || `${teammates.length} agents`,
      members: teammates.map((t) => ({
        name: t.name,
        model: t.model,
        promptPath: t.promptFile,
      })),
    };
    await window.electronAPI.saveTeamTemplate(template);
    setCustomTemplates([...customTemplates.filter((t) => t.id !== id), template]);
    setDesignMode(false);
    setSelectedTemplate(id);
  };

  const deleteCustomTemplate = async (templateId: string) => {
    await window.electronAPI.deleteTeamTemplate(templateId);
    setCustomTemplates(customTemplates.filter((t) => t.id !== templateId));
    if (selectedTemplate === templateId) {
      setSelectedTemplate('');
      setTeammates([]);
    }
  };

  const addTeammate = () => {
    const name = `agent-${teammates.length + 1}`;
    setTeammates([...teammates, { name, model: 'sonnet', cwd: '', promptFile: suggestPromptPath(name), promptManual: false }]);
  };

  const updateTeammate = (idx: number, field: keyof TeammateRow, value: string | boolean) => {
    setTeammates(teammates.map((t, i) => {
      if (i !== idx) return t;
      const updated = { ...t, [field]: value };
      // Auto-suggest prompt when name changes (unless manually edited)
      if (field === 'name' && !t.promptManual) {
        updated.promptFile = suggestPromptPath(value as string);
      }
      if (field === 'promptFile') {
        updated.promptManual = true;
      }
      return updated;
    }));
  };

  const removeTeammate = (idx: number) => {
    setTeammates(teammates.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !leadCwd.trim()) return;
    setCreating(true);
    try {
      const leadConfig: TeamMemberConfig = {
        name: leadName.trim() || 'team-lead',
        agentType: 'team-lead',
        model: leadModel || undefined,
        cwd: leadCwd.trim(),
        promptFile: leadPrompt.trim() || undefined,
      };
      const teammateConfigs: TeamMemberConfig[] = teammates
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          agentType: 'general-purpose',
          model: t.model || undefined,
          cwd: t.cwd.trim() || leadCwd.trim(),
          promptFile: t.promptFile.trim() || undefined,
        }));
      await createTeam({ teamName: teamName.trim(), description: description.trim(), leadConfig, teammateConfigs });
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-default)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
  };

  const labelStyle = {
    fontSize: 11,
    color: 'var(--text-secondary)',
    display: 'block' as const,
    marginBottom: 4,
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 96px)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Create Team
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
          }}>
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-default)' }}>
            <button type="button" onClick={() => { setMode('custom'); setSelectedTemplate(''); setTeammates([]); }}
              style={{
                flex: 1, padding: '8px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === 'custom' ? 'var(--accent)' : 'var(--bg-card)',
                color: mode === 'custom' ? '#1a1a1a' : 'var(--text-secondary)',
              }}>
              Custom
            </button>
            <button type="button" onClick={() => setMode('template')}
              style={{
                flex: 1, padding: '8px', border: 'none', borderLeft: '1px solid var(--border-default)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === 'template' ? 'var(--accent)' : 'var(--bg-card)',
                color: mode === 'template' ? '#1a1a1a' : 'var(--text-secondary)',
              }}>
              Template
            </button>
          </div>

          {/* Template selector */}
          {mode === 'template' && !designMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Built-in templates */}
              {TEAM_TEMPLATES.map((t) => (
                <div key={t.id} onClick={() => applyTemplate(t.id)} style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: selectedTemplate === t.id ? 'var(--bg-card)' : 'transparent',
                  border: selectedTemplate === t.id ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={(e) => { if (selectedTemplate !== t.id) e.currentTarget.style.borderColor = 'var(--border-active)'; }}
                  onMouseLeave={(e) => { if (selectedTemplate !== t.id) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {t.members.length} agents: {t.members.map((m) => m.name).join(', ')}
                  </div>
                </div>
              ))}

              {/* Custom templates */}
              {customTemplates.map((t) => (
                <div key={t.id} style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: selectedTemplate === t.id ? 'var(--bg-card)' : 'transparent',
                  border: selectedTemplate === t.id ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}
                  onClick={() => applyTemplate(t.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {t.members.length} agents: {t.members.map((m) => m.name).join(', ')}
                    </div>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteCustomTemplate(t.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    title="Delete template"
                  >✕</button>
                </div>
              ))}

              {/* Design New Team pill */}
              <div onClick={() => { setDesignMode(true); setSelectedTemplate(''); setTeammates([]); setNewTemplateName(''); setNewTemplateDesc(''); }}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px dashed var(--border-default)',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>+ Design New Team</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pick roles from your prompts directory</div>
              </div>
            </div>
          )}

          {/* Design mode — role picker */}
          {mode === 'template' && designMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Template Name</label>
                  <input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="my-custom-team" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Description</label>
                  <input value={newTemplateDesc} onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="What does this team do?" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Add Agent by Role ({availableRoles.length} available)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 120, overflowY: 'auto', padding: 4 }}>
                  {availableRoles.map((role) => (
                    <button key={role.name} type="button" onClick={() => addFromRole(role)}
                      style={{
                        padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                      title={role.promptPath}
                    >
                      + {role.name}
                    </button>
                  ))}
                </div>
              </div>

              {teammates.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {teammates.length} agent(s) added. Edit names/prompts below, then save.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDesignMode(false)} style={{
                  padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                  borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                }}>Back</button>
                <button type="button" onClick={saveCustomTemplate}
                  disabled={!newTemplateName.trim() || teammates.length === 0}
                  style={{
                    padding: '6px 14px', background: 'var(--accent)', border: 'none',
                    borderRadius: 6, color: '#1a1a1a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    opacity: (!newTemplateName.trim() || teammates.length === 0) ? 0.5 : 1,
                  }}>Save Template</button>
              </div>
            </div>
          )}

          {/* Team basics */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Team
            </div>
            <label style={labelStyle}>Team Name</label>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
              placeholder="my-team" style={{ ...inputStyle, marginBottom: 8 }} />
            <label style={labelStyle}>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this team working on?" style={inputStyle} />
          </div>

          {/* Lead config */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Lead Agent
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Name</label>
                <input value={leadName} onChange={(e) => {
                  setLeadName(e.target.value);
                  if (!leadPromptManual) {
                    const name = e.target.value.trim().toLowerCase();
                    setLeadPrompt(`~/.claude/protocols/${name || 'lead'}/protocol.md`);
                  }
                }}
                  placeholder="team-lead" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Model</label>
                <ModelSelect value={leadModel} onChange={setLeadModel} />
              </div>
            </div>
            <label style={labelStyle}>Working Directory</label>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <input value={leadCwd} onChange={(e) => setLeadCwd(e.target.value)}
                placeholder="~/dev/my-project" style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={async () => {
                const picked = await window.electronAPI.openFolderDialog();
                if (picked) setLeadCwd(picked);
              }} style={{
                padding: '6px 10px', background: 'var(--bg-card)',
                border: '1px solid var(--border-default)', borderRadius: 6,
                color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', flexShrink: 0,
              }}>Browse</button>
            </div>
            <label style={labelStyle}>Prompt File (optional)</label>
            <FileInput value={leadPrompt} onChange={(v) => { setLeadPrompt(v); setLeadPromptManual(true); }} />
          </div>

          {/* Teammates */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Teammates {teammates.length > 0 && `(${teammates.length})`}
              </span>
              <button type="button" onClick={addTeammate} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 11,
                padding: '4px 10px',
                cursor: 'pointer',
              }}>
                + Add
              </button>
            </div>

            {teammates.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                No teammates yet. Click + Add to add agents.
              </div>
            )}

            {teammates.map((t, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Teammate {idx + 1}
                  </span>
                  <button type="button" onClick={() => removeTeammate(idx)} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: 14, cursor: 'pointer', lineHeight: 1,
                  }}>
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Name</label>
                    <input value={t.name} onChange={(e) => updateTeammate(idx, 'name', e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Model</label>
                    <ModelSelect value={t.model} onChange={(v) => updateTeammate(idx, 'model', v)} />
                  </div>
                </div>
                <label style={labelStyle}>Working Directory (defaults to lead's)</label>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input value={t.cwd} onChange={(e) => updateTeammate(idx, 'cwd', e.target.value)}
                    placeholder={leadCwd || '~/dev/my-project'} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={async () => {
                    const picked = await window.electronAPI.openFolderDialog();
                    if (picked) updateTeammate(idx, 'cwd', picked);
                  }} style={{
                    padding: '6px 10px', background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)', borderRadius: 6,
                    color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                  }}>Browse</button>
                </div>
                <label style={labelStyle}>Prompt File (optional)</label>
                <FileInput value={t.promptFile} onChange={(v) => updateTeammate(idx, 'promptFile', v)} />
              </div>
            ))}
          </div>

          {/* Footer */}
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
            <button type="submit" disabled={creating || !teamName.trim() || !leadCwd.trim()} style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: '#1a1a1a',
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: (creating || !teamName.trim() || !leadCwd.trim()) ? 0.5 : 1,
            }}>
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
