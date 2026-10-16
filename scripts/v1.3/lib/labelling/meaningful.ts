/**
 * v1.3 meaningful labeller: two runs per sampled finding, with permuted option order, through the cassette store.
 *
 * Run 0 shows the options canonically, run 1 in a seeded permutation (`optionOrder`); each answer letter is mapped
 * back. An unparseable answer is re-asked once (a distinct prompt, so a distinct cassette key), then the run is
 * invalid. The item's label is the two runs' label when they agree; otherwise it is `uncertain`, with the reason
 * (`disagree` or `invalid-run`). Per rule, the share of `yes` among labelled items is reported with its Wilson
 * interval (validation-protocol.md §3: "a Wilson lower bound is reported per rule").
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { wilson } from '../../../lib/stats.js';
import type { LabellingJob } from './findings.js';
import type { SampledFinding } from './sampler.js';
import type { MeaningfulLabel } from './meaningful-prompt.js';
import { REASK_SUFFIX, SYSTEM_PROMPT, optionOrder, parseAnswer, renderPrompt, styleDefinition } from './meaningful-prompt.js';
import type { CassetteStore, MeaningfulProvider } from './providers.js';
import { LABEL_TEMPERATURE, cassetteCall } from './providers.js';

export const RUNS = 2;

export interface MeaningfulRun {
  readonly runIndex: 0 | 1;
  readonly order: readonly MeaningfulLabel[];
  readonly label: MeaningfulLabel | null;
  readonly reason: string;
  readonly reasked: boolean;
  readonly cassetteKey: string;
  readonly invalid?: string;
}

export interface MeaningfulItemLabel {
  readonly key: string;
  readonly projectId: string;
  readonly rule: string;
  readonly ruleId: string;
  readonly provider: string;
  readonly model: string;
  readonly label: MeaningfulLabel;
  readonly agreement: 'agree' | 'disagree' | 'invalid-run';
  readonly runs: readonly MeaningfulRun[];
}

export interface RuleMeaningful {
  readonly rule: string;
  readonly n: number;
  readonly yes: number;
  readonly no: number;
  readonly uncertain: number;
  readonly yesShare: number | null;
  readonly wilsonLow: number | null;
  readonly wilsonHigh: number | null;
}

export interface LabelOptions {
  readonly seed: number;
  readonly repoRoot: string;
  readonly styleDoc: string;
  readonly jobs: ReadonlyMap<string, LabellingJob>;
  readonly store: CassetteStore;
  readonly provider: MeaningfulProvider;
  readonly log?: (line: string) => void;
}

function readSource(job: LabellingJob | undefined, file: string): string | null {
  if (job === undefined) return null;
  try {
    const root = fs.realpathSync(job.projectRoot);
    const real = fs.realpathSync(path.join(root, file));
    if (real !== root && !real.startsWith(root + path.sep)) return null;
    return fs.readFileSync(real, 'utf8');
  } catch {
    return null;
  }
}

/** Prompt of one run (before any re-ask). */
export function promptFor(item: SampledFinding, runIndex: 0 | 1, o: Pick<LabelOptions, 'seed' | 'styleDoc' | 'jobs'>): { prompt: string; order: MeaningfulLabel[] } {
  const order = optionOrder(runIndex, o.seed, item.key);
  const prompt = renderPrompt({
    finding: item, source: readSource(o.jobs.get(item.projectId), item.file),
    styleDefinition: styleDefinition(o.styleDoc, item.style), order,
  });
  return { prompt, order };
}

async function oneRun(item: SampledFinding, runIndex: 0 | 1, o: LabelOptions): Promise<MeaningfulRun> {
  const { prompt, order } = promptFor(item, runIndex, o);
  let key = '';
  let lastInvalid = '';
  for (const [i, text] of [prompt, prompt + REASK_SUFFIX].entries()) {
    const r = await cassetteCall(o.store, o.provider, { system: SYSTEM_PROMPT, prompt: text, temperature: LABEL_TEMPERATURE }, runIndex, item.key);
    if ('failed' in r) {
      key = r.key;
      lastInvalid = `provider failed: ${r.failed.join(', ')}`;
      continue;
    }
    key = r.entry.key;
    const a = parseAnswer(r.entry.answer.text, order);
    if ('label' in a) return { runIndex, order, label: a.label, reason: a.reason, reasked: i > 0, cassetteKey: key };
    lastInvalid = a.invalid;
  }
  return { runIndex, order, label: null, reason: '', reasked: true, cassetteKey: key, invalid: lastInvalid };
}

export function reconcile(runs: readonly MeaningfulRun[]): { label: MeaningfulLabel; agreement: MeaningfulItemLabel['agreement'] } {
  const labels = runs.map((r) => r.label);
  if (labels.some((l) => l === null)) return { label: 'uncertain', agreement: 'invalid-run' };
  return labels.every((l) => l === labels[0]) ? { label: labels[0] ?? 'uncertain', agreement: 'agree' } : { label: 'uncertain', agreement: 'disagree' };
}

export async function labelItems(items: readonly SampledFinding[], o: LabelOptions): Promise<MeaningfulItemLabel[]> {
  const out: MeaningfulItemLabel[] = [];
  for (const item of items) {
    const runs: MeaningfulRun[] = [];
    for (const runIndex of [0, 1] as const) runs.push(await oneRun(item, runIndex, o));
    const r = reconcile(runs);
    out.push({
      key: item.key, projectId: item.projectId, rule: item.rule, ruleId: item.ruleId,
      provider: o.provider.id, model: o.provider.model, ...r, runs,
    });
    o.log?.(`${item.rule} ${item.key}: ${r.label} (${r.agreement})`);
  }
  return out;
}

export function perRule(labels: readonly MeaningfulItemLabel[]): RuleMeaningful[] {
  const by = new Map<string, MeaningfulItemLabel[]>();
  for (const l of labels) by.set(l.rule, [...(by.get(l.rule) ?? []), l]);
  return [...by.keys()].sort().map((rule) => {
    const ls = by.get(rule) ?? [];
    const count = (x: MeaningfulLabel): number => ls.filter((l) => l.label === x).length;
    const n = ls.length;
    const yes = count('yes');
    const ci = n > 0 ? wilson(yes, n) : null;
    return { rule, n, yes, no: count('no'), uncertain: count('uncertain'), yesShare: n > 0 ? yes / n : null, wilsonLow: ci?.low ?? null, wilsonHigh: ci?.high ?? null };
  });
}

/** Calls the plan needs: items × 2 runs, and the worst case with one re-ask and one retry each. */
export function estimateCalls(items: number): { calls: number; worstCase: number; line: string } {
  const calls = items * RUNS;
  const worstCase = calls * 4;
  return { calls, worstCase, line: `estimate: ${String(calls)} calls (${String(items)} items x ${String(RUNS)} runs); worst case with re-asks and retries ${String(worstCase)}` };
}
