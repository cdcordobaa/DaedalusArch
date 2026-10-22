/**
 * COMPREHEND-01 scorer (design §6). The answer line is parsed by the EFF-01 extractor (`extractAnswer`, imported
 * read-only), so a missing or unparsable `ANSWER:` line scores 0 in both arms. Primary score in {0, 0.5, 1}; a
 * secondary score in [0, 1] (Jaccard for sets, the ordered fraction of required hops for chains).
 */
import picomatch from 'picomatch';
import { extractAnswer, jaccard } from '../../../scripts/v1.3/lib/eff01/score.js';
import type { Item } from './bank.js';

export interface ItemScore { readonly parse: string; readonly primary: number; readonly secondary: number; readonly detail: string }

const norm = (s: unknown): string => String(s ?? '').trim().replace(/^\.\//, '').replace(/\\/g, '/');
const low = (s: unknown): string => norm(s).toLowerCase();
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => low(x)).filter((x) => x !== '') : []);

/** A hop of an answer chain matches a required unit when equal (case-insensitive) or when it ends with `#unit` or `.unit` qualifiers. */
const hopMatches = (given: string, required: string): boolean => {
  const g = low(given); const r = low(required);
  return g === r || g.endsWith(`#${r}`) || g.endsWith(`/${r}`);
};

/** Ordered matches of `required` inside `given` (greedy subsequence). */
function orderedMatches(given: readonly string[], required: readonly string[]): number {
  let i = 0; let n = 0;
  for (const r of required) {
    let j = i;
    while (j < given.length && !hopMatches(given[j]!, r)) j++;
    if (j < given.length) { n++; i = j + 1; }
  }
  return n;
}

function pathMatches(globs: readonly string[] | undefined, p: string): boolean {
  if (!globs || p === '') return false;
  const bare = p.replace(/\/+$/, '');
  return globs.some((g) => { const m = picomatch(g, { dot: true }); return m(bare) || m(`${bare}/__probe__.ts`); });
}

/** Score a parsed answer object against the item's key. */
export function scorePayload(item: Item, payload: unknown): Omit<ItemScore, 'parse'> {
  const a = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
  const k = item.key;
  const field = Object.keys(item.answerFormat)[0]!;
  switch (item.scoring.kind) {
    case 'set': {
      const want = new Set(list(k[field])); const got = new Set(list(a[field]));
      const exact = want.size === got.size && [...want].every((x) => got.has(x));
      return { primary: exact ? 1 : 0, secondary: jaccard(want, got), detail: exact ? 'exact set' : `got [${[...got].join(', ')}]` };
    }
    case 'exact': {
      const ok = low(a[field]) === low(k[field]);
      return { primary: ok ? 1 : 0, secondary: ok ? 1 : 0, detail: ok ? 'exact' : `got ${low(a[field]) || '(empty)'}` };
    }
    case 'chain': {
      const req = item.scoring.required ?? [];
      const given = Array.isArray(a.chain) ? a.chain.map((x) => norm(x)) : [];
      const hits = orderedMatches(given, req);
      const endOk = low(a.endFile) === low(k.endFile);
      const primary = hits === req.length && endOk ? 1 : 0;
      return { primary, secondary: (hits + (endOk ? 1 : 0)) / (req.length + 1), detail: `${hits}/${req.length} required hops in order; endFile ${endOk ? 'ok' : 'wrong'}` };
    }
    case 'path': {
      const p = low(a[field]);
      const full = pathMatches(item.scoring.full?.map((g) => g.toLowerCase()), p);
      const half = !full && pathMatches(item.scoring.half?.map((g) => g.toLowerCase()), p);
      return { primary: full ? 1 : half ? 0.5 : 0, secondary: full ? 1 : half ? 0.5 : 0, detail: full ? 'accepted path' : half ? 'right context, not the folder' : `got ${p || '(empty)'}` };
    }
  }
}

export function scoreText(item: Item, finalText: string | null | undefined): ItemScore {
  const ex = extractAnswer(finalText);
  if (ex.parse === 'missing' || ex.parse === 'unparsable' || ex.payload === undefined) return { parse: ex.parse, primary: 0, secondary: 0, detail: `answer ${ex.parse}` };
  return { parse: ex.parse, ...scorePayload(item, ex.payload) };
}
