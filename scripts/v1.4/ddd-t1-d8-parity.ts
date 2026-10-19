/**
 * v1.4 TIER-A4 (REV-04 P15/P19, gate D8): the Neo4j half of the TIER-A3 re-score. Entry file: no exports.
 * Report: `Docs/DiagnosticRuns/v1.4-ddd-t1-and-d8-2026-10-19.md`.
 *
 * Usage (repository root), after `ddd-b2-t1-rescore.ts --engine neo4j --dest results/v1.4-ddd-t1-d8`:
 *   npx tsx scripts/v1.4/ddd-t1-d8-parity.ts [--interp results/v1.4-ddd-b2-v9/cypher-interp]
 *     [--neo4j results/v1.4-ddd-t1-d8/neo4j] [--out results/v1.4-ddd-t1-d8]
 *
 * Zero model calls; reads stored CLI reports only.
 * - T1 (`<out>/t1-compare.json`): each Neo4j row of `rows.json` against the interpreter row of the same subject, run,
 *   variant, post-seal and step: scored, verdict, blocking AHS, Y, the blocking rules run and the blocking findings;
 *   each `drift.json` row: Y1, memo D, edge-grain D, per step.
 * - D8 (`<out>/d8-parity.{json,md}`): per snapshot (CLI report pair), the whole result field by field (the areas of
 *   `scripts/v1.3/cypher-interp-compare-runs.ts`) and, per rule over every tier, the violation count, the identity
 *   multiset (rule, file, target, discriminator) and the file set (file, target and `.ts` evidence; a cycle by its
 *   files).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const i = argv.indexOf(name);
  return path.resolve(i >= 0 ? (argv[i + 1] ?? fallback) : fallback);
};
const interpDir = opt('--interp', 'results/v1.4-ddd-b2-v9/cypher-interp');
const neoDir = opt('--neo4j', 'results/v1.4-ddd-t1-d8/neo4j');
const outDir = opt('--out', 'results/v1.4-ddd-t1-d8');
const rel = (p: string): string => path.relative(process.cwd(), p);

type Obj = Record<string, unknown>;
const read = (p: string): Obj => JSON.parse(fs.readFileSync(p, 'utf8')) as Obj;

function files(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(root, p));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

/** Every leaf path where the two JSON values differ (arrays by index), as in `cypher-interp-compare-runs.ts`. */
function diffPaths(a: unknown, b: unknown, at = '$'): string[] {
  if (a === b) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = a.length === b.length ? [] : [`${at}.length (${String(a.length)} vs ${String(b.length)})`];
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(...diffPaths(a[i], b[i], `${at}[${String(i)}]`));
    return out;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out: string[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diffPaths((a as Obj)[k], (b as Obj)[k], `${at}.${k}`));
    return out;
  }
  return [`${at} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`];
}

const AREAS: readonly (readonly [string, (r: Obj) => unknown])[] = [
  ['ahsDeterministic', (r) => r.ahsDeterministic],
  ['verdict', (r) => [r.verdict, (r.tiers as Obj | undefined)?.verdict]],
  ['blockingAhs', (r) => (r.tiers as Obj | undefined)?.blockingAhs],
  ['perDimensionScores', (r) => r.perDimensionScores],
  ['universalMetrics', (r) => r.universalMetrics],
  ['tiers', (r) => r.tiers],
  ['functionExecution', (r) => r.functionExecution],
  ['functionResults', (r) => r.functionResults],
  ['disabledFunctions', (r) => r.disabledFunctions],
  ['graphStats', (r) => r.graphStats],
  ['violations', (r) => r.violations],
  ['warnings', (r) => r.warnings],
  ['whole result', (r) => r],
];

interface Violation { functionId: string; filePath: string; target?: string; discriminator?: string[]; evidence?: string[] }
const identity = (v: Violation): string => JSON.stringify([v.functionId, v.filePath, v.target ?? null, v.discriminator ?? []]);
const fileSet = (vs: Violation[]): string[] => [...new Set(vs.flatMap((v) => [v.filePath, ...(v.target !== undefined ? [v.target] : []), ...(v.evidence ?? []).filter((e) => e.endsWith('.ts'))]))].sort();

