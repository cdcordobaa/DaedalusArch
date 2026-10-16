/**
 * Zero-config onboarding measurement (`firewall init` / `evaluate --from-inferred`): the pure comparisons and the
 * report. Evaluation code: it reads the ground truth, which `src/ise` never sees.
 *
 * Unlike the ISE prototype's (d), which inferred once from the clean variant, here every variant is inferred from
 * itself, as `evaluate --from-inferred` does on a project without a spec.
 */
import YAML from 'yaml';
import { annotate } from '../../../src/ise/layer-mapper.js';
import type { InferredLayer } from '../../../src/ise/layer-mapper.js';
import type { BlockingAgreement, PlantedResult } from './ise-compare.js';

/** The layers of a spec text (directories and file patterns), as the annotator reads them. */
export function specLayers(specText: string): InferredLayer[] {
  const raw = YAML.parse(specText) as { architecture: { layers: { name: string; directories?: string[]; file_patterns?: string[] }[] } };
  return raw.architecture.layers.map((l) => ({ name: l.name, directories: l.directories ?? [], filePatterns: l.file_patterns ?? [] }));
}

export interface FileLayerScore {
  readonly correct: number;
  readonly total: number;
  readonly wrong: readonly { readonly file: string; readonly inferred: string | null; readonly truth: string | null }[];
}

/**
 * Per-file layer accuracy of the inferred spec on one variant. Truth: the reference's `expected-graph.json` layer
 * where it lists the file, else the true spec's layer (files a variant adds).
 */
export function fileLayerScore(
  files: readonly string[],
  inferredSpec: string,
  trueSpec: string,
  expected: readonly { readonly path: string; readonly layer: string | null }[],
): FileLayerScore {
  const exp = new Map(expected.map((e) => [e.path, e.layer]));
  const inf = annotate(files, specLayers(inferredSpec));
  const tru = annotate(files, specLayers(trueSpec));
  const wrong: { file: string; inferred: string | null; truth: string | null }[] = [];
  let correct = 0;
  for (const f of files) {
    const truth = exp.has(f) ? exp.get(f) ?? null : tru.get(f)?.layer ?? null;
    const got = inf.get(f)?.layer ?? null;
    if (got === truth) correct += 1;
    else wrong.push({ file: f, inferred: got, truth });
  }
  return { correct, total: files.length, wrong };
}

export interface VariantRow {
  readonly variant: string;
  readonly kind: string;
  readonly inferredStyle: string;
  readonly styleConfidence: number;
  readonly questions: number;
  /** Wrong files that lie in a folder the proposal asks about. */
  readonly wrongAsked: number;
  /** Questions about folders whose every file is right (the cost of asking). */
  readonly questionsOnCorrect: number;
  readonly layers: FileLayerScore;
  readonly agreement: BlockingAgreement | null;
  readonly trueSpec: PlantedResult | null;
  readonly inferredSpec: PlantedResult | null;
  /** The firewall refused the inferred spec (e.g. the compiler rejects it). */
  readonly inferredError?: string;
}

export interface TargetSummary {
  readonly id: string;
  readonly style: string;
  readonly renamed: boolean;
  readonly variants: number;
  readonly styleCorrect: number;
  readonly filesCorrect: number;
  readonly files: number;
  readonly evaluated: number;
  readonly rejected: number;
  readonly verdictAgrees: number;
  readonly blockingIdentical: number;
  readonly meanJaccard: number;
  readonly violationVariants: number;
  readonly plantedTrue: number;
  readonly plantedInferred: number;
  readonly meanQuestions: number;
  readonly wrongFiles: number;
  readonly wrongAsked: number;
  readonly questionsOnCorrect: number;
}

/** How the proposal's questions cover its wrong files (subjects are folder ids like `src/kernel/` or `style`). */
export function questionCoverage(subjects: readonly string[], layers: FileLayerScore): { wrongAsked: number; questionsOnCorrect: number } {
  const folders = subjects.filter((s) => s !== 'style');
  const covers = (folder: string, file: string): boolean => (folder.endsWith('/') ? file.startsWith(folder) : file === folder);
  return {
    wrongAsked: layers.wrong.filter((w) => folders.some((f) => covers(f, w.file))).length,
    questionsOnCorrect: folders.filter((f) => !layers.wrong.some((w) => covers(f, w.file))).length,
  };
}

export function summariseTarget(id: string, style: string, renamed: boolean, rows: readonly VariantRow[]): TargetSummary {
  const ev = rows.filter((r) => r.agreement !== null);
  // Planted recall only over variants both specs evaluated (a rejected inferred spec has no rows).
  const vio = ev.filter((r) => r.kind === 'violation');
  return {
    id,
    style,
    renamed,
    variants: rows.length,
    styleCorrect: rows.filter((r) => r.inferredStyle === style).length,
    filesCorrect: rows.reduce((s, r) => s + r.layers.correct, 0),
    files: rows.reduce((s, r) => s + r.layers.total, 0),
    evaluated: ev.length,
    rejected: rows.filter((r) => r.inferredError !== undefined).length,
    verdictAgrees: ev.filter((r) => r.agreement?.verdictAgrees === true).length,
    blockingIdentical: ev.filter((r) => r.agreement !== null && r.agreement.onlyInferred.length === 0 && r.agreement.onlyTrue.length === 0).length,
    meanJaccard: ev.length === 0 ? 0 : ev.reduce((s, r) => s + (r.agreement?.jaccard ?? 0), 0) / ev.length,
    violationVariants: vio.length,
    plantedTrue: vio.filter((r) => r.trueSpec?.plantedDetected === true).length,
    plantedInferred: vio.filter((r) => r.inferredSpec?.plantedDetected === true).length,
    meanQuestions: rows.length === 0 ? 0 : rows.reduce((s, r) => s + r.questions, 0) / rows.length,
    wrongFiles: rows.reduce((s, r) => s + r.layers.wrong.length, 0),
    wrongAsked: rows.reduce((s, r) => s + r.wrongAsked, 0),
    questionsOnCorrect: rows.reduce((s, r) => s + r.questionsOnCorrect, 0),
  };
}

