/**
 * Compares two `ue-baseline-live --keep-cli` runs of the 71 reference variants, one per graph engine
 * (Docs/v1.3/cypher-interpreter.md §4.3). Entry file: no exports.
 *
 * - byte identity of `raw/` (71 files), `report.json`, `report.md` between the runs and against the committed
 *   reference (`results/v1.3-reference/after-member-facts`);
 * - the evidence violations (every column of every violation), `elapsedMs` aside;
 * - the CLI's whole JSON result per variant (`cli/`), field by field: the AHS (`ahsDeterministic`, `tiers.blockingAhs`),
 *   the verdicts, the per-dimension scores, the universal metrics, the tier counts, the function results and
 *   execution counts, the graph statistics, the warnings and the violations. Every differing path is listed.
 *
 * Usage: node --import tsx scripts/v1.3/cypher-interp-compare-runs.ts --neo4j <dir> --interp <dir> [--reference <dir>] --out <dir>
 * Writes <out>/engine-comparison.json and <out>/engine-comparison.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const neoDir = path.resolve(opt('--neo4j') ?? '');
const interpDir = path.resolve(opt('--interp') ?? '');
const refDir = path.resolve(opt('--reference') ?? 'results/v1.3-reference/after-member-facts');
const outDir = path.resolve(opt('--out') ?? 'results/v1.3-cypher-interp/ue-baseline-live');

function files(dir: string, sub: string): string[] {
  const root = path.join(dir, sub);
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p));
    }
  };
  walk(root);
  return out.sort();
}

function same(a: string, b: string): boolean {
  return fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
}

/** Every leaf path where the two JSON values differ (arrays by index). */
function diffPaths(a: unknown, b: unknown, at = '$'): string[] {
  if (a === b) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = a.length === b.length ? [] : [`${at}.length (${String(a.length)} vs ${String(b.length)})`];
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(...diffPaths(a[i], b[i], `${at}[${String(i)}]`));
    return out;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    const out: string[] = [];
    for (const k of new Set([...ka, ...kb])) out.push(...diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`));
    if (out.length === 0 && ka.join() !== kb.join()) out.push(`${at} (key order)`);
    return out;
  }
  return [`${at} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`];
}

const read = (p: string): Record<string, unknown> => JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;

/** The numbers the CLI report carries, by area: what the comparison table counts. */
const AREAS: readonly (readonly [string, (r: Record<string, unknown>) => unknown])[] = [
  ['ahsDeterministic', (r) => r.ahsDeterministic],
  ['verdict', (r) => [r.verdict, (r.tiers as Record<string, unknown> | undefined)?.verdict, (r.tiers as Record<string, unknown> | undefined)?.v12eVerdict]],
  ['blockingAhs', (r) => (r.tiers as Record<string, unknown> | undefined)?.blockingAhs],
  ['perDimensionScores', (r) => r.perDimensionScores],
  ['universalMetrics', (r) => r.universalMetrics],
  ['tiers', (r) => r.tiers],
  ['functionExecution', (r) => r.functionExecution],
  ['functionResults', (r) => r.functionResults],
  ['graphStats', (r) => r.graphStats],
  ['violations', (r) => r.violations],
  ['warnings', (r) => r.warnings],
  ['whole result', (r) => r],
];

function main(): number {
  const byteFiles = [...files(refDir, 'raw'), 'report.json', 'report.md'];
  const bytes = byteFiles.map((f) => ({
    path: f,
    interpEqualsNeo4j: same(path.join(interpDir, f), path.join(neoDir, f)),
    interpEqualsReference: same(path.join(interpDir, f), path.join(refDir, f)),
    neo4jEqualsReference: same(path.join(neoDir, f), path.join(refDir, f)),
  }));
  const evidence = files(interpDir, 'evidence').map((f) => {
    const strip = (p: string): unknown => {
      const { elapsedMs: _e, ...rest } = read(p);
      return rest;
    };
    const d = fs.existsSync(path.join(neoDir, f)) ? diffPaths(strip(path.join(neoDir, f)), strip(path.join(interpDir, f))) : ['missing on neo4j'];
    return { path: f, differences: d };
  });
  const cliFiles = files(interpDir, 'cli');
  const cli = cliFiles.map((f) => {
    const n = fs.existsSync(path.join(neoDir, f)) ? read(path.join(neoDir, f)) : undefined;
    const i = read(path.join(interpDir, f));
    const areas = Object.fromEntries(AREAS.map(([name, get]) => [name, n === undefined ? ['missing on neo4j'] : diffPaths(get(n), get(i))]));
    return { path: f, ahs: { neo4j: n?.ahsDeterministic, interp: i.ahsDeterministic }, universalMetrics: { neo4j: n?.universalMetrics, interp: i.universalMetrics }, areas };
  });
  const summary = {
    generatedAt: new Date().toISOString(),
    neo4j: path.relative(process.cwd(), neoDir), interp: path.relative(process.cwd(), interpDir), reference: path.relative(process.cwd(), refDir),
    bytes: {
      files: bytes.length,
      interpEqualsNeo4j: bytes.filter((b) => b.interpEqualsNeo4j).length,
      interpEqualsReference: bytes.filter((b) => b.interpEqualsReference).length,
      neo4jEqualsReference: bytes.filter((b) => b.neo4jEqualsReference).length,
    },
    evidence: { variants: evidence.length, identical: evidence.filter((e) => e.differences.length === 0).length },
    cli: {
      variants: cli.length,
      identicalByArea: Object.fromEntries(AREAS.map(([name]) => [name, cli.filter((c) => (c.areas[name] ?? []).length === 0).length])),
    },
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'engine-comparison.json'), JSON.stringify({ summary, bytes, evidence: evidence.filter((e) => e.differences.length > 0), cli }, null, 1) + '\n');
  const md = [
    '# Reference set: cypher-interp vs Neo4j 5.26.24, field by field', '',
    `Runs: \`${summary.neo4j}\` (Neo4j) and \`${summary.interp}\` (cypher-interp), both \`ue-baseline-live --keep-cli\`; reference \`${summary.reference}\`.`, '',
    '| check | identical |', '|---|---:|',
    `| bytes: raw/ + report.json + report.md, interp vs Neo4j | ${String(summary.bytes.interpEqualsNeo4j)}/${String(summary.bytes.files)} |`,
    `| bytes: interp vs committed reference | ${String(summary.bytes.interpEqualsReference)}/${String(summary.bytes.files)} |`,
    `| bytes: Neo4j rerun vs committed reference | ${String(summary.bytes.neo4jEqualsReference)}/${String(summary.bytes.files)} |`,
    `| evidence violations, every column (elapsedMs aside) | ${String(summary.evidence.identical)}/${String(summary.evidence.variants)} |`,
    ...AREAS.map(([name]) => `| CLI result: ${name} | ${String(summary.cli.identicalByArea[name] ?? 0)}/${String(summary.cli.variants)} |`),
    '',
    'CLI result = the whole `firewall evaluate --format json` output without `runId`, `durationMs`, `executionTimeMs`, `timings` (run-volatile) and with the temporary project path replaced by `<project>`.',
    '',
  ];
  const differing = cli.filter((c) => (c.areas['whole result'] ?? []).length > 0);
  if (differing.length > 0) md.push('## Differences', '', ...differing.map((c) => `- ${c.path}: ${(c.areas['whole result'] ?? []).slice(0, 5).join('; ')}`), '');
  fs.writeFileSync(path.join(outDir, 'engine-comparison.md'), md.join('\n'));
  process.stdout.write(md.join('\n'));
  const ok = summary.bytes.interpEqualsNeo4j === summary.bytes.files && summary.evidence.identical === summary.evidence.variants && differing.length === 0;
  return ok ? 0 : 1;
}

process.exitCode = main();
