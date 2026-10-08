import * as fs from 'node:fs';
import * as path from 'node:path';
import { Node, Project, SyntaxKind, type SourceFile } from 'ts-morph';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { canonicalJSON } from './canonical-json.js';
import {
  CHARS_PER_TOKEN, EXCERPT_EDGE_TYPES, EXCERPT_MAX_NODES, SOURCE_BEGIN, SOURCE_DELIMITER_ESCAPED,
  SOURCE_DELIMITER_PREFIX, SOURCE_END, TRUNCATION_MARKER,
} from './frozen.js';
import type { JudgeGraphView } from './judge-graph.js';
import { loadJudgeGraphView, typeKey } from './judge-graph.js';
import type { JudgeUnit } from './judge-unit-selector.js';
import type { TokenBudget } from './types.js';

/**
 * Unit source context (BR-U4-CTX-01..05, CTX-08; DE §3.1-3.2). The pure core reads only files
 * under `projectRoot` (real-path prefix check) and a `JudgeGraphView`; the output holds
 * root-relative paths only, sorted lists, no timestamps (CTX-08).
 */

export interface UnitSourceContext {
  readonly unitId: string;
  readonly source: string;
  readonly signatures?: string;
  readonly incoming: readonly string[];
  readonly outgoing: readonly string[];
  readonly subgraphExcerpt: string;
  readonly truncated: boolean;
  readonly filesOmitted: readonly string[];
  readonly excerptTruncated: boolean;
}

export interface ExcerptNode {
  readonly path: string;
  readonly kind: 'File' | 'Class' | 'Interface' | 'Package';
  readonly name?: string;
  readonly layer: string | null;
}

export interface ExcerptEdge {
  readonly type: (typeof EXCERPT_EDGE_TYPES)[number];
  readonly from: string;
  readonly to: string;
}

export interface GraphExcerpt {
  readonly nodes: readonly ExcerptNode[];
  readonly edges: readonly ExcerptEdge[];
}

export const EMPTY_EXCERPT = '{"edges":[],"nodes":[]}';

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ── Reading (CTX-02) ─────────────────────────────────────────────────────────────────────

function readUnderRoot(projectRoot: string, relPath: string): DomainResult<string> {
  let rootReal: string;
  let real: string;
  try {
    rootReal = fs.realpathSync(projectRoot);
    real = fs.realpathSync(path.join(rootReal, relPath));
  } catch {
    return DomainResult.fail([{ code: 'CRITIC_001', message: `Cannot read unit file ${relPath}` }]);
  }
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) {
    return DomainResult.fail([{ code: 'CRITIC_001', message: `Unit file ${relPath} resolves outside the project root` }]);
  }
  try {
    return DomainResult.ok(fs.readFileSync(real, 'utf8').replace(/\r\n/g, '\n'));
  } catch {
    return DomainResult.fail([{ code: 'CRITIC_001', message: `Cannot read unit file ${relPath}` }]);
  }
}

// ── Fencing and truncation (CTX-03, CTX-05) ──────────────────────────────────────────────

export function escapeDelimiters(content: string): string {
  return content.split(SOURCE_DELIMITER_PREFIX).join(SOURCE_DELIMITER_ESCAPED);
}

export function fenceFile(filePath: string, content: string): string {
  return `${SOURCE_BEGIN} ${filePath}=====\n${escapeDelimiters(content)}\n${SOURCE_END}`;
}

