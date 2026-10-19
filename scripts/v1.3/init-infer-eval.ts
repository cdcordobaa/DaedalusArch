/**
 * Zero-config onboarding measurement: `firewall evaluate --from-inferred` against the true spec on every variant of
 * the 71-variant dev set and of the ISE folder-renaming probes (`lib/ise-targets.ts`: P1-P5 by default, `--set
 * heldout` for N1/N2/S). Each variant is inferred from itself, exactly as the CLI does for a project without a spec.
 *
 * Per variant: (a) the inferred style; (b) the per-file layer under the inferred spec against the reference's
 * expected layers; (c) the blocking findings (v1.3 tiers, each spec's own style) of `evaluate --from-inferred`
 * against `evaluate --spec <true spec>`, and the planted-violation recall under each.
 *
 * Usage (repository root):
 *   NEO4J_URI=bolt://127.0.0.1:7687 NEO4J_PASSWORD=... npx tsx scripts/v1.3/init-infer-eval.ts [--out <dir>] [--set dev|heldout|all] [--target id,id]
 *   (add --resume to reuse the rows already in <out>/raw)
 *   npx tsx scripts/v1.3/init-infer-eval.ts --from-raw [--out <dir>]     (recompute (c) from <out>/raw; (a), (b) re-run offline)
 *   npx tsx scripts/v1.3/init-infer-eval.ts --offline [--out <dir>]      ((a), (b) only; no Neo4j)
 * Writes <out>/raw/<target>/<variant>.json, <out>/init-infer.json and <out>/init-infer.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { proposeSpec } from '../../src/ise/propose.js';
import { listSnapshotFiles } from '../../src/ise/snapshot.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { normaliseFindingPath } from './lib/compare.js';
import type { ActualFinding } from './lib/compare.js';
import { blockingAgreement, plantedResult } from './lib/ise-compare.js';
import { fileLayerScore, pool, questionCoverage, renderDisagreements, renderTable, summariseTarget } from './lib/init-infer-compare.js';
import type { TargetSummary, VariantRow } from './lib/init-infer-compare.js';
import { materialiseTarget, renamedExpectedLayers, renamedFindings, targetSet, trueSpecText } from './lib/ise-targets.js';
import { makeTempRoot } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';
import { LIVE_REFUSAL, liveEvaluator } from './lib/validate-reference-main.js';

const PRESETS = path.resolve('presets');

interface Raw {
  readonly trueFindings: readonly ActualFinding[];
  readonly inferredFindings: readonly ActualFinding[];
  /** `specSource` of the `--from-inferred` JSON report. */
  readonly specSource: { readonly style: string; readonly label: string } | null;
  readonly inferredError?: string;
}

/** `evaluate --from-inferred --symbolic-only --format json` through the CLI, as a user runs it. */
function fromInferredEvaluator(env: NodeJS.ProcessEnv): (dir: string) => Promise<{ findings: ActualFinding[]; specSource: Raw['specSource'] }> {
  const runner = new NodeProcessRunner();
  const childEnv: Record<string, string> = {};
  for (const k of ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    const v = env[k];
    if (v !== undefined) childEnv[k] = v;
  }
  const tsx = path.resolve('node_modules/.bin/tsx');
  return async (dir) => {
    const run = await runner.run(tsx, ['bin/firewall.ts', 'evaluate', '--post-seal', 'off', '--project', dir, '--from-inferred', '--format', 'json', '--symbolic-only', '--neo4j-uri', env.NEO4J_URI ?? ''], { cwd: process.cwd(), env: childEnv, timeoutMs: 600_000 });
    if (!run.success) throw new Error(run.errors.map((e) => e.message).join('; '));
    const start = run.data.stdout.indexOf('{');
    if (start < 0) throw new Error((run.data.stderr.split('\n').find((l) => l.startsWith('Error')) ?? run.data.stderr).trim());
    const report = JSON.parse(run.data.stdout.slice(start)) as { specSource?: { style: string; label: string }; violations: { functionId: string; filePath: string; target?: string }[] };
    const findings = report.violations.map((v) => {
      const target = normaliseFindingPath(v.target ?? '', dir);
      return { ruleId: v.functionId, file: normaliseFindingPath(v.filePath, dir), ...(target !== '' ? { target } : {}) };
    });
    return { findings, specSource: report.specSource ?? null };
  };
}