const frac = (n: number, d: number): string => (d === 0 ? 'n/a' : `${String(n)}/${String(d)}`);
const pc = (n: number, d: number): string => (d === 0 ? 'n/a' : `${String(n)}/${String(d)} (${((100 * n) / d).toFixed(1)}%)`);

/** Pools target summaries (e.g. all unrenamed targets). */
export function pool(id: string, xs: readonly TargetSummary[]): TargetSummary {
  const sum = (k: keyof TargetSummary): number => xs.reduce((s, x) => s + (x[k] as number), 0);
  const evaluated = sum('evaluated');
  return {
    id,
    style: 'all',
    renamed: xs.every((x) => x.renamed),
    variants: sum('variants'),
    styleCorrect: sum('styleCorrect'),
    filesCorrect: sum('filesCorrect'),
    files: sum('files'),
    evaluated,
    rejected: sum('rejected'),
    verdictAgrees: sum('verdictAgrees'),
    blockingIdentical: sum('blockingIdentical'),
    meanJaccard: evaluated === 0 ? 0 : xs.reduce((s, x) => s + x.meanJaccard * x.evaluated, 0) / evaluated,
    violationVariants: sum('violationVariants'),
    plantedTrue: sum('plantedTrue'),
    plantedInferred: sum('plantedInferred'),
    meanQuestions: sum('variants') === 0 ? 0 : xs.reduce((s, x) => s + x.meanQuestions * x.variants, 0) / sum('variants'),
    wrongFiles: sum('wrongFiles'),
    wrongAsked: sum('wrongAsked'),
    questionsOnCorrect: sum('questionsOnCorrect'),
  };
}

export function renderTable(rows: readonly TargetSummary[]): string {
  const out = [
    '| Target | Style accuracy (variants) | Per-file layer accuracy | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted, true spec | Planted, inferred spec | Inferred spec rejected | Questions per variant | Wrong files under a question | Questions on correct folders |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of rows) {
    out.push(`| ${s.id} | ${frac(s.styleCorrect, s.variants)} | ${pc(s.filesCorrect, s.files)} | ${frac(s.verdictAgrees, s.evaluated)} | ${frac(s.blockingIdentical, s.evaluated)} | ${s.evaluated === 0 ? '-' : s.meanJaccard.toFixed(2)} | ${s.evaluated === 0 ? '-' : frac(s.plantedTrue, s.violationVariants)} | ${s.evaluated === 0 ? '-' : frac(s.plantedInferred, s.violationVariants)} | ${String(s.rejected)} | ${s.meanQuestions.toFixed(1)} | ${frac(s.wrongAsked, s.wrongFiles)} | ${String(s.questionsOnCorrect)} |`);
  }
  return out.join('\n');
}

/** The variants where the two specs disagree (blocking set, planted outcome, layer or style). */
export function renderDisagreements(id: string, style: string, rows: readonly VariantRow[]): string {
  const bad = rows.filter((r) =>
    r.inferredStyle !== style || r.layers.wrong.length > 0 || r.inferredError !== undefined ||
    (r.agreement !== null && r.agreement.onlyInferred.length + r.agreement.onlyTrue.length > 0) ||
    r.trueSpec?.plantedDetected !== r.inferredSpec?.plantedDetected);
  if (bad.length === 0) return `### ${id}\n\nEvery variant: the right style, every file in the right layer, identical blocking findings.\n`;
  const out = [`### ${id}`, '', '| Variant | Kind | Inferred style | Files wrong | Blocking only under inferred | Blocking only under true | Planted (true / inferred) |', '|---|---|---|---|---|---|---|'];
  const list = (xs: readonly string[]): string => (xs.length === 0 ? '' : `${xs.slice(0, 3).join('<br>')}${xs.length > 3 ? `<br>(+${String(xs.length - 3)})` : ''}`);
  const p = (x: boolean | null | undefined): string => (x === null || x === undefined ? '-' : x ? 'yes' : 'no');
  for (const r of bad) {
    const wrong = r.layers.wrong.map((w) => `${w.file}: ${w.inferred ?? '-'} (true ${w.truth ?? '-'})`);
    const only = r.inferredError !== undefined ? [`rejected: ${r.inferredError.slice(0, 80)}`] : r.agreement?.onlyInferred ?? [];
    out.push(`| ${r.variant} | ${r.kind} | ${r.inferredStyle} ${r.styleConfidence.toFixed(2)} | ${list(wrong)} | ${list(only)} | ${list(r.agreement?.onlyTrue ?? [])} | ${p(r.trueSpec?.plantedDetected)} / ${p(r.inferredSpec?.plantedDetected)} |`);
  }
  return out.join('\n') + '\n';
}
