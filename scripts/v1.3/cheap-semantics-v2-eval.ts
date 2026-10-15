/**
 * AP-DUP-RULE v2: the cheap duplication proxies (pass 0.5, `src/apg-enrich/cheap`) on the same copies the judge sees.
 * DEVELOPMENT SET. No LLM, no Neo4j, no network.
 *
 * Every ok row of `judge-catch-v2-seed.ts` (seed and twin copies) and every unmodified base is extracted (`extractAPG`,
 * the spec's `default_exclude_paths`) and all proxies run with their default options, exactly as
 * `cheap-semantics-eval.ts` does. Proxies read here: `clones` (primary for AP-DUP-RULE in that harness) and
 * `shared-literals` (the second member of its designated set).
 *
 * Units (definitions of `cheap-semantics-eval.ts`, with the v2 twin's own edit):
 * - Seed: the second service class on its file (the class that gains the copy; class-level, as for AP-DUP-RULE).
 * - Twin: the units the v2 twin edits: the first service class on its file, and the host file (domain host).
 * - Catch / twin false flag: a flag of the proxy on the unit; paired: the flag key (proxy, kind, file, class, method)
 *   is not on the same unit of the unmodified base. Clean false flag: a flag on the seed's unit in the base.
 *
 * Usage: npx tsx scripts/v1.3/cheap-semantics-v2-eval.ts --seed <work> [--out results/v1.3-cheap-semantics/duprule-v2]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAndEnrich } from '../../src/apg-enrich/cheap/index.js';
import type { CheapFlag, ProxyId } from '../../src/apg-enrich/cheap/index.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { wilson } from '../lib/stats.js';
import type { V2Row } from './judge-catch-v2-seed.js';

interface Unit {
  readonly file: string;
  readonly className: string | undefined;
}

const PROXIES: readonly ProxyId[] = ['clones', 'shared-literals'];
const flagKey = (f: CheapFlag): string => `${f.proxy}|${f.kind}|${f.evidence.file}|${f.className ?? ''}|${f.methodName ?? ''}`;
const onUnit = (f: CheapFlag, u: Unit): boolean => f.evidence.file === u.file && (u.className === undefined || f.className === u.className);

function rate(k: number, n: number): { k: number; n: number; text: string } {
  if (n === 0) return { k, n, text: '0/0' };
  const w = wilson(k, n);
  return { k, n, text: `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]` };
}

const specCache = new Map<string, { model: LayerModel; excludes: string[] }>();
async function specOf(specPath: string): Promise<{ model: LayerModel; excludes: string[] }> {
  const hit = specCache.get(specPath);
  if (hit !== undefined) return hit;
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`${specPath}: spec does not parse`);
  const v = { model: parsed.data.layerModel, excludes: specExcludePathsFromYaml(fs.readFileSync(specPath, 'utf8')) };
  specCache.set(specPath, v);
  return v;
}

async function flagsOf(dir: string, specPath: string): Promise<{ flags: CheapFlag[]; ms: number }> {
  const { model, excludes } = await specOf(specPath);
  const t0 = performance.now();
  const r = await extractAndEnrich(fs.realpathSync(dir), { layerModel: model, extractorOptions: { excludePatterns: excludes } });
  return { flags: r.enrichment.flags.filter((f) => PROXIES.includes(f.proxy)), ms: performance.now() - t0 };
}

export function unitsOf(row: V2Row): Unit[] {
  const d = row.site.detail;
  if (row.role === 'seed') return [{ file: row.site.filePath, className: d.class }];
  const out: Unit[] = [{ file: d.sourceFile ?? '', className: d.sourceClass }];
  if (d.twinHost !== undefined && d.twinHost !== d.sourceFile && d.twinHost !== '!') out.push({ file: d.twinHost, className: undefined });
  return out;
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const arg = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const seedArg = arg('--seed');
  if (seedArg === undefined) {
    process.stderr.write('usage: cheap-semantics-v2-eval.ts --seed <work> [--out <dir>]\n');
    return 2;
  }
  const seedDir = path.resolve(seedArg);
  const out = path.resolve(arg('--out') ?? 'results/v1.3-cheap-semantics/duprule-v2');
  fs.mkdirSync(path.join(out, 'flags'), { recursive: true });
  const rows = (JSON.parse(fs.readFileSync(path.join(seedDir, 'seed-manifest.json'), 'utf8')) as { rows: V2Row[] }).rows.filter((r) => r.status === 'ok');
  const baseFlags = new Map<string, CheapFlag[]>();
  for (const baseId of [...new Set(rows.map((r) => r.baseId))].sort()) {
    const spec = path.resolve(repoRoot, rows.find((r) => r.baseId === baseId)?.specPath ?? '');
    const r = await flagsOf(path.join(seedDir, 'bases', baseId.replace('/', '__')), spec);
    baseFlags.set(baseId, r.flags);
    fs.writeFileSync(path.join(out, 'flags', `base__${baseId.replace('/', '__')}.json`), `${JSON.stringify(r.flags, null, 1)}\n`);
  }
  const results: Record<string, unknown>[] = [];
  for (const row of rows) {
    const r = await flagsOf(path.join(seedDir, row.copyDir), path.resolve(repoRoot, row.specPath));
    fs.writeFileSync(path.join(out, 'flags', `${row.rowId}.json`), `${JSON.stringify(r.flags, null, 1)}\n`);
    const base = baseFlags.get(row.baseId) ?? [];
    const units = unitsOf(row);
    const per: Record<string, unknown> = {};
    for (const p of PROXIES) {
      const on = r.flags.filter((f) => f.proxy === p && units.some((u) => onUnit(f, u)));
      const baseOn = base.filter((f) => f.proxy === p && units.some((u) => onUnit(f, u)));
      const baseKeys = new Set(baseOn.map(flagKey));
      per[p] = { flag: on.length > 0, paired: on.some((f) => !baseKeys.has(flagKey(f))), base: baseOn.length > 0, kinds: [...new Set(on.map((f) => f.kind))].sort(), messages: on.map((f) => f.message).slice(0, 4) };
    }
    results.push({ rowId: row.rowId, role: row.role, stratum: row.stratum, baseId: row.baseId, hostKind: row.role === 'twin' ? row.hostKind : null, units, ...per, ms: Math.round(r.ms) });
    process.stderr.write(`${row.rowId}: ${PROXIES.map((p) => `${p}=${String((per[p] as { flag: boolean }).flag)}`).join(' ')}\n`);
  }
  const pick = (role: string, stratum?: string): Record<string, unknown>[] => results.filter((x) => x['role'] === role && (stratum === undefined || x['stratum'] === stratum));
  const val = (x: Record<string, unknown>, p: string, k: string): boolean => (x[p] as Record<string, boolean>)[k] === true;
  const anyOf = (x: Record<string, unknown>, k: string): boolean => PROXIES.some((p) => val(x, p, k));
  const tab: Record<string, Record<string, unknown>> = {};
  for (const s of ['fixture', 'e1', undefined]) {
    const seeds = pick('seed', s);
    const twins = pick('twin', s);
    const row: Record<string, unknown> = { seeds: seeds.length, twins: twins.length };
    for (const p of PROXIES) {
      row[p] = {
        catch: rate(seeds.filter((x) => val(x, p, 'flag')).length, seeds.length),
        pairedCatch: rate(seeds.filter((x) => val(x, p, 'paired')).length, seeds.length),
        twinFalseFlag: rate(twins.filter((x) => val(x, p, 'flag')).length, twins.length),
        twinFalseFlagPaired: rate(twins.filter((x) => val(x, p, 'paired')).length, twins.length),
        cleanFalseFlag: rate(seeds.filter((x) => val(x, p, 'base')).length, seeds.length),
      };
    }
    row['either'] = {
      catch: rate(seeds.filter((x) => anyOf(x, 'flag')).length, seeds.length),
      pairedCatch: rate(seeds.filter((x) => anyOf(x, 'paired')).length, seeds.length),
      twinFalseFlag: rate(twins.filter((x) => anyOf(x, 'flag')).length, twins.length),
      twinFalseFlagPaired: rate(twins.filter((x) => anyOf(x, 'paired')).length, twins.length),
      cleanFalseFlag: rate(seeds.filter((x) => anyOf(x, 'base')).length, seeds.length),
    };
    tab[s ?? 'combined'] = row;
  }
  fs.writeFileSync(path.join(out, 'scores.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), label: 'DEVELOPMENT SET; cheap proxies clones and shared-literals on the AP-DUP-RULE v2 copies', table: tab, rows: results }, null, 1)}\n`);
  const lines = ['| Stratum | Proxy | Seeds | Catch | Paired | Twins | Twin false flag | Paired | Clean false flag |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [s, row] of Object.entries(tab)) {
    for (const p of [...PROXIES, 'either']) {
      const b = row[p] as Record<string, { text: string }>;
      lines.push(`| ${s} | ${p} | ${String(row['seeds'])} | ${b['catch']?.text ?? ''} | ${b['pairedCatch']?.text ?? ''} | ${String(row['twins'])} | ${b['twinFalseFlag']?.text ?? ''} | ${b['twinFalseFlagPaired']?.text ?? ''} | ${b['cleanFalseFlag']?.text ?? ''} |`);
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('cheap-semantics-v2-eval.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
