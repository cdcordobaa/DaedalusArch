/**
 * C4 interpretation through facts (v1.4 U3 amendment A1; decision M4). Given one Sem verdict, the model is asked
 * whether it is a declared exception or a problem, and how severe. It must receive the project's docs, ADRs and the
 * comments near the finding, not only the subgraph, because intent and declared exceptions are written in prose.
 *
 * This module assembles that context and renders the prompt. It makes no model call; U3 wires no C4 run (the frozen
 * v2.2 judge in `src/llm-critic/` is untouched). Deterministic: the same A2, units and files give the same prompt.
 */
import type { FileReader } from './grounding.js';
import type { Fact, FactsFile } from './facts.js';
import { commentsSection, docExcerpts, docsSection } from './reading.js';
import type { DocExcerpt } from './reading.js';
import type { SemVerdict } from './sem-rules.js';
import type { ClassUnit, OntologyUnits } from './units.js';
import { graphSlice } from './prompts.js';
import type { Evidence } from '../cheap/types.js';

export const INTERPRETATION_PROMPT_VERSION = 'c4-facts-v0.1';

/** Lines above and below a site searched for comments. */
export const COMMENT_WINDOW = 10;

export const INTERPRETATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assessment', 'severity', 'rationale', 'cites'],
  properties: {
    assessment: { type: 'string', enum: ['declared-exception', 'problem', 'unclear'] },
    severity: { type: 'string', enum: ['blocking', 'advisory', 'none'] },
    rationale: { type: 'string' },
    /** `path:line` of the code, doc or ADR lines the answer rests on. */
    cites: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface SiteCode {
  readonly nodeId: string;
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly numbered: string;
}

export interface NearbyComment {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

export interface InterpretationContext {
  readonly verdict: SemVerdict;
  /** The A2 facts the verdict cites, in the verdict's order. */
  readonly facts: readonly Fact[];
  readonly code: readonly SiteCode[];
  /** The graph slice of each site's class. */
  readonly graph: readonly string[];
  /** Doc excerpts that mention the sites (ADRs first), plus the head of each ADR when none mentions them. */
  readonly docs: readonly DocExcerpt[];
  /** JSDoc of the site classes and the comment lines within `COMMENT_WINDOW` lines of each site. */
  readonly comments: readonly NearbyComment[];
  readonly classComments: readonly string[];
}

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

function numberSpan(text: string, span: Evidence): string {
  const lines = text.split('\n');
  const width = String(span.endLine).length;
  const out: string[] = [];
  for (let i = span.startLine; i <= span.endLine; i++) out.push(`${String(i).padStart(width, ' ')}| ${lines[i - 1] ?? ''}`);
  return out.join('\n');
}

/** The ADRs' first lines (title, status), for a finding no ADR mentions by name: declared decisions still apply. */
function adrHeads(units: OntologyUnits, max: number): DocExcerpt[] {
  return units.docs.filter((d) => d.adr).slice(0, max).map((d) => {
    const lines = d.text.split('\n').slice(0, 8);
    return { path: d.path, startLine: 1, endLine: lines.length, adr: true, numbered: lines.map((l, k) => `${String(k + 1)}| ${l}`).join('\n') };
  });
}

export function buildInterpretationContext(verdict: SemVerdict, a2: FactsFile, units: OntologyUnits, read: FileReader): InterpretationContext {
  const byId = new Map(a2.facts.map((f) => [f.id, f]));
  const facts = verdict.facts.flatMap((id) => { const f = byId.get(id); return f === undefined ? [] : [f]; });
  const classOf = new Map<string, ClassUnit>(units.classes.flatMap((c) => [[c.nodeId, c] as const, ...c.methods.map((m) => [m.nodeId, c] as const)]));
  const classes = [...new Map(verdict.sites.flatMap((s) => { const c = classOf.get(s); return c === undefined ? [] : [[c.nodeId, c] as const]; })).values()];

  const code: SiteCode[] = [];
  const comments: NearbyComment[] = [];
  for (const s of verdict.sites) {
    const span = units.nodeSpans.get(s);
    if (span === undefined) continue;
    const text = read(span.file) ?? '';
    code.push({ nodeId: s, file: span.file, startLine: span.startLine, endLine: span.endLine, numbered: numberSpan(text, span) });
    const lines = text.split('\n');
    const lo = Math.max(1, span.startLine - COMMENT_WINDOW);
    const hi = Math.min(lines.length, span.endLine + COMMENT_WINDOW);
    for (let i = lo; i <= hi; i++) {
      const l = lines[i - 1] ?? '';
      if (COMMENT_LINE.test(l) && !comments.some((c) => c.file === span.file && c.line === i)) comments.push({ file: span.file, line: i, text: l.trim() });
    }
  }

  const terms = [...classes.map((c) => c.name), ...classes.map((c) => c.component), ...(verdict.context !== null ? [verdict.context] : [])];
  const mentioned = docExcerpts(units.docs, terms);
  const docs = mentioned.some((d) => d.adr) ? mentioned : [...mentioned, ...adrHeads(units, 3)];
  return {
    verdict, facts, code, graph: classes.flatMap((c) => graphSlice(c).slice(1).map((l) => `${c.name}: ${l.replace(/^- /, '')}`)), docs, comments,
    classComments: classes.flatMap((c) => c.comments),
  };
}

const RULE_TEXT: Readonly<Record<SemVerdict['rule'], string>> = {
  'SEM-MISPLACED': 'a responsibility sits in a layer other than the one it naturally belongs to',
  'SEM-DUP': 'one business rule is enforced in more than one bounded context',
  'SEM-FRAG': 'one business concept is defined by differently-named classes inside one declared bounded context',
};

/** The C4 prompt: the finding, its facts, the code, the graph slice, the comments near the code, and the docs and ADRs. */
export function interpretationPrompt(ctx: InterpretationContext): string {
  const fact = (f: Fact): string => {
    const locs = f.citations.locations.map((l) => `${l.file}:${String(l.startLine)}-${String(l.endLine)}${l.kind === 'doc' ? ' (doc)' : ''}`).join(', ');
    const graph = f.citations.graph.map((g) => `${g.statistic}=${String(g.value)}`).join(', ');
    return `- ${f.id} ${f.predicate} ${JSON.stringify(f.value)} [${f.source}${f.agreement !== null ? `, ${f.agreement}` : ''}] cites ${locs}${graph === '' ? '' : `; graph ${graph}`}`;
  };
  return [
    '## Task',
    `A deterministic rule found that ${RULE_TEXT[ctx.verdict.rule]} (${ctx.verdict.rule}). Decide whether this is an exception the project declares on purpose (in its documentation, an ADR or a comment) or a problem, and how severe it is. Read the code, the graph and the prose together; the graph alone does not show intent. Cite the lines your answer rests on as path:line.`,
    '',
    '## Finding',
    `rule ${ctx.verdict.rule}; sites ${ctx.verdict.sites.join(', ')}${ctx.verdict.context !== null ? `; context ${ctx.verdict.context}` : ''}${ctx.verdict.verified !== undefined ? `; verified ${String(ctx.verdict.verified)}` : ''}; fact policy ${ctx.verdict.policy}`,
    '',
    '## Facts (A2)',
    ...(ctx.facts.length > 0 ? ctx.facts.map(fact) : ['- (none)']),
    '',
    '## Graph slice',
    ...(ctx.graph.length > 0 ? ctx.graph.map((g) => `- ${g}`) : ['- (none)']),
    ...commentsSection(ctx.classComments),
    ...(ctx.comments.length > 0 ? ['', '## Comment lines near the finding', ...ctx.comments.map((c) => `- ${c.file}:${String(c.line)} ${c.text}`)] : []),
    ...docsSection(ctx.docs),
    '',
    '## Code',
    ...ctx.code.flatMap((c) => [`=====SOURCE-BEGIN ${c.file} (node ${c.nodeId})`, c.numbered.replace(/=====(SOURCE|DOC)-/g, '=====$1\\-'), '=====SOURCE-END=====']),
  ].join('\n');
}