function cut(text: string, maxChars: number): { readonly text: string; readonly truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, maxChars)}\n${TRUNCATION_MARKER}`, truncated: true };
}

// ── ts-morph helpers (class range, exported signatures) ──────────────────────────────────

function parse(filePath: string, content: string): SourceFile {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  return project.createSourceFile(filePath.replace(/\.[cm]?[jt]sx?$/, '') + '.ts', content, { overwrite: true });
}

function classText(filePath: string, content: string, className: string): string | null {
  const cls = parse(filePath, content).getClass(className);
  return cls === undefined ? null : cls.getText();
}

function withoutBody(node: Node, body: Node | undefined): string {
  const text = node.getText();
  if (body === undefined) return text;
  return `${text.slice(0, body.getStart() - node.getStart()).trimEnd()};`;
}

function isPrivateMember(member: Node): boolean {
  if (Node.isModifierable(member) && member.hasModifier(SyntaxKind.PrivateKeyword)) return true;
  return Node.isPropertyNamed(member) && member.getName().startsWith('#');
}

/** Exported declarations of one file as signatures (bodies removed); `null` when none. */
export function exportedSignatures(filePath: string, content: string): string | null {
  const sf = parse(filePath, content);
  const lines: string[] = [];
  for (const statement of sf.getStatements()) {
    if (Node.isFunctionDeclaration(statement) && statement.isExported()) {
      lines.push(withoutBody(statement, statement.getBody()));
    } else if (Node.isClassDeclaration(statement) && statement.isExported()) {
      const heritage = statement.getHeritageClauses().map((h) => h.getText()).join(' ');
      lines.push(`export class ${statement.getName() ?? 'default'}${heritage === '' ? '' : ` ${heritage}`} {`);
      for (const member of statement.getMembers()) {
        if (isPrivateMember(member)) continue;
        if (Node.isMethodDeclaration(member) || Node.isConstructorDeclaration(member)) {
          lines.push(`  ${withoutBody(member, member.getBody())}`);
        } else if (Node.isPropertyDeclaration(member)) {
          lines.push(`  ${member.getText()}`);
        }
      }
      lines.push('}');
    } else if (
      (Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement) || Node.isEnumDeclaration(statement))
      && statement.isExported()
    ) {
      lines.push(statement.getText());
    } else if (Node.isVariableStatement(statement) && statement.isExported()) {
      for (const decl of statement.getDeclarations()) {
        const type = decl.getTypeNode()?.getText();
        lines.push(`export ${statement.getDeclarationKind()} ${decl.getName()}${type === undefined ? '' : `: ${type}`};`);
      }
    }
  }
  return lines.length === 0 ? null : lines.join('\n');
}

// ── Excerpt (CTX-04) ─────────────────────────────────────────────────────────────────────

const EDGE_TYPES = new Set<string>(EXCERPT_EDGE_TYPES);

/** One-hop excerpt around the unit's File nodes and their Class/Interface nodes (CTX-04). */
export function buildGraphExcerpt(
  unit: Pick<JudgeUnit, 'filePaths'>,
  view: JudgeGraphView,
  maxNodes: number = EXCERPT_MAX_NODES,
  budgetChars?: number,
): { readonly excerpt: GraphExcerpt; readonly json: string; readonly truncated: boolean } {
  const fileLayer = new Map(view.files.map((f) => [f.path, f.layer]));
  const nodeOf = new Map<string, ExcerptNode>();
  for (const f of view.files) nodeOf.set(f.path, { path: f.path, kind: 'File', layer: f.layer });
  for (const c of view.classes) nodeOf.set(typeKey(c), { path: c.file, kind: 'Class', name: c.name, layer: fileLayer.get(c.file) ?? null });
  for (const i of view.interfaces) nodeOf.set(typeKey(i), { path: i.file, kind: 'Interface', name: i.name, layer: fileLayer.get(i.file) ?? null });
  const describe = (key: string): ExcerptNode => nodeOf.get(key) ?? { path: key, kind: 'Package', layer: null };

  const members = new Set(unit.filePaths);
  const seeds = new Set<string>(unit.filePaths);
  for (const t of [...view.classes, ...view.interfaces]) if (members.has(t.file)) seeds.add(typeKey(t));

  const edges = view.edges.filter((e) => EDGE_TYPES.has(e.type) && (seeds.has(e.from) || seeds.has(e.to)));
  const neighbours = new Set<string>();
  for (const e of edges) {
    if (!seeds.has(e.from)) neighbours.add(e.from);
    if (!seeds.has(e.to)) neighbours.add(e.to);
  }
  const byJson = (a: string, b: string): number => compareStrings(canonicalJSON(describe(a)), canonicalJSON(describe(b)));
  const ordered = [...[...seeds].sort(byJson), ...[...neighbours].sort(byJson)];
  let truncated = ordered.length > maxNodes;
  let kept = ordered.slice(0, maxNodes);

  const render = (keys: readonly string[], keptEdges: readonly ExcerptEdge[]): { excerpt: GraphExcerpt; json: string } => {
    const nodes = keys.map(describe).sort((a, b) => compareStrings(canonicalJSON(a), canonicalJSON(b)));
    const sortedEdges = [...keptEdges].sort((a, b) => compareStrings(canonicalJSON(a), canonicalJSON(b)));
    const excerpt = { nodes, edges: sortedEdges };
    return { excerpt, json: canonicalJSON(excerpt) };
  };
  const edgesWithin = (keys: readonly string[]): ExcerptEdge[] => {
    const set = new Set(keys);
    return edges.filter((e) => set.has(e.from) && set.has(e.to)).map((e) => ({ type: e.type, from: e.from, to: e.to }));
  };

  let keptEdges = edgesWithin(kept);
  let out = render(kept, keptEdges);
  if (budgetChars !== undefined) {
    while (out.json.length > budgetChars && kept.length > 0) {
      kept = kept.slice(0, -1);
      keptEdges = edgesWithin(kept);
      out = render(kept, keptEdges);
      truncated = true;
    }
  }
  return { excerpt: out.excerpt, json: kept.length === 0 ? EMPTY_EXCERPT : out.json, truncated };
}

// ── Module context (CTX-03: signatures and cross-module edges first) ─────────────────────

function crossModule(unit: Pick<JudgeUnit, 'filePaths'>, view: JudgeGraphView): { incoming: string[]; outgoing: string[] } {
  const members = new Set(unit.filePaths);
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  for (const e of view.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    if (members.has(e.to) && !members.has(e.from)) incoming.add(e.from);
    if (members.has(e.from) && !members.has(e.to)) outgoing.add(e.to);
  }
  return { incoming: [...incoming].sort(compareStrings), outgoing: [...outgoing].sort(compareStrings) };
}

/**
 * Pure core of `assembleUnitSource` (DE §3.1) over a `JudgeGraphView`. Fails with `CRITIC_001`
 * when a unit file cannot be read under `projectRoot` (CTX-02).
 */
export function assembleUnitSourceFromView(
  unit: JudgeUnit,
  projectRoot: string,
  view: JudgeGraphView,
  budget: TokenBudget,
  maxNodes: number = EXCERPT_MAX_NODES,
): DomainResult<UnitSourceContext> {
  const contents = new Map<string, string>();
  for (const filePath of unit.filePaths) {
    const read = readUnderRoot(projectRoot, filePath);
    if (!read.success) return DomainResult.fail(read.errors);
    contents.set(filePath, read.data);
  }
  const excerpt = buildGraphExcerpt(unit, view, maxNodes, budget.apgSubgraph * CHARS_PER_TOKEN);

  if (unit.kind !== 'module') {
    const filePath = unit.filePaths[0] ?? '';
    let body = contents.get(filePath) ?? '';
    if (unit.kind === 'class') {
      const className = unit.id.slice(0, unit.id.indexOf('@'));
      const text = classText(filePath, body, className);
      if (text === null) {
        return DomainResult.fail([{ code: 'CRITIC_001', message: `Class ${className} not found in ${filePath}` }]);
      }
      body = text;
    }
    const cutBody = cut(body, budget.codeSnippet * CHARS_PER_TOKEN);
    return DomainResult.ok({
      unitId: unit.id,
      source: fenceFile(filePath, cutBody.text),
      incoming: [],
      outgoing: [],
      subgraphExcerpt: excerpt.json,
      truncated: cutBody.truncated,
      filesOmitted: [],
      excerptTruncated: excerpt.truncated,
    });
  }

  const { incoming, outgoing } = crossModule(unit, view);
  const signatureBlocks: string[] = [];
  for (const filePath of unit.filePaths) {
    const sig = exportedSignatures(filePath, contents.get(filePath) ?? '');
    if (sig !== null) signatureBlocks.push(`// ${filePath}\n${sig}`);
  }
  const signatures = signatureBlocks.join('\n\n');
  let remaining = budget.moduleSource * CHARS_PER_TOKEN
    - signatures.length - incoming.join('\n').length - outgoing.join('\n').length;
  const blocks: string[] = [];
  const omitted: string[] = [];
  for (const filePath of unit.filePaths) {
    const body = contents.get(filePath) ?? '';
    if (body.length <= remaining) {
      blocks.push(fenceFile(filePath, body));
      remaining -= body.length;
    } else {
      omitted.push(filePath);
    }
  }
  return DomainResult.ok({
    unitId: unit.id,
    source: blocks.join('\n\n'),
    ...(signatures === '' ? {} : { signatures }),
    incoming,
    outgoing,
    subgraphExcerpt: excerpt.json,
    truncated: omitted.length > 0,
    filesOmitted: omitted,
    excerptTruncated: excerpt.truncated,
  });
}

/**
 * DE §3.1 export (U5b BR-U5b-35/55): reads the graph view with `loadJudgeGraphView`, then runs
 * the pure core. A graph read failure is `CRITIC_001`, as is a unit file outside the root.
 */
export async function assembleUnitSource(
  unit: JudgeUnit,
  projectRoot: string,
  graph: GraphRepository,
  budget: TokenBudget,
  maxNodes: number = EXCERPT_MAX_NODES,
): Promise<DomainResult<UnitSourceContext>> {
  const view = await loadJudgeGraphView(graph);
  if (!view.success) return DomainResult.fail(view.errors);
  return assembleUnitSourceFromView(unit, projectRoot, view.data, budget, maxNodes);
}
