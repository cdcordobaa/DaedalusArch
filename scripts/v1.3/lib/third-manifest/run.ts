/**
 * v1.3 third manifest: the answer parser, the cassette store, the frozen-hash check and the run over a set of cases.
 * Output layout is the one `scripts/v1.3/ue-score.ts --blind` reads: `blind-key.json` and
 * `blind-out/<style>/<case>.json`, plus `run.json` (hashes, writer facts, per-case status) and `ledger.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sortedJson, writeFileAtomic } from '../../../../src/llm-critic/cassette-manager.js';
import { ProviderError } from '../labelling/providers.js';
import type { ManifestWriter, WriterAnswer, WriterRequest } from './adapters.js';
import type { Bundle } from './bundle.js';
import { OUTPUT_SCHEMA_TEXT, PROMPT_SHA256, SCHEMA_SHA256, SYSTEM_PROMPT, THIRD_MANIFEST_PROMPT_VERSION, sha256 } from './prompt.js';

export const THIRD_MANIFEST_DOC = 'Docs/v1.3/third-manifest.md';

// ── Frozen-hash check ───────────────────────────────────────────────────────

/** The prompt and schema sha256 recorded in the doc's §7 table must equal the computed ones (`TM_HASH_DRIFT`). */
export function checkFrozenHashes(docText: string): void {
  const row = (label: RegExp): string | undefined => docText.split('\n').find((l) => label.test(l))?.match(/`([0-9a-f]{64})`/)?.[1];
  const p = row(/^\| Prompt text `tm-1`/);
  const s = row(/^\| Output schema/);
  if (p !== PROMPT_SHA256 || s !== SCHEMA_SHA256) {
    throw new ProviderError('TM_HASH_DRIFT', `prompt/schema hashes differ from ${THIRD_MANIFEST_DOC} (doc ${String(p)}/${String(s)}, computed ${PROMPT_SHA256}/${SCHEMA_SHA256})`, 'stop');
  }
}

// ── Strict answer parser ────────────────────────────────────────────────────

export interface ParsedFinding { ruleId: string; file: string; target: string | null; tier: 'blocking' | 'advisory'; reason: string; confidence: 'high' | 'medium' | 'low'; alsoMatches: string[] }
export interface ParsedManifest {
  verdict: 'pass' | 'fail';
  expectedGraph: { files: { file: string; layer: string | null; context?: string | null }[]; edges: { from: string; to: string; kind: 'import' | 're-export'; typeOnly?: boolean; viaReExport?: boolean; through?: string[] }[]; unresolvedEdges: { from: string; specifier: string }[] };
  findings: ParsedFinding[];
  nearMissOk: { nearMissOk: string; reason: string }[];
}

export class AnswerError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || v === '') throw new AnswerError(`${what} is not a non-empty string`);
  return v;
};
const oneOf = <T extends string>(v: unknown, opts: readonly T[], what: string): T => {
  if (typeof v !== 'string' || !(opts as readonly string[]).includes(v)) throw new AnswerError(`${what} is not one of ${opts.join(', ')}`);
  return v as T;
};
const arr = (v: unknown, what: string): unknown[] => {
  if (!Array.isArray(v)) throw new AnswerError(`${what} is not an array`);
  return v;
};
const nullableStr = (v: unknown, what: string): string | null => (v === null || v === undefined || v === '' ? null : str(v, what));