async function run(): Promise<number> {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const ti = argv.indexOf('--target');
  const fromRaw = argv.includes('--from-raw');
  const offline = argv.includes('--offline');
  const resume = argv.includes('--resume');
  const out = path.resolve(oi >= 0 ? argv[oi + 1] ?? '' : 'results/v1.3-init-infer/2026-10-16');
  const only = ti >= 0 ? new Set((argv[ti + 1] ?? '').split(',')) : undefined;
  const env = process.env;
  const live = !fromRaw && !offline;
  if (live && ((env.NEO4J_URI ?? '') === '' || (env.NEO4J_PASSWORD ?? '') === '')) {
    process.stderr.write(`${LIVE_REFUSAL}\n`);
    return 2;
  }
  const refs = loadAllReferences(process.cwd());
  const evaluateTrue = live ? liveEvaluator(process.cwd(), env) : undefined;
  const evaluateInferred = live ? fromInferredEvaluator(env) : undefined;
  const lock = live ? await acquireNeo4jLock(env.NEO4J_URI ?? '', { label: 'init-infer-eval', env, onWait: (t) => process.stderr.write(`${t}\n`) }) : undefined;
  const work = makeTempRoot('v13-init-infer-');
  const summaries: TargetSummary[] = [];
  const details: string[] = [];
  const json: { id: string; summary: TargetSummary; variants: VariantRow[] }[] = [];
  try {
    for (const t of targetSet(argv).filter((x) => only === undefined || only.has(x.id))) {
      const ref = refs.find((r) => r.style === t.style);
      if (ref === undefined) throw new Error(`no reference ${t.style}`);
      const trueText = trueSpecText(ref, t);
      const truePath = path.join(work, `${t.id}.true.yaml`);
      fs.writeFileSync(truePath, trueText);
      const expected = renamedExpectedLayers(ref, t);
      const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
      const raws = new Map<string, Raw | undefined>();
      const partial: { v: (typeof ref.variants)[number]; row: Omit<VariantRow, 'agreement' | 'trueSpec' | 'inferredSpec'> }[] = [];
      for (const v of ref.variants) {
        const dir = materialiseTarget(ref, v, t, work);
        // (a), (b): the same proposal the CLI evaluates (deterministic), scored offline.
        const proposal = await proposeSpec(dir, { presetsDir: PRESETS });
        const files = listSnapshotFiles(dir).filter((f) => f.startsWith('src/') && f.endsWith('.ts'));
        const layers = fileLayerScore(files, proposal.yaml, trueText, expected);
        const rawFile = path.join(out, 'raw', t.id, `${v.manifest.variant}.json`);
        let raw: Raw | undefined;
        if (fromRaw || (resume && fs.existsSync(rawFile))) raw = JSON.parse(fs.readFileSync(rawFile, 'utf8')) as Raw;
        else if (evaluateTrue !== undefined && evaluateInferred !== undefined) {
          const trueFindings = await evaluateTrue(dir, truePath);
          try {
            const r = await evaluateInferred(dir);
            raw = { trueFindings, inferredFindings: r.findings, specSource: r.specSource };
          } catch (e: unknown) {
            raw = { trueFindings, inferredFindings: [], specSource: null, inferredError: e instanceof Error ? e.message : String(e) };
          }
          fs.mkdirSync(path.dirname(rawFile), { recursive: true });
          fs.writeFileSync(rawFile, JSON.stringify(raw, null, 1) + '\n');
          if (raw.specSource !== null && raw.specSource.style !== proposal.style) throw new Error(`${t.id}/${v.manifest.variant}: CLI inferred ${raw.specSource.style}, proposeSpec ${proposal.style}`);
        }
        raws.set(v.manifest.variant, raw);
        partial.push({
          v,
          row: {
            variant: v.manifest.variant,
            kind: v.manifest.kind,
            inferredStyle: proposal.style,
            styleConfidence: proposal.styleConfidence,
            questions: proposal.questions.length,
            ...questionCoverage(proposal.questions.map((q) => q.subject), layers),
            layers,
            ...(raw?.inferredError !== undefined ? { inferredError: raw.inferredError } : {}),
          },
        });
        fs.rmSync(dir, { recursive: true, force: true });
        process.stdout.write(`${t.id}/${v.manifest.variant}: ${proposal.style} ${proposal.styleConfidence.toFixed(2)}, files ${String(layers.correct)}/${String(layers.total)}${raw !== undefined ? `, true ${String(raw.trueFindings.length)} rows, inferred ${raw.inferredError !== undefined ? 'REJECTED' : `${String(raw.inferredFindings.length)} rows`}` : ''}\n`);
      }
      const cleanName = ref.variants.find((v) => v.manifest.kind === 'clean')?.manifest.variant ?? '';
      const cleanRaw = raws.get(cleanName);
      const rows: VariantRow[] = partial.map(({ v, row }) => {
        const raw = raws.get(v.manifest.variant);
        if (raw === undefined || raw.inferredError !== undefined) return { ...row, agreement: null, trueSpec: null, inferredSpec: null };
        const manifest = { ...v.manifest, expectedFindings: renamedFindings(v.manifest.expectedFindings, t) };
        return {
          ...row,
          agreement: blockingAgreement(raw.inferredFindings, row.inferredStyle, raw.trueFindings, ref.style),
          trueSpec: plantedResult(ref.style, manifest, raw.trueFindings, cleanRaw?.trueFindings ?? [], scope),
          inferredSpec: plantedResult(ref.style, manifest, raw.inferredFindings, cleanRaw?.inferredFindings ?? [], scope),
        };
      });
      const renamed = Object.keys(t.rename).length > 0 || t.probe !== undefined;
      const summary = summariseTarget(t.id, ref.style, renamed, rows);
      summaries.push(summary);
      json.push({ id: t.id, summary, variants: rows });
      details.push(renderDisagreements(t.id, ref.style, rows));
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    lock?.release();
  }
  const pooled = [pool('all unrenamed (dev set)', summaries.filter((s) => !s.renamed)), pool('all renamed', summaries.filter((s) => s.renamed))].filter((s) => s.variants > 0);
  const md = [
    '# Zero-config onboarding: `evaluate --from-inferred` against the true spec',
    '',
    'Every variant is inferred from itself (`firewall init` / `--from-inferred` on a project without a spec). Generated by `scripts/v1.3/init-infer-eval.ts`.',
    '',
    renderTable([...summaries, ...pooled]),
    '',
    '## Disagreements per target',
    '',
    ...details,
  ].join('\n');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'init-infer.json'), JSON.stringify(json, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'init-infer.md'), md);
  process.stdout.write(renderTable([...summaries, ...pooled]) + '\n');
  return 0;
}

if (process.argv[1]?.endsWith('init-infer-eval.ts') === true) {
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
