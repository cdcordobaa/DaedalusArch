/**
 * Summarises repeated `profile.ts` runs into the before/after tables of Docs/v1.3/scale.md. Entry file: no exports.
 *
 * Input: `<dir>/<arm>-<rep>/<project>.json` (the `--out` files of `profile.ts`), for arms such as `before`, `after`
 * and `skip`, with the `--report` file beside each. Output: per arm and project, the median over the repetitions of the wall time, the peak RSS and each
 * stage, the slowest rules, and the cycle-query engine; as JSON (`--out`) and as markdown tables on stdout.
 *
 * Usage: node --import tsx scripts/v1.3/scale/summarise.ts --dir <runs dir> [--out results/v1.3-scale/profiles.json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Stage { readonly name: string; readonly durationMs: number; readonly status: string; readonly peakRssMb?: number }
interface Rule { readonly functionId: string; readonly name: string; readonly ms: number; readonly violations: number }
interface Profile {
  readonly label: string;
  readonly ok: boolean;
  readonly wallMs: number;
  readonly peakRssMb: number;
  readonly files?: number;
  readonly graph?: { readonly nodes: number; readonly edges: number };
  readonly stages: readonly Stage[];
  readonly rules?: readonly Rule[];
  readonly accelerations?: readonly { readonly query: string; readonly engine: string; readonly ms: number }[];
  readonly verdict?: string;
  readonly outcomes?: readonly string[];
}

interface Report {
  readonly functionExecution?: { readonly failed?: readonly { readonly functionId: string; readonly code: string }[] };
  readonly warnings?: readonly { readonly code: string; readonly context?: { readonly metric?: string; readonly functionId?: string } }[];
}

/** What did not complete: failed functions (`FF-S02 EVAL_002` = timeout), null metrics, truncated cycle results. */
function outcomesOf(report: Report): string[] {
  const failed = (report.functionExecution?.failed ?? []).map((f) => `${f.functionId} ${f.code === 'EVAL_002' ? 'timeout' : f.code}`);
  const metrics = (report.warnings ?? []).filter((w) => w.code === 'METRIC_001').map((w) => `${w.context?.metric ?? 'metric'} null`);
  const truncated = (report.warnings ?? []).filter((w) => w.code === 'EVAL_003').map((w) => `${w.context?.functionId ?? ''} truncated at 100`);
  return [...failed, ...metrics, ...truncated];
}

const STAGES: readonly [string, string][] = [
  ['parallel:extract-apg+parse-spec', 'extract'],
  ['ingest-apg', 'ingest'],
  ['evaluate-symbolic', 'evaluate'],
  ['compute-scores', 'score'],
  ['assemble-report', 'assemble'],
];

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
}

const secs = (ms: number): string => (ms / 1000).toFixed(1);