/** The answer as JSON (a fenced block is accepted), checked against the frozen schema's shape. */
export function parseManifestAnswer(text: string): ParsedManifest {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(text);
  let raw: unknown;
  try { raw = JSON.parse((fenced?.[1] ?? text).trim()); } catch { throw new AnswerError('answer is not JSON'); }
  if (!isObj(raw)) throw new AnswerError('answer is not a JSON object');
  const g = raw.expectedGraph;
  if (!isObj(g)) throw new AnswerError('expectedGraph is not an object');
  const findings = arr(raw.findings, 'findings').map((f, i): ParsedFinding => {
    if (!isObj(f)) throw new AnswerError(`findings[${String(i)}] is not an object`);
    return {
      ruleId: str(f.ruleId, `findings[${String(i)}].ruleId`), file: str(f.file, `findings[${String(i)}].file`),
      target: nullableStr(f.target, `findings[${String(i)}].target`), tier: oneOf(f.tier, ['blocking', 'advisory'], `findings[${String(i)}].tier`),
      reason: str(f.reason, `findings[${String(i)}].reason`), confidence: oneOf(f.confidence, ['high', 'medium', 'low'], `findings[${String(i)}].confidence`),
      alsoMatches: f.alsoMatches === undefined ? [] : arr(f.alsoMatches, `findings[${String(i)}].alsoMatches`).map((n, j) => str(n, `findings[${String(i)}].alsoMatches[${String(j)}]`)),
    };
  });
  return {
    verdict: oneOf(raw.verdict, ['pass', 'fail'], 'verdict'),
    expectedGraph: {
      files: arr(g.files, 'expectedGraph.files').map((f, i) => {
        if (!isObj(f)) throw new AnswerError(`expectedGraph.files[${String(i)}] is not an object`);
        return { file: str(f.file, 'file'), layer: nullableStr(f.layer, 'layer'), ...(f.context !== undefined && { context: nullableStr(f.context, 'context') }) };
      }),
      edges: arr(g.edges, 'expectedGraph.edges').map((e, i) => {
        if (!isObj(e)) throw new AnswerError(`expectedGraph.edges[${String(i)}] is not an object`);
        return {
          from: str(e.from, 'from'), to: str(e.to, 'to'), kind: oneOf(e.kind, ['import', 're-export'], `expectedGraph.edges[${String(i)}].kind`),
          ...(typeof e.typeOnly === 'boolean' && { typeOnly: e.typeOnly }), ...(typeof e.viaReExport === 'boolean' && { viaReExport: e.viaReExport }),
          ...(e.through !== undefined && { through: arr(e.through, 'through').map((t) => str(t, 'through[]')) }),
        };
      }),
      unresolvedEdges: [],
    },
    findings,
    nearMissOk: arr(raw.nearMissOk, 'nearMissOk').map((n, i) => {
      if (!isObj(n)) throw new AnswerError(`nearMissOk[${String(i)}] is not an object`);
      return { nearMissOk: str(n.nearMissOk, 'nearMissOk'), reason: str(n.reason, 'reason') };
    }),
  };
}

// ── Cassettes ───────────────────────────────────────────────────────────────

export interface TmCassette {
  readonly key: string;
  readonly adapter: string;
  readonly model: string;
  readonly caseId: string;
  readonly attempt: number;
  readonly promptSha256: string;
  readonly answer: WriterAnswer;
}

export function tmCassetteKey(adapter: string, model: string, req: WriterRequest, attempt: number): string {
  return sha256(JSON.stringify([THIRD_MANIFEST_PROMPT_VERSION, adapter, model, attempt, sha256(req.system), sha256(req.prompt), sha256(OUTPUT_SCHEMA_TEXT)]));
}

export class TmCassetteStore {
  constructor(readonly dir: string, readonly mode: 'record' | 'replay') {}
  private file(key: string): string { return path.join(this.dir, key.slice(0, 2), `${key}.json`); }
  read(key: string): TmCassette | null {
    const f = this.file(key);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as TmCassette : null;
  }
  write(c: TmCassette): void { writeFileAtomic(this.file(c.key), sortedJson(c)); }
}

// ── The run ─────────────────────────────────────────────────────────────────

export interface CaseResult {
  readonly caseId: string;
  readonly style: string;
  readonly status: 'ok' | 'invalid';
  readonly bundleSha256: string;
  readonly promptSha256: string;
  readonly cassetteKeys: readonly string[];
  readonly servedModel?: string;
  readonly failures: readonly string[];
}

export interface RunOptions {
  readonly outDir: string;
  readonly cassettes: TmCassetteStore;
  /** case id -> variant (`<style>/<variant>` or an author label); written to blind-key.json only. */
  readonly key: Readonly<Record<string, string>>;
  readonly label: string;
}

const REASK = 'Your previous reply was not valid against the response schema. Reply again with one JSON object that matches it, and nothing else.';

