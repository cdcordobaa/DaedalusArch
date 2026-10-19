/**
 * U5 evasion check, the analysis core and the entry (design §2.6): byte-identical `evasion.json` on two runs, no
 * absolute path in any output (EV-10), steps before `fromStep` ignored (EV-01), exclusions counted (EV-02), observed
 * pairs flagged without changing a count (EV-06a), and the CLI body over a real out-root with one `snapshots.git` per
 * run, where git's own rename detection removes the rename-only diff (EV-06b) and a tampered key is refused (EV-07).
 * Synthetic fixtures; local git only; no model, no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseEvasion, stableStringify } from '../../../../../scripts/v1.3/lib/evasion/analyse.js';
import type { EvasionOptions } from '../../../../../scripts/v1.3/lib/evasion/analyse.js';
import { parseArgs, runEvasion } from '../../../../../scripts/v1.3/lib/evasion/run.js';
import { REMOVAL_CASES, buildGitOutRoot, fixtureIO, loadedRuns, tierText, tmp } from './helpers.js';
import type { RunSpecIn } from './helpers.js';

const H2: [string, string] = ['none@L2', 'daedalus-mcp@L2'];
const OPTS: EvasionOptions = { fromStep: 2, seed: 20261018, perArm: 10, h2: H2, h1: ['none@L2', 'none@L3'], outRootLabel: '<out-root>', tierSource: tierText() };

function grid(): RunSpecIn[] {
  const out: RunSpecIn[] = [];
  for (const c of [...REMOVAL_CASES, 'avoided', 'rename-only', 'observed-pair']) {
    out.push({ caseName: c, arm: 'none', rung: 'L2' }, { caseName: c, arm: 'daedalus-mcp', rung: 'L2' });
  }
  return out;
}

const ABS = /(^|[^<])\/(Users|Volumes|home|private|tmp|var)\//;

/** The report fields these tests read. */
interface Rep {
  readonly schema: string;
  readonly identity: string;
  readonly outRoot: string;
  readonly cells: readonly string[];
  readonly movedOnly: Readonly<Record<string, unknown>>;
  readonly guardedPairs: { readonly observedNotInSpec: readonly (readonly string[])[] };
  readonly flags: Readonly<Record<string, boolean | null>>;
  readonly edgeless: number;
  readonly sample: Readonly<Record<string, unknown>>;
  readonly notHere: { readonly literalView: string };
  readonly acceptance: Readonly<Record<string, { readonly stepsWithRecord: number; readonly stepsPassing: number }>>;
  readonly excluded: { readonly evaluationMissing: number };
  readonly diffs: readonly { readonly runId: string }[];
  readonly humanRead: { readonly readers: number } | null;
}

const asRep = (v: unknown): Rep => v as Rep;

describe('analyseEvasion over the fixture out-root', () => {
  it('is deterministic: byte-identical json and packet on two runs', async () => {
    const a = await analyseEvasion(loadedRuns(grid()), (id) => `/x/${id}`, OPTS, fixtureIO());
    const b = await analyseEvasion(loadedRuns(grid()).reverse(), (id) => `/x/${id}`, OPTS, fixtureIO());
    expect(stableStringify(a.report)).toBe(stableStringify(b.report));
    expect([...a.packet.files]).toEqual([...b.packet.files]);
    expect(a.packet.keyText).toBe(b.packet.keyText);
  });

  it('counts per cell, flags the observed pair without changing a count, and writes no absolute path', async () => {
    const r = await analyseEvasion(loadedRuns(grid()), (id) => `/x/${id}`, OPTS, fixtureIO());
    const rep = asRep(r.report);
    expect(rep.schema).toBe('study2-evasion/v1');
    expect(rep.identity).toBe('pilot-metrics');
    expect(rep.cells).toEqual(['daedalus-mcp@L2', 'none@L2']);
    expect(rep.movedOnly['none@L2']).toEqual({
      eligible: 12,
      byKind: { avoided: 1, removal: 11 },
      byClass: { deleted: 2, 'dynamic-escape': 2, inlined: 1, none: 1, 'relocated-unguarded': 1, 'relocated-unmapped': 4, wrapped: 1 },
      movedOnlyHeuristic: 8,
    });
    expect(rep.movedOnly.H2PairedDiff).toBe(0);
    expect(rep.guardedPairs.observedNotInSpec).toEqual([['business', 'persistence']]);
    expect(rep.flags.guardedPairsIncomplete).toBe(true);
    expect(rep.edgeless).toBe(2);
    expect(rep.sample).toMatchObject({ perArm: 10, pool: 24, drawn: { 'daedalus-mcp@L2': 10, 'none@L2': 10 } });
    expect(rep.flags.evasionHumanRead).toBeNull();
    expect(rep.notHere.literalView).toMatch(/§5\.4/);
    const text = stableStringify(rep) + [...r.packet.files.values()].join('\n') + r.packet.keyText;
    expect(text).not.toMatch(ABS);
  });

  it('EV-01: steps before fromStep are never eligible and never counted in A1', async () => {
    const r = await analyseEvasion(loadedRuns(grid()), (id) => `/x/${id}`, { ...OPTS, fromStep: 3 }, fixtureIO());
    const rep = asRep(r.report);
    expect(r.diffs).toHaveLength(0);
    expect(rep.acceptance['none@L2']?.stepsWithRecord).toBe(0);
  });

  it('EV-05: diffs from a non-H2 cell (none@L3) are counted but never enter the sample pool', async () => {
    const withL3 = [...grid(), ...grid().filter((g) => g.arm === 'none').map((g) => ({ ...g, rung: 'L3' as const }))];
    const r = await analyseEvasion(loadedRuns(withL3), (id) => `/x/${id}`, OPTS, fixtureIO());
    const rep = asRep(r.report);
    expect(rep.cells).toContain('none@L3');
    expect(rep.movedOnly['none@L3']).toBeDefined();
    expect(rep.sample).toMatchObject({ pool: 24, drawn: { 'daedalus-mcp@L2': 10, 'none@L2': 10 } });
    expect(Object.keys(rep.sample.drawn as Record<string, number>)).not.toContain('none@L3');
  });

  it('EV-02: a step without an evaluation is excluded and counted; without acceptance it never passes', async () => {
    const runs = loadedRuns([
      { caseName: 'wrapped', arm: 'none', rung: 'L2', evaluated: [true, false] },
      { caseName: 'inlined', arm: 'daedalus-mcp', rung: 'L2', acceptance: false },
    ]);
    const r = await analyseEvasion(runs, (id) => `/x/${id}`, OPTS, fixtureIO());
    const rep = asRep(r.report);
    expect(rep.excluded.evaluationMissing).toBe(1);
    expect(rep.acceptance['daedalus-mcp@L2']?.stepsPassing).toBe(0);
    expect(rep.sample.pool).toBe(0);
    expect(rep.flags.acceptanceIncomplete).toBe(true);
  });
});

