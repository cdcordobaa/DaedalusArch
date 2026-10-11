/**
 * ADR-034: agy 1.3.2 cannot deny `search_web`, so a labeller call that completes any tool step is invalid. The attempt
 * is discarded (no answer stored, its invocation still counts), the call is retried once, and a retry that also
 * completes a tool step makes the item `uncertain` with reason `tool-use`. A pre-registered stop rule ends the run
 * when 20 % or more of the P4 items done (at least 10) end as tool-use.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LABEL_TOOL_USE_STOP, TOOL_USE_REASON, finalToolUse, labelItems, loadLabellerPrompts, reconcile, toolUseDiscardsOf,
} from '../../../../scripts/llm-label.js';
import type { LabelRun, LabellerConfig, LabellerPrompt } from '../../../../scripts/llm-label.js';
import type { LabelItem } from '../../../../scripts/lib/label-context.js';
import { listCassetteKeys, readCassetteEntry } from '../../../../src/llm-critic/cassette-manager.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../../src/shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../../../../src/shared/types/evaluation.js';
import { FIXTURE_MODEL, ScriptedLabeller, fixturePlan } from './label-fixture.js';
import { ROOT } from './score-fixture.js';

const FIXED_NOW = (): string => '2026-10-11T00:00:00.000Z';
const TOOL_USE = 'LLM_CLI_TOOL_USE';

function prompts(): ReadonlyMap<LabelItem['kind'], LabellerPrompt> {
  const p = loadLabellerPrompts(ROOT);
  if (!p.ok) throw new Error(p.detail);
  return p.prompts;
}
const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'u5b-tool-use-'));
  dirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
function config(over: Partial<LabellerConfig>): LabellerConfig {
  return {
    provider: new ScriptedLabeller(), model: FIXTURE_MODEL, runs: 2, mode: 'record', cassetteDir: tmp(),
    permutationSeed: fixturePlan().permutationSeed, budgetCalls: 1000, knownSecrets: [], now: FIXED_NOW, ...over,
  };
}

/**
 * The scripted labeller, except that a judge-unit prompt whose item matches `toolUse` completes a tool step on its
 * first `times` invocations (per prompt text).
 */
class ToolUsingLabeller implements LLMProvider {
  readonly name = 'tool-using-mock';
  readonly inner = new ScriptedLabeller();
  readonly seen = new Map<string, number>();
  calls = 0;
  constructor(private readonly toolUse: (prompt: string) => boolean, private readonly times: number) {}
  describe(): ProviderDescription {
    return this.inner.describe();
  }
  evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.calls += 1;
    const n = this.seen.get(prompt) ?? 0;
    this.seen.set(prompt, n + 1);
    if (this.toolUse(prompt) && n < this.times) {
      return Promise.resolve(DomainResult.fail([{ code: TOOL_USE, message: 'agy executed tool(s): search_web' }]));
    }
    return this.inner.evaluate(prompt, options, call);
  }
}

function judgeUnits(): LabelItem[] {
  return fixturePlan().items.filter((i) => i.kind === 'judge-unit');
}
/** `n` distinct P4 items: the fixture's judge units with a unique marker in their context. */
function p4Items(n: number): LabelItem[] {
  const base = judgeUnits()[0];
  if (base === undefined) throw new Error('no judge unit in the fixture');
  return Array.from({ length: n }, (_, k) => ({ ...base, itemId: `${base.itemId}-c${String(k)}`, context: `${base.context}\n// copy ${String(k)}` }));
}

