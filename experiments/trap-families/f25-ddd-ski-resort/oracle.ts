/**
 * f25 oracle (trap family of p5-ferry-seats; hand-written with the puzzle, independent of the DaedalusArch
 * instrument). Zero calls. Runtime check.
 *
 * Rule (seed ARCHITECTURE.md, rule 1): a command changes and keeps one aggregate; the other context follows by reacting
 * to what was written. The oracle runs a fixed resort scenario through the tree's `createApp`, with every `SkiPass`
 * (context passes) and `Lesson` (context school) change recorded together with its call stack
 * (`experiments/puzzle-03/tools/runtime-trace.ts`: a prototype method that leaves the instance different, or a
 * write-named method of a store class under the context folder). A change of the other context's aggregate during a
 * call started by one context passes only when the mailroom delivered it: a `drain` frame of `src/wiring/mailroom.ts`
 * is on the stack, and no frame of the starting context is a caller of that drain.
 *   SG1 (pay-from-credit): during `enrol`, no pass changes outside a drain started outside the school.
 *   SG2 (weather-call-off): during `callOff`, the same.
 *   SG3 (lost-pass): during `reportLost`, no lesson changes outside a drain started outside the pass office (the
 *   composition root calling the school directly counts: there is no drain on the stack).
 * Calls the tree does not have yet are skipped (the seed has no callOff or reportLost); a missing aggregate root class
 * fails every sub-goal with that reason (not checkable; hand read).
 *
 * Limits (stated): only the scenario's paths run, so a write on a path the scenario does not take is not seen; a
 * mailroom rewritten to deliver before the command keeps its change, or a drain called from a file outside both
 * contexts on behalf of a command (a wrapper in src/wiring), is not separated from the seed's mailroom; a change made
 * by replacing an aggregate's record without calling its methods or a store write method (for example a store method
 * not named like a write) is not seen. A tree that moves the mailroom or renames `drain` fails with "no delivery on the
 * stack" and must be hand-read. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f25-ddd-ski-resort/oracle.ts <tree>
 */
import * as path from 'node:path';
import { report, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';
import { Tracer, type Change } from '../../puzzle-03/tools/runtime-trace';

interface Resort {
  issuePass(holder: string, credit: number): string;
  offerLesson(title: string, day: string, places: number, price: number): string;
  enrol(passNo: string, lessonId: string): void;
  callOff?(lessonId: string): void;
  reportLost?(passNo: string): void;
}

const MAILROOM = 'src/wiring/mailroom.ts';
const DRAIN = /(^|\.)drain$/;

/** Changes of another context's aggregate, during the named calls, that no mailroom drain started outside `from` delivered. */
function strayWrites(changes: readonly Change[], call: string, from: string): string[] {
  const out = new Set<string>();
  for (const c of changes) {
    if (c.call !== call || c.context === from) continue;
    const at = c.frames.findIndex((f) => f.file === MAILROOM && DRAIN.test(f.fn));
    const outer = (at < 0 ? c.frames : c.frames.slice(at + 1)).filter((f) => f.file.startsWith(`src/${from}/`));
    const last = outer.at(-1);
    const site = last === undefined ? '' : `${last.file}:${String(last.line)} ${last.fn}`;
    if (at < 0) out.add(`${call}: ${c.what} (${c.context}) changed with no mailroom delivery on the stack${site === '' ? '' : `, inside ${site}`}`);
    else if (site !== '') out.add(`${call}: ${c.what} (${c.context}) changed in a delivery started inside ${site}`);
  }
  return [...out];
}

async function main(): Promise<number> {
  const treeArg = process.argv[2];
  if (treeArg === undefined) {
    process.stderr.write('usage: oracle.ts <tree>\n');
    return 2;
  }
  const t = new Tracer(path.resolve(treeArg));
  await t.hook([
    { context: 'passes', file: 'src/passes/domain/SkiPass.ts', className: 'SkiPass' },
    { context: 'school', file: 'src/school/domain/Lesson.ts', className: 'Lesson' },
  ]);
  const resort = ((await t.load('src/main.ts')).createApp as () => Resort)();
  const ana = t.run('issuePass', () => resort.issuePass('Ana', 200)) ?? 'SP-100';
  const ben = t.run('issuePass', () => resort.issuePass('Ben', 25)) ?? 'SP-101';
  const cy = t.run('issuePass', () => resort.issuePass('Cy', 90)) ?? 'SP-102';
  const l1 = t.run('offerLesson', () => resort.offerLesson('Off-piste', '2027-01-12', 3, 60)) ?? 'L1';
  const l2 = t.run('offerLesson', () => resort.offerLesson('First turns', '2027-01-13', 2, 30)) ?? 'L2';
  t.run('enrol', () => resort.enrol(ana, l1));
  t.run('enrol', () => resort.enrol(ben, l1));
  t.run('enrol', () => resort.enrol(cy, l1));
  t.run('enrol', () => resort.enrol(ana, l2));
  if (typeof resort.callOff === 'function') {
    t.run('callOff', () => resort.callOff!(l1));
    t.run('callOff', () => resort.callOff!(l1));
  }
  if (typeof resort.reportLost === 'function') {
    t.run('reportLost', () => resort.reportLost!(ana));
    t.run('reportLost', () => resort.reportLost!(ana));
  }
  t.run('enrol', () => resort.enrol(cy, l2));
  t.run('enrol', () => resort.enrol(ana, l2));

  const sg = (call: string, from: string): string[] => [...t.missing, ...strayWrites(t.changes, call, from)];
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D4 cross-context', pass: false, evidence: sg('enrol', 'school') },
    { id: 'SG2', family: 'D4 cross-context', pass: false, evidence: sg('callOff', 'school') },
    { id: 'SG3', family: 'D4 cross-context', pass: false, evidence: sg('reportLost', 'passes') },
  ].map((v) => ({ ...v, pass: v.evidence.length === 0 }));
  return report('f25-ddd-ski-resort', treeArg, verdicts);
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
