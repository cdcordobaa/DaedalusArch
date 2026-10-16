/**
 * v1.3 model panel: every rater labels every item, two runs each with permuted options, through one cassette store
 * per rater (Docs/v1.3/model-panel.md §4).
 *
 * Per rater and item, the meaningful labeller's procedure: run 0 shows the options canonically, run 1 in a seeded
 * permutation; an unparsable answer is re-asked once (a distinct prompt, so a distinct cassette key); the item label
 * is the two runs' label when they agree, else `uncertain` (`reconcile`). The blinding check runs on every prompt
 * before the first call: an item that fails it is withheld from every rater and listed.
 *
 * A `stop` error (usage limit, auth, isolation) ends the run; everything answered so far is in the cassettes, so the
 * same command resumes. Replay mode never calls a provider and fails on a cassette miss.
 */
import * as path from 'node:path';
import type { MeaningfulLabel } from '../labelling/meaningful-prompt.js';
import { REASK_SUFFIX, optionOrder, parseAnswer } from '../labelling/meaningful-prompt.js';
import { reconcile } from '../labelling/meaningful.js';
import type { MeaningfulRun } from '../labelling/meaningful.js';
import { CassetteStore, LABEL_TEMPERATURE, cassetteCall } from '../labelling/providers.js';
import type { CassetteMode } from '../labelling/providers.js';
import type { PanelRater } from './adapters.js';
import type { PanelSet } from './items.js';
import { PANEL_SYSTEM_PROMPT, blindingProblems, renderPanelPrompt } from './prompt.js';

export interface RaterItemLabel {
  readonly label: MeaningfulLabel;
  readonly agreement: 'agree' | 'disagree' | 'invalid-run';
  readonly runs: readonly MeaningfulRun[];
}

export interface RaterUsage { calls: number; fromCassette: number; inputTokens: number; outputTokens: number }

export interface PanelLabels {
  readonly schemaVersion: 1;
  readonly seed: number;
  readonly raters: readonly { readonly name: string; readonly vendor: string; readonly provider: string; readonly model: string; readonly usage: RaterUsage }[];
  /** rater name -> item id -> label. */
  readonly labels: Readonly<Record<string, Readonly<Record<string, RaterItemLabel>>>>;
  readonly withheld: readonly { readonly id: string; readonly problems: readonly string[] }[];
}

export interface PanelRunOptions {
  readonly seed: number;
  readonly cassetteRoot: string;
  readonly mode: CassetteMode;
  /** Secrets to scrub from every cassette (keys from the environment). */
  readonly secrets?: readonly string[];
  readonly log?: (line: string) => void;
}

export const raterDir = (r: Pick<PanelRater, 'vendor' | 'provider'>): string => `${r.vendor}-${r.provider.id}-${r.provider.model}`.replace(/[^A-Za-z0-9._-]/g, '_');

export async function runPanel(set: PanelSet, raters: readonly PanelRater[], o: PanelRunOptions): Promise<PanelLabels> {
  const withheld: { id: string; problems: string[] }[] = [];
  const sendable = set.items.filter((it) => {
    const problems = [...new Set([0, 1].flatMap((ri) => blindingProblems(renderPanelPrompt(it, optionOrder(ri as 0 | 1, o.seed, it.key)))))];
    if (problems.length > 0) withheld.push({ id: it.id, problems });
    return problems.length === 0;
  });
  const labels: Record<string, Record<string, RaterItemLabel>> = {};
  const meta: PanelLabels['raters'][number][] = [];
  for (const r of raters) {
    const store = new CassetteStore(path.join(o.cassetteRoot, raterDir(r)), o.mode, o.secrets ?? []);
    const usage: RaterUsage = { calls: 0, fromCassette: 0, inputTokens: 0, outputTokens: 0 };
    const mine: Record<string, RaterItemLabel> = {};
    for (const it of sendable) {
      const runs: MeaningfulRun[] = [];
      for (const runIndex of [0, 1] as const) {
        const order = optionOrder(runIndex, o.seed, it.key);
        const prompt = renderPanelPrompt(it, order);
        let key = '';
        let lastInvalid = '';
        let done: MeaningfulRun | null = null;
        for (const [i, text] of [prompt, prompt + REASK_SUFFIX].entries()) {
          const res = await cassetteCall(store, r.provider, { system: PANEL_SYSTEM_PROMPT, prompt: text, temperature: LABEL_TEMPERATURE }, runIndex, it.key);
          if ('failed' in res) { key = res.key; lastInvalid = `provider failed: ${res.failed.join(', ')}`; continue; }
          key = res.entry.key;
          usage.calls += 1;
          if (res.fromCassette) usage.fromCassette += 1;
          usage.inputTokens += res.entry.answer.inputTokens ?? 0;
          usage.outputTokens += res.entry.answer.outputTokens ?? 0;
          const a = parseAnswer(res.entry.answer.text, order);
          if ('label' in a) { done = { runIndex, order, label: a.label, reason: a.reason, reasked: i > 0, cassetteKey: key }; break; }
          lastInvalid = a.invalid;
        }
        runs.push(done ?? { runIndex, order, label: null, reason: '', reasked: true, cassetteKey: key, invalid: lastInvalid });
      }
      const rec = reconcile(runs);
      mine[it.id] = { ...rec, runs };
      o.log?.(`${r.name} ${it.id}: ${rec.label} (${rec.agreement})`);
    }
    labels[r.name] = mine;
    meta.push({ name: r.name, vendor: r.vendor, provider: r.provider.id, model: r.provider.model, usage });
  }
  return { schemaVersion: 1, seed: o.seed, raters: meta, labels, withheld };
}

/** Calls a run needs: items × raters × 2 runs; worst case with one re-ask and one retry per run. */
export function estimatePanel(items: number, raters: number): { calls: number; worstCase: number } {
  const calls = items * raters * 2;
  return { calls, worstCase: calls * 4 };
}
