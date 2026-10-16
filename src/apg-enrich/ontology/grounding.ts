/**
 * Ontology v0 grounding validator. An assertion is kept only when every citation it makes resolves:
 *
 * - the cited node id is an APG node, of an allowed type, and (when the pass restricts it) inside the item;
 * - the cited file is a project file and is the node's own file;
 * - the line span lies in the file and inside the node's declaration span (when the project shows one);
 * - the quote, with whitespace collapsed, occurs in the cited lines, with whitespace collapsed.
 *
 * Non-citation references (a rule's `enforcedBy` method, a capability's `realizedBy` classes) must be APG nodes of
 * the right type inside the item too. One failing check rejects the whole assertion; each rejection is counted as a
 * hallucination. The validator never repairs a citation.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { APGNode, APGResult } from '../../shared/types/apg.js';
import type { Evidence } from '../cheap/types.js';
import type { Citation, GroundedEvidence, RejectionDetail } from './types.js';

export type FileReader = (projectRelativePath: string) => string | null;

export function diskReader(projectRoot: string): FileReader {
  return (rel) => {
    try {
      return fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    } catch {
      return null;
    }
  };
}

/** Collapses every whitespace run to one space and trims. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export interface ReferenceRule {
  /** APG node types a reference may name. */
  readonly types: readonly string[];
  /** When set, the reference must be one of these ids (the item's own nodes). */
  readonly within?: ReadonlySet<string>;
}

export interface CitationRule {
  /** APG node types a citation may name (default: any). */
  readonly types?: readonly string[];
  /** When set, the cited node must be one of these ids. */
  readonly within?: ReadonlySet<string>;
}

export type GroundingOutcome =
  | { readonly ok: true; readonly evidence: readonly GroundedEvidence[] }
  | { readonly ok: false; readonly reasons: readonly RejectionDetail[] };

export class GroundingIndex {
  private readonly nodes: ReadonlyMap<string, APGNode>;
  private readonly files: ReadonlySet<string>;
  private readonly lines = new Map<string, readonly string[] | null>();

  constructor(apg: APGResult, private readonly spans: ReadonlyMap<string, Evidence>, private readonly read: FileReader) {
    this.nodes = new Map(apg.nodes.map((n) => [n.id, n]));
    this.files = new Set(apg.nodes.filter((n) => n.type === 'File').map((n) => n.filePath));
  }

  node(id: string): APGNode | undefined {
    return this.nodes.get(id);
  }

  private fileLines(file: string): readonly string[] | null {
    if (!this.lines.has(file)) {
      const text = this.files.has(file) ? this.read(file) : null;
      this.lines.set(file, text === null ? null : text.split('\n'));
    }
    return this.lines.get(file) ?? null;
  }

  /** The first failing check of one citation, or null when it is grounded. */
  checkCitation(c: Citation, index: number, rule: CitationRule = {}): RejectionDetail | null {
    const fail = (reason: RejectionDetail['reason'], detail: string): RejectionDetail => ({ reason, citation: index, detail });
    const node = this.nodes.get(c.nodeId);
    if (node === undefined) return fail('unknown-node', `no APG node ${c.nodeId}`);
    if (rule.types !== undefined && !rule.types.includes(node.type)) return fail('wrong-node-type', `${c.nodeId} is a ${node.type}`);
    if (rule.within !== undefined && !rule.within.has(c.nodeId)) return fail('node-outside-item', `${c.nodeId} (${node.name}) is not part of the item`);
    const lines = this.fileLines(c.file);
    if (lines === null) return fail('unknown-file', `no project file ${c.file}`);
    if (node.filePath !== c.file) return fail('node-file-mismatch', `${node.name} is in ${node.filePath}, not ${c.file}`);
    if (!Number.isInteger(c.startLine) || !Number.isInteger(c.endLine) || c.startLine < 1 || c.endLine < c.startLine || c.endLine > lines.length) {
      return fail('span-out-of-range', `${c.file}:${String(c.startLine)}-${String(c.endLine)} (file has ${String(lines.length)} lines)`);
    }
    const span = this.spans.get(c.nodeId);
    if (span !== undefined && (c.startLine < span.startLine || c.endLine > span.endLine)) {
      return fail('span-outside-node', `${String(c.startLine)}-${String(c.endLine)} is outside ${node.name} (${String(span.startLine)}-${String(span.endLine)})`);
    }
    const quote = collapseWhitespace(c.quote);
    if (quote === '') return fail('empty-quote', 'empty quote');
    const text = collapseWhitespace(lines.slice(c.startLine - 1, c.endLine).join('\n'));
    if (!text.includes(quote)) return fail('quote-mismatch', `quote not in ${c.file}:${String(c.startLine)}-${String(c.endLine)}: ${quote.slice(0, 80)}`);
    return null;
  }

  /** Grounds one assertion: its citations (at least one) and its non-citation references. */
  ground(citations: readonly Citation[], rule: CitationRule = {}, references: readonly { readonly id: string; readonly rule: ReferenceRule }[] = []): GroundingOutcome {
    const reasons: RejectionDetail[] = [];
    if (citations.length === 0) reasons.push({ reason: 'no-evidence', citation: -1, detail: 'no citation' });
    citations.forEach((c, i) => {
      const r = this.checkCitation(c, i, rule);
      if (r !== null) reasons.push(r);
    });
    for (const ref of references) {
      const node = this.nodes.get(ref.id);
      if (node === undefined) reasons.push({ reason: 'unknown-node', citation: -1, detail: `no APG node ${ref.id}` });
      else if (!ref.rule.types.includes(node.type)) reasons.push({ reason: 'wrong-node-type', citation: -1, detail: `${ref.id} is a ${node.type}` });
      else if (ref.rule.within !== undefined && !ref.rule.within.has(ref.id)) reasons.push({ reason: 'node-outside-item', citation: -1, detail: `${ref.id} (${node.name}) is not part of the item` });
    }
    if (reasons.length > 0) return { ok: false, reasons };
    return { ok: true, evidence: citations.map((c) => ({ ...c, grounded: true as const })) };
  }
}
