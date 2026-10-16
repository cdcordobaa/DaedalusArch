/**
 * Ontology v0 scripted mock answers (tests and the recorded-fixture cassettes). A script is hand-written JSON that
 * names nodes by APG name (`Class` or `Class.method`) and cites code by quote; the responder resolves each short
 * citation to a full one (node id, file, and the given `lines` or else the shortest line span whose text holds the
 * quote; lines 0-0 when the quote is not in the file). A citation written in full
 * (`nodeId`, `file`, `startLine`, `endLine`, `quote`) is passed through unchanged, which is how a script plants a
 * hallucination for the grounding validator to reject.
 *
 * These answers are NOT model output: they exercise the pipeline, the validator, the cache and the scorer.
 */
import type { APGResult } from '../../shared/types/apg.js';
import { collapseWhitespace } from './grounding.js';
import type { FileReader } from './grounding.js';
import type { MockResponder, OntologyModelRequest } from './provider.js';
import type { PassId } from './types.js';

export interface ScriptedEntry {
  readonly pass: PassId;
  /** Item name (class name or group id) for passes a to c; for `adjudicate`, substrings the pair text must all hold. */
  readonly item?: string;
  readonly contains?: readonly string[];
  /** Run indices this answer is for (default: every run). */
  readonly runs?: readonly number[];
  /** Free text, e.g. `planted-hallucination: ...`; ignored by the responder. */
  readonly tag?: string;
  readonly answer: unknown;
}

export interface ScriptedAnswers {
  readonly case: string;
  readonly note?: string;
  readonly responses: readonly ScriptedEntry[];
}

const EMPTY: Readonly<Record<PassId, unknown>> = {
  responsibility: { responsibilities: [], concepts: [] },
  capability: { capabilities: [] },
  rules: { rules: [] },
  adjudicate: { same: false, confidence: 0.5, rationale: 'scripted default: different' },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Line span (1-based) of the shortest, then first, window of up to 12 lines whose collapsed text holds the collapsed quote. */
export function locateQuote(text: string, quote: string): { startLine: number; endLine: number } | null {
  const lines = text.split('\n');
  const q = collapseWhitespace(quote);
  if (q === '') return null;
  for (let len = 1; len <= 12; len++) {
    for (let i = 0; i + len <= lines.length; i++) {
      if (collapseWhitespace(lines.slice(i, i + len).join('\n')).includes(q)) return { startLine: i + 1, endLine: i + len };
    }
  }
  return null;
}

export function createScriptedResponder(script: ScriptedAnswers, apg: APGResult, read: FileReader): MockResponder {
  const byName = new Map<string, { id: string; file: string }>();
  for (const n of apg.nodes) if (n.type === 'Class' || n.type === 'Method' || n.type === 'Interface') byName.set(n.name, { id: n.id, file: n.filePath });
  const idOf = (name: unknown): unknown => (typeof name === 'string' ? byName.get(name)?.id ?? name : name);

  const resolveCitation = (c: unknown): unknown => {
    if (!isRecord(c) || typeof c.node !== 'string') return c;
    const node = byName.get(c.node);
    const quote = typeof c.quote === 'string' ? c.quote : '';
    if (node === undefined) return { nodeId: c.node, file: '', startLine: 0, endLine: 0, quote };
    const lines = Array.isArray(c.lines) && typeof c.lines[0] === 'number' && typeof c.lines[1] === 'number' ? { startLine: c.lines[0], endLine: c.lines[1] } : null;
    const span = lines ?? locateQuote(read(node.file) ?? '', quote);
    return { nodeId: node.id, file: node.file, startLine: span?.startLine ?? 0, endLine: span?.endLine ?? 0, quote };
  };

  const resolve = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) {
      if (key === 'evidence') return v.map(resolveCitation);
      if (key === 'realizedBy') return v.map(idOf);
      return v.map((x) => resolve(x));
    }
    if (isRecord(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = k === 'enforcedBy' ? idOf(x) : resolve(x, k);
      return out;
    }
    return v;
  };

  return (req: OntologyModelRequest) => {
    const entry = script.responses.find((e) => e.pass === req.pass
      && (e.runs === undefined || e.runs.includes(req.runIndex))
      && (e.pass === 'adjudicate' ? (e.contains ?? []).every((s) => req.itemName.includes(s)) : e.item === req.itemName));
    return entry === undefined ? EMPTY[req.pass] : resolve(entry.answer);
  };
}
