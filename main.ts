// Token launch radar — entrypoint.
//
// What running this file does, in order:
//   1. loads a protocol snapshot (JSON) from the place the caller points at,
//   2. asks lib/model.ts to rank every protocol in it,
//   3. refuses to continue when the model's own board check complains,
//   4. emits board.json plus the dashboard's data.js into the output folder,
//   5. mirrors dashboard/ and screenshots/ next to them, and
//   6. seals the folder with dossier.json from vendor/makefun-board.ts,
//      which the scorer later rebuilds from the same folder and compares.
//
// Plain Node >= 22, standard library only, no network. Two knobs:
//   --input <snapshot.json | folder holding one>   (default: /input)
//   --output <folder>   (default: $MAKEFUN_OUTPUT_DIR, otherwise /output)

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, boardIssue, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

function die(code: number, message: string): never {
  process.stderr.write(`radar: ${message}\n`);
  process.exit(code);
}

// Pull one "--flag value" or "--flag=value" option out of argv.
// The first spelling that matches wins; an absent flag yields the fallback.
function flagValue(flag: string, fallback: string): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]!;
    if (token === `--${flag}` && i + 1 < args.length) return args[i + 1]!;
    if (token.startsWith(`--${flag}=`)) return token.slice(flag.length + 3);
  }
  return fallback;
}

// --- load and rank ----------------------------------------------------------

const inputPoint = flagValue('input', '/input');
const snapshotPath = inputPoint.endsWith('.json') ? inputPoint : join(inputPoint, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  die(2, `cannot find a snapshot at ${snapshotPath} — pass --input <file|folder> or mount the sealed input at /input`);
}
const outDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const ranked = buildRadar(snapshot);
const problem = boardIssue(ranked.board, snapshot);
if (problem !== null) die(1, `the model produced a board the gate rejects: ${problem}`);

// --- write the ranked board and the dashboard's data ------------------------

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), JSON.stringify({ rows: ranked.board }) + '\n');
writeFileSync(join(outDir, 'data.js'), dataScript(ranked.radar));

// Mirror a folder's plain files (no dotfiles, no nesting) into the output.
function mirror(sourceDir: string, targetDir: string): string[] {
  const names: string[] = [];
  if (!existsSync(sourceDir)) return names;
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    if (entry.startsWith('.')) continue;
    const from = join(sourceDir, entry);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(targetDir, entry));
    names.push(entry);
  }
  return names;
}

mirror(join(ROOT, 'dashboard'), join(outDir, 'dashboard'));
const shotNames = mirror(join(ROOT, 'screenshots'), join(outDir, 'screenshots'));
if (shotNames.length < 3) {
  die(1, `screenshots/ gave ${shotNames.length} image(s); the entry needs 3: the board, one detail view, one filtered view`);
}
const SHOT_NAME_OK = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
for (const name of shotNames) {
  if (!SHOT_NAME_OK.test(name)) die(1, `screenshots/${name}: file names use letters, digits and . _ -, up to 128 characters`);
}

// --- seal -------------------------------------------------------------------
// The caps below mirror the competition gates. The dossier goes in last:
// the scorer rebuilds it from this finished folder and compares the bytes.
const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 64 * 1024,
  screenshots: { max: 4, max_bytes: 512 * 1024 },
  dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
});
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);

process.stdout.write(
  `radar: ranked ${ranked.board.length} rows from ${snapshot.protocols.length} protocols (${snapshot.watchlist.length} watchlisted; ${ranked.radar.early_size} early, ${ranked.radar.live_size} live kept apart)\n` +
    `radar: output in ${outDir}: board.json, data.js, dashboard/, screenshots/ (${shotNames.length} images), dossier.json\n`,
);
