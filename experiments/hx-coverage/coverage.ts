/**
 * HX-COVERAGE (zero calls): which agent trap failures the Hexagonal study's candidate counted rules see, at instrument
 * v1.5.5 (rules root `098d67bd4fdc97c5`, `experiments/hcal-07/RULES-FROZEN.sha256`). No model, no Neo4j, no network;
 * run with `DAEDALUS_MIRROR_SEM=off` (the R-MIRROR-SEM judge is not used, so that rule never fires here).
 *
 *   DAEDALUS_MIRROR_SEM=off npx tsx experiments/hx-coverage/coverage.ts [--out results/v1.5-hx-coverage]
 *
 * Inputs (agent trees kept on main):
 * - `results/v1.5-pilot-ladder/` (TRAP-PILOT-v2 difficulty ladder): every session, trap failures and clean trees;
 * - `results/v1.5-traprate-01/`: the Hexagonal sessions, rebuilt from the committed seed and step diffs with
 *   `restoreSession` (every rebuilt tree checked against the driver's recorded tree hash), as `score-traprate.ts` does.
 * The first final study kept no trees (DEV-2), so it has nothing to score here.
 *
 * Each session is scored by the study scorer's `scoreSessionSteps` (`experiments/v15-study/score-study.ts`, unchanged:
 * the v1.5 rules with step-00 as the baseline, the frozen file rules, the task's tests and oracle on every step). The
 * pilot variants are passed as task paths relative to the scorer's families root, so the scorer reads each variant's
 * own spec, oracle and tests; R-MIRROR2's shape word is the scorer's `Hit.shape`. The variant's oracle is run once more
 * on the final scored copy for its evidence lines.
 * - `experiments/hx-study-set/` parts A and B: each task's reference `solutions/trap` and `solutions/clean` scored as a
 *   one-step session (step-00 = the seed, step-01 = the reference tree).
 *
 * Per session: the identities on the final tree that are new against the seed, by rule group:
 * - counted: the rule ids of rows H01 H02 H03 H04 H05 H07 H08 H09 H10, without FF-S03 and FF-P02 (advisory in the
 *   draft registration), plus R-MIRROR2 (= the scorer's `HX_COUNTED_RULES` + R-MIRROR2). Two readings of R-MIRROR2:
 *   option (ii), every shape word, and option (i), `literal` and `error` only (the scorer's `hxCounted`);
 * - advisory: FF-S03, FF-P02 (reported, never counted);
 * - notCounted: R-MIRROR (status open, B3) and R-MIRROR-SEM (needs the judge; off here);
 * - other: any other rule (R-ADAPTER-RULE, R-D4 …).
 * "Seen" = at least one counted identity new against the seed on the final tree in a file the oracle names in its
 * evidence (the trap's own file); "fires elsewhere" = counted identities only in other files. Hand-read in the report.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules } from '../../src/v15-instrument/index.js';
import { HEX_ROW_RULES, INSTRUMENT_ID, instrumentRuleHash } from '../../src/v15-instrument/rule-set.js';
import { HX_COUNTED_RULES, hxCounted, scoreSessionSteps, type Hit, type SessionScoringContext } from '../v15-study/score-study.js';
import { restoreSession, wilson } from '../traprate-01/score-traprate.js';

const REPO = process.cwd();
const FAM = path.join(REPO, 'experiments', 'trap-families');

export const COUNTED_ROWS = ['H01', 'H02', 'H03', 'H04', 'H05', 'H07', 'H08', 'H09', 'H10'] as const;
export const ADVISORY = ['FF-S03', 'FF-P02'] as const;
export const NOT_COUNTED = ['R-MIRROR', 'R-MIRROR-SEM'] as const;
export const COUNTED: readonly string[] = [...new Set([...COUNTED_ROWS.flatMap((r) => HEX_ROW_RULES[r] ?? []).filter((r) => !(ADVISORY as readonly string[]).includes(r)), 'R-MIRROR2'])].sort();
if (JSON.stringify(COUNTED) !== JSON.stringify([...HX_COUNTED_RULES, 'R-MIRROR2'].sort())) throw new Error('counted set differs from the scorer HX_COUNTED_RULES + R-MIRROR2');
export const groupOf = (rule: string): 'counted' | 'advisory' | 'notCounted' | 'other' =>
  COUNTED.includes(rule) ? 'counted' : (ADVISORY as readonly string[]).includes(rule) ? 'advisory' : (NOT_COUNTED as readonly string[]).includes(rule) ? 'notCounted' : 'other';
/** Files an oracle evidence line names (`SG1: src/x.ts:3 …` or `src/x.ts:3 …`). */
export const evidenceFiles = (lines: readonly string[]): string[] => [...new Set(lines.map((l) => /(src\/[^\s:]+\.ts)/.exec(l)?.[1]).filter((x): x is string => x !== undefined))].sort();