describe('ADR-034 tool-use discard and retry', () => {
  it('a tool step on the first attempt is discarded; the retry answer is the label and the discard is counted', async () => {
    const provider = new ToolUsingLabeller(() => true, 1);
    const cfg = config({ provider });
    const items = judgeUnits();
    const r = await labelItems(items, cfg, prompts());
    if (!r.ok) throw new Error(r.detail);
    expect(r.labels.every((l) => l.label !== 'uncertain')).toBe(true);
    expect(r.toolUseDiscards).toBe(items.length * 2);
    expect(r.calls).toBe(items.length * 2 * 2);
    for (const l of r.labels) for (const run of l.runs) expect(run).toMatchObject({ toolUseDiscards: 1, invocations: 2, attempts: 1 });
    for (const key of listCassetteKeys(cfg.cassetteDir)) {
      const e = readCassetteEntry(cfg.cassetteDir, key);
      expect(e?.discardedAttempts).toEqual([TOOL_USE]);
      expect(e?.attempts).toBe(2);
      expect(e?.response.startsWith(TOOL_USE)).toBe(false);
      if (e !== null) expect(toolUseDiscardsOf(e)).toBe(1);
    }
  });

  it('a retry that also completes a tool step makes the item uncertain/tool-use, with no re-ask; replay agrees', async () => {
    const provider = new ToolUsingLabeller(() => true, 99);
    const cfg = config({ provider });
    const items = judgeUnits();
    const r = await labelItems(items, cfg, prompts());
    if (!r.ok) throw new Error(r.detail);
    expect(r.labels.map((l) => [l.label, l.uncertainReason])).toEqual(items.map(() => ['uncertain', 'tool-use']));
    expect(provider.calls).toBe(items.length * 2 * 2);
    expect([...provider.seen.keys()].some((p) => p.includes('## Your previous answer was invalid'))).toBe(false);
    expect(r.toolUseDiscards).toBe(items.length * 2 * 2);
    for (const key of listCassetteKeys(cfg.cassetteDir)) {
      const e = readCassetteEntry(cfg.cassetteDir, key);
      expect(e === null ? false : finalToolUse(e)).toBe(true);
      expect(e?.discardedAttempts).toEqual([TOOL_USE]);
    }
    const replay = await labelItems(items, { ...cfg, mode: 'replay' }, prompts());
    if (!replay.ok) throw new Error(replay.detail);
    expect(replay.labels).toEqual(r.labels);
    expect(replay.toolUseDiscards).toBe(r.toolUseDiscards);
  });

  it('a timeout retry writes no discardedAttempts field (cassettes of other causes are unchanged)', async () => {
    let n = 0;
    const inner = new ScriptedLabeller();
    const flaky: LLMProvider = {
      name: 'flaky', describe: () => inner.describe(),
      evaluate: (p, o, c) => (n++ === 0 ? Promise.resolve(DomainResult.fail([{ code: 'LLM_CLI_TIMEOUT', message: 't' }])) : inner.evaluate(p, o, c)),
    };
    const cfg = config({ provider: flaky });
    const r = await labelItems(judgeUnits().slice(0, 1), cfg, prompts());
    if (!r.ok) throw new Error(r.detail);
    expect(r.toolUseDiscards).toBe(0);
    for (const key of listCassetteKeys(cfg.cassetteDir)) expect(readCassetteEntry(cfg.cassetteDir, key)?.discardedAttempts).toBeUndefined();
  });

  it('reconciliation: a tool-use run wins over invalid-run and disagreement', () => {
    const item = judgeUnits()[0];
    const judge = prompts().get('judge-unit');
    if (item === undefined || judge === undefined) throw new Error('fixture');
    const run = (runIndex: 0 | 1, label: LabelRun['label'], invalidReason?: string): LabelRun => ({
      runIndex, label, rationale: '', cassetteKey: 'k', attempts: 1, ...(invalidReason !== undefined && { invalidReason }),
    });
    expect(reconcile(item, judge, [run(0, null, TOOL_USE_REASON), run(1, 'pass')])).toMatchObject({ label: 'uncertain', uncertainReason: 'tool-use' });
    expect(reconcile(item, judge, [run(0, null, 'bad'), run(1, null, TOOL_USE_REASON)])).toMatchObject({ uncertainReason: 'tool-use' });
    expect(reconcile(item, judge, [run(0, null, 'bad'), run(1, 'pass')])).toMatchObject({ uncertainReason: 'invalid-run' });
  });
});

describe('ADR-034 stop rule (20 % of at least 10 P4 items)', () => {
  it('stops at the 10th P4 item when every one ends as tool-use; cassettes recorded so far are kept', async () => {
    const provider = new ToolUsingLabeller(() => true, 99);
    const cfg = config({ provider });
    const r = await labelItems(p4Items(12), cfg, prompts());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe(LABEL_TOOL_USE_STOP);
    expect(r.detail).toMatch(/10 of 10 P4 items/);
    expect(listCassetteKeys(cfg.cassetteDir)).toHaveLength(10);
  });

  it('does not stop below 20 % (1 of 10) and stops at exactly 20 % (2 of 10)', async () => {
    const below = await labelItems(p4Items(10), config({ provider: new ToolUsingLabeller((p) => p.includes('// copy 3'), 99) }), prompts());
    expect(below.ok).toBe(true);
    if (below.ok) expect(below.labels.filter((l) => l.uncertainReason === 'tool-use')).toHaveLength(1);
    const at = await labelItems(p4Items(10), config({ provider: new ToolUsingLabeller((p) => p.includes('// copy 3') || p.includes('// copy 7'), 99) }), prompts());
    expect(at.ok).toBe(false);
    if (!at.ok) expect(at.code).toBe(LABEL_TOOL_USE_STOP);
  });

  it('only P4 items count toward the rule', async () => {
    const nonP4: LabelItem[] = p4Items(12).map((i) => ({ ...i, population: 'P2' }));
    const r = await labelItems(nonP4, config({ provider: new ToolUsingLabeller(() => true, 99) }), prompts());
    expect(r.ok).toBe(true);
  });
});
