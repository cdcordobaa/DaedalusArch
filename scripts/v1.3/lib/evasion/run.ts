/**
 * The body of `scripts/v1.3/study2-evasion.ts` (the Study 2 evasion check entry): argument parsing, the snapshot-store
 * io of a real out-root and the writing of the report, packet and sealed key. Local store reads only; no model,
 * network or Neo4j call (EV-09).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../../src/spec-parser/spec-parser.js';
import type { ParsedSpec } from '../../../../src/shared/types/spec.js';
import { runDirFor } from '../../../lib/loop/loop.js';
import { SNAPSHOT_GIT_DIR } from '../../../lib/loop/snapshot.js';
import { analyseEvasion, renderEvasionMd, stableStringify } from './analyse.js';
import type { EvasionIO, EvasionOptions } from './analyse.js';
import { renameMap } from './identity.js';
import { readTreeCommit } from './import-graph.js';
import { DEFAULT_PER_ARM, DEFAULT_SEED, unblind } from './sample.js';
import { loadOutRoot } from '../study2-io.js';

export const EVASION_USAGE = [
  'usage: npx tsx scripts/v1.3/study2-evasion.ts --out-root <loop out-root> --out <dir>',
  '         [--from-step 2] [--sample-per-arm 10] [--seed 20261018] [--labels <form.csv>]',
  '         [--cells none@L2,none@L3,daedalus-mcp@L2] [--h2 none@L2,daedalus-mcp@L2] [--h1 none@L2,none@L3]',
  '         [--spec <repo-relative spec>]',
  '',
].join('\n');

export const TIER_SOURCES = ['Docs/v1.4/rule-tiers-post-seal.md', 'Docs/v1.3/rule-tiers.md'] as const;

export interface EvasionArgs {
  outRoot: string;
  out: string;
  fromStep: number;
  perArm: number;
  seed: number;
  labels?: string;
  cells?: string[];
  h2: [string, string];
  h1: [string, string];
  spec?: string;
}

function pair(v: string): [string, string] | null {
  const p = v.split(',').map((x) => x.trim());
  return p.length === 2 && p[0] !== '' && p[1] !== '' ? [p[0] ?? '', p[1] ?? ''] : null;
}

export function parseArgs(argv: readonly string[]): EvasionArgs | string {
  const a: Partial<EvasionArgs> & { h2: [string, string]; h1: [string, string] } = { h2: ['none@L2', 'daedalus-mcp@L2'], h1: ['none@L2', 'none@L3'] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i] ?? '';
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) return `missing value for ${k}`;
    i++;
    const int = (): number | null => (/^\d+$/.test(v) ? Number(v) : null);
    switch (k) {
      case '--out-root': a.outRoot = v; break;
      case '--out': a.out = v; break;
      case '--from-step': { const n = int(); if (n === null || n < 2) return '--from-step must be an integer >= 2'; a.fromStep = n; break; }
      case '--sample-per-arm': { const n = int(); if (n === null || n < 1) return '--sample-per-arm must be a positive integer'; a.perArm = n; break; }
      case '--seed': { const n = int(); if (n === null) return '--seed must be a non-negative integer'; a.seed = n; break; }
      case '--labels': a.labels = v; break;
      case '--cells': a.cells = v.split(',').map((x) => x.trim()).filter((x) => x !== ''); break;
      case '--h2': { const p = pair(v); if (p === null) return '--h2 must be <reference>,<treated>'; a.h2 = p; break; }
      case '--h1': { const p = pair(v); if (p === null) return '--h1 must be <reference>,<treated>'; a.h1 = p; break; }
      case '--spec': a.spec = v; break;
      default: return `unexpected argument ${JSON.stringify(k)}`;
    }
  }
  if (a.outRoot === undefined || a.out === undefined) return '--out-root and --out are required';
  return { fromStep: 2, perArm: DEFAULT_PER_ARM, seed: DEFAULT_SEED, ...a } as EvasionArgs;
}

const GIT_ENV = (): NodeJS.ProcessEnv => ({ PATH: process.env.PATH ?? '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' });

/** The git-backed io of a real out-root (local git only). */
export function gitIO(repoRoot: string, scratchRoot: string): EvasionIO {
  const specs = new Map<string, ParsedSpec | null>();
  let n = 0;
  const gitDir = (runDir: string): string => path.join(runDir, SNAPSHOT_GIT_DIR);
  return {
    readTree: (runDir, commit) => readTreeCommit(gitDir(runDir), commit, path.join(scratchRoot, `t${String(n++)}`)),
    renameMap: (runDir, a, b) => renameMap(gitDir(runDir), a, b),
    diff: (runDir, a, b) => {
      const r = spawnSync('git', [`--git-dir=${gitDir(runDir)}`, 'diff', '--no-color', '-M50%', a, b, '--', 'src'], { encoding: 'utf8', env: GIT_ENV(), maxBuffer: 64 * 1024 * 1024 });
      return r.status === 0 ? r.stdout : '';
    },
    readSpec: async (ref, runDir) => {
      const file = ref.kind === 'static' ? path.resolve(repoRoot, ref.path) : path.join(runDir, ref.path);
      if (specs.has(file)) return specs.get(file) ?? null;
      const parsed = fs.existsSync(file) ? await parseSpec({ specFilePath: file }) : null;
      const spec = parsed !== null && parsed.success ? parsed.data : null;
      specs.set(file, spec);
      return spec;
    },
  };
}

