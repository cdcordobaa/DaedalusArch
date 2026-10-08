/**
 * U4 plan Step 23 (U4-K7): `judgeProvenanceOf` (BR-U4-CAS-10, SEL-06; DE §4.6; BR-U3-63).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../src/shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../../../src/shared/types/evaluation.js';
import { NO_JUDGE } from '../../../src/scoring-engine/report-builder.js';
import { judgeProvenanceOf, provenanceWarning } from '../../../src/llm-critic/provenance.js';
import { CassetteLLMProvider } from '../../../src/llm-critic/cassette-provider.js';
import { readCassetteEntry, listCassetteKeys, writeCassetteEntry } from '../../../src/llm-critic/cassette-manager.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';

const dirs: string[] = [];
function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-k7-'));
  dirs.push(d);
  return d;
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const OPTIONS: LLMOptions = { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 };
const RUN = { runsPerUnit: 3, repetition: 0, seededList: [] as string[] };
const call = (runIndex: number): LLMCallContext => ({ runIndex, repetition: 0, functionId: 'FF-N02', unitId: 'src/a.ts' });

/** A provider that describes itself as the Claude CLI and answers a fixed valid verdict. */
class FakeCli implements LLMProvider {
  readonly name = 'fake-cli';
  describe(): ProviderDescription { return { provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high' }; }
  evaluate(): Promise<DomainResult<LLMResponse>> {
    return Promise.resolve(DomainResult.ok({
      content: JSON.stringify({ pass: true, confidence: 0.9, reasoning: 'r', evidence: [], violations: [] }),
      model: 'claude-opus-5-5', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: { model: 'claude-opus-5-5', effort: 'high' }, ignoredOptions: ['maxTokens'],
    }));
  }
}

async function recordThree(dir: string, cliVersion: string): Promise<CassetteLLMProvider> {
  const rec = new CassetteLLMProvider(new FakeCli(), {
    mode: 'record', dir, cliVersion, isolationProbeSha256: 'probe-hash', configListingSha256: 'listing-hash', knownSecrets: [],
  });
  for (const i of [0, 1, 2]) await rec.judge(`prompt ${String(i)}`, OPTIONS, call(i));
  return rec;
}

describe('judgeProvenanceOf (BR-U4-CAS-10)', () => {
  it('no provider: exactly U3\'s symbolic-only stub, string-equal, with no seededList key', () => {
    const none = judgeProvenanceOf(undefined, RUN);
    expect(JSON.stringify(none)).toBe(JSON.stringify(NO_JUDGE));
    expect(JSON.stringify(judgeProvenanceOf(undefined))).toBe('{"provider":"none","model":"none","runsPerUnit":0}');
    expect('seededList' in none).toBe(false);
  });

  it('record: describe(), the decorator\'s pre-flight provenance, resolvedModel, mode, runs, repetition, seededList []', async () => {
    const rec = await recordThree(tmpDir(), '2.1.294');
    expect(judgeProvenanceOf(rec, RUN)).toEqual({
      provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high', cliVersion: '2.1.294', cassetteMode: 'record',
      runsPerUnit: 3, resolvedModel: 'claude-opus-5-5', repetition: 0, isolationProbeSha256: 'probe-hash',
      configListingSha256: 'listing-hash', provenanceMixed: false, seededList: [],
    });
  });

  it('replay: every field from the entries used; the inner provider is only described', async () => {
    const dir = tmpDir();
    await recordThree(dir, '2.1.294');
    const inner = new FakeCli();
    const evaluate = jest.spyOn(inner, 'evaluate');
    const replay = new CassetteLLMProvider(inner, { mode: 'replay', dir, knownSecrets: [] });
    for (const i of [0, 1, 2]) await replay.judge(`prompt ${String(i)}`, OPTIONS, call(i));
    const judge = judgeProvenanceOf(replay, RUN);
    expect(judge).toEqual(expect.objectContaining({
      provider: 'claude-cli', cliVersion: '2.1.294', cassetteMode: 'replay', resolvedModel: 'claude-opus-5-5',
      isolationProbeSha256: 'probe-hash', configListingSha256: 'listing-hash', provenanceMixed: false, repetition: 0,
    }));
    expect(evaluate).not.toHaveBeenCalled();
    expect(provenanceWarning(judge)).toBeUndefined();
  });

  it('mixed provenance: the most frequent value with provenanceMixed true and a warning', async () => {
    const dir = tmpDir();
    await recordThree(dir, '2.1.294');
    // one entry re-stamped as recorded under another CLI version (metadata only, CAS-03)
    const [first] = listCassetteKeys(dir);
    const entry = first === undefined ? null : readCassetteEntry(dir, first);
    if (entry === null) throw new Error('no entry');
    writeCassetteEntry(dir, { ...entry, cliVersion: '2.1.300' });
    const replay = new CassetteLLMProvider(new FakeCli(), { mode: 'replay', dir, knownSecrets: [] });
    for (const i of [0, 1, 2]) await replay.judge(`prompt ${String(i)}`, OPTIONS, call(i));
    const judge = judgeProvenanceOf(replay, RUN);
    expect(judge.cliVersion).toBe('2.1.294');
    expect(judge.provenanceMixed).toBe(true);
    expect(provenanceWarning(judge)).toEqual(expect.objectContaining({ code: 'JUDGE_PROVENANCE_MIXED', stage: 'llm-critic' }));
  });

  it('SEL-06: seededList defaults to [] and is reported sorted when set', () => {
    const mock = new CassetteLLMProvider(new MockLLMProvider(), { mode: 'record', dir: tmpDir(), knownSecrets: [] });
    expect(judgeProvenanceOf(mock, RUN).seededList).toEqual([]);
    expect(judgeProvenanceOf(mock, { ...RUN, seededList: ['src/b', 'src/a'] }).seededList).toEqual(['src/a', 'src/b']);
  });

  it('a Mock run is described as mock with its cassette mode', () => {
    const mock = new CassetteLLMProvider(new MockLLMProvider(), { mode: 'record', dir: tmpDir(), knownSecrets: [] });
    expect(judgeProvenanceOf(mock, RUN)).toEqual({
      provider: 'mock', model: 'mock-model', cassetteMode: 'record', runsPerUnit: 3, repetition: 0, provenanceMixed: false, seededList: [],
    });
  });
});
