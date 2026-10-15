/**
 * DDD reference project helpers (v1.3, FR-V3/FR-V4): materialise a variant, run the real extractor, layer annotator
 * and compiler over it, and evaluate the compiled DDD queries without Neo4j.
 *
 * `evaluate` is a line-for-line mirror of the WHERE clauses of the DDD templates and of the two hexagonal layering
 * templates the preset composes, plus `domain-purity`. The Cypher text itself runs against a database only in
 * `ddd-neo4j.test.ts`, which skips without NEO4J_PASSWORD.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { APGNode, APGResult } from '../../../src/shared/types/apg.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

/** The value, or a thrown error naming what was missing (tests use it instead of non-null assertions). */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`missing: ${what}`);
  return value;
}

export const ROOT = path.resolve(__dirname, '../../..');
export const REFERENCE = path.join(ROOT, 'tests/fixtures/v1.3-reference/ddd');
export const PRESET = path.join(ROOT, 'presets/ddd.yaml');

export interface VariantMeta { readonly id: string; readonly rule: string | null; readonly plants: string; readonly delete: readonly string[] }
export interface ExpectedFinding { readonly rule: string; readonly name: string; readonly file: string; readonly target?: string; readonly class?: string; readonly reason: string }
export interface Manifest { readonly variant: string; readonly findings: readonly ExpectedFinding[] }

/** One result row, reduced to what a manifest entry names: function id, file and (for edges) target. */
export interface Row { readonly rule: string; readonly name: string; readonly file: string; readonly target?: string }

export function variantIds(): string[] {
  return fs.readdirSync(path.join(REFERENCE, 'variants')).sort();
}

export function readVariant(id: string): { meta: VariantMeta; manifest: Manifest } {
  const dir = path.join(REFERENCE, 'variants', id);
  return {
    meta: JSON.parse(fs.readFileSync(path.join(dir, 'variant.json'), 'utf8')) as VariantMeta,
    manifest: JSON.parse(fs.readFileSync(path.join(dir, 'expected-findings.json'), 'utf8')) as Manifest,
  };
}

function copyDir(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

/**
 * Materialise a variant into a fresh directory under `parent` (`clean` is the clean project itself): copy `clean/`
 * without its manifest, delete the listed files, copy the overlay on top.
 */
export function materialise(id: string, parent: string): string {
  const dir = path.join(parent, id);
  copyDir(path.join(REFERENCE, 'clean'), dir);
  fs.rmSync(path.join(dir, 'expected-findings.json'), { force: true });
  if (id === 'clean') return dir;
  const { meta } = readVariant(id);
  for (const rel of meta.delete) fs.rmSync(path.join(dir, rel));
  copyDir(path.join(REFERENCE, 'variants', id, 'overlay'), dir);
  return dir;
}

export function cleanupScratch(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function parsedPreset(): Promise<ParsedSpec> {
  const parsed = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  return parsed.data;
}

export async function compiledPreset(): Promise<readonly CypherQuery[]> {
  const compiled = compileFunctions(compilerInputFromSpec(await parsedPreset()));
  if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));
  return compiled.data.symbolicQueries;
}

/** Extract and annotate a project directory with the preset's layer model. */
export async function extractAnnotated(projectDir: string): Promise<APGResult> {
  const spec = await parsedPreset();
  const apg = await extractAPG(projectDir);
  if (!apg.success) throw new Error(apg.errors.map((e) => e.message).join('; '));
  const { annotations } = annotateNodes(apg.data.nodes, spec.layerModel);
  const nodes: APGNode[] = apg.data.nodes.map((n) => ({ ...n, layer: annotations.get(n.id)?.layer ?? undefined }));
  return { ...apg.data, nodes };
}

export async function analyse(projectDir: string): Promise<{ rows: Row[]; queries: readonly CypherQuery[]; apg: APGResult }> {
  const queries = await compiledPreset();
  const apg = await extractAnnotated(projectDir);
  return { rows: queries.flatMap((q) => evaluate(q, apg)), queries, apg };
}

const re = (p: string): RegExp => new RegExp(p);
const full = (p: string): RegExp => new RegExp(`^(?:${p})$`); // Cypher =~ is a full match

