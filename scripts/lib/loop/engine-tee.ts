/**
 * The loop evaluator's graph engine (`--engine neo4j|cypher-interp|both`, `Docs/v1.3/loop-engine-tee.md`).
 *
 * - `engineDeps`: the `evaluate_project` wiring for one engine. Both engines go through the same `evaluateProject`
 *   call (same spec, same pinned per-run tsconfig, uncapped violations); `cypher-interp` only sets the pipeline's
 *   `graphEngine`, so the in-process `MemoryGraphRepository` answers the same compiled Cypher text. It deliberately
 *   avoids the MCP server's cached `interp-evaluator.ts` path, which takes no tsconfig.
 * - `teeEvaluator`: Neo4j is the engine of record; the interpreter evaluates the same snapshot afterwards and the
 *   record carries `engineOfRecord: 'neo4j'` and a `parity` block. A divergence never fails the snapshot.
 * - `compareEvaluations`: the parity rule of the design doc §3.
 *
 * Absent `--engine`, the base wiring evaluates; its engine is still recorded on every evaluation.
 */
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import type { BlockingFinding, EngineParity, LoopEngine, ParityDiff, ParityFindingKey, ParityStatus, StepEvaluation, StepEvaluator } from './types.js';

export { LOOP_ENGINES, parseLoopEngine } from './types.js';
export type { LoopEngine } from './types.js';

/** Findings listed per side in a parity diff (the totals always hold the full number). */
export const MAX_PARITY_FINDINGS = 20;
/**
 * The loop tee's own bound: an `ahs`/`blockingAhs` pair within this many ULP is classed `order` (an accumulation-order
 * difference), not `divergent`. It is stricter than, and separate from, the statement sweep's `float-drift` class of
 * `Docs/v1.3/cypher-interpreter.md` (16 ULP, two named `averageInstability` texts only, trap T2 as revised by #151): the
 * tee compares two scores, not statement rows. Reworded 2026-10-16 (post-merge review item 7); the value is unchanged.
 */
export const ORDER_ULP = 4;

/** Placeholder password for the interpreter-only wiring: `evaluateProject` reads one, the in-memory graph never does. */
const INTERP_PASSWORD = 'unused-by-cypher-interp';

/**
 * The `evaluate_project` wiring of one engine, built from the production wiring. Both go through the pipeline path of
 * `evaluateProject` (`graphEngine: 'neo4j'` there means "not the MCP cache path"); `cypher-interp` swaps the
 * reachability probe for the in-memory repository and sets the pipeline's engine.
 */
export function engineDeps(base: EvaluateDeps, engine: 'neo4j' | 'cypher-interp'): EvaluateDeps {
  const { interp: _interp, graphEngine: _engine, ...rest } = base;
  if (engine === 'neo4j') return { ...rest, graphEngine: 'neo4j' };
  return {
    ...rest,
    graphEngine: 'neo4j',
    makeGraph: () => new MemoryGraphRepository(),
    makePipeline: (config) => base.makePipeline({ ...config, graphEngine: 'cypher-interp' }),
  };
}

/** The evaluator's environment for an engine: the interpreter-only mode needs no Neo4j variable. */
export function engineEnv(env: NodeJS.ProcessEnv, engine: LoopEngine): NodeJS.ProcessEnv {
  if (engine !== 'cypher-interp' || (env.NEO4J_PASSWORD ?? '') !== '') return env;
  return { ...env, NEO4J_PASSWORD: INTERP_PASSWORD };
}

/** Records the engine on an evaluator's results (the interpreter-only mode). */
export function taggedEvaluator(inner: StepEvaluator, engine: 'neo4j' | 'cypher-interp'): StepEvaluator {
  return {
    id: inner.id,
    evaluate: async (dir, runId) => {
      const r = await inner.evaluate(dir, runId);
      return r.success ? DomainResult.ok({ ...r.data, engineOfRecord: engine }) : r;
    },
  };
}

function findingKey(f: BlockingFinding): ParityFindingKey {
  return { ruleId: f.ruleId, template: f.template ?? null, filePath: f.filePath, target: f.target ?? null };
}

function keyString(k: ParityFindingKey): string {
  return JSON.stringify([k.ruleId, k.template, k.filePath, k.target]);
}

/** Multiset difference a − b of finding identities, in a's order. */
function minus(a: readonly ParityFindingKey[], b: readonly ParityFindingKey[]): ParityFindingKey[] {
  const left = new Map<string, number>();
  for (const k of b) left.set(keyString(k), (left.get(keyString(k)) ?? 0) + 1);
  const out: ParityFindingKey[] = [];
  for (const k of a) {
    const s = keyString(k);
    const n = left.get(s) ?? 0;
    if (n > 0) left.set(s, n - 1);
    else out.push(k);
  }
  return out;
}

function countDiff(a: Readonly<Record<string, number>> | undefined, b: Readonly<Record<string, number>> | undefined): Record<string, readonly [number, number]> {
  const out: Record<string, readonly [number, number]> = {};
  const ids = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort();
  for (const id of ids) {
    const x = a?.[id] ?? 0;
    const y = b?.[id] ?? 0;
    if (x !== y) out[id] = [x, y];
  }
  return out;
}