/**
 * Runs every bundle through the writer, one call per case (a re-ask after an unparsable answer, one retry after a
 * retryable failure). A stop error ends the run: run.json is written with what finished, and the error is rethrown.
 */
export async function runCases(bundles: readonly Bundle[], writer: ManifestWriter, o: RunOptions): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  const writeRun = (stopped: string | null): void => {
    writeFileAtomic(path.join(o.outDir, 'run.json'), sortedJson({
      label: o.label, promptVersion: THIRD_MANIFEST_PROMPT_VERSION, promptSha256: PROMPT_SHA256, schemaSha256: SCHEMA_SHA256,
      writer: { adapter: writer.id, vendor: writer.vendor, model: writer.model, facts: writer.facts }, stopped,
      cases: results, notRun: bundles.filter((b) => !results.some((r) => r.caseId === b.caseId)).map((b) => b.caseId),
    }));
  };
  const blindKey: Record<string, string> = {};
  for (const b of bundles) blindKey[`${b.style}/${b.caseId}`] = o.key[b.caseId] ?? '';
  writeFileAtomic(path.join(o.outDir, 'blind-key.json'), sortedJson(blindKey));
  try {
    await writer.prepare();
    for (const b of bundles) {
      const keys: string[] = [];
      const failures: string[] = [];
      let parsed: ParsedManifest | null = null;
      let served: string | undefined;
      let attempt = 0;
      let prompt = b.prompt;
      while (parsed === null && attempt < 3) {
        attempt += 1;
        const req: WriterRequest = { system: SYSTEM_PROMPT, prompt, caseId: b.caseId };
        const key = tmCassetteKey(writer.id, writer.model, req, attempt);
        keys.push(key);
        let answer: WriterAnswer;
        const hit = o.cassettes.read(key);
        if (hit !== null) answer = hit.answer;
        else if (o.cassettes.mode === 'replay') throw new ProviderError('CASSETTE_MISS', `no cassette for ${b.caseId} attempt ${String(attempt)}`, 'stop');
        else {
          try {
            answer = await writer.call(req);
          } catch (e) {
            if (e instanceof ProviderError && e.kind === 'retry') { failures.push(`${e.code}: ${e.message}`); if (failures.length >= 2) break; continue; }
            throw e;
          }
          o.cassettes.write({ key, adapter: writer.id, model: writer.model, caseId: b.caseId, attempt, promptSha256: sha256(prompt), answer });
        }
        served = answer.servedModel;
        try {
          parsed = parseManifestAnswer(answer.text);
        } catch (e) {
          failures.push(`TM_INVALID_ANSWER: ${(e as Error).message}`);
          if (prompt !== b.prompt) break;
          prompt = `${b.prompt}\n\n${REASK}`;
        }
      }
      const out = path.join(o.outDir, 'blind-out', b.style, `${b.caseId}.json`);
      const provenance = { writer: `${writer.vendor}:${writer.model}`, adapter: writer.id, servedModel: served ?? null, promptSha256: PROMPT_SHA256, schemaSha256: SCHEMA_SHA256, casePromptSha256: b.promptSha256, bundleSha256: b.bundleSha256, cassetteKeys: keys, label: o.label };
      if (parsed === null) {
        writeFileAtomic(out, sortedJson({ style: b.style, case: b.caseId, verdict: 'invalid', expectedGraph: { files: [], edges: [], unresolvedEdges: [] }, findings: [], nearMissOk: [], provenance, failures }));
        results.push({ caseId: b.caseId, style: b.style, status: 'invalid', bundleSha256: b.bundleSha256, promptSha256: b.promptSha256, cassetteKeys: keys, ...(served !== undefined && { servedModel: served }), failures });
      } else {
        writeFileAtomic(out, sortedJson({ style: b.style, case: b.caseId, ...parsed, provenance }));
        results.push({ caseId: b.caseId, style: b.style, status: 'ok', bundleSha256: b.bundleSha256, promptSha256: b.promptSha256, cassetteKeys: keys, ...(served !== undefined && { servedModel: served }), failures });
      }
    }
  } catch (e) {
    writeRun(e instanceof ProviderError ? `${e.code}: ${e.message}` : String(e));
    throw e;
  }
  writeRun(null);
  return results;
}
