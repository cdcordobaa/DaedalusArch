/**
 * v1.4 U3 D5: `LlmOntologyProvider`, the generic adapter over any `LLMProvider`, with a fake provider only. No
 * `GeminiProvider` or `AgyCliProvider` is constructed.
 */
import { LlmOntologyProvider, ModelCaller, OntologyCache, toVendorSchema } from '../../../../src/apg-enrich/ontology/index.js';
import type { OntologyModelRequest } from '../../../../src/apg-enrich/ontology/index.js';
import { RULE_SCHEMA } from '../../../../src/apg-enrich/ontology/prompts.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../../src/shared/interfaces/llm-provider.js';

const REQ: OntologyModelRequest = { pass: 'rules', itemId: 'cls1', itemName: 'Cls', runIndex: 1, system: 'SYSTEM', prompt: 'PROMPT', schema: RULE_SCHEMA };

class FakeLlm implements LLMProvider {
  readonly name = 'fake';
  calls: { prompt: string; options: LLMOptions; call: LLMCallContext | undefined }[] = [];
  constructor(private readonly answer: () => DomainResult<LLMResponse>) {}
  describe(): { provider: string; model: string } { return { provider: 'gemini', model: 'gemini-x' }; }
  evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.calls.push({ prompt, options, call });
    return Promise.resolve(this.answer());
  }
}

const text = (content: string, model = 'gemini-x'): DomainResult<LLMResponse> =>
  DomainResult.ok({ content, model, usage: { inputTokens: 10, outputTokens: 5 }, usedOptions: {}, ignoredOptions: [] });
const RULES_OK = JSON.stringify({ rules: [] });

describe('LlmOntologyProvider', () => {
  it('sends the system prompt and the vendor schema in the call context and parses the JSON answer', async () => {
    const fake = new FakeLlm(() => text(RULES_OK));
    const p = new LlmOntologyProvider(fake, { route: 'gemini-api', model: 'gemini-x', maxTokens: 100, temperature: 0 });
    expect(await p.complete(REQ)).toEqual({ success: true, data: { json: { rules: [] }, model: 'gemini-x', usage: { inputTokens: 10, outputTokens: 5 } } });
    expect(fake.calls[0]?.prompt).toBe('PROMPT');
    expect(fake.calls[0]?.options).toEqual({ model: 'gemini-x', maxTokens: 100, temperature: 0 });
    expect(fake.calls[0]?.call).toMatchObject({ runIndex: 1, repetition: 0, systemPrompt: 'SYSTEM', functionId: 'ontology:rules', unitId: 'cls1', responseSchema: JSON.stringify(toVendorSchema('gemini-api', RULE_SCHEMA)) });
    expect(p.describe()).toEqual({ provider: 'gemini-api', model: 'gemini-x', temperature: 0 });
    const agy = new LlmOntologyProvider(fake, { route: 'gemini-agy', model: 'gemini-x', maxTokens: 100 });
    expect(agy.describe()).toEqual({ provider: 'gemini-agy', model: 'gemini-x', temperature: null });
    await agy.complete(REQ);
    expect(fake.calls[1]?.options).toEqual({ model: 'gemini-x', maxTokens: 100 });
  });

  it('a non-JSON answer is LLM_BAD_JSON, retried once by ModelCaller, then the item is invalid', async () => {
    const fake = new FakeLlm(() => text('not json'));
    const p = new LlmOntologyProvider(fake, { route: 'gemini-agy', model: 'gemini-x', maxTokens: 100 });
    expect(await p.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_BAD_JSON' }] });
    fake.calls = [];
    const caller = new ModelCaller({ provider: p, cache: new OntologyCache('off', null), budget: 10, runId: 'r', promptVersion: 'v' });
    expect(await caller.call(REQ)).toMatchObject({ kind: 'invalid' });
    expect(fake.calls).toHaveLength(2);
    expect(caller.stopped).toBeNull();
  });

  it('the served model must be the requested one; gemini-api accepts a dated variant, gemini-agy does not', async () => {
    const other = new LlmOntologyProvider(new FakeLlm(() => text(RULES_OK, 'gemini-y')), { route: 'gemini-api', model: 'gemini-x', maxTokens: 1 });
    expect(await other.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_MODEL_MISMATCH' }] });
    const dated = new LlmOntologyProvider(new FakeLlm(() => text(RULES_OK, 'gemini-x-001')), { route: 'gemini-api', model: 'gemini-x', maxTokens: 1 });
    expect(await dated.complete(REQ)).toMatchObject({ success: true, data: { model: 'gemini-x-001' } });
    const agy = new LlmOntologyProvider(new FakeLlm(() => text(RULES_OK, 'gemini-x-001')), { route: 'gemini-agy', model: 'gemini-x', maxTokens: 1 });
    expect(await agy.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_MODEL_MISMATCH' }] });
  });

  it('passes error codes through, so a stop code ends the run', async () => {
    const p = new LlmOntologyProvider(new FakeLlm(() => DomainResult.fail([{ code: 'LLM_USAGE_LIMIT', message: '429' }])), { route: 'gemini-api', model: 'gemini-x', maxTokens: 1, temperature: 0 });
    expect(await p.complete(REQ)).toMatchObject({ success: false, errors: [{ code: 'LLM_USAGE_LIMIT' }] });
    const caller = new ModelCaller({ provider: p, cache: new OntologyCache('off', null), budget: 10, runId: 'r', promptVersion: 'v' });
    expect(await caller.call(REQ)).toEqual({ kind: 'stopped' });
    expect(caller.stopped).toMatchObject({ code: 'LLM_USAGE_LIMIT' });
  });

  it('toVendorSchema turns [T, null] into nullable for gemini-api only; Ajv still checks the original schema', async () => {
    const g = toVendorSchema('gemini-api', RULE_SCHEMA) as { properties: { rules: { items: { properties: Record<string, unknown> } } } };
    expect(g.properties.rules.items.properties.threshold).toEqual({ type: 'number', nullable: true });
    expect(g.properties.rules.items.properties.unit).toEqual({ type: 'string', nullable: true });
    expect(toVendorSchema('gemini-agy', RULE_SCHEMA)).toBe(RULE_SCHEMA);
    expect(JSON.stringify(RULE_SCHEMA)).toContain('"null"'); // the original is not mutated
    const bad = JSON.stringify({ rules: [{ statement: 's', kind: 'technical', subject: 'x', operator: '>', threshold: 1, unit: null, enforcedBy: 'm', confidence: 0.5, evidence: [] }] });
    const p = new LlmOntologyProvider(new FakeLlm(() => text(bad)), { route: 'gemini-api', model: 'gemini-x', maxTokens: 1, temperature: 0 });
    const caller = new ModelCaller({ provider: p, cache: new OntologyCache('off', null), budget: 10, runId: 'r', promptVersion: 'v' });
    const r = await caller.call(REQ);
    expect(r).toMatchObject({ kind: 'invalid' });
    expect(r.kind === 'invalid' ? r.reason : '').toContain('fails the rules schema');
  });
});
