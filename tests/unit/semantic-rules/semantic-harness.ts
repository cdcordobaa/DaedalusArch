/**
 * Semantic rule tests: helpers (no test of their own).
 *
 * A case builds a small APG by hand, writes it through the real ingestion statements (`ingestNodes` / `ingestEdges`)
 * into the in-process interpreter (`MemoryGraphRepository`, engine `cypher-interp`), compiles the style's reference
 * spec with the v1.3 compile options the pipeline uses, and runs the one compiled query of the rule through
 * `evaluateSymbolic`. The template text is never copied or edited here: whatever the catalogue holds is what runs.
 *
 * No Neo4j, no network, no LLM.
 */
import * as path from 'node:path';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';
import type { LayerAnnotation } from '../../../src/neo4j-ingestion/types.js';
import { ingestEdges, ingestNodes } from '../../../src/neo4j-ingestion/graph-ingester.js';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/index.js';
import type { CompileOptions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseInstrumentVersion } from '../../../src/fitness-compiler/role-exemptions.js';
import { evaluateSymbolic } from '../../../src/evaluation-engine/index.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';

/** The repository root (jest runs CommonJS with `__dirname`; under an ES-module runner the cwd is the root). */
const ROOT = typeof __dirname === 'string' ? path.resolve(__dirname, '../../..') : process.cwd();

/** The spec each reference style is evaluated with (`tests/fixtures/v1.3-reference`, DDD: `presets/ddd.yaml`). */
export const STYLE_SPECS = {
  'clean-architecture': 'tests/fixtures/v1.3-reference/clean-architecture/spec.yaml',
  layered: 'tests/fixtures/v1.3-reference/layered/spec.yaml',
  nestjs: 'tests/fixtures/v1.3-reference/nestjs/spec.yaml',
  hexagonal: 'tests/fixtures/v1.3-reference/hexagonal/spec.yaml',
  ddd: 'presets/ddd.yaml',
} as const;
export type Style = keyof typeof STYLE_SPECS;

// ── Graph builder ─────────────────────────────────────────────────────────────

type EdgeType = APGEdge['type'];

/** A hand-built APG. Node ids: files by path, classes and interfaces `path#Name`, packages `pkg:name`. */
export class Graph {
  readonly nodes: APGNode[] = [];
  readonly edges: APGEdge[] = [];
  readonly annotations = new Map<string, LayerAnnotation>();
  private line = 1;

  private add(id: string, type: APGNode['type'], name: string, filePath: string, layer: string | undefined, properties: Record<string, unknown>): string {
    if (this.nodes.some((n) => n.id === id)) return id;
    this.nodes.push({ id, type, name, filePath, decorators: [], properties });
    if (layer !== undefined) this.annotations.set(id, { layer, role: null, matchMethod: 'directory' });
    return id;
  }

  /** A File node; `layer` undefined leaves the node without a layer (as for an unmapped file). */
  file(filePath: string, layer?: string, properties: Record<string, unknown> = {}): string {
    return this.add(filePath, 'File', path.posix.basename(filePath), filePath, layer, { isBarrel: false, ...properties });
  }

  cls(name: string, filePath: string, layer?: string, properties: Record<string, unknown> = {}): string {
    this.file(filePath, layer);
    return this.add(`${filePath}#${name}`, 'Class', name, filePath, layer, properties);
  }

  iface(name: string, filePath: string, layer?: string): string {
    this.file(filePath, layer);
    return this.add(`${filePath}#${name}`, 'Interface', name, filePath, layer, {});
  }

  pkg(name: string): string {
    return this.add(`pkg:${name}`, 'Package', name, '', undefined, {});
  }

  /** A Method of a class or interface; like the layer annotator, it takes its file's layer. */
  method(classId: string, name: string): string {
    const owner = this.nodes.find((n) => n.id === classId);
    if (owner === undefined) throw new Error(`no class ${classId}`);
    const id = this.add(`${classId}.${name}`, 'Method', name, owner.filePath, this.annotations.get(classId)?.layer ?? undefined, {});
    this.edge('CONTAINS', classId, id);
    return id;
  }

  edge(type: EdgeType, from: string, to: string, properties: Record<string, unknown> = {}): this {
    const line = this.line;
    this.line += 1;
    const isImport = type === 'IMPORTS' || type === 'RE_EXPORTS';
    this.edges.push({ id: `e${String(this.edges.length + 1)}`, type, sourceId: from, targetId: to,
      properties: isImport ? { line, lines: [line], isTypeOnly: false, ...properties } : properties });
    return this;
  }