/** Per rule over every tier: count, identity multiset and file set, Neo4j vs interpreter. */
function perRule(n: Obj, i: Obj): { rule: string; neo4j: number; interp: number; identitiesAgree: boolean; fileSetsAgree: boolean }[] {
  const by = (r: Obj): Map<string, Violation[]> => {
    const m = new Map<string, Violation[]>();
    for (const v of r.violations as Violation[]) m.set(v.functionId, [...(m.get(v.functionId) ?? []), v]);
    return m;
  };
  const bn = by(n);
  const bi = by(i);
  return [...new Set([...bn.keys(), ...bi.keys()])].sort().map((rule) => {
    const vn = bn.get(rule) ?? [];
    const vi = bi.get(rule) ?? [];
    return {
      rule, neo4j: vn.length, interp: vi.length,
      identitiesAgree: JSON.stringify(vn.map(identity).sort()) === JSON.stringify(vi.map(identity).sort()),
      fileSetsAgree: JSON.stringify(fileSet(vn)) === JSON.stringify(fileSet(vi)),
    };
  });
}

const rowKey = (r: Obj): string => JSON.stringify([r.subject, r.run, r.variant, r.postSeal, r.step]);
const driftKey = (r: Obj): string => JSON.stringify([r.subject, r.run, r.variant, r.postSeal]);
const T1_FIELDS = ['scored', 'verdict', 'blockingAhs', 'blocking', 'blockingRulesRun', 'blockingByRule', 'blockingFindings', 'error'] as const;
const DRIFT_FIELDS = ['Y1', 'memoD', 'perStep', 'edgeGrain'] as const;

