/**
 * ISE prototype measurement (d), downstream: firewall findings under the inferred spec against findings under the
 * true spec, per variant, for every target of `lib/ise-targets.ts`. Needs Neo4j (as validate-reference's live run).
 * Entry file: no exports besides `summarise` and `renderDownstream` (unit-tested).
 *
 * Usage (repository root), after `ise-measure.ts` wrote <out>/specs/:
 *   NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... npx tsx scripts/v1.3/ise-downstream.ts [--out <dir>] [--set dev|heldout|all] [--target id,id]
 *   npx tsx scripts/v1.3/ise-downstream.ts --from-raw [--out <dir>]     (recompute from <out>/raw, no Neo4j)
 * Writes <out>/raw/<target>/<variant>.json (both specs' rows), <out>/downstream.json and <out>/downstream.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import type { ActualFinding } from './lib/compare.js';
import { blockingAgreement, plantedResult } from './lib/ise-compare.js';
import type { BlockingAgreement, PlantedResult } from './lib/ise-compare.js';
import { materialiseTarget, targetSet, renamedFindings, trueSpecText } from './lib/ise-targets.js';
import { makeTempRoot } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';
import { LIVE_REFUSAL, liveEvaluator } from './lib/validate-reference-main.js';

export interface VariantDownstream {
  readonly variant: string;
  readonly kind: string;
  readonly agreement: BlockingAgreement;
  readonly trueSpec: PlantedResult;
  readonly inferredSpec: PlantedResult;
}

export interface TargetDownstream {
  readonly id: string;
  readonly trueStyle: string;
  readonly inferredStyle: string;
  readonly variants: readonly VariantDownstream[];
  readonly summary: ReturnType<typeof summarise>;
  /** The firewall refused to evaluate under the inferred spec (e.g. the compiler rejects it); inferred columns are void. */
  readonly inferredSpecError?: string;
}

interface Raw {
  readonly trueFindings: readonly ActualFinding[];
  readonly inferredFindings: readonly ActualFinding[];
  readonly inferredError?: string;
}

/** Per-target totals: verdict agreement, mean blocking Jaccard, planted recall under each spec. */
export function summarise(rows: readonly VariantDownstream[]): {
  variants: number;
  verdictAgreement: number;
  exactBlockingAgreement: number;
  meanJaccard: number;
  violationVariants: number;
  plantedTrue: number;
  plantedInferred: number;
  touchedTrue: number;
  touchedInferred: number;
  expectedMatchedTrue: number;
  expectedMatchedInferred: number;
  expectedTotal: number;
} {
  const vio = rows.filter((r) => r.kind === 'violation');
  return {
    variants: rows.length,
    verdictAgreement: rows.filter((r) => r.agreement.verdictAgrees).length,
    exactBlockingAgreement: rows.filter((r) => r.agreement.onlyInferred.length === 0 && r.agreement.onlyTrue.length === 0).length,
    meanJaccard: rows.length === 0 ? 1 : rows.reduce((s, r) => s + r.agreement.jaccard, 0) / rows.length,
    violationVariants: vio.length,
    plantedTrue: vio.filter((r) => r.trueSpec.plantedDetected === true).length,
    plantedInferred: vio.filter((r) => r.inferredSpec.plantedDetected === true).length,
    touchedTrue: vio.filter((r) => r.trueSpec.touched === true).length,
    touchedInferred: vio.filter((r) => r.inferredSpec.touched === true).length,
    expectedMatchedTrue: rows.reduce((s, r) => s + r.trueSpec.matched, 0),
    expectedMatchedInferred: rows.reduce((s, r) => s + r.inferredSpec.matched, 0),
    expectedTotal: rows.reduce((s, r) => s + r.trueSpec.expected, 0),
  };
}

const frac = (n: number, d: number): string => (d === 0 ? 'n/a' : `${String(n)}/${String(d)}`);

export function renderDownstream(results: readonly TargetDownstream[]): string {
  const out: string[] = ['# ISE prototype: downstream findings (d), inferred spec vs true spec', ''];
  out.push('| Target | True style | Inferred style | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted detected (true spec) | Planted detected (inferred spec) | Planted touched (true / inferred) | Expected findings matched (true / inferred) |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const s = r.summary;
    if (r.inferredSpecError !== undefined) {
      const x = 'inferred spec rejected';
      out.push(`| ${r.id} | ${r.trueStyle} | ${r.inferredStyle} | ${x} | ${x} | - | ${frac(s.plantedTrue, s.violationVariants)} | ${x} | ${frac(s.touchedTrue, s.violationVariants)} / - | ${frac(s.expectedMatchedTrue, s.expectedTotal)} / - |`);
      continue;
    }
    out.push(`| ${r.id} | ${r.trueStyle} | ${r.inferredStyle} | ${frac(s.verdictAgreement, s.variants)} | ${frac(s.exactBlockingAgreement, s.variants)} | ${s.meanJaccard.toFixed(2)} | ${frac(s.plantedTrue, s.violationVariants)} | ${frac(s.plantedInferred, s.violationVariants)} | ${frac(s.touchedTrue, s.violationVariants)} / ${frac(s.touchedInferred, s.violationVariants)} | ${frac(s.expectedMatchedTrue, s.expectedTotal)} / ${frac(s.expectedMatchedInferred, s.expectedTotal)} |`);
  }
  for (const r of results) {
    if (r.inferredSpecError !== undefined) {
      out.push('', `## ${r.id}`, '', `The firewall refused every evaluation under the inferred spec: \`${r.inferredSpecError}\`.`);
      continue;
    }
    const rows = r.variants.filter((v) => v.agreement.onlyInferred.length + v.agreement.onlyTrue.length > 0 || v.trueSpec.plantedDetected !== v.inferredSpec.plantedDetected);
    out.push('', `## ${r.id}`, '', rows.length === 0 ? 'Every variant: identical blocking findings and the same planted-rule outcome.' : '| Variant | Kind | Blocking only under inferred | Blocking only under true | Planted (true / inferred) |');
    if (rows.length > 0) out.push('|---|---|---|---|---|');
    for (const v of rows) {
      const p = (x: boolean | null): string => (x === null ? '-' : x ? 'yes' : 'no');
      const list = (xs: readonly string[]): string => (xs.length === 0 ? '' : `${xs.slice(0, 4).join('<br>')}${xs.length > 4 ? `<br>(+${String(xs.length - 4)})` : ''}`);
      out.push(`| ${v.variant} | ${v.kind} | ${list(v.agreement.onlyInferred)} | ${list(v.agreement.onlyTrue)} | ${p(v.trueSpec.plantedDetected)} / ${p(v.inferredSpec.plantedDetected)} |`);
    }
  }
  return out.join('\n') + '\n';
}

