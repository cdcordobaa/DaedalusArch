/**
 * Byte-stability normaliser (FR-35, NFR-02; U3 BR-U3-61, BR-U3-70 item 7).
 *
 * Two symbolic-only runs of one fixture must give byte-identical report JSON after replacing
 * exactly these five paths and nothing else: the run id and the wall-clock durations, which are
 * treated as timestamps. The list is frozen before the first run; a change needs its own ADR.
 */

/** The five paths replaced before comparing (`[*]` = every element of the array). */
export const BYTE_STABILITY_PATHS = [
  'runId',
  'durationMs',
  'timings.totalMs',
  'timings.stages[*].durationMs',
  'functionResults[*].executionTimeMs',
] as const;

/** Value written in place of every normalised path. */
export const BYTE_STABILITY_PLACEHOLDER = '<normalised>';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function replaceAt(node: Json, segments: readonly string[]): Json {
  if (segments.length === 0) return BYTE_STABILITY_PLACEHOLDER;
  const [head, ...rest] = segments;
  if (head === undefined || node === null || typeof node !== 'object') return node;
  if (head.endsWith('[*]')) {
    const key = head.slice(0, -3);
    if (Array.isArray(node) || !(key in node)) return node;
    const list = node[key];
    if (!Array.isArray(list)) return node;
    return { ...node, [key]: list.map((item) => replaceAt(item, rest)) };
  }
  if (Array.isArray(node) || !(head in node)) return node;
  return { ...node, [head]: replaceAt(node[head] as Json, rest) };
}

/** The report JSON (two-space indent, as `formatJSON`) with the five paths replaced. */
export function normaliseForByteStability(report: unknown): string {
  let json = JSON.parse(JSON.stringify(report)) as Json;
  for (const p of BYTE_STABILITY_PATHS) json = replaceAt(json, p.split('.'));
  return JSON.stringify(json, null, 2);
}
