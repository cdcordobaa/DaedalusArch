/**
 * v1.3 labelling: the excerpt scrubber. Removes every comment (line, block and JSDoc) from a source text before it is
 * shown to the labeller or the author, because the reference fixtures carry comments that state the answer
 * (`// VIOLATION (...)`, `// near-miss`, rule ids). Line numbers stay stable: a comment is replaced by nothing but
 * the line breaks inside it, and a line a comment touched loses its trailing whitespace.
 *
 * Comments are found with the TypeScript scanner's comment-range functions on the trivia before every token of the
 * parsed file, so `//` or `/*` inside a string, template or regular expression literal is not mistaken for a comment.
 */
import ts from 'typescript';

interface Range { readonly pos: number; readonly end: number }

function commentRanges(text: string): Range[] {
  const sf = ts.createSourceFile('excerpt.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const seen = new Map<number, Range>();
  const add = (rs: readonly ts.CommentRange[] | undefined): void => {
    for (const r of rs ?? []) seen.set(r.pos, { pos: r.pos, end: r.end });
  };
  const visit = (node: ts.Node): void => {
    const kids = node.getChildren(sf);
    if (kids.length === 0) {
      // A leaf token: its leading trivia holds every comment between the previous token and this one.
      const start = node.getFullStart();
      add(ts.getTrailingCommentRanges(text, start));
      add(ts.getLeadingCommentRanges(text, start));
      return;
    }
    for (const k of kids) visit(k);
  };
  visit(sf);
  return [...seen.values()].sort((a, b) => a.pos - b.pos);
}

/** The source with every comment removed; line breaks inside comments are kept, so line n stays line n. */
export function stripComments(content: string): string {
  const text = content.replace(/\r\n/g, '\n');
  const ranges = commentRanges(text);
  if (ranges.length === 0) return text;
  let out = '';
  let at = 0;
  const touched = new Set<number>();
  let line = 0;
  const lineAt = (from: number, to: number): void => {
    for (let i = from; i < to; i += 1) if (text[i] === '\n') line += 1;
  };
  for (const r of ranges) {
    if (r.pos < at) continue;
    out += text.slice(at, r.pos);
    lineAt(at, r.pos);
    touched.add(line);
    const body = text.slice(r.pos, r.end);
    const breaks = (body.match(/\n/g) ?? []).length;
    out += '\n'.repeat(breaks);
    for (let b = 1; b <= breaks; b += 1) touched.add(line + b);
    line += breaks;
    at = r.end;
  }
  out += text.slice(at);
  return out.split('\n').map((l, i) => (touched.has(i) ? l.trimEnd() : l)).join('\n');
}
