/**
 * HX study set rule-visibility check (pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` §9.1). Each
 * task's reference trap tree and clean tree is scored by the study scorer (`scoreSessionSteps`, `--counted hx-i`) as a
 * one-step session from the task's seed: step-00 = seed, step-01 = the reference.
 *
 *   DAEDALUS_MIRROR_SEM=off npx tsx experiments/hx-study-set/visibility.ts --out results/v1.5-hx-prereg/visibility
 *   DAEDALUS_MIRROR_SEM=live DAEDALUS_MIRROR_SEM_CACHE=<fresh empty dir> \
 *     npx tsx experiments/hx-study-set/visibility.ts --sem --out results/v1.5-hx-prereg/visibility-sem
 *
 * Judge off (zero calls): every primary task (D8: the 11 not in `semOnly`) must have D_hx > 0 on its trap tree with a
 * counted identity in a file the oracle names in its failing evidence ("seen"), and D_hx = 0 on its clean tree.
 * `--sem` (live judge, `claude-opus-5-5` through the Claude CLI, a fresh empty cache so every candidate is asked): the
 * `semOnly` tasks only; each must have D_sem > 0 on its trap tree; D_sem on the clean tree is reported.
 * Writes `<out>/visibility.json`; exit 0 iff every check holds.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules } from '../../src/v15-instrument/index.js';
import { INSTRUMENT_ID } from '../../src/v15-instrument/rule-set.js';
import { scoreSessionSteps, type SessionScoringContext } from '../v15-study/score-study.js';
import { loadStudySet } from '../v15-study/lib/study-set.js';

const REPO = process.cwd();
const MANIFEST = 'experiments/hx-study-set/study-set.json';

/** Files an oracle evidence line names (`src/x.ts:3 …`). */
const evidenceFiles = (lines: readonly string[]): string[] => [...new Set(lines.map((l) => /(src\/[^\s:]+\.ts)/.exec(l)?.[1]).filter((x): x is string => x !== undefined))].sort();

