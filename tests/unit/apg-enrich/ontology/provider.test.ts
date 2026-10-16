/** Ontology v0 provider port: the judge's Claude CLI route adapter and the mocks. */
import { ClaudeCliOntologyProvider, MockFailure, MockOntologyProvider, NoCallProvider, STOP_CODES } from '../../../../src/apg-enrich/ontology/index.js';
import type { OntologyModelRequest } from '../../../../src/apg-enrich/ontology/index.js';
import { reduceEnvelope } from '../../../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_MODEL } from '../../../../src/llm-critic/frozen.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../../src/shared/interfaces/llm-provider.js';

const REQ: OntologyModelRequest = { pass: 'rules', itemId: 'cls1', itemName: 'Cls', runIndex: 1, system: 'SYSTEM', prompt: 'PROMPT', schema: { type: 'object' } };

class FakeCli implements LLMProvider {
  readonly name = 'claude-cli';
  calls: { prompt: string; options: LLMOptions; call: LLMCallContext | undefined }[] = [];
  constructor(private readonly answer: () => DomainResult<LLMResponse>) {}
  describe(): { provider: string; model: string } { return { provider: 'claude-cli', model: JUDGE_MODEL }; }
  evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.calls.push({ prompt, options, call });
    return Promise.resolve(this.answer());
  }
}

function envelope(e: Record<string, unknown>): DomainResult<LLMResponse> {
  return DomainResult.ok({ content: reduceEnvelope(e), model: JUDGE_MODEL, usage: { inputTokens: 10, outputTokens: 5 }, usedOptions: {}, ignoredOptions: [] });
}

describe('ClaudeCliOntologyProvider (judge route adapter)', () => {
  it('passes the ontology system prompt and schema through the call context, prompt on the port, model pinned', async () => {
    const cli = new FakeCli(() => envelope({ model: JUDGE_MODEL, result: '', structured_output: { rules: [] }, modelUsage: { [JUDGE_MODEL]: { outputTokens: 5 } } }));
    const p = new ClaudeCliOntologyProvider(cli);
    const r = await p.complete(REQ);
    expect(r).toEqual({ success: true, data: { json: { rules: [] }, model: JUDGE_MODEL, usage: { inputTokens: 10, outputTokens: 5 } } });
    expect(cli.calls[0]?.prompt).toBe('PROMPT');
    expect(cli.calls[0]?.options.model).toBe(JUDGE_MODEL);
    expect(cli.calls[0]?.call).toMatchObject({ runIndex: 1, systemPrompt: 'SYSTEM', responseSchema: '{"type":"object"}', functionId: 'ontology:rules', unitId: 'cls1' });
    expect(p.describe()).toMatchObject({ provider: 'claude-cli', model: JUDGE_MODEL, temperature: null });
  });

  it('falls back to a JSON result text, and rejects a non-JSON one', async () => {
    const ok = new ClaudeCliOntologyProvider(new FakeCli(() => envelope({ model: JUDGE_MODEL, result: '{"rules":[]}' })));
    expect(await ok.complete(REQ)).toMatchObject({ success: true, data: { json: { rules: [] } } });
    const bad = new ClaudeCliOntologyProvider(new FakeCli(() => envelope({ model: JUDGE_MODEL, result: 'sorry' })));
    expect(await bad.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_BAD_JSON' }] });
  });

  it('rejects an answer carried by another model (VRD-07) and passes errors through unchanged', async () => {
    const other = new ClaudeCliOntologyProvider(new FakeCli(() => envelope({ structured_output: {}, modelUsage: { 'claude-other': { outputTokens: 9 } } })));
    expect(await other.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_MODEL_MISMATCH' }] });
    const limit = new ClaudeCliOntologyProvider(new FakeCli(() => DomainResult.fail([{ code: 'LLM_USAGE_LIMIT', message: 'limit' }])));
    expect(await limit.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_USAGE_LIMIT' }] });
    expect(STOP_CODES.has('LLM_USAGE_LIMIT')).toBe(true);
  });
});

describe('mock providers', () => {
  it('MockOntologyProvider answers from its responder and records requests; MockFailure fails', async () => {
    const m = new MockOntologyProvider((r) => (r.runIndex === 0 ? { a: 1 } : new MockFailure('X', 'boom')));
    expect(await m.complete({ ...REQ, runIndex: 0 })).toMatchObject({ success: true, data: { json: { a: 1 }, model: 'mock-ontology' } });
    expect(await m.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'X', message: 'boom' }] });
    expect(m.received()).toHaveLength(2);
  });

  it('NoCallProvider never answers', async () => {
    const n = new NoCallProvider({ provider: 'claude-cli', model: 'm', temperature: null });
    expect(n.describe().provider).toBe('claude-cli');
    expect(await n.complete()).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_NO_CALL' }] });
  });
});