/** Mirror of the Cypher WHERE clauses of the compiled queries (see the template file for each). */
export function evaluate(q: CypherQuery, apg: APGResult): Row[] {
  const byId = new Map(apg.nodes.map((n) => [n.id, n]));
  const p = q.params as Record<string, unknown>;
  const list = (name: string): string[] => (p[name] as string[] | undefined) ?? [];
  const any = (patterns: readonly string[], s: string): boolean => patterns.some((x) => re(x).test(s));
  const rule = String(q.functionId);
  const fileEdges = apg.edges
    .filter((e) => e.type === 'IMPORTS' || e.type === 'RE_EXPORTS')
    .flatMap((e) => {
      const src = byId.get(e.sourceId);
      const tgt = byId.get(e.targetId);
      return src?.type === 'File' && tgt?.type === 'File' ? [{ src, tgt }] : [];
    });
  const edgeRow = (src: APGNode, tgt: APGNode): Row => ({ rule, name: q.name, file: src.filePath, target: tgt.filePath });
  const classesWithMethods = (): { c: APGNode; methods: APGNode[] }[] =>
    apg.nodes.filter((c) => c.type === 'Class').map((c) => ({
      c,
      methods: apg.edges.filter((e) => e.type === 'CONTAINS' && e.sourceId === c.id).map((e) => byId.get(e.targetId)).filter((m): m is APGNode => m?.type === 'Method'),
    }));

  switch (q.name) {
    case 'bounded-context-modules': {
      const roots = list('contextRoots');
      return apg.nodes
        .filter((f) => f.type === 'File' && f.filePath.startsWith(String(p.sourceRoot)))
        .filter((f) => !roots.some((r) => f.filePath.startsWith(r)) && !any(list('outsidePatterns'), f.filePath))
        .map((f) => ({ rule, name: q.name, file: f.filePath }));
    }
    case 'context-isolation': {
      const roots = list('contextRoots');
      const ctx = (s: string): string | undefined => roots.find((r) => s.startsWith(r));
      const reExports = apg.edges.filter((e) => e.type === 'RE_EXPORTS');
      // EXISTS { (api:File)-[:RE_EXPORTS*1..]->(tgt) } with api a public-API file of the target's context
      const publishedVia = (tgtId: string, root: string): boolean => {
        const seen = new Set<string>([tgtId]);
        const queue: string[] = [tgtId];
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          for (const e of reExports.filter((x) => x.targetId === id)) {
            const api = byId.get(e.sourceId);
            if (api?.type === 'File' && api.filePath.startsWith(root) && any(list('publicApiPatterns'), api.filePath)) return true;
            if (!seen.has(e.sourceId)) { seen.add(e.sourceId); queue.push(e.sourceId); }
          }
        }
        return false;
      };
      return fileEdges
        .filter(({ src, tgt }) => {
          const a = ctx(src.filePath);
          const b = ctx(tgt.filePath);
          return a !== undefined && b !== undefined && a !== b
            && !any(list('publicApiPatterns'), tgt.filePath) && !publishedVia(tgt.id, b) && !any(list('aclPatterns'), src.filePath);
        })
        .map(({ src, tgt }) => edgeRow(src, tgt));
    }
    case 'aggregate-boundary': {
      const aggs = p.aggregates as { module: string; innerEntities: string[] }[];
      return aggs.flatMap((agg) => fileEdges
        .filter(({ src, tgt }) => any(agg.innerEntities, tgt.filePath) && !re(agg.module).test(src.filePath))
        .map(({ src, tgt }) => edgeRow(src, tgt)));
    }
    case 'repository-aggregate-root': {
      const aggs = p.aggregates as { module: string; innerEntities: string[] }[];
      return aggs.flatMap((agg) => fileEdges
        .filter(({ src, tgt }) => any(list('repositoryPatterns'), src.filePath) && any(agg.innerEntities, tgt.filePath))
        .map(({ src, tgt }) => edgeRow(src, tgt)));
    }
    case 'value-object-immutability': {
      const setter = full(String(p.setterPattern));
      return classesWithMethods()
        .filter(({ c }) => any(list('valueObjectPatterns'), c.filePath))
        .flatMap(({ c, methods }) => methods
          .filter((m) => m.properties.isStatic !== true && setter.test(m.name.split('.').pop() ?? ''))
          .map(() => ({ rule, name: q.name, file: c.filePath })));
    }
    case 'domain-event-placement': {
      const types = list('domainEventTypes');
      const domainLayers = list('domainLayers');
      const supers = (id: string): string[] => apg.edges.filter((e) => (e.type === 'IMPLEMENTS' || e.type === 'EXTENDS') && e.sourceId === id).map((e) => e.targetId);
      const reaches = (id: string, seen = new Set<string>()): boolean => supers(id).some((t) => {
        if (seen.has(t)) return false;
        seen.add(t);
        return types.includes(byId.get(t)?.name ?? '') || reaches(t, seen);
      });
      return apg.nodes
        .filter((c) => c.type === 'Class' && reaches(c.id) && (c.layer == null || !domainLayers.includes(c.layer)))
        .map((c) => ({ rule, name: q.name, file: c.filePath }));
    }
    case 'application-service-thin':
      return classesWithMethods()
        .filter(({ c, methods }) => any(list('applicationServicePatterns'), c.filePath) && methods.length > (p.threshold as number))
        .map(({ c }) => ({ rule, name: q.name, file: c.filePath }));
    case 'domain-purity': {
      const forbidden = list('forbiddenImports');
      return apg.edges
        .filter((e) => e.type === 'IMPORTS' || e.type === 'RE_EXPORTS')
        .flatMap((e) => {
          const src = byId.get(e.sourceId);
          const pkg = byId.get(e.targetId);
          if (src?.type !== 'File' || pkg?.type !== 'Package' || src.layer !== p.domainLayer) return [];
          const hit = forbidden.some((fp) => pkg.name === fp || (fp.endsWith('/*') && pkg.name.startsWith(fp.slice(0, -1))));
          return hit ? [{ rule, name: q.name, file: src.filePath, target: pkg.name }] : [];
        });
    }
    case 'dependency-direction-graph':
    case 'layer-skip-graph': {
      const allowed = list('allowedDependencies');
      const wantReverse = q.name === 'dependency-direction-graph';
      return fileEdges
        .filter(({ src, tgt }) => src.layer != null && tgt.layer != null && src.layer !== tgt.layer
          && !allowed.includes(`${src.layer}>${tgt.layer}`) && allowed.includes(`${tgt.layer}>${src.layer}`) === wantReverse)
        .map(({ src, tgt }) => edgeRow(src, tgt));
    }
    default:
      throw new Error(`no mirror for ${q.name}`);
  }
}

/** Manifest entries reduced to the comparable key `rule file [-> target]`. */
export function manifestKeys(m: Manifest): string[] {
  return m.findings.map((f) => `${f.rule} ${f.file}${f.target !== undefined ? ` -> ${f.target}` : ''}`).sort();
}

export function rowKeys(rows: readonly Row[]): string[] {
  return [...new Set(rows.map((r) => `${r.rule} ${r.file}${r.target !== undefined ? ` -> ${r.target}` : ''}`))].sort();
}

export const tmpdir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-'));