/** Distance in units in the last place between two finite doubles (Infinity across signs or for non-finite values). */
export function ulpDistance(a: number, b: number): number {
  if (a === b) return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.sign(a) !== Math.sign(b)) return Infinity;
  const buf = new DataView(new ArrayBuffer(16));
  buf.setFloat64(0, a);
  buf.setFloat64(8, b);
  const d = buf.getBigInt64(0) - buf.getBigInt64(8);
  return Number(d < 0n ? -d : d);
}

const EXACT_FIELDS = ['verdict', 'violationCount', 'blockingViolationCount', 'advisoryViolationCount'] as const;
const FLOAT_FIELDS = ['ahs', 'blockingAhs'] as const;

/** The parity of a check evaluation against the evaluation of record (design doc §3). */
export function compareEvaluations(record: StepEvaluation, check: StepEvaluation): { status: Exclude<ParityStatus, 'check-failed'>; diff?: ParityDiff } {
  const rk = record.blockingFindings.map(findingKey);
  const ck = check.blockingFindings.map(findingKey);
  const onlyRecord = minus(rk, ck);
  const onlyCheck = minus(ck, rk);
  const blockingByRule = countDiff(record.blockingByRule, check.blockingByRule);
  const advisoryByRule = countDiff(record.advisoryByRule, check.advisoryByRule);
  const fields: Record<string, readonly [unknown, unknown]> = {};
  for (const f of EXACT_FIELDS) if (record[f] !== check[f]) fields[f] = [record[f], check[f]];
  let floatsWithinUlp = true;
  for (const f of FLOAT_FIELDS) {
    const x = record[f];
    const y = check[f];
    if (x === y) continue;
    fields[f] = [x, y];
    if (x === null || y === null || ulpDistance(x, y) > ORDER_ULP) floatsWithinUlp = false;
  }
  const diff: ParityDiff = {
    ...(onlyRecord.length > 0 ? { onlyRecord: onlyRecord.slice(0, MAX_PARITY_FINDINGS), onlyRecordTotal: onlyRecord.length } : {}),
    ...(onlyCheck.length > 0 ? { onlyCheck: onlyCheck.slice(0, MAX_PARITY_FINDINGS), onlyCheckTotal: onlyCheck.length } : {}),
    ...(Object.keys(blockingByRule).length > 0 ? { blockingByRule } : {}),
    ...(Object.keys(advisoryByRule).length > 0 ? { advisoryByRule } : {}),
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
  };
  if (Object.keys(diff).length === 0) return { status: 'identical' };
  const onlyFloats = Object.keys(diff).length === 1 && diff.fields !== undefined && Object.keys(fields).every((f) => (FLOAT_FIELDS as readonly string[]).includes(f));
  return { status: onlyFloats && floatsWithinUlp ? 'order' : 'divergent', diff };
}

export interface TeeOptions {
  /** Called once per snapshot whose parity is not `identical` (the harness prints it to stderr). */
  readonly onMismatch?: (runId: string | undefined, projectDir: string, parity: EngineParity) => void;
}

/**
 * Neo4j of record, the interpreter as check. A failed evaluation of record is returned as is (the interpreter is not
 * run); a failed or divergent check is recorded and never fails the snapshot.
 */
export function teeEvaluator(record: StepEvaluator, check: StepEvaluator, o: TeeOptions = {}): StepEvaluator {
  return {
    id: record.id,
    evaluate: async (dir, runId) => {
      const r = await record.evaluate(dir, runId);
      if (!r.success) return r;
      const c = await check.evaluate(dir, runId);
      let parity: EngineParity;
      if (!c.success) {
        const first = c.errors[0];
        parity = { checkEngine: 'cypher-interp', status: 'check-failed', checkError: { code: first?.code ?? 'CHECK_FAILED', message: first?.message ?? 'unknown' } };
      } else {
        const cmp = compareEvaluations(r.data, c.data);
        parity = { checkEngine: 'cypher-interp', status: cmp.status, ...(cmp.diff !== undefined ? { diff: cmp.diff } : {}), durationMs: c.data.durationMs };
      }
      if (parity.status !== 'identical') o.onMismatch?.(runId, dir, parity);
      return DomainResult.ok({ ...r.data, engineOfRecord: 'neo4j', parity });
    },
  };
}

/**
 * The step evaluator of a spec file under an engine. `build(deps, env)` makes the plain evaluator (normally
 * `firewallEvaluator` with the run's tsconfig); `undefined` engine = the base wiring unchanged. Every mode records the
 * engine its evaluations ran on (`engineOfRecord`): the base wiring's own engine, the chosen one, or Neo4j under
 * `both` (review fix F7: a record never leaves its engine to be guessed).
 */
export function evaluatorForEngine(
  engine: LoopEngine | undefined,
  base: EvaluateDeps,
  env: NodeJS.ProcessEnv,
  build: (deps: EvaluateDeps, env: NodeJS.ProcessEnv) => StepEvaluator,
  o: TeeOptions = {},
): StepEvaluator {
  if (engine === undefined) return taggedEvaluator(build(base, env), base.graphEngine ?? 'neo4j');
  if (engine === 'neo4j') return taggedEvaluator(build(engineDeps(base, 'neo4j'), env), 'neo4j');
  if (engine === 'cypher-interp') return taggedEvaluator(build(engineDeps(base, 'cypher-interp'), engineEnv(env, engine)), 'cypher-interp');
  return teeEvaluator(build(engineDeps(base, 'neo4j'), env), build(engineDeps(base, 'cypher-interp'), env), o);
}
