/**
 * Proxy 10, DOC TEXT: the JSDoc and leading comments of every class, method and top-level function, stored as the
 * `docText` property of its APG node. It raises no flag; it is the natural-language input of the later LLM pass.
 */
import { Node } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { topLevelFunctions } from './behaviour.js';
import type { CheapNodeFact, CheapProxyOutput } from './types.js';

/** JSDoc text plus `//` and `/* *\/` leading comments of a node, comment markers stripped, '' when none. */
export function docTextOf(node: Node): string {
  const parts: string[] = [];
  const target = Node.isVariableDeclaration(node) ? node.getVariableStatement() ?? node : node;
  for (const r of target.getLeadingCommentRanges()) {
    const text = r.getText()
      .replace(/^\/\*\*?/, '')
      .replace(/\*\/$/, '')
      .replace(/^\/\/+/, '')
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l.length > 0)
      .join(' ');
    if (text.length > 0) parts.push(text);
  }
  return parts.join('\n');
}

export function runDocText(ctx: CheapContext): CheapProxyOutput {
  const nodeFacts: CheapNodeFact[] = [];
  let units = 0;
  const add = (id: string | undefined, node: Node): void => {
    units++;
    const text = docTextOf(node);
    if (id !== undefined && text.length > 0) nodeFacts.push({ proxy: 'doc-text', nodeId: id, key: 'docText', value: text, evidence: ctx.evidence(node) });
  };
  for (const { file, sf } of ctx.sources) {
    for (const cls of classesOf(sf)) {
      const cn = cls.getName() ?? '';
      add(ctx.nodeId('Class', file, cn), cls);
      for (const m of cls.getMethods()) add(ctx.nodeId('Method', file, `${cn}.${m.getName()}`), m);
    }
    for (const f of topLevelFunctions(sf)) add(ctx.nodeId('Function', file, f.name), f.node);
  }
  return { edges: [], nodeFacts, flags: [], summary: { units, withText: nodeFacts.length } };
}
