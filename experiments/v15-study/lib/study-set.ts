/**
 * The study task set, read from one manifest (zero calls). The first study reads
 * `experiments/trap-families/study-set.json` (every task directory is `experiments/trap-families/<task>/`); the
 * Hexagonal study reads `experiments/hx-study-set/study-set.json`, whose tasks live under several roots
 * (`experiments/hx-study-set/part-a`, `part-b`, and `experiments/trap-families`), named per task in `taskDirs`.
 *
 * A manifest has the trap-families shape (`confirmatory.ddd`, `confirmatory.hexagonal`, optional `exploratory`), plus,
 * optionally, `taskDirs` (task → directory, repository-relative). A task without a `taskDirs` entry lives in the
 * manifest's own directory. `make-input.ts` and `score-study.ts` take the manifest with `--study-set`; without it they
 * read the trap-families manifest, unchanged.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const DEFAULT_STUDY_SET = 'experiments/trap-families/study-set.json';

export interface StudySetManifest {
  readonly confirmatory: { readonly ddd: readonly string[]; readonly hexagonal: readonly string[] };
  readonly exploratory?: { readonly ddd?: readonly string[]; readonly hexagonal?: readonly string[] };
  readonly taskDirs?: Readonly<Record<string, string>>;
}

export interface StudySet {
  /** The manifest, repository-relative. */
  readonly manifest: string;
  readonly confirmatory: { readonly ddd: readonly string[]; readonly hexagonal: readonly string[] };
  readonly exploratory: { readonly ddd: readonly string[]; readonly hexagonal: readonly string[] };
  /** Every task in study-set order: confirmatory DDD, confirmatory Hexagonal, exploratory DDD, exploratory Hexagonal. */
  readonly ids: readonly string[];
  /** The task's directory, repository-relative (no trailing slash). */
  readonly dirOf: (task: string) => string;
  /** The distinct task roots (parents of the task directories), sorted. */
  readonly roots: readonly string[];
}

const rel = (p: string): string => path.posix.normalize(p.split(path.sep).join('/')).replace(/\/+$/, '');

/** Parses a manifest (`manifest` repository-relative, read under `repo`). Throws on a malformed manifest. */
export function loadStudySet(repo: string, manifest: string = DEFAULT_STUDY_SET): StudySet {
  const m = rel(manifest);
  if (path.isAbsolute(m) || m.startsWith('../')) throw new Error(`--study-set must be repository-relative, got ${manifest}`);
  const raw = JSON.parse(fs.readFileSync(path.join(repo, m), 'utf8')) as Partial<StudySetManifest>;
  if (raw.confirmatory === undefined || !Array.isArray(raw.confirmatory.ddd) || !Array.isArray(raw.confirmatory.hexagonal)) throw new Error(`${m}: confirmatory.ddd and confirmatory.hexagonal must be lists`);
  const doc = raw as StudySetManifest;
  const exploratory = { ddd: [...(doc.exploratory?.ddd ?? [])], hexagonal: [...(doc.exploratory?.hexagonal ?? [])] };
  const ids = [...doc.confirmatory.ddd, ...doc.confirmatory.hexagonal, ...exploratory.ddd, ...exploratory.hexagonal];
  if (new Set(ids).size !== ids.length) throw new Error(`a task is listed twice in ${m}`);
  const dirs = doc.taskDirs ?? {};
  for (const k of Object.keys(dirs)) if (!ids.includes(k)) throw new Error(`${m}: taskDirs names ${k}, which is not in the set`);
  const base = path.posix.dirname(m);
  const dirOf = (task: string): string => {
    if (!ids.includes(task)) throw new Error(`${m}: unknown task ${task}`);
    const d = dirs[task];
    if (d === undefined) return `${base}/${task}`;
    const r = rel(d);
    if (path.isAbsolute(r) || r.startsWith('../')) throw new Error(`${m}: taskDirs.${task} must be repository-relative`);
    return r;
  };
  const roots = [...new Set(ids.map((t) => path.posix.dirname(dirOf(t))))].sort();
  return { manifest: m, confirmatory: { ddd: [...doc.confirmatory.ddd], hexagonal: [...doc.confirmatory.hexagonal] }, exploratory, ids, dirOf, roots };
}
