/**
 * v1.3 labeller calibration: labelling the sample (one rater, one arm) through the cassette.
 *
 * - judge arm: `runsFor` runs of the same prompt (distinct run indices, so distinct cassette keys), no re-ask
 *   (the judge has none), the v1 vote.
 * - labeller arm: run 0 canonical options, run 1 the seeded permutation; an unparseable answer is re-asked once with
 *   `REASK_SUFFIX`; the two runs' label when they agree, else `uncertain` (the meaningful labeller's reconcile).
 */
import { reconcile } from '../../lib/labelling/meaningful.js';
import type { MeaningfulRun } from '../../lib/labelling/meaningful.js';
import type { MeaningfulLabel } from '../../lib/labelling/meaningful-prompt.js';
import { REASK_SUFFIX, callsFor, runsFor, judgeMajority, labellerToBinary, parseAnswer, parseJudgeVerdict } from './prompts.js';
import type { CallSpec, JudgeRun } from './prompts.js';
import { cassetteCall } from './raters.js';
import type { CallBudget, Cassette, Rater } from './raters.js';
import type { Arm, RaterId, RaterLabel, ResolvedItem } from './types.js';

export interface RunOptions {
  readonly seed: number;
  readonly cassette: Cassette;
  readonly budget: CallBudget;
  readonly log?: (line: string) => void;
}

async function judgeItem(item: ResolvedItem, rater: Rater, specs: readonly CallSpec[], o: RunOptions): Promise<RaterLabel> {
  const runs: JudgeRun[] = [];
  const meta: RaterLabel['runs'][number][] = [];
  for (const s of specs) {
    const r = await cassetteCall(o.cassette, rater, 'judge', { system: s.system, prompt: s.prompt, schema: s.schema }, s.runIndex, item.id, o.budget);
    if ('failed' in r) {
      runs.push({ valid: false, why: `provider failed: ${r.failed.join(', ')}` });
      meta.push({ runIndex: s.runIndex, raw: 'invalid', cassetteKey: r.key, reasked: false });
      continue;
    }
    const v = parseJudgeVerdict(r.entry.answer.text);
    runs.push(v);
    meta.push({ runIndex: s.runIndex, raw: v.valid ? (v.pass ? 'pass' : 'fail') : 'invalid', cassetteKey: r.entry.key, reasked: false });
  }
  const m = judgeMajority(runs);
  return {
    itemId: item.id, rater: rater.id, model: rater.model, arm: 'judge', binary: m.label, raw: m.raw, procedureFailure: m.raw === 'invalid',
    ...(m.confidence !== undefined && { confidence: m.confidence }), runs: meta,
  };
}

async function labellerRun(item: ResolvedItem, rater: Rater, s: CallSpec, o: RunOptions): Promise<MeaningfulRun> {
  const order = s.order ?? [];
  let key = '';
  let lastInvalid = '';
  for (const [i, text] of [s.prompt, s.prompt + REASK_SUFFIX].entries()) {
    const r = await cassetteCall(o.cassette, rater, 'labeller', { system: s.system, prompt: text, schema: s.schema }, s.runIndex, item.id, o.budget);
    if ('failed' in r) {
      key = r.key;
      lastInvalid = `provider failed: ${r.failed.join(', ')}`;
      continue;
    }
    key = r.entry.key;
    const a = parseAnswer(r.entry.answer.text, order);
    if ('label' in a) return { runIndex: s.runIndex as 0 | 1, order, label: a.label, reason: a.reason, reasked: i > 0, cassetteKey: key };
    lastInvalid = a.invalid;
  }
  return { runIndex: s.runIndex as 0 | 1, order, label: null, reason: '', reasked: true, cassetteKey: key, invalid: lastInvalid };
}

async function labellerItem(item: ResolvedItem, rater: Rater, specs: readonly CallSpec[], o: RunOptions): Promise<RaterLabel> {
  const runs: MeaningfulRun[] = [];
  for (const s of specs) runs.push(await labellerRun(item, rater, s, o));
  const r = reconcile(runs);
  const label: MeaningfulLabel = r.label;
  return {
    itemId: item.id, rater: rater.id, model: rater.model, arm: 'labeller', binary: labellerToBinary(label), raw: label,
    procedureFailure: r.agreement === 'invalid-run',
    runs: runs.map((x) => ({ runIndex: x.runIndex, raw: x.label ?? 'invalid', cassetteKey: x.cassetteKey, reasked: x.reasked })),
  };
}

export async function labelSample(items: readonly ResolvedItem[], rater: Rater, arm: Arm, o: RunOptions): Promise<RaterLabel[]> {
  const out: RaterLabel[] = [];
  for (const item of items) {
    const specs = callsFor(item, arm, rater.id, o.seed);
    const l = arm === 'judge' ? await judgeItem(item, rater, specs, o) : await labellerItem(item, rater, specs, o);
    out.push(l);
    o.log?.(`${rater.id} ${arm} ${item.id}: ${l.raw}`);
  }
  return out;
}

/**
 * Calls one (rater, arm) needs for `items` items: `runsFor` per item; the worst case adds one retry per call and, for
 * the labeller, one re-ask per run.
 */
export function callEstimate(items: number, rater: RaterId, arm: Arm): { calls: number; worstCase: number } {
  const runs = runsFor(arm, rater);
  return { calls: runs * items, worstCase: runs * items * (arm === 'labeller' ? 4 : 2) };
}
