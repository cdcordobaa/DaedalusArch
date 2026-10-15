/**
 * Test helpers of the batch-2 cheap proxies: run a planted fixture project of `tests/fixtures/v1.3-cheap2/<name>`
 * (copied to a temp directory with a tsconfig and the shared vendor typings) and check its `expected.json`: every
 * planted case is flagged with its kind on its unit, no near-miss unit carries a flag of the proxy, and the proxy
 * raises no other flag.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAndEnrich } from '../../../../src/apg-enrich/cheap/index.js';
import type { CheapEnrichment, CheapFlag, CheapOptions, ContextProxyId } from '../../../../src/apg-enrich/cheap/index.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';
import type { APGResult } from '../../../../src/shared/types/apg.js';
import { LAYERS } from './helpers.js';

export const CHEAP2_FIXTURES = path.resolve(__dirname, '../../../fixtures/v1.3-cheap2');

export interface ExpectedCase {
  readonly id: string;
  readonly kind?: string;
  readonly file: string;
  readonly className?: string;
  readonly methodName?: string;
  readonly note?: string;
}

export interface Expected {
  readonly proxy: ContextProxyId;
  readonly planted: readonly ExpectedCase[];
  readonly nearMisses: readonly ExpectedCase[];
}

export const TSCONFIG = JSON.stringify({
  compilerOptions: { target: 'ES2021', module: 'CommonJS', moduleResolution: 'node', strict: true, experimentalDecorators: true, skipLibCheck: true, types: [] },
  include: ['src/**/*.ts', 'types/**/*.d.ts'],
});

/** Copies a fixture to a fresh temp directory with `tsconfig.json` and `types/vendor.d.ts`; returns its real path. */
export function materialiseFixture(name: string): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `cheap2-${name}-`)));
  fs.cpSync(path.join(CHEAP2_FIXTURES, name), root, { recursive: true, filter: (src) => !/(expected|history|steps)\.json$/.test(src) });
  fs.writeFileSync(path.join(root, 'tsconfig.json'), TSCONFIG);
  fs.mkdirSync(path.join(root, 'types'), { recursive: true });
  fs.copyFileSync(path.join(CHEAP2_FIXTURES, 'vendor.d.ts'), path.join(root, 'types', 'vendor.d.ts'));
  return root;
}

export function loadExpected(name: string): Expected {
  return JSON.parse(fs.readFileSync(path.join(CHEAP2_FIXTURES, name, 'expected.json'), 'utf8')) as Expected;
}

export interface Run {
  readonly root: string;
  readonly apg: APGResult;
  readonly enrichment: CheapEnrichment;
  flags(proxy: ContextProxyId): CheapFlag[];
  cleanup(): void;
}

export async function runDir(root: string, proxies: readonly ContextProxyId[], options: Partial<CheapOptions> = {}, layerModel: LayerModel = LAYERS): Promise<Run> {
  const r = await extractAndEnrich(root, { layerModel, options: { ...options, proxies } });
  return {
    root, apg: r.apg, enrichment: r.enrichment,
    flags: (p) => r.enrichment.flags.filter((f) => f.proxy === p),
    cleanup: () => {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function runFixture(name: string, proxies: readonly ContextProxyId[], options: Partial<CheapOptions> = {}, layerModel: LayerModel = LAYERS): Promise<Run> {
  return runDir(materialiseFixture(name), proxies, options, layerModel);
}

export function onUnit(f: CheapFlag, c: ExpectedCase): boolean {
  return f.evidence.file === c.file && (c.className === undefined || f.className === c.className) && (c.methodName === undefined || f.methodName === c.methodName);
}

/** Outcome of the expected.json check: what was missed, what fired on a near miss, what fired unexpectedly. */
export function check(flags: readonly CheapFlag[], expected: Expected): { missed: string[]; nearMissFlags: string[]; unexpected: string[] } {
  const missed = expected.planted.filter((p) => !flags.some((f) => f.kind === p.kind && onUnit(f, p))).map((p) => p.id);
  const nearMissFlags = expected.nearMisses.flatMap((n) => flags.filter((f) => onUnit(f, n)).map((f) => `${n.id}: ${f.kind} ${f.message}`));
  const unexpected = flags.filter((f) => !expected.planted.some((p) => f.kind === p.kind && onUnit(f, p))).map((f) => `${f.kind} ${f.evidence.file}:${String(f.evidence.startLine)} ${f.message}`);
  return { missed, nearMissFlags, unexpected };
}

export interface ReplayCommit {
  readonly message: string;
  readonly trailers?: Readonly<Record<string, string>>;
  /** Project-relative path → content; null deletes the file. */
  readonly files: Readonly<Record<string, string | null>>;
}

/** Replays commits into `root` as a fresh git repository (fixed identity and dates, no global configuration). */
export function replayGit(root: string, commits: readonly ReplayCommit[]): void {
  const env = { PATH: process.env.PATH ?? '', HOME: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' };
  const run = (args: string[], extra: Record<string, string> = {}): void => {
    const r = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  run(['init', '--quiet']);
  commits.forEach((c, i) => {
    for (const [rel, text] of Object.entries(c.files)) {
      const abs = path.join(root, rel);
      if (text === null) fs.rmSync(abs, { force: true });
      else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
      }
    }
    run(['add', '--all']);
    const trailers = Object.entries(c.trailers ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    const date = new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
    run(['commit', '--quiet', '--allow-empty', '-m', trailers === '' ? c.message : `${c.message}\n\n${trailers}`], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  });
}
