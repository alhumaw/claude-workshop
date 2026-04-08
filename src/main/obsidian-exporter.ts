import { spawn } from 'child_process';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

interface ObsidianNote {
  title: string;
  content: string;
  links: string[];
}

interface ExportSpec {
  hub: ObsidianNote;
  notes: ObsidianNote[];
}

interface FileEntry {
  relPath: string;
  content: string;
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'env', 'vendor', 'target',
  'coverage', '.nyc_output', '.cache', '.parcel-cache', '.turbo',
  'bower_components', '.pytest_cache', '.mypy_cache', '.tox',
  'htmlcov', 'site-packages',
]);

const SKIP_EXTENSIONS = new Set([
  '.lock', '.map', '.png', '.jpg', '.jpeg', '.gif', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4', '.mov', '.avi',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.bin', '.exe', '.dll',
  '.so', '.dylib', '.a', '.o', '.class', '.pyc', '.pyo', '.pyd',
  '.pdf', '.db', '.sqlite', '.sqlite3',
]);

const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  'Gemfile.lock', 'composer.lock', 'poetry.lock', 'bun.lockb',
]);

const MAX_FILE_BYTES = 80_000;
const MAX_TOTAL_BYTES = 200_000;

function expandPath(p: string): string {
  if (p.startsWith('~/')) return p.replace('~', homedir());
  if (p === '~') return homedir();
  return p;
}

function slugify(title: string): string {
  return title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

// For note filenames and wiki-links: Obsidian treats / as a path separator,
// so strip all filesystem-unsafe chars and collapse extra spaces.
function safeFilename(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildNoteContent(note: ObsidianNote, allTitles: string[]): string {
  const linkSection = note.links
    .filter((l) => allTitles.includes(l))
    .map((l) => `- [[${safeFilename(l)}]]`)
    .join('\n');
  return [note.content, linkSection ? '\n\n## Related\n' + linkSection : ''].join('');
}

async function collectFiles(
  dir: string,
  base: string,
  entries: FileEntry[],
  totalRef: { bytes: number }
): Promise<void> {
  if (totalRef.bytes >= MAX_TOTAL_BYTES) return;

  let items;
  try {
    items = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Sort so entry-point files surface first within each directory
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return 1;
    if (!a.isDirectory() && b.isDirectory()) return -1;
    return a.name.localeCompare(b.name);
  });

  for (const item of items) {
    if (totalRef.bytes >= MAX_TOTAL_BYTES) return;
    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(base, fullPath);

    if (item.isDirectory()) {
      if (SKIP_DIRS.has(item.name) || item.name.startsWith('.')) continue;
      await collectFiles(fullPath, base, entries, totalRef);
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (SKIP_FILES.has(item.name)) continue;
      if (SKIP_EXTENSIONS.has(ext)) continue;
      // Skip minified / bundled files
      if (/\.(min|bundle|chunk)\.[jt]s$/.test(item.name)) continue;

      let content: string;
      try {
        const buf = await readFile(fullPath);
        if (buf.length > MAX_FILE_BYTES) continue;
        content = buf.toString('utf-8');
        // Heuristic: skip binary-looking files
        if (content.includes('\x00')) continue;
      } catch {
        continue;
      }

      entries.push({ relPath, content });
      totalRef.bytes += Buffer.byteLength(content, 'utf-8');
    }
  }
}

function isEntryPoint(relPath: string): boolean {
  const name = path.basename(relPath).toLowerCase();
  return /^(readme|main|index|app|server|__init__|__main__|manage|cli|cmd)\./i.test(name);
}

function runClaudePrint(prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', prompt], {
      shell: false,
      cwd,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`claude --print exited ${code}: ${stderr}`));
      else resolve(stdout);
    });
    proc.on('error', reject);
  });
}

export async function exportToObsidian(
  projectDir: string,
  vaultPath: string
): Promise<string> {
  const expandedProject = expandPath(projectDir);
  const expandedVault = expandPath(vaultPath);

  const projectName = path.basename(expandedProject);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join(expandedVault, `${date}-${slugify(projectName)}`);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  // Collect source files
  const entries: FileEntry[] = [];
  await collectFiles(expandedProject, expandedProject, entries, { bytes: 0 });

  // Entry points first, then alphabetical
  entries.sort((a, b) => {
    const aEntry = isEntryPoint(a.relPath);
    const bEntry = isEntryPoint(b.relPath);
    if (aEntry && !bEntry) return -1;
    if (!aEntry && bEntry) return 1;
    return a.relPath.localeCompare(b.relPath);
  });

  const fileTree = entries.map((e) => e.relPath).join('\n');
  const fileContents = entries
    .map((e) => `=== ${e.relPath} ===\n${e.content}`)
    .join('\n\n');

  const prompt = `You are generating an Obsidian vault knowledge graph for a software project. The goal is to help a developer understand how the project actually works — entry points, execution flow, module relationships, and key concepts.

Project name: ${projectName}
Project directory: ${expandedProject}

File tree:
${fileTree}

Source files:
${fileContents}

Output ONLY valid JSON (no markdown fences, no explanation) matching this exact structure:
{
  "hub": {
    "title": "string — project name or one-line description",
    "content": "string — 3-5 sentences: what this project does, its tech stack, main entry point(s), and high-level architecture",
    "links": ["Module A", "Module B"]
  },
  "notes": [
    {
      "title": "string — 2-5 words naming this module, file, or concept",
      "content": "string — 3-6 sentences: what it does, key functions/classes, what triggers it, what it calls next, important data it handles",
      "links": ["hub title", "related note title"]
    }
  ]
}

Rules:
- Generate 8-20 notes depending on project complexity
- Prioritize execution flow: trace from entry point through key operations to outputs
- Cover: entry points, core modules, key data types/interfaces, important algorithms or flows
- Every wiki-link MUST be the exact title of another note or the hub — no invented targets
- Every note MUST link back to the hub
- Link notes when one calls, imports, or meaningfully depends on the other
- Output raw JSON only`;

  const raw = await runClaudePrint(prompt, expandedProject);
  const jsonText = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const spec: ExportSpec = JSON.parse(jsonText);
  const allTitles = [spec.hub.title, ...spec.notes.map((n) => n.title)];

  await writeFile(
    path.join(outDir, `${safeFilename(spec.hub.title)}.md`),
    buildNoteContent(spec.hub, allTitles)
  );
  for (const note of spec.notes) {
    await writeFile(
      path.join(outDir, `${safeFilename(note.title)}.md`),
      buildNoteContent(note, allTitles)
    );
  }
  return outDir;
}
