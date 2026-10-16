/**
 * Study 2 analysis: from a loop out-root to every planned table and figure. NOT A PRE-REGISTRATION (the analysis is a
 * candidate; Docs/v1.3/study2-analysis-rehearsal.md lists what must be fixed before it is locked). Entry file: no
 * exports. Analysis: scripts/v1.3/lib/study2-analysis.ts; tables and figures: scripts/v1.3/lib/study2-report.ts.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-analyse.ts --out-root <study2 out-root> --out <dir>
 *     (--pilot-out-root <pilot out-root> [--labels <labels.json>] | --primary blocking|advisory-per-kloc --reason <text>)
 *     [--seed 20261016] [--resamples 4999] [--flips 9999] [--engine neo4j|cypher-interp]
 * `--engine` (default neo4j, the reference engine) is the graph engine every evaluated snapshot of the out-root (and of
 * the pilot out-root) must record; any other engine, or none recorded, stops the analysis before it reads a number.
 * `--labels` is a JSON object { "<ruleId>|<filePath>|<target>": "correct" | "incorrect" | "not-checkable-confirmed" |
 * "not-checkable" } (check-correct.ts labels of the pilot's new findings). Writes <dir>/report.md, report.json and
 * the SVG figures. Reads step records only; makes no model call and no network call.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_OPTIONS, analyse, overrideSwitch, pilotSwitch } from './lib/study2-analysis.js';
import type { FindingLabel, PrimaryOutcome } from './lib/study2-analysis.js';
import { parseGraphEngine } from '../../src/cypher-interp/engine.js';
import { engineProblems, loadOutRoot } from './lib/study2-io.js';
import type { LoadedOutRoot } from './lib/study2-io.js';
import { forestSvg, renderReport, trajectorySvg } from './lib/study2-report.js';
import { METRIC_LABEL } from './lib/study2-analysis.js';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};
const int = (name: string, def: number): number => {
  const v = Number(opt(name, String(def)));
  if (!Number.isSafeInteger(v) || v <= 0) throw new Error(`${name} must be a positive integer`);
  return v;
};

try {
  const outRoot = opt('--out-root', '');
  const out = opt('--out', '');
  if (outRoot === '' || out === '') throw new Error('--out-root and --out are required');
  const engine = parseGraphEngine(opt('--engine', 'neo4j'));
  if (engine === undefined) throw new Error('--engine must be neo4j or cypher-interp');
  const checked = (root: string): LoadedOutRoot => {
    const loaded = loadOutRoot(root);
    const problems = engineProblems(loaded.runs, engine);
    if (problems.length > 0) throw new Error(`${root}: snapshots not evaluated on ${engine}:\n${problems.slice(0, 20).join('\n')}`);
    return loaded;
  };
  const study = checked(outRoot);
  const pilotRoot = opt('--pilot-out-root', '');
  const primary = opt('--primary', '');
  let decision;
  if (pilotRoot !== '') {
    const labelsFile = opt('--labels', '');
    const labels = labelsFile === '' ? null : new Map(Object.entries(JSON.parse(fs.readFileSync(labelsFile, 'utf8')) as Record<string, FindingLabel>));
    decision = pilotSwitch(checked(pilotRoot).runs, labels);
  } else if (primary === 'blocking' || primary === 'advisory-per-kloc') {
    const reason = opt('--reason', '');
    if (reason === '') throw new Error('--primary needs --reason');
    decision = overrideSwitch(primary as PrimaryOutcome, reason);
  } else {
    throw new Error('give --pilot-out-root (the memo §5 rule) or --primary with --reason');
  }
  const options = { ...DEFAULT_OPTIONS, seed: int('--seed', DEFAULT_OPTIONS.seed), resamples: int('--resamples', DEFAULT_OPTIONS.resamples), flips: int('--flips', DEFAULT_OPTIONS.flips) };
  const report = analyse(study.runs, study.scheduled, decision, options);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'report.md'), renderReport(report, `Study 2 analysis: ${path.basename(path.resolve(outRoot, '..'))}`));
  fs.writeFileSync(path.join(out, 'F1-trajectory.svg'), trajectorySvg(report.trajectories.primary, METRIC_LABEL[report.primaryMetric].replace(/, slope per step$|^Erosion slope: /g, ''), 'F1. Primary outcome per step, by arm (mean, 95% normal CI)'));
  for (const c of report.confirmatory) fs.writeFileSync(path.join(out, `F2-forest-${c.arm}-vs-${c.reference}.svg`), forestSvg(c, `F2. Task-level effects: ${c.arm} − ${c.reference}`));
  if (study.missingRuns.length > 0) process.stderr.write(`warning: ${String(study.missingRuns.length)} scheduled runs have no run.json\n`);
  process.stdout.write(`${report.switch.statement}\n${report.confirmatory.map((c) => `${c.arm} − ${c.reference}: diff ${String(c.meanDiff)} Holm p ${String(c.holmP)}`).join('\n')}\n→ ${out}\n`);
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
