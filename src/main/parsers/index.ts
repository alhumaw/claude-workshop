import { SessionInfo } from '../../shared/types';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const DEBUG_APPROVAL = true;
let debugCounter = 0;

// Strip ANSI escape sequences so regexes match cleanly against terminal output
function stripAnsi(str: string): string {
  // First, replace cursor-forward sequences (\x1b[<n>C) with spaces — Claude Code
  // uses these instead of literal spaces between words.
  // eslint-disable-next-line no-control-regex
  let result = str.replace(/\x1b\[(\d*)C/g, (_match, n) => ' '.repeat(parseInt(n || '1', 10)));
  // Strip remaining ANSI escape sequences
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]/g, '');
  // Strip trailing \r from lines. Claude outputs \r\r\n (CR CR LF) — after
  // splitting on \n the trailing \r(s) must be removed, not used as overwrite markers.
  // True mid-line overwrites (\r followed by visible text) are rare in Claude's output.
  return result.replace(/\r+/g, '');
}

const SPINNER_CHARS = new Set([
  '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏',
  '⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷',
  '◐', '◓', '◑', '◒', '●', '○', '◉', '◎',
  '✳', '✢', '✦', '✧', '✶', '✷', '✸', '✹', '✺', '⟳', '↻',
  '·', '✻', '✽', '✾', '✿', '❀', '❁', '❂', '❃', '❇', '❈', '❉', '❊', '❋',
]);

export function parseStatus(buffer: string, lastActivity?: number): SessionInfo['status'] {
  if (!buffer || buffer.length === 0) return 'idle';
  const tail = stripAnsi(buffer.slice(-3000));
  const lastChunk = tail.slice(-300);
  const trimmed = tail.trimEnd();
  const tailLines = trimmed.split('\n');

  // Check spinner/activity FIRST — these take precedence over an idle prompt
  // that may still be visible a few lines above the spinner.

  // Spinner pattern: ellipsis near the end means spinner is active
  // e.g. "✳ Ionizing...", "⠋ Thinking..." — Claude uses random fun words
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

  // Active tool output markers (⏺ = tool call, ⎿ = tool result)
  if (/[⏺⎿]/.test(lastChunk)) return 'generating';

  // Check idle — if any of the last 5 lines is a prompt, Claude is idle.
  // Scanning 5 lines handles Claude's "accept edits on" banner which sits
  // below the ❯ prompt and would otherwise hide the idle state.
  const recentLines = tailLines.slice(-5);
  for (const line of recentLines) {
    if (/[❯>$]\s*$/.test(line.trim())) return 'idle';
  }

  // Claude Code idle timer: "✱ Baked for 48s", "✦ Sautéed for 36s", etc.
  for (const line of recentLines) {
    if (/for\s+\d+[sm]\s*$/.test(line.trim())) return 'idle';
  }

  // Data-flow check: If PTY has been quiet for 4+ seconds and no idle
  // signal found, it's likely idle (buffer just doesn't have a visible prompt).
  if (lastActivity !== undefined) {
    const silenceMs = Date.now() - lastActivity;
    if (silenceMs > 4000) return 'idle';
  }

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

export function parseAwaitingApproval(buffer: string): boolean {
  if (!buffer || buffer.length === 0) return false;
  const raw = buffer.slice(-3000);
  const tail = stripAnsi(raw);
  // Use only the last few non-empty lines at the very bottom. Once the user
  // approves/denies, new output (spinners, tool calls) appears below, pushing
  // the prompt away. Checking only the bottom prevents stale prompts from
  // causing false positives.
  const allLines = tail.trimEnd().split('\n');
  // Take last 8 non-empty lines — tight enough to avoid stale prompts,
  // wide enough to capture the question + options + footer.
  const nonEmpty = allLines.filter(l => l.trim().length > 0);
  const bottomLines = nonEmpty.slice(-8);
  const block = bottomLines.join('\n');

  // Debug: write buffer state to tmp file on every poll so we can inspect
  if (DEBUG_APPROVAL) {
    debugCounter++;
    const debugFile = '/tmp/claude-workshop-debug.txt';
    const debugContent = [
      `=== DEBUG parseAwaitingApproval (poll #${debugCounter}) ===`,
      `raw buffer length: ${buffer.length}`,
      `raw slice(-3000) length: ${raw.length}`,
      `stripped length: ${tail.length}`,
      `total non-empty lines: ${nonEmpty.length}`,
      `bottom 8 non-empty lines count: ${bottomLines.length}`,
      '',
      '--- BLOCK (bottom 8 non-empty) ---',
      block,
      '',
      '--- FULL STRIPPED TAIL ---',
      tail,
      '',
      '--- RAW LAST 500 CHARS ---',
      JSON.stringify(raw.slice(-500)),
    ].join('\n');
    try { writeFileSync(debugFile, debugContent); } catch (e: any) {
      try { writeFileSync(debugFile, `WRITE ERROR: ${e.message}`); } catch {}
    }
  }

  // 1. Permission prompts:
  //    "Do you want to proceed/create/make this edit/run/..." — all Claude permission questions
  //    "Allow once" / "Allow for this session" / "Allow for this project" / "Deny"
  //    "(y)es | (n)o" hints
  if (/Do you want to\s|Allow once|Allow for this|Deny(?! all)|\(y\)es/i.test(block)) {
    return true;
  }

  // 2. Interactive choice menus (AskUserQuestion / skill prompts):
  //    Numbered options (❯ 1. ... / 2. ... / 3. ...) with "Type something" as final option
  if (/❯\s*\d+\.\s/.test(block) && /Type something/i.test(block)) {
    return true;
  }

  // 3. Generic numbered menu: at least 2 numbered options near the end
  //    with a question line above them ("What would you like to do", etc.)
  const numberedOptions = block.match(/^\s*(?:❯\s*)?\d+\.\s/gm);
  if (numberedOptions && numberedOptions.length >= 2 && /\?\s*$/m.test(block)) {
    return true;
  }

  return false;
}