const styleOf = (specText: string): string => (YAML.parse(specText) as { architecture: { style: string } }).architecture.style;

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const ti = argv.indexOf('--target');
  const fromRaw = argv.includes('--from-raw');
  const out = path.resolve(oi >= 0 ? argv[oi + 1] ?? '' : 'results/v1.3-ise/2026-10-15');
  const only = ti >= 0 ? new Set((argv[ti + 1] ?? '').split(',')) : undefined;
  const env = process.env;
  if (!fromRaw && ((env.NEO4J_URI ?? '') === '' || (env.NEO4J_PASSWORD ?? '') === '')) {
    process.stderr.write(`${LIVE_REFUSAL}\n`);
    return 2;
  }
  const refs = loadAllReferences(process.cwd());
  const evaluate = fromRaw ? undefined : liveEvaluator(process.cwd(), env);
  const lock = fromRaw ? undefined : await acquireNeo4jLock(env.NEO4J_URI ?? '', { label: 'ise-downstream', env, onWait: (t) => process.stderr.write(`${t}\n`) });
  const work = makeTempRoot('v13-ise-d-');
  const results: TargetDownstream[] = [];
  try {
    for (const t of targetSet(argv).filter((x) => only === undefined || only.has(x.id))) {
      const ref = refs.find((r) => r.style === t.style);
      if (ref === undefined) throw new Error(`no reference ${t.style}`);
      const inferredPath = path.join(out, 'specs', `${t.id}.yaml`);
      if (!fs.existsSync(inferredPath)) throw new Error(`${inferredPath} missing: run ise-measure.ts first`);
      const truePath = path.join(out, 'specs', `${t.id}.true.yaml`);
      const trueText = trueSpecText(ref, t);
      fs.writeFileSync(truePath, trueText);
      const inferredStyle = styleOf(fs.readFileSync(inferredPath, 'utf8'));
      const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
      const raws = new Map<string, Raw>();
      for (const v of ref.variants) {
        const rawFile = path.join(out, 'raw', t.id, `${v.manifest.variant}.json`);
        let raw: Raw;
        if (evaluate === undefined) raw = JSON.parse(fs.readFileSync(rawFile, 'utf8')) as Raw;
        else {
          const dir = materialiseTarget(ref, v, t, work);
          const trueFindings = await evaluate(dir, truePath);
          try {
            raw = { trueFindings, inferredFindings: await evaluate(dir, inferredPath) };
          } catch (e: unknown) {
            raw = { trueFindings, inferredFindings: [], inferredError: e instanceof Error ? e.message : String(e) };
          }
          fs.mkdirSync(path.dirname(rawFile), { recursive: true });
          fs.writeFileSync(rawFile, JSON.stringify(raw, null, 1) + '\n');
        }
        raws.set(v.manifest.variant, raw);
        process.stdout.write(`${t.id}/${v.manifest.variant}: true ${String(raw.trueFindings.length)} rows, inferred ${String(raw.inferredFindings.length)} rows\n`);
      }
      const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
      const cleanRaw = raws.get(clean?.manifest.variant ?? '') ?? { trueFindings: [], inferredFindings: [] };
      const variants: VariantDownstream[] = ref.variants.map((v) => {
        const raw = raws.get(v.manifest.variant) ?? { trueFindings: [], inferredFindings: [] };
        const manifest = { ...v.manifest, expectedFindings: renamedFindings(v.manifest.expectedFindings, t) };
        return {
          variant: v.manifest.variant,
          kind: v.manifest.kind,
          agreement: blockingAgreement(raw.inferredFindings, inferredStyle, raw.trueFindings, ref.style),
          trueSpec: plantedResult(ref.style, manifest, raw.trueFindings, cleanRaw.trueFindings, scope),
          inferredSpec: plantedResult(ref.style, manifest, raw.inferredFindings, cleanRaw.inferredFindings, scope),
        };
      });
      const inferredError = [...raws.values()].find((r) => r.inferredError !== undefined)?.inferredError;
      results.push({ id: t.id, trueStyle: ref.style, inferredStyle, variants, summary: summarise(variants), ...(inferredError !== undefined ? { inferredSpecError: inferredError } : {}) });
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    lock?.release();
  }
  fs.writeFileSync(path.join(out, 'downstream.json'), JSON.stringify(results, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'downstream.md'), renderDownstream(results));
  process.stdout.write(renderDownstream(results).split('\n').slice(0, 16).join('\n') + '\n');
  return 0;
}

if (process.argv[1]?.endsWith('ise-downstream.ts') === true) {
  void run().then(
    (c) => {
      process.exitCode = c;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
      process.exitCode = 2;
    },
  );
}