function tsxJson(args: string[]): Record<string, unknown> | null {
  const r = spawnSync(process.execPath, [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  try { return line === undefined ? null : (JSON.parse(line) as Record<string, unknown>); } catch { return null; }
}

interface Src { readonly source: 'pilot-ladder' | 'traprate-01' | 'hx-study-set'; readonly id: string; readonly sessionsDir: string; readonly taskDir: string; readonly label: string; readonly nSteps: number; readonly verdict: string }
interface NewHit { readonly rule: string; readonly group: string; readonly file: string; readonly subject: string; readonly shape: string | null; readonly onTrapFile: boolean; readonly countedI: boolean }

async function main(): Promise<number> {
  if (process.env['DAEDALUS_MIRROR_SEM'] !== 'off') { process.stderr.write('run with DAEDALUS_MIRROR_SEM=off (zero calls)\n'); return 2; }
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const outDir = path.resolve(oi >= 0 ? (argv[oi + 1] as string) : 'results/v1.5-hx-coverage');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-coverage-'));
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(REPO).join('.').split(os.tmpdir()).join('<tmp>');
  const ctx: SessionScoringContext = { scratch, scrub, rules: loadRules(), frozenEnabled: false, nm: undefined, env: {} as SessionScoringContext['env'], deps: null, head: null, onEvaluationFailure: () => undefined };
  const srcs: Src[] = [];
  // Pilot ladder: every session.
  const PL = path.join(REPO, 'results', 'v1.5-pilot-ladder');
  const plMap = JSON.parse(fs.readFileSync(path.join(PL, 'private-id-map.json'), 'utf8')) as Record<string, { task: string }>;
  for (const id of fs.readdirSync(path.join(PL, 'sessions')).sort()) {
    const s = JSON.parse(fs.readFileSync(path.join(PL, 'sessions', id, 'session.json'), 'utf8')) as { taskId: string; steps: unknown[]; verdict: string };
    const v = plMap[s.taskId]?.task;
    if (v === undefined) throw new Error(`pilot: no map entry for ${s.taskId}`);
    srcs.push({ source: 'pilot-ladder', id, sessionsDir: path.join(PL, 'sessions'), taskDir: path.join(REPO, 'experiments', 'trap-pilot-v2', v), label: v, nSteps: s.steps.length, verdict: s.verdict });
  }
  // TRAPRATE-01: the Hexagonal sessions, rebuilt (tree hashes verified).
  const TR = path.join(REPO, 'results', 'v1.5-traprate-01');
  const trMap = JSON.parse(fs.readFileSync(path.join(TR, 'private-id-map.json'), 'utf8')) as Record<string, { task: string; style: string }>;
  const trInput = JSON.parse(fs.readFileSync(path.join(TR, 'run', 'input.json'), 'utf8')) as { tasks: { id: string; seedTreeSha256: string }[] };
  const restored = path.join(scratch, 'traprate-restored');
  let treesVerified = 0;
  for (const id of fs.readdirSync(path.join(TR, 'sessions')).sort()) {
    const s = JSON.parse(fs.readFileSync(path.join(TR, 'sessions', id, 'session.json'), 'utf8')) as { taskId: string; steps: unknown[]; verdict: string };
    const m = trMap[s.taskId];
    if (m === undefined || m.style !== 'hexagonal') continue;
    const pin = trInput.tasks.find((t) => t.id === s.taskId)?.seedTreeSha256;
    if (pin === undefined) throw new Error(`traprate: no seed pin for ${s.taskId}`);
    const rep = restoreSession(TR, id, path.join(FAM, m.task, 'seed'), pin, restored);
    treesVerified += rep.verified.filter(Boolean).length;
    srcs.push({ source: 'traprate-01', id, sessionsDir: restored, taskDir: path.join(FAM, m.task), label: m.task, nSteps: s.steps.length, verdict: s.verdict });
  }
  // HX study set: each reference tree as a one-step session (seed, reference).
  const refs = path.join(scratch, 'hx-refs');
  for (const part of ['part-a', 'part-b']) {
    const pdir = path.join(REPO, 'experiments', 'hx-study-set', part);
    if (!fs.existsSync(pdir)) continue;
    for (const t of fs.readdirSync(pdir).filter((d) => fs.existsSync(path.join(pdir, d, 'oracle.ts'))).sort()) {
      for (const kind of ['trap', 'clean']) {
        const id = `${t}--${kind}`;
        fs.cpSync(path.join(pdir, t, 'seed'), path.join(refs, id, 'snap', 'step-00'), { recursive: true });
        fs.cpSync(path.join(pdir, t, 'solutions', kind), path.join(refs, id, 'snap', 'step-01'), { recursive: true });
        srcs.push({ source: 'hx-study-set', id, sessionsDir: refs, taskDir: path.join(pdir, t), label: `${part}/${t} ${kind}`, nSteps: 1, verdict: 'done' });
      }
    }
  }
  const rows: Record<string, unknown>[] = [];
  try {
    for (const s of srcs) {
      const sid = `${s.source === 'pilot-ladder' ? 'pl' : s.source === 'traprate-01' ? 'tr' : 'hx'}-${s.id}`;
      // The study scorer reads `<families root>/<task>`; a pilot variant is given relative to that root.
      const sc = await scoreSessionSteps({ ...ctx, scratch: path.join(scratch, sid) }, { id: s.id, sessionsDir: s.sessionsDir, task: path.relative(FAM, s.taskDir), style: 'hexagonal', nSteps: s.nSteps, verdict: s.verdict, cell: 'none' });
      const n = sc.snaps.length - 1;
      const finalCopy = path.join(scratch, sid, s.id, `s${String(n)}`);
      const oracle = tsxJson([path.join(s.taskDir, 'oracle.ts'), finalCopy]);
      const subGoals = (oracle?.subGoals as { id: string; pass: boolean; evidence?: string[] }[] | undefined) ?? [];
      const ev = subGoals.filter((g) => !g.pass).flatMap((g) => (g.evidence ?? []).map((e) => `${g.id}: ${e}`));
      const trapFiles = evidenceFiles(ev);
      const key = (h: Pick<Hit, 'rule' | 'file' | 'subject'>): string => `${h.rule}|${h.file}|${h.subject}`;
      const seedKeys = new Set((sc.hitsPerStep[0] ?? []).map(key));
      const seen = new Set<string>();
      const fresh: NewHit[] = [];
      for (const h of sc.hitsPerStep.at(-1) ?? []) {
        const k = key(h);
        if (seedKeys.has(k) || seen.has(k)) continue;
        seen.add(k);
        fresh.push({ rule: h.rule, group: groupOf(h.rule), file: h.file, subject: h.subject, shape: h.shape ?? null, onTrapFile: trapFiles.includes(h.file), countedI: hxCounted(h, 'i') });
      }
      const final = sc.steps.at(-1) as { trapFailed: boolean | null; testsPass: boolean } | undefined;
      const counted = fresh.filter((h) => h.group === 'counted');
      const row = {
        source: s.source, session: s.id, task: s.label, complete: sc.complete,
        trapFailed: final?.trapFailed ?? null, functional: final?.testsPass ?? null,
        oracleEvidence: ev, trapFiles,
        countedOnTrap: counted.filter((h) => h.onTrapFile).length > 0,
        countedAnywhere: counted.length > 0,
        countedOnTrapI: counted.filter((h) => h.onTrapFile && h.countedI).length > 0,
        countedAnywhereI: counted.filter((h) => h.countedI).length > 0,
        newOnFinal: fresh.sort((a, b) => (key(a) < key(b) ? -1 : 1)),
        D_admittedOld: sc.dv.D,
      };
      rows.push(row);
      process.stdout.write(`${s.source} ${s.id} ${s.label}: trapFailed ${String(row.trapFailed)} countedOnTrap ${String(row.countedOnTrap)} new ${fresh.map((h) => `${h.rule}${h.shape !== null ? `[${h.shape}]` : ''}`).join(',') || '-'}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const summarise = (rs: Record<string, unknown>[]) => {
    const traps = rs.filter((r) => r.trapFailed === true);
    const clean = rs.filter((r) => r.trapFailed === false);
    const one = (onTrap: string, any: string) => {
      const k = traps.filter((r) => r[onTrap] === true).length;
      const f = clean.filter((r) => r[any] === true).length;
      return { seen: k, coverage: traps.length === 0 ? null : +(k / traps.length).toFixed(3), wilson95: wilson(k, traps.length), cleanWithCountedFinding: f, fpRate: clean.length === 0 ? null : +(f / clean.length).toFixed(3), fpWilson95: wilson(f, clean.length) };
    };
    return { trapFailures: traps.length, cleanTrees: clean.length, optionII_allShapes: one('countedOnTrap', 'countedAnywhere'), optionI_literalError: one('countedOnTrapI', 'countedAnywhereI') };
  };
  const agentRows = rows.filter((r) => r.source !== 'hx-study-set');
  const rh = instrumentRuleHash();
  const out = {
    schema: 'v15-hx-coverage/v1', modelCalls: 0, mirrorSem: 'off', instrumentId: INSTRUMENT_ID, instrumentRuleHash: rh.hash,
    rulesRoot: '098d67bd4fdc97c5 (experiments/hcal-07/RULES-FROZEN.sha256, 45 files, verified before scoring)',
    counted: COUNTED, advisory: ADVISORY, notCounted: NOT_COUNTED,
    traprateTreesVerified: treesVerified,
    finalStudy: 'no trees kept (DEV-2): not scored',
    hxStudySet: 'reference trap and clean solutions of parts A and B, each scored as a one-step session from the seed',
    summary: { agentTrees: summarise(agentRows), pilotLadder: summarise(rows.filter((r) => r.source === 'pilot-ladder')), traprate01: summarise(rows.filter((r) => r.source === 'traprate-01')), hxStudySetReferences: summarise(rows.filter((r) => r.source === 'hx-study-set')) },
    rows,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'coverage.json'), `${scrub(JSON.stringify(out, null, 1))}\n`);
  process.stdout.write(`${JSON.stringify(out.summary)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('coverage.ts') === true) {
  main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
}