function main(): number {
  // T1: the rows and the drift, Neo4j against the interpreter.
  const pair = (name: string, key: (r: Obj) => string, fields: readonly string[]): Obj[] => {
    const ni = new Map((JSON.parse(fs.readFileSync(path.join(interpDir, name), 'utf8')) as Obj[]).map((r) => [key(r), r]));
    return (JSON.parse(fs.readFileSync(path.join(neoDir, name), 'utf8')) as Obj[]).map((n) => {
      const i = ni.get(key(n));
      ni.delete(key(n));
      const differences = i === undefined ? ['missing on cypher-interp'] : fields.flatMap((f) => diffPaths(n[f], i[f], `$.${f}`));
      return { key: JSON.parse(key(n)) as unknown, differences };
    }).concat([...ni.keys()].map((k) => ({ key: JSON.parse(k) as unknown, differences: ['missing on neo4j'] })));
  };
  const t1Rows = pair('rows.json', rowKey, T1_FIELDS);
  const t1Drift = pair('drift.json', driftKey, DRIFT_FIELDS);
  const neoRows = JSON.parse(fs.readFileSync(path.join(neoDir, 'rows.json'), 'utf8')) as Obj[];

  // D8: the CLI reports, snapshot by snapshot.
  const cliI = files(path.join(interpDir, 'cli'));
  const cliN = new Set(files(path.join(neoDir, 'cli')));
  const cli = cliI.map((f) => {
    const subject = f.split(path.sep)[0] ?? '';
    if (!cliN.has(f)) return { path: f, subject, missing: true, areas: {}, rules: [] };
    cliN.delete(f);
    const n = read(path.join(neoDir, 'cli', f));
    const i = read(path.join(interpDir, 'cli', f));
    return { path: f, subject, missing: false, areas: Object.fromEntries(AREAS.map(([name, get]) => [name, diffPaths(get(n), get(i))])), rules: perRule(n, i) };
  });
  const bySubject = [...new Set(cli.map((c) => c.subject))].map((subject) => {
    const cs = cli.filter((c) => c.subject === subject);
    const rules = cs.flatMap((c) => c.rules);
    return {
      subject, reports: cs.length, missing: cs.filter((c) => c.missing).length,
      identicalByArea: Object.fromEntries(AREAS.map(([name]) => [name, cs.filter((c) => !c.missing && ((c.areas as Record<string, string[]>)[name] ?? []).length === 0).length])),
      ruleRows: rules.length, ruleRowsWithFindings: rules.filter((r) => r.neo4j + r.interp > 0).length,
      countsAgree: rules.filter((r) => r.neo4j === r.interp).length, identitiesAgree: rules.filter((r) => r.identitiesAgree).length, fileSetsAgree: rules.filter((r) => r.fileSetsAgree).length,
      violations: { neo4j: rules.reduce((s, r) => s + r.neo4j, 0), interp: rules.reduce((s, r) => s + r.interp, 0) },
    };
  });
  const allRules = [...new Set(cli.flatMap((c) => c.rules.map((r) => `${c.subject} ${r.rule}`)))].sort().map((k) => {
    const [subject, rule] = k.split(' ');
    const rs = cli.filter((c) => c.subject === subject).flatMap((c) => c.rules.filter((r) => r.rule === rule));
    return { subject, rule, reportsWithRule: rs.length, neo4j: rs.reduce((s, r) => s + r.neo4j, 0), interp: rs.reduce((s, r) => s + r.interp, 0), fileSetsAgree: rs.filter((r) => r.fileSetsAgree).length, identitiesAgree: rs.filter((r) => r.identitiesAgree).length };
  });
  const summary = {
    neo4j: rel(neoDir), interp: rel(interpDir),
    t1: {
      rows: t1Rows.length, rowsIdentical: t1Rows.filter((r) => (r.differences as string[]).length === 0).length,
      neo4jErrors: neoRows.filter((r) => r.scored !== true).length,
      drift: t1Drift.length, driftIdentical: t1Drift.filter((r) => (r.differences as string[]).length === 0).length,
      msMedian: [...neoRows.map((r) => Number(r.ms))].sort((a, b) => a - b)[Math.floor(neoRows.length / 2)],
    },
    d8: { reports: cli.length, neo4jOnly: [...cliN], bySubject },
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 't1-compare.json'), `${JSON.stringify({ summary: summary.t1, rows: t1Rows, drift: t1Drift }, null, 1)}\n`);
  fs.writeFileSync(path.join(outDir, 'd8-parity.json'), `${JSON.stringify({ summary, rules: allRules, cli }, null, 1)}\n`);
  const md = [
    '# D8: cypher-interp vs Neo4j 5.26.24 on the TIER-A3 snapshots', '',
    `Neo4j \`${summary.neo4j}\`, interpreter \`${summary.interp}\`. T1 rows identical ${String(summary.t1.rowsIdentical)}/${String(summary.t1.rows)}; drift rows identical ${String(summary.t1.driftIdentical)}/${String(summary.t1.drift)}; Neo4j evaluation errors ${String(summary.t1.neo4jErrors)}.`, '',
    '| subject | reports | whole result identical | violations identical | rule rows (with findings) | counts agree | identities agree | file sets agree | violations neo4j / interp |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...bySubject.map((s) => `| ${s.subject} | ${String(s.reports)} | ${String(s.identicalByArea['whole result'])} | ${String(s.identicalByArea.violations)} | ${String(s.ruleRows)} (${String(s.ruleRowsWithFindings)}) | ${String(s.countsAgree)} | ${String(s.identitiesAgree)} | ${String(s.fileSetsAgree)} | ${String(s.violations.neo4j)} / ${String(s.violations.interp)} |`),
    '', '## Per rule', '',
    '| subject | rule | reports with the rule | violations neo4j / interp | file sets agree | identities agree |', '|---|---|---:|---|---:|---:|',
    ...allRules.map((r) => `| ${r.subject} | ${r.rule} | ${String(r.reportsWithRule)} | ${String(r.neo4j)} / ${String(r.interp)} | ${String(r.fileSetsAgree)} | ${String(r.identitiesAgree)} |`),
    '',
  ];
  const differing = cli.filter((c) => c.missing || ((c.areas as Record<string, string[]>)['whole result'] ?? []).length > 0);
  if (differing.length > 0) md.push('## Differences', '', ...differing.map((c) => `- ${c.path}: ${c.missing ? 'missing on neo4j' : ((c.areas as Record<string, string[]>)['whole result'] ?? []).slice(0, 5).join('; ')}`), '');
  fs.writeFileSync(path.join(outDir, 'd8-parity.md'), md.join('\n'));
  process.stdout.write(md.join('\n'));
  return differing.length === 0 && summary.t1.rowsIdentical === summary.t1.rows && summary.t1.driftIdentical === summary.t1.drift ? 0 : 1;
}

process.exitCode = main();