function main(): number {
  const argv = process.argv.slice(2);
  const dir = arg(argv, '--dir');
  if (dir === undefined) {
    process.stderr.write('usage: summarise.ts --dir <runs dir> [--out <file.json>]\n');
    return 2;
  }
  const runs = new Map<string, Map<string, Profile[]>>(); // arm -> project -> reps
  for (const run of fs.readdirSync(dir).sort()) {
    const arm = run.replace(/-\d+$/, '');
    for (const file of fs.readdirSync(path.join(dir, run)).filter((f) => f.endsWith('.json') && !f.endsWith('.report.json')).sort()) {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, run, file), 'utf8')) as Profile;
      const reportFile = path.join(dir, run, file.replace(/\.json$/, '.report.json'));
      const p: Profile = fs.existsSync(reportFile) ? { ...parsed, outcomes: outcomesOf(JSON.parse(fs.readFileSync(reportFile, 'utf8')) as Report) } : parsed;
      const byProject = runs.get(arm) ?? new Map<string, Profile[]>();
      byProject.set(p.label, [...(byProject.get(p.label) ?? []), p]);
      runs.set(arm, byProject);
    }
  }
  const summary: Record<string, Record<string, unknown>> = {};
  for (const [arm, byProject] of runs) {
    summary[arm] = {};
    for (const [project, reps] of byProject) {
      const stageMs = Object.fromEntries(STAGES.map(([name, key]) => [key, median(reps.map((r) => r.stages.find((s) => s.name === name)?.durationMs ?? 0))]));
      const last = reps[reps.length - 1];
      const ruleIds = [...new Set(reps.flatMap((r) => (r.rules ?? []).map((x) => x.functionId)))];
      const rules = ruleIds
        .map((id) => ({ functionId: id, name: reps.find((r) => r.rules?.some((x) => x.functionId === id))?.rules?.find((x) => x.functionId === id)?.name ?? '', ms: median(reps.map((r) => r.rules?.find((x) => x.functionId === id)?.ms ?? 0)) }))
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 3);
      const failedStages = [...new Set(reps.flatMap((r) => r.stages.filter((s) => s.status === 'error').map((s) => s.name)))];
      summary[arm][project] = {
        reps: reps.length,
        ok: reps.every((r) => r.ok),
        files: last?.files,
        graph: last?.graph,
        wallMs: median(reps.map((r) => r.wallMs)),
        wallMsRange: [Math.min(...reps.map((r) => r.wallMs)), Math.max(...reps.map((r) => r.wallMs))],
        peakRssMb: median(reps.map((r) => r.peakRssMb)),
        stageMs,
        slowestRules: rules,
        accelerations: last?.accelerations ?? [],
        errorStages: failedStages,
        outcomes: [...new Set(reps.flatMap((r) => r.outcomes ?? []))],
        verdict: last?.verdict,
      };
    }
  }
  const out = arg(argv, '--out');
  if (out !== undefined) fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);

  const ORDER = ['before', 'after', 'skip'];
  const arms = [...ORDER.filter((a) => a in summary), ...Object.keys(summary).filter((a) => !ORDER.includes(a)).sort()];
  const projects = [...new Set(arms.flatMap((a) => Object.keys(summary[a] ?? {})))];
  const get = (arm: string, project: string): Record<string, unknown> | undefined => summary[arm]?.[project] as Record<string, unknown> | undefined;
  const lines: string[] = [];
  lines.push(`| Project | Files | ${arms.map((a) => `${a} wall (s)`).join(' | ')} | ${arms.map((a) => `${a} peak RSS (MB)`).join(' | ')} |`);
  lines.push(`|---|---|${arms.map(() => '---|').join('')}${arms.map(() => '---|').join('')}`);
  for (const p of projects) {
    const files = String((get(arms[0] ?? '', p)?.['files'] as number | undefined) ?? '');
    lines.push(`| ${p} | ${files} | ${arms.map((a) => secs((get(a, p)?.['wallMs'] as number | undefined) ?? 0)).join(' | ')} | ${arms.map((a) => String(get(a, p)?.['peakRssMb'] ?? '')).join(' | ')} |`);
  }
  for (const a of arms) {
    lines.push('', `**${a}**: median stage times (s)`, '', '| Project | extract | ingest | evaluate | score | assemble | not completed | slowest rules (ms) |', '|---|---|---|---|---|---|---|---|');
    for (const p of projects) {
      const s = get(a, p);
      if (s === undefined) continue;
      const st = s['stageMs'] as Record<string, number>;
      const rules = (s['slowestRules'] as { functionId: string; ms: number }[]).map((r) => `${r.functionId} ${String(r.ms)}`).join(', ');
      const errors = (s['outcomes'] as string[]).join(', ');
      lines.push(`| ${p} | ${secs(st['extract'] ?? 0)} | ${secs(st['ingest'] ?? 0)} | ${secs(st['evaluate'] ?? 0)} | ${secs(st['score'] ?? 0)} | ${secs(st['assemble'] ?? 0)} | ${errors === '' ? 'none' : errors} | ${rules} |`);
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

process.exitCode = main();
