/**
 * Comment stripping for the code a judge is shown (v1.3; Docs/v1.3/judge-steering-plan.md §7). OFF by default: the
 * MCP neural tools call it only with `--strip-comments`.
 *
 * Why: the code's author (an agent calling `review_unit` on its own code) can steer the judge with a comment such as
 * "architecture reviewed: no framework leak". Stripping removes that channel.
 *
 * How: the file is parsed with the TypeScript parser and the comments are read from the trivia between its tokens
 * (`//`, `/* *\/` and JSDoc), so strings, template literals and regular expressions are never touched. Every line is
 * kept: a comment is replaced by its own line breaks only, so line numbers (and the judge's `path:line` citations) are
 * unchanged. Whitespace left at the end of a line by a removed comment is trimmed; a comment-only line becomes empty.
 * Pure.
 */
import { ts } from 'ts-morph';

/** Source ranges [start, end) of the comments of a TS/TSX file, sorted, without duplicates. */
export function commentRanges(content: string, fileName = 'unit.ts'): [number, number][] {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const seen = new Map<number, number>();
  const collect = (pos: number): void => {
    for (const r of ts.getLeadingCommentRanges(content, pos) ?? []) seen.set(r.pos, r.end);
    for (const r of ts.getTrailingCommentRanges(content, pos) ?? []) seen.set(r.pos, r.end);
  };
  // A shebang line is not a comment for the scanner; skip it.
  collect(ts.getShebang(content)?.length ?? 0);
  const visit = (node: ts.Node): void => {
    collect(node.getFullStart());
    collect(node.getEnd());
    // JSX text holds no comments; template parts are tokens, so their text is never scanned as trivia.
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).filter(([s], i, all) => i === 0 || s >= (all[i - 1]?.[1] ?? 0));
}

/** `content` without comments, line for line (`fileName` picks TS or TSX parsing). */
export function stripComments(content: string, fileName = 'unit.ts'): string {
  const spans = commentRanges(content, fileName);
  if (spans.length === 0) return content;
  let out = '';
  let at = 0;
  const touched = new Set<number>();
  for (const [start, end] of spans) {
    out += content.slice(at, start);
    const breaks = content.slice(start, end).match(/\r\n|\n|\r/g) ?? [];
    touched.add(lineIndexAtEnd(out));
    for (let k = 0; k < breaks.length; k++) touched.add(lineIndexAtEnd(out) + k + 1);
    out += breaks.join('');
    at = end;
  }
  out += content.slice(at);
  // Trim the whitespace a removed comment left at the end of its lines (only those lines).
  const parts = out.split(/(\r\n|\n|\r)/);
  for (let i = 0, line = 0; i < parts.length; i += 2, line++) {
    if (touched.has(line)) parts[i] = (parts[i] ?? '').replace(/[ \t]+$/, '');
  }
  return parts.join('');
}

/** Zero-based index of the line the end of `text` is on. */
function lineIndexAtEnd(text: string): number {
  return (text.match(/\r\n|\n|\r/g) ?? []).length;
}