describe('the entry body over a real out-root (one snapshots.git per run)', () => {
  let dir: string;
  beforeAll(() => {
    dir = tmp();
    buildGitOutRoot(path.join(dir, 'out-root'), [
      { caseName: 'rename-only', arm: 'none', rung: 'L2' },
      { caseName: 'rename-only', arm: 'daedalus-mcp', rung: 'L2' },
      { caseName: 'tool-tell', arm: 'none', rung: 'L2' },
      { caseName: 'tool-tell', arm: 'daedalus-mcp', rung: 'L2' },
      { caseName: 'wrapped', arm: 'daedalus-mcp', rung: 'L2' },
    ]);
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('EV-06b with git rename detection; writes the report, packet and key; refuses a tampered key (EV-07)', async () => {
    const args = parseArgs(['--out-root', path.join(dir, 'out-root'), '--out', path.join(dir, 'report'), '--sample-per-arm', '2']);
    if (typeof args === 'string') throw new Error(args);
    const r = await runEvasion(args, process.cwd(), () => new Date('2026-10-18T00:00:00Z'));
    expect(r.exitCode).toBe(0);
    const rep = asRep(JSON.parse(fs.readFileSync(path.join(dir, 'report', 'evasion.json'), 'utf8')));
    expect(rep.outRoot).toBe('<out-root>');
    expect(rep.diffs.map((d) => d.runId.split('/')[2] ?? '').sort()).toEqual(['tool-tell', 'tool-tell', 'wrapped']);
    const packet = fs.readdirSync(path.join(dir, 'report', 'packet')).sort();
    expect(packet).toEqual(['E-01.md', 'E-02.md', 'E-03.md', 'README.md', 'form.csv']);
    const all = packet.map((f) => fs.readFileSync(path.join(dir, 'report', 'packet', f), 'utf8')).join('\n');
    expect(all).not.toMatch(/check_import|which_layer|\bdaedalus\b|\bMCP\b|daedalus-mcp|stub-model/i);
    expect(`${JSON.stringify(rep)}${all}`).not.toMatch(ABS);
    const second = await runEvasion(args, process.cwd(), () => new Date('2026-10-19T00:00:00Z'));
    expect(second.exitCode).toBe(0);
    const again = fs.readFileSync(path.join(dir, 'report', 'evasion.json'), 'utf8');
    expect(again).toBe(stableStringify(rep));

    const form = path.join(dir, 'form.csv');
    fs.writeFileSync(form, 'item,class,note\nE-01,resolved,\nE-02,moved-only,\nE-03,resolved,\n');
    const keyFile = path.join(dir, 'report', 'packet-key', 'key.json');
    const key = fs.readFileSync(keyFile, 'utf8');
    fs.writeFileSync(keyFile, key.replace('"seed": 20261018', '"seed": 1'));
    const refused = await runEvasion({ ...args, labels: form }, process.cwd());
    expect(refused.exitCode).toBe(2);
    expect(refused.message).toMatch(/EVASION_KEY_MISMATCH/);
    fs.writeFileSync(keyFile, key);
    const read = await runEvasion({ ...args, labels: form }, process.cwd());
    expect(read.exitCode).toBe(0);
    const unblinded = asRep(JSON.parse(fs.readFileSync(path.join(dir, 'report', 'evasion.json'), 'utf8')));
    expect(unblinded.humanRead?.readers).toBe(1);
    expect(typeof unblinded.flags.evasionHumanRead).toBe('boolean');
  });
});