  imports(from: string, to: string, properties: Record<string, unknown> = {}): this {
    return this.edge('IMPORTS', from, to, properties);
  }

  reExports(from: string, to: string, properties: Record<string, unknown> = {}): this {
    return this.edge('RE_EXPORTS', from, to, properties);
  }

  /** Writes the graph through the ingestion's own statements. */
  async repository(): Promise<MemoryGraphRepository> {
    const repo = new MemoryGraphRepository();
    const n = await ingestNodes(this.nodes, this.annotations, repo);
    if (!n.success) throw new Error(`ingest nodes: ${JSON.stringify(n.errors)}`);
    const e = await ingestEdges(this.edges, repo);
    if (!e.success) throw new Error(`ingest edges: ${JSON.stringify(e.errors)}`);
    if (e.data !== this.edges.length) throw new Error(`ingest edges: ${String(e.data)} of ${String(this.edges.length)} created`);
    return repo;
  }
}

// ── Compile and evaluate ──────────────────────────────────────────────────────

const specCache = new Map<Style, Promise<ParsedSpec>>();

function specOf(style: Style): Promise<ParsedSpec> {
  let p = specCache.get(style);
  if (p === undefined) {
    p = parseSpec({ specFilePath: path.join(ROOT, STYLE_SPECS[style]) }).then((r) => {
      if (!r.success) throw new Error(`spec ${style}: ${JSON.stringify(r.errors)}`);
      return r.data;
    });
    specCache.set(style, p);
  }
  return p;
}

/**
 * The rule's query as the v1.3 pipeline compiles it (`CompileCommand`: `V13_COMPILE_OPTIONS`, instrument v2). Compiled
 * per call, so the text is whatever the catalogue holds when the test runs. `overrides` changes compile options (only
 * FF-P05 uses it, see its cases).
 */
export async function compiledQuery(style: Style, ruleId: string, overrides: Partial<CompileOptions> = {}): Promise<CypherQuery> {
  const spec = await specOf(style);
  const instrumentVersion = parseInstrumentVersion('v2');
  if (instrumentVersion === undefined) throw new Error('instrument v2 unknown');
  const c = compileFunctions(compilerInputFromSpec(spec), { ...V13_COMPILE_OPTIONS, instrumentVersion, ...overrides });
  if (!c.success) throw new Error(`COMPILE_FAILED ${style}: ${c.errors.map((e) => e.message).join('; ')}`);
  const q = c.data.symbolicQueries.find((x) => String(x.functionId) === ruleId);
  if (q === undefined) throw new Error(`COMPILE_FAILED ${style}: no compiled query for ${ruleId}`);
  return q;
}

/** One finding as a short, order-free key: `file -> target (relType)`; cycles are their sorted file set. */
export function findingKey(v: Violation, ruleId: string): string {
  if (ruleId === 'FF-S02') {
    const files = [...new Set(v.filePath.split(','))].sort();
    return `cycle{${files.join(' ')}}`;
  }
  const rel = (v.discriminator ?? []).find((d) => d === 'IMPORTS' || d === 'RE_EXPORTS');
  return `${v.filePath}${v.target !== undefined ? ` -> ${v.target}` : ''}${rel !== undefined ? ` (${rel})` : ''}`;
}

export interface Evaluated {
  readonly keys: string[];
  readonly violations: readonly Violation[];
  readonly warnings: readonly string[];
}

/** Runs the rule's compiled query over the graph; a query failure throws (the test then fails loudly). */
export async function evaluate(style: Style, ruleId: string, graph: Graph, overrides: Partial<CompileOptions> = {}): Promise<Evaluated> {
  const query = await compiledQuery(style, ruleId, overrides);
  const repo = await graph.repository();
  const r = await evaluateSymbolic({ queries: [query], graphRepository: repo });
  if (!r.success) throw new Error(`QUERY_FAILED ${ruleId}: ${JSON.stringify(r.errors)}`);
  if (r.data.failures.length > 0) throw new Error(`QUERY_FAILED ${ruleId}: ${r.data.failures.map((f) => f.message).join('; ')}`);
  const violations = r.data.results.flatMap((x) => x.violations);
  return { keys: violations.map((v) => findingKey(v, ruleId)).sort(), violations, warnings: r.data.warnings.map((w) => `${w.code}: ${w.message}`) };
}