/** Repo-relative when inside the repository, else a placeholder (EV-10). */
export function pathLabel(repoRoot: string, p: string, placeholder: string): string {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(p));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : placeholder;
}

export function tierSource(repoRoot: string): { path: string; text: string } {
  for (const p of TIER_SOURCES) {
    const abs = path.join(repoRoot, p);
    if (fs.existsSync(abs)) return { path: p, text: fs.readFileSync(abs, 'utf8') };
  }
  throw new Error('no committed rule-tier table found');
}

export interface RunEvasionResult {
  readonly exitCode: number;
  readonly message: string;
}

/** The CLI body (exported for the tests and the recorded dry run). */
export async function runEvasion(args: EvasionArgs, repoRoot: string, now: () => Date = () => new Date()): Promise<RunEvasionResult> {
  const loaded = loadOutRoot(args.outRoot);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'study2-evasion-'));
  try {
    const opts: EvasionOptions = {
      fromStep: args.fromStep,
      seed: args.seed,
      perArm: args.perArm,
      ...(args.cells !== undefined ? { cells: args.cells } : {}),
      h2: args.h2,
      h1: args.h1,
      ...(args.spec !== undefined ? { specFallback: args.spec } : {}),
      outRootLabel: pathLabel(repoRoot, args.outRoot, '<out-root>'),
      tierSource: tierSource(repoRoot),
    };
    const io = gitIO(repoRoot, scratch);
    const result = await analyseEvasion(loaded.runs, (id) => runDirFor(args.outRoot, id), opts, io);
    const keyFile = path.join(args.out, 'packet-key', 'key.json');
    if (args.labels !== undefined) {
      if (!fs.existsSync(keyFile)) return { exitCode: 2, message: 'no sealed key in <out>/packet-key/ to unblind against' };
      const read = unblind(fs.readFileSync(args.labels, 'utf8'), fs.readFileSync(keyFile, 'utf8'), result.packet.keySha256, args.h2[1]);
      if (!read.success) return { exitCode: 2, message: read.errors.map((e) => `${e.code}: ${e.message}`).join('\n') };
      const flags = result.report.flags as Record<string, unknown>;
      result.report.humanRead = read.data;
      flags.evasionHumanRead = read.data.treatedMovedOnly > 0;
      flags.evasionHumanReadBroad = read.data.treatedMovedOnlyBroad > 0;
    }
    fs.mkdirSync(args.out, { recursive: true });
    fs.writeFileSync(path.join(args.out, 'evasion.json'), stableStringify(result.report));
    fs.writeFileSync(path.join(args.out, 'evasion.md'), renderEvasionMd(result.report, now().toISOString()));
    const packetDir = path.join(args.out, 'packet');
    fs.rmSync(packetDir, { recursive: true, force: true });
    fs.mkdirSync(packetDir, { recursive: true });
    for (const [name, text] of result.packet.files) fs.writeFileSync(path.join(packetDir, name), text);
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, result.packet.keyText);
    const missing = (result.report.excluded as { snapshotMissing: number }).snapshotMissing;
    return { exitCode: missing > 0 ? 1 : 0, message: `evasion report: ${String(result.diffs.length)} eligible diffs, ${String(result.packet.files.size - 2)} packet items${missing > 0 ? `, ${String(missing)} unreadable snapshots` : ''}` };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

