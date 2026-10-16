/**
 * v1.3 labeller calibration: dataset parsers and label mappings (Docs/v1.3/labeller-calibration-plan.md §3).
 * Every parser is pure: text in, `CalibrationItem[]` out. The pinned sources are in `../sources.json`.
 *
 * MLCQ (Madeyski and Lewowski, EASE 2020; Zenodo 10.5281/zenodo.3666840 v1.1, CC-BY-4.0): one row per review,
 * `;`-separated: `id;reviewer_id;sample_id;smell;severity;review_timestamp;type;code_name;repository;commit_hash;
 * path;start_line;end_line;link;is_from_industry_relevant_project`. One item = one (sample_id, smell). Severity
 * `none < minor < major < critical`. Primary mapping: `none` → pass, anything else → fail. Sensitivity mapping:
 * `none`, `minor` → pass, `major`, `critical` → fail. A reviewer who reviewed the same (sample, smell) twice counts
 * once (the latest review).
 */
import type { Binary, CalibrationItem, HumanRating } from './types.js';
import { parseRecords } from './csv.js';

export const MLCQ_SEVERITIES = ['none', 'minor', 'major', 'critical'] as const;
export type MlcqMapping = 'primary' | 'major-or-worse';

export const MLCQ_SMELL_TASK: Readonly<Record<string, string>> = Object.freeze({
  blob: 'blob', 'data class': 'data-class', 'long method': 'long-method', 'feature envy': 'feature-envy',
});

export function mapMlcq(severity: string, mapping: MlcqMapping): Binary | null {
  const i = (MLCQ_SEVERITIES as readonly string[]).indexOf(severity.trim());
  if (i < 0) return null;
  return i >= (mapping === 'primary' ? 1 : 2) ? 'fail' : 'pass';
}

/** `git@github.com:owner/repo.git` or `https://github.com/owner/repo(.git)` → `https://github.com/owner/repo`. */
export function normaliseRepository(repo: string): string | null {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(repo.trim());
  return m === null ? null : `https://github.com/${m[1] ?? ''}/${m[2] ?? ''}`;
}

/** `org.pkg.Outer.Inner#method(args)` → `Inner#method`; `org.pkg.Clazz` → `Clazz`. */
export function shortUnitName(codeName: string): string {
  const [cls = '', member] = codeName.split('#', 2);
  const simple = cls.split('.').pop() ?? cls;
  return member === undefined ? simple : `${simple}#${member.replace(/\(.*$/, '')}`;
}

export function parseMlcq(text: string, mapping: MlcqMapping = 'primary'): CalibrationItem[] {
  const rows = parseRecords(text, ';');
  const groups = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const task = MLCQ_SMELL_TASK[r.smell ?? ''];
    if (task === undefined || (r.sample_id ?? '') === '') continue;
    const k = `${r.sample_id ?? ''}|${task}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const items: CalibrationItem[] = [];
  for (const [k, rs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [sampleId = '', task = ''] = k.split('|');
    const first = rs[0] as Record<string, string>;
    const repository = normaliseRepository(first.repository ?? '');
    const start = Number(first.start_line);
    const end = Number(first.end_line);
    if (repository === null || !Number.isInteger(start) || !Number.isInteger(end) || end < start) continue;
    // Latest review per reviewer.
    const byReviewer = new Map<string, Record<string, string>>();
    for (const r of [...rs].sort((a, b) => (a.review_timestamp ?? '').localeCompare(b.review_timestamp ?? ''))) byReviewer.set(r.reviewer_id ?? '', r);
    const ratings: HumanRating[] = [...byReviewer.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([rater, r]) => {
      const original = (r.severity ?? '').trim();
      const ordinal = (MLCQ_SEVERITIES as readonly string[]).indexOf(original);
      return { rater, original, binary: mapMlcq(original, mapping), ...(ordinal >= 0 && { ordinal }) };
    });
    items.push({
      id: `mlcq:${sampleId}:${task}`, dataset: 'mlcq', task,
      unitKind: first.type === 'class' ? 'class' : 'method',
      unitName: shortUnitName(first.code_name ?? ''), language: 'java',
      location: { repository, commit: (first.commit_hash ?? '').trim(), path: (first.path ?? '').replace(/^\/+/, ''), startLine: start, endLine: end },
      ratings,
    });
  }
  return items;
}
