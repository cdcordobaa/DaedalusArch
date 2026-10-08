/**
 * FR-24 acceptance through the CLI (U5a plan Step 32; FR-v1.2E-24; BR-U5a-04, 09, 31, 55; `business-rules.md` §9
 * row 1): the 22 catalogue entries, each at its forced site of `business-logic-model.md` §2.3, are applied by
 * `scripts/mutate.ts` (`main`, in process) to copies of `fixtures/correct-reference` (MO-S03 and MO-S03n under the
 * layered fixture spec) into **one** manifest with `split: 'dev'`. Every copy passes the mutant gate, the manifest
 * validates, the rows equal the hand-written key table, and the fixture's tree sha is unchanged. Also the CLI's
 * usage, refusal and exit-code paths.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { loadManifest, validateManifest } from '../../../../scripts/lib/manifest.js';
import type { Manifest } from '../../../../scripts/lib/manifest.js';
import { COPY_MARKER } from '../../../../scripts/lib/mutation/apply.js';
import { defaultMutateDeps, main, parseMutateArgs, parseSiteJson } from '../../../../scripts/lib/mutation/mutate-main.js';
import type { MutateMainDeps } from '../../../../scripts/lib/mutation/mutate-main.js';
import { CATALOGUE_OPERATORS } from '../../../../scripts/lib/mutation/operators/index.js';
import { computeBaseTreeSha } from '../../../../scripts/lib/mutation/tree-sha.js';
import { CLEAN_SPEC, CORRECT_DIR, NOW, REPO, fixtureBase } from './operator-harness.js';
import { FORCED_SITES } from './forced-sites.js';
import { KEY_TABLE } from './key-table.js';

jest.setTimeout(900_000);

const runner = new NodeProcessRunner();
const CORRECT_REL = 'fixtures/correct-reference';

interface Captured {
  readonly deps: MutateMainDeps;
  readonly out: string[];
  readonly err: string[];
}

function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { deps: { ...defaultMutateDeps(), now: () => NOW, out: (t) => out.push(t), err: (t) => err.push(t) }, out, err };
}

function siteArg(site: { readonly filePath: string; readonly detail: Readonly<Record<string, string>> }): string {
  return JSON.stringify({ filePath: site.filePath, detail: site.detail });
}

async function treeShaOfCorrectReference(): Promise<string> {
  const r = await computeBaseTreeSha(runner, fixtureBase(CLEAN_SPEC), CORRECT_DIR, []);
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

let scratch: string;
let manifestPath: string;
let outRoot: string;
let shaBefore: string;
const exits = new Map<string, number>();
let manifest: Manifest;

beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-fr24-'));
  manifestPath = path.join(scratch, 'manifest.json');
  outRoot = path.join(scratch, 'out');
  shaBefore = await treeShaOfCorrectReference();
  for (const e of FORCED_SITES) {
    const c = capture();
    const code = await main(
      ['--base', CORRECT_REL, '--spec', e.spec, '--operator', e.id, '--site', siteArg(e.site), '--manifest', manifestPath, '--out', outRoot],
      REPO,
      c.deps,
    );
    if (code !== 0) throw new Error(`${e.id}: exit ${String(code)} ${c.err.join('')}`);
    exits.set(e.id, code);
  }
  const m = loadManifest(REPO, manifestPath);
  if (!m.success) throw new Error(JSON.stringify(m.errors));
  manifest = m.data;
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe('FR-24 acceptance: 22 entries through scripts/mutate.ts into one manifest', () => {
  it('every entry exits 0 and appends exactly one forced dev row; no rejection', () => {
    expect([...exits.keys()].sort()).toEqual(CATALOGUE_OPERATORS.map((o) => o.id).sort());
    expect([...exits.values()].every((c) => c === 0)).toBe(true);
    expect(manifest.rows.map((r) => r.operatorId)).toEqual(FORCED_SITES.map((f) => f.id));
    expect(manifest.rejections).toEqual([]);
    expect(manifest.cycleStrategy).toBe('simple-cycles');
    for (const r of manifest.rows) {
      expect([r.operatorId, r.split, r.siteSelection, r.projectId]).toEqual([r.operatorId, 'dev', 'forced', 'correct-reference']);
    }
  });

  it('the manifest validates against the frozen schema', () => {
    expect(validateManifest(REPO, JSON.parse(fs.readFileSync(manifestPath, 'utf8')))).toEqual({ valid: true, errors: [] });
  });

  it('every copy passed the mutant gate and keeps its marker', () => {
    for (const r of manifest.rows) {
      expect([r.operatorId, r.typecheck.baseErrors, r.typecheck.mutantErrors]).toEqual([r.operatorId, 0, 0]);
      expect(fs.existsSync(path.join(outRoot, r.projectId, r.operatorId, 'k-0', COPY_MARKER))).toBe(true);
    }
  });

  it('the rows equal the hand-written key table (BR-U5a-14, 20)', () => {
    for (const r of manifest.rows) {
      const keys = r.expected.keys.map((k) => [k.functionId, k.filePath, k.target, k.discriminator, k.lineRule, k.line ?? null]);
      const coll = r.expected.collateral.map((c) => [c.kind, c.cause, c.functionId, c.key?.filePath ?? null, c.key?.target ?? null, c.key?.discriminator ?? null, c.key?.lineRule ?? null, c.key?.line ?? null]);
      expect([r.operatorId, { keys, collateral: coll }]).toEqual([r.operatorId, KEY_TABLE[r.operatorId]]);
    }
  });

  it('MO-S03 and MO-S03n were resolved under the layered fixture spec; the others under clean-arch', () => {
    for (const r of manifest.rows) {
      const spec = FORCED_SITES.find((f) => f.id === r.operatorId)?.spec;
      expect([r.operatorId, r.specPath]).toEqual([r.operatorId, spec]);
    }
  });

  it('fixtures/correct-reference tree sha is unchanged (BR-U5a-04)', async () => {
    expect(await treeShaOfCorrectReference()).toBe(shaBefore);
  });
});

describe('scripts/mutate.ts usage and refusals (exit codes)', () => {
  const s01 = FORCED_SITES[0];
  if (s01 === undefined) throw new Error('no forced sites');

  it('--help prints the usage and exits 0; no argument exits 2', async () => {
    const c = capture();
    expect(await main(['--help'], REPO, c.deps)).toBe(0);
    expect(c.out.join('')).toContain('usage: npx tsx scripts/mutate.ts');
    const d = capture();
    expect(await main([], REPO, d.deps)).toBe(2);
    expect(d.err.join('')).toContain('MUT_USAGE');
  });

  it('outside the repository root exits 2', async () => {
    const c = capture();
    expect(await main(['--help'], os.tmpdir(), c.deps)).toBe(2);
    expect(c.err.join('')).toContain('run from the repository root');
  });

  it('argument parsing: sampling needs --k; bad --site, --k, --split and --cycle-strategy are usage errors', () => {
    const base = ['--base', CORRECT_REL, '--spec', CLEAN_SPEC, '--operator', 'MO-S01', '--manifest', 'm.json', '--out', 'o'];
    expect(parseMutateArgs(base).success).toBe(false);
    expect(parseMutateArgs([...base, '--k', '2']).success).toBe(true);
    expect(parseMutateArgs([...base, '--k', 'x']).success).toBe(false);
    expect(parseMutateArgs([...base, '--k', '1', '--split', 'gold']).success).toBe(false);
    expect(parseMutateArgs([...base, '--k', '1', '--cycle-strategy', 'tarjan']).success).toBe(false);
    expect(parseSiteJson('{"filePath":"a.ts","detail":{"n":1}}').success).toBe(false);
    expect(parseSiteJson('{"filePath":"a.ts","extra":1}').success).toBe(false);
    expect(parseSiteJson('[1]').success).toBe(false);
    const ok = parseSiteJson('{"filePath":"a.ts","line":3,"detail":{"symbol":"X"}}');
    expect(ok.success && ok.data).toEqual({ filePath: 'a.ts', line: 3, detail: { symbol: 'X' } });
    const forced = parseMutateArgs([...base, '--site', siteArg(s01.site), '--k', '1', '--cycle-strategy', 'scc']);
    expect(forced.success && [forced.data.k, forced.data.cycleStrategy, forced.data.split]).toEqual([1, 'scc', 'dev']);
    const sp = ['--base', CORRECT_REL, '--spec', CLEAN_SPEC, '--operator', 'SP-FF-C04', '--manifest', 'm.json', '--out', 'o', '--k', '1'];
    const spDefault = parseMutateArgs(sp);
    expect(spDefault.success && spDefault.data.split).toBe('probe');
    const spDev = parseMutateArgs([...sp, '--split', 'dev']);
    expect(spDev.success && spDev.data.split).toBe('dev');
  });

  it('an unknown operator exits 2', async () => {
    const c = capture();
    const args = ['--base', CORRECT_REL, '--spec', CLEAN_SPEC, '--operator', 'MO-NOPE', '--site', siteArg(s01.site), '--manifest', path.join(scratch, 'u.json'), '--out', path.join(scratch, 'u')];
    expect(await main(args, REPO, c.deps)).toBe(2);
    expect(c.err.join('')).toContain('MUT_UNKNOWN_OPERATOR');
    expect(fs.existsSync(path.join(scratch, 'u.json'))).toBe(false);
  });

  it('--cycle-strategy against an existing header → MAN_CYCLE_STRATEGY_MISMATCH, exit 2, manifest bytes unchanged (D-U5a-14)', async () => {
    const before = fs.readFileSync(manifestPath);
    const c = capture();
    const args = ['--base', CORRECT_REL, '--spec', CLEAN_SPEC, '--operator', 'MO-S01', '--site', siteArg(s01.site), '--k', '1', '--cycle-strategy', 'scc', '--manifest', manifestPath, '--out', outRoot];
    expect(await main(args, REPO, c.deps)).toBe(2);
    expect(c.err.join('')).toContain('MAN_CYCLE_STRATEGY_MISMATCH');
    expect(fs.readFileSync(manifestPath).equals(before)).toBe(true);
  });

  it('a forced site outside the eligible list → MUT_SITE_OVERRIDE_INVALID, exit 1, manifest bytes unchanged (BR-U5a-55)', async () => {
    const before = fs.readFileSync(manifestPath);
    const c = capture();
    const bad = JSON.stringify({ filePath: 'src/domain/entities/Task.ts', detail: { symbol: 'Nope', targetFile: 'src/domain/entities/Category.ts' } });
    const args = ['--base', CORRECT_REL, '--spec', CLEAN_SPEC, '--operator', 'MO-S01', '--site', bad, '--k', '1', '--manifest', manifestPath, '--out', outRoot];
    expect(await main(args, REPO, c.deps)).toBe(1);
    expect(c.err.join('')).toContain('MUT_SITE_OVERRIDE_INVALID');
    expect(fs.readFileSync(manifestPath).equals(before)).toBe(true);
  });

  it('a prepared-base JSON whose specPath differs from --spec exits 2 (MUT_SPEC_MISMATCH)', async () => {
    const prepared = path.join(scratch, 'prepared.json');
    fs.writeFileSync(prepared, JSON.stringify({ ...fixtureBase(CLEAN_SPEC) }));
    const c = capture();
    const args = ['--base', prepared, '--spec', 'specs/other.yaml', '--operator', 'MO-S01', '--site', siteArg(s01.site), '--manifest', path.join(scratch, 'p.json'), '--out', path.join(scratch, 'p')];
    expect(await main(args, REPO, c.deps)).toBe(2);
    expect(c.err.join('')).toContain('MUT_SPEC_MISMATCH');
  });
});
