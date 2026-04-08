import { SessionInfo } from '../../shared/types';

// Strip ANSI escape sequences so regexes match cleanly against terminal output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\r/g, '');
}

const SPINNER_CHARS = new Set([
  '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏',
  '⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷',
  '◐', '◓', '◑', '◒', '●', '○', '◉', '◎',
  '✳', '✢', '✦', '✧', '✶', '✷', '✸', '✹', '✺', '⟳', '↻',
]);

export function parseStatus(buffer: string): SessionInfo['status'] {
  if (!buffer || buffer.length === 0) return 'idle';
  const tail = stripAnsi(buffer.slice(-800));

  // Check idle FIRST — if any of the last 5 lines is a prompt, Claude is idle.
  // Scanning 5 lines handles Claude's "accept edits on" banner which sits
  // below the ❯ prompt and would otherwise hide the idle state.
  const trimmed = tail.trimEnd();
  const tailLines = trimmed.split('\n');
  const recentLines = tailLines.slice(-5);
  for (const line of recentLines) {
    if (/[❯>$]\s*$/.test(line.trim())) return 'idle';
  }

  // Spinner pattern: ellipsis (…) near the end means spinner is active
  // e.g. "✳ Ionizing…", "⠋ Thinking…" — Claude uses random fun words
  const lastChunk = tail.slice(-300);
  if (/[\w]+…/.test(lastChunk)) {
    // Distinguish thinking vs generating by looking for generation keywords
    const GENERATING_KEYWORDS = ['Generating', 'Writing', 'Editing', 'Creating', 'Reading'];
    for (const kw of GENERATING_KEYWORDS) {
      if (lastChunk.includes(kw)) return 'generating';
    }
    return 'thinking';
  }

  // Spinner character in last few lines also indicates activity
  const lastLines = tail.split('\n').slice(-5);
  for (const line of lastLines) {
    for (const ch of line) {
      if (SPINNER_CHARS.has(ch)) return 'thinking';
    }
  }

  // Active tool output markers (⏺ = tool call, ⎿ = tool result)
  if (/[⏺⎿]/.test(lastChunk)) return 'generating';

  return 'idle';
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
  // "claude-4-6-sonnet" or "claude-4-6-opus" from status line — take last match
  const claudeMatches = [...tail.matchAll(/claude-[\d]+-[\d]+-\w+/g)];
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