function tsxJson(args: string[]): Record<string, unknown> | null {
  const r = spawnSync(process.execPath, [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  try { return line === undefined ? null : (JSON.parse(line) as Record<string, unknown>); } catch { return null; }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const sem = argv.includes('--sem');
  const mode = process.env['DAEDALUS_MIRROR_SEM'];
  if (!sem && mode !== 'off') { process.stderr.write('run with DAEDALUS_MIRROR_SEM=off (zero calls), or --sem with live\n'); return 2; }
  if (sem && (mode !== 'live' || process.env['DAEDALUS_MIRROR_SEM_CACHE'] === undefined)) { process.stderr.write('--sem needs DAEDALUS_MIRROR_SEM=live and a fresh DAEDALUS_MIRROR_SEM_CACHE\n'); return 2; }
  if (sem && fs.readdirSync(process.env['DAEDALUS_MIRROR_SEM_CACHE'] as string).length > 0) { process.stderr.write('the judge cache must be empty (a fresh cache: every candidate asked)\n'); return 2; }
  const oi = argv.indexOf('--out');
  const outDir = path.resolve(oi >= 0 ? (argv[oi + 1] as string) : `results/v1.5-hx-prereg/visibility${sem ? '-sem' : ''}`);
  const set = loadStudySet(REPO, MANIFEST);
  const tasks = set.confirmatory.hexagonal.filter((t) => (sem ? set.semOnly.includes(t) : true));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-visibility-'));
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(REPO).join('.').split(os.tmpdir()).join('<tmp>');
  const ctx: SessionScoringContext = { scratch, scrub, rules: loadRules(), frozenEnabled: false, nm: undefined, env: {} as SessionScoringContext['env'], deps: null, head: null, onEvaluationFailure: () => undefined, counted: 'i', taskDir: set.dirOf };
  const rows: Record<string, unknown>[] = [];
  let ok = true;
  try {
    const refs = path.join(scratch, 'refs');
    for (const t of tasks) {
      const primary = !set.semOnly.includes(t);
      const row: Record<string, unknown> = { task: t, primary };
      for (const kind of ['trap', 'clean'] as const) {
        const id = `${t}--${kind}`;
        const td = path.join(REPO, set.dirOf(t));
        fs.cpSync(path.join(td, 'seed'), path.join(refs, id, 'snap', 'step-00'), { recursive: true });
        fs.cpSync(path.join(td, 'solutions', kind), path.join(refs, id, 'snap', 'step-01'), { recursive: true });
        const sc = await scoreSessionSteps({ ...ctx, scratch: path.join(scratch, id) }, { id, sessionsDir: refs, task: t, style: 'hexagonal', nSteps: 1, verdict: 'done', cell: 'none' });
        const finalCopy = path.join(scratch, id, id, 's1');
        const oracle = tsxJson([path.join(set.dirOf(t), 'oracle.ts'), finalCopy]);
        const subGoals = (oracle?.subGoals as { id: string; pass: boolean; evidence?: string[] }[] | undefined) ?? [];
        const ev = subGoals.filter((g) => !g.pass).flatMap((g) => g.evidence ?? []);
        const trapFiles = evidenceFiles(ev);
        const step = sc.steps.at(-1) as { trapFailed: boolean | null; testsPass: boolean; symbolicNewVsSeed?: { rule: string; file: string; subject: string; shape?: string; counted: boolean }[] };
        const newHits = step.symbolicNewVsSeed ?? [];
        const counted = newHits.filter((h) => h.counted);
        const semHits = newHits.filter((h) => h.rule === 'R-MIRROR-SEM');
        row[kind] = {
          trapFailed: step.trapFailed, testsPass: step.testsPass, D: sc.dv.D, Dsem: sc.dsem?.D ?? null,
          countedOnTrapFile: counted.filter((h) => trapFiles.includes(h.file)).map((h) => `${h.rule}${h.shape !== undefined ? `[${h.shape}]` : ''} ${h.file} ${h.subject}`),
          countedElsewhere: counted.filter((h) => !trapFiles.includes(h.file)).map((h) => `${h.rule}${h.shape !== undefined ? `[${h.shape}]` : ''} ${h.file} ${h.subject}`),
          notCounted: newHits.filter((h) => !h.counted).map((h) => `${h.rule}${h.shape !== undefined ? `[${h.shape}]` : ''} ${h.file} ${h.subject}`),
          semHits: semHits.map((h) => `${h.file} ${h.subject}`),
          oracleEvidence: ev,
        };
      }
      const trap = row['trap'] as { trapFailed: boolean | null; testsPass: boolean; D: number | null; Dsem: number | null; countedOnTrapFile: string[] };
      const clean = row['clean'] as { trapFailed: boolean | null; testsPass: boolean; D: number | null; Dsem: number | null };
      const refsOk = trap.trapFailed === true && trap.testsPass && clean.trapFailed === false && clean.testsPass;
      const pass = sem
        ? refsOk && (trap.Dsem ?? 0) > 0
        : primary
          ? refsOk && (trap.D ?? 0) > 0 && trap.countedOnTrapFile.length > 0 && clean.D === 0
          : refsOk; // judge off: a semOnly task is not checked for D_hx (it is not in it); its D_hx is reported
      row['pass'] = pass;
      if (!pass) ok = false;
      rows.push(row);
      process.stdout.write(`${pass ? 'ok  ' : 'FAIL'} ${t}${primary ? '' : ' (secondary 8 only)'}: trap D ${String(trap.D)} Dsem ${String(trap.Dsem)} seen [${trap.countedOnTrapFile.join('; ')}]; clean D ${String(clean.D)} Dsem ${String(clean.Dsem)}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const out = { schema: 'hx-visibility/v1', date: new Date().toISOString().slice(0, 10), instrumentId: INSTRUMENT_ID, counted: 'hx-i', judge: sem ? 'live, fresh cache (claude-opus-5-5, Claude CLI route)' : 'off (zero calls)', allPass: ok, rows };
  fs.writeFileSync(path.join(outDir, 'visibility.json'), `${scrub(JSON.stringify(out, null, 1))}\n`);
  return ok ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
