/**
 * Pilot runner options (zero calls): `make-input.ts --task-root … --arms none --runs 2` and the rule-blind pilot scorer
 * (`score-pilot.ts`) on the TRAP-PILOT-v2 reference trees. The study path's byte-identity is checked by
 * `experiments/v15-study/study-input-diff.sh` (against origin/main).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scorePilot } from '../../../experiments/v15-study/score-pilot.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const ROOT = 'experiments/trap-pilot-v2';
const tsx = (args: string[]) => spawnSync(process.execPath, [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], { cwd: REPO, encoding: 'utf8', timeout: 300_000 });

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-pilot-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('make-input.ts pilot option', () => {
  it('plans only the none arm over the pilot variants, with short task names and --runs', () => {
    const r = tsx(['experiments/v15-study/make-input.ts', '--o', path.join(tmp, 'o'), '--vault', path.join(tmp, 'v'), '--srv', path.join(tmp, 'srv'), '--clone', REPO,
      '--task-root', ROOT, '--tasks', 'p1/L1,p6/L3', '--arms', 'none', '--runs', '2', '--phase', 'pilot-test', '--results-dir', 'results/v1.5-pilot-test']);
    expect(r.status).toBe(0);
    const input = JSON.parse(fs.readFileSync(path.join(tmp, 'o', 'pilot-test', 'input.json'), 'utf8')) as Record<string, unknown> & { tasks: { id: string; steps: string[] }[] };
    const map = JSON.parse(fs.readFileSync(path.join(tmp, 'v', 'private-id-map.json'), 'utf8')) as Record<string, { task: string; confirmatory: boolean }>;
    expect(Object.keys(map)).toHaveLength(18);
    expect(Object.values(map).every((v) => !v.confirmatory)).toBe(true);
    expect(input.tasks.map((t) => map[t.id]!.task)).toEqual(['p1-campsite-payments/L1', 'p6-museum-entry/L3']);
    expect(input.tasks.every((t) => t.steps.length === 3)).toBe(true);
    expect(input.arms).toEqual(['none']);
    expect(input.replicates).toBe(2);
    expect(input.plannedSessions).toBe(4);
    expect(input.plannedTurns).toBe(12);
    expect(input.caps).toEqual({ smoke: 1, probes: 1, sessions: 13, total: 15 });
    expect(input.taskRoot).toBe(ROOT);
    expect(input.resultsDir).toBe(path.join(REPO, 'results', 'v1.5-pilot-test'));
  });

  it('refuses an unknown arm', () => {
    const r = tsx(['experiments/v15-study/make-input.ts', '--o', path.join(tmp, 'o'), '--vault', path.join(tmp, 'v'), '--srv', path.join(tmp, 'srv'), '--task-root', ROOT, '--arms', 'gate']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('unknown arm');
  });
});

describe('score-pilot.ts (rule-blind)', () => {
  it('scores the clean reference as trap passed and functional, the shortcut reference as trap failed and functional', () => {
    const variant = 'p4-dental-calendar/L2';
    const vdir = path.join(REPO, ROOT, variant);
    const out = path.join(tmp, 'out');
    for (const [id, tree] of [['c001', 'clean'], ['c002', 'trap']] as const) {
      const s = path.join(out, 'sessions', id);
      fs.cpSync(path.join(vdir, 'seed'), path.join(s, 'snap', 'step-00'), { recursive: true });
      fs.cpSync(path.join(vdir, 'solutions', tree), path.join(s, 'snap', 'step-01'), { recursive: true });
      fs.writeFileSync(path.join(s, 'session.json'), JSON.stringify({ id, planId: id, taskId: 't11', rep: 0, verdict: 'done', steps: [{ typecheck: { errors: 0, codes: [] } }] }));
    }
    fs.mkdirSync(path.join(tmp, 'v'));
    fs.writeFileSync(path.join(tmp, 'v', 'private-id-map.json'), JSON.stringify({ t11: { task: variant, style: 'hexagonal', confirmatory: false } }));
    fs.writeFileSync(path.join(tmp, 'input.json'), JSON.stringify({ vault: path.join(tmp, 'v'), taskRoot: ROOT }));
    const res = scorePilot(out, path.join(tmp, 'input.json'));
    const [clean, shortcut] = res.runs;
    expect(clean).toMatchObject({ session: 'c001', complete: true, trapFailed: false, functional: true, typecheckErrors: [0] });
    expect(shortcut).toMatchObject({ session: 'c002', complete: true, trapFailed: true, functional: true });
    expect(shortcut!.oracleEvidence.length).toBeGreaterThan(0);
    expect(clean!.oracleByStep.map((o) => o.pass)).toEqual([true, true]);
  }, 300_000);
});
