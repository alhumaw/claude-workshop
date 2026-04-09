import { SessionInfo } from '../../shared/types';

// Strip ANSI escape sequences so regexes match cleanly against terminal output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\r/g, '');
}

/**
 * Parse status using buffer content + data recency.
 *
 * Strategy: check for reliable idle signals first (prompt, timer).
 * If none found, use lastActivity timestamp to determine if the agent
 * is actively processing (data flowing) or quietly idle (no prompt
 * visible but PTY is silent). This replaces the fragile approach of
 * scanning for spinner characters which flicker during animation.
 */
export function parseStatus(buffer: string, lastActivity?: number): SessionInfo['status'] {
  if (!buffer || buffer.length === 0) return 'idle';
  const tail = stripAnsi(buffer.slice(-800));
  const trimmed = tail.trimEnd();
  const tailLines = trimmed.split('\n');

  // ── Idle checks (highest priority) ────────────────────────────────

  // 1. Prompt character (❯ or > or $) at end of a recent line
  const recentLines = tailLines.slice(-5);
  for (const line of recentLines) {
    if (/[❯>$]\s*$/.test(line.trim())) return 'idle';
  }

  // 2. Claude Code idle timer: "✱ Baked for 48s", "✦ Sautéed for 36s", etc.
  for (const line of recentLines) {
    if (/for\s+\d+[sm]\s*$/.test(line.trim())) return 'idle';
  }

  // ── Data-flow check ───────────────────────────────────────────────

  // If PTY has been quiet for 4+ seconds and no idle signal found,
  // it's likely idle (buffer just doesn't have a visible prompt).
  if (lastActivity !== undefined) {
    const silenceMs = Date.now() - lastActivity;
    if (silenceMs > 4000) return 'idle';
  }

  // ── Active: data is flowing, determine thinking vs generating ─────

  // Spinner with ellipsis: "⠋ Thinking…", "✳ Ionizing…"
  const lastChunk = tail.slice(-300);
  if (/[\w]+…/.test(lastChunk)) {
    const GENERATING_KEYWORDS = ['Generating', 'Writing', 'Editing', 'Creating', 'Reading'];
    for (const kw of GENERATING_KEYWORDS) {
      if (lastChunk.includes(kw)) return 'generating';
    }
    return 'thinking';
  }

  // Tool output markers on last 2 lines
  const last2Lines = tailLines.slice(-2).join('\n');
  if (/[⏺⎿]/.test(last2Lines)) return 'generating';

  // Data is flowing but no specific pattern — default to thinking
  return 'thinking';
}

/**
 * Parse the Claude Code status line format:
 * (3% used) E[████░░]F (97% left) 29k:1000k | claude-4-6-sonnet | amoomaw
 */
export function parseContext(buffer: string): number | null {
  const tail = stripAnsi(buffer.slice(-3000));
  // Find the LAST occurrence so we get the most recent status line
  const usedMatches = [...tail.matchAll(/\((\d{1,3})%\s*used\)/g)];
  if (usedMatches.length > 0) return parseInt(usedMatches[usedMatches.length - 1][1], 10);
  const leftMatches = [...tail.matchAll(/\((\d{1,3})%\s*left\)/g)];
  if (leftMatches.length > 0) return 100 - parseInt(leftMatches[leftMatches.length - 1][1], 10);
  return null;
}

export function parseContextSize(buffer: string): string | null {
  const tail = stripAnsi(buffer.slice(-3000));
  // "29k:1000k" → "29k/1000k" — take the last match
  const matches = [...tail.matchAll(/(\d+k):(\d+k)/g)];
  if (matches.length > 0) {
    const m = matches[matches.length - 1];
    return `${m[1]}/${m[2]}`;
  }
  return null;
}

export function parseCost(buffer: string): string | null {
  const tail = stripAnsi(buffer.slice(-3000));
  const matches = tail.match(/<?\$[\d.]+/g);
  return matches ? matches[matches.length - 1] : null;
}

export function parseModel(buffer: string): string | null {
  const tail = stripAnsi(buffer.slice(-3000));
  // "claude-4-6-sonnet[1m]" or "claude-4-6-opus" from status line — take last match
  // The \[1m\] suffix indicates long context mode
  const claudeMatches = [...tail.matchAll(/claude-[\d]+-[\d]+-\w+(?:\[\dm\])?/g)];
  if (claudeMatches.length > 0) return claudeMatches[claudeMatches.length - 1][0];
  // "Opus 4.6" from welcome banner
  const nameMatches = [...tail.matchAll(/(Opus|Sonnet|Haiku)\s+[\d.]+/g)];
  if (nameMatches.length > 0) return nameMatches[nameMatches.length - 1][0];
  return null;
}

export function parseBranch(buffer: string): string | null {
  const tail = stripAnsi(buffer.slice(-3000));
  // Pipe-separated status line: "| branch-name |"
  const pipes = tail.match(/\|\s*([a-zA-Z0-9_\-./]+)\s*\|/g);
  if (pipes && pipes.length > 0) {
    // First pipe match is typically the branch/user field
    const m = pipes[0].match(/\|\s*([a-zA-Z0-9_\-./]+)\s*\|/);
    if (m) return m[1];
  }
  return null;
}
