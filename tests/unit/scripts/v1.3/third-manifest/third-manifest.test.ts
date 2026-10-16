/**
 * v1.3 third manifest (Docs/v1.3/third-manifest.md §4): the input allow-list (H-P1), the frozen hashes (H-P2), the
 * fake dry run in the ue-score blind layout (H-P3), the comparison (H-P4), and the adapters with stubs only (no
 * network, no CLI, no key).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AGY_PINNED_VERSION } from '../../../../../src/llm-critic/agy-cli-provider';
import { DomainResult } from '../../../../../src/shared/errors/domain-result';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../../src/shared/interfaces/process-runner';
import { ProviderError } from '../../../../../scripts/v1.3/lib/labelling/providers';
import { materialiseVariant } from '../../../../../scripts/v1.3/lib/materialise';
import { loadReference } from '../../../../../scripts/v1.3/lib/reference-model';
import {
  Budget, agyWriter, budgeted, fakeWriter, geminiWriter, readEnvVar,
} from '../../../../../scripts/v1.3/lib/third-manifest/adapters';
import type { ManifestWriter, Perturbation } from '../../../../../scripts/v1.3/lib/third-manifest/adapters';
import { InputGuard, InputRefusedError, buildBundle, declarations, tierTable } from '../../../../../scripts/v1.3/lib/third-manifest/bundle';
import { cohenKappa, compareManifests, loadManifestDir, mapRuleName, matchFindings } from '../../../../../scripts/v1.3/lib/third-manifest/compare';
import type { MappingRow } from '../../../../../scripts/v1.3/lib/third-manifest/compare';
import { OUTPUT_SCHEMA_TEXT, PROMPT_SHA256, SCHEMA_SHA256, SYSTEM_PROMPT } from '../../../../../scripts/v1.3/lib/third-manifest/prompt';
import { AnswerError, TmCassetteStore, checkFrozenHashes, parseManifestAnswer, runCases } from '../../../../../scripts/v1.3/lib/third-manifest/run';

const REPO = path.resolve(__dirname, '../../../../..');
const roots: string[] = [];
const tmp = (prefix = 'tm-test-'): string => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); roots.push(d); return d; };
afterAll(() => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });

const MAPPING = (JSON.parse(fs.readFileSync(path.join(REPO, 'results/v1.3-reference/after-member-facts/blind-rule-mapping.json'), 'utf8')) as { mapping: MappingRow[] }).mapping;
const HEX = loadReference(REPO, 'hexagonal');

function materialised(variant: string): string {
  const v = HEX.variants.find((x) => x.manifest.variant === variant);
  if (v === undefined) throw new Error(variant);
  const root = tmp();
  const m = materialiseVariant(HEX, v, root);
  const dest = path.join(root, 'case-01', 'project');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(m.projectDir, dest);
  return dest;
}

describe('H-P1: the input allow-list', () => {
  it('builds a bundle from the four allowed inputs only, comments removed and spec rules dropped', () => {
    const project = materialised('v03-use-case-injects-concrete-adapter');
    const b = buildBundle(REPO, { caseId: 'case-01', style: 'hexagonal', specPath: HEX.specPath, projectRoot: project });
    expect(new Set(b.inputs.map((r) => r.input))).toEqual(new Set(['A1', 'A2', 'A3', 'A4']));
    expect(b.inputs.filter((r) => r.input === 'A1').map((r) => r.path)).toEqual(['Docs/v1.3/style-rule-sources.md']);
    expect(b.inputs.filter((r) => r.input === 'A4').every((r) => r.path.endsWith('.ts'))).toBe(true);
    expect(b.droppedSpecKeys).toEqual(expect.arrayContaining(['fitness_functions', 'scoring']));
    for (const f of b.sections.files) expect(f.content).not.toMatch(/\/\/|\/\*/);
    expect(b.prompt).not.toMatch(/v03|concrete-adapter|fitness_functions|template:/);
    expect(b.prompt).toContain('Case case-01. Style: hexagonal.');
  });

  it('refuses any read outside the list', () => {
    const project = materialised('clean');
    const g = new InputGuard(REPO, HEX.specPath, project);
    expect(() => g.read('A1', 'README.md')).toThrow(InputRefusedError);
    expect(() => g.read('A2', 'Docs/v1.3/style-rule-sources.md')).toThrow(InputRefusedError);
    expect(() => g.read('A3', 'presets/hexagonal.yaml')).toThrow(InputRefusedError);
    expect(() => g.read('A4', 'package.json')).toThrow(InputRefusedError);
    expect(() => g.read('A4', '../../../etc/passwd')).toThrow(InputRefusedError);
  });

  it('refuses a daedalus-sealed path anywhere, and a symlink that leaves the project', () => {
    const sealed = path.join(tmp(), 'daedalus-sealed', 'x');
    fs.mkdirSync(path.join(sealed, 'src'), { recursive: true });
    fs.writeFileSync(path.join(sealed, 'src', 'a.ts'), 'export const a = 1;\n');
    expect(() => buildBundle(REPO, { caseId: 'case-01', style: 'hexagonal', specPath: HEX.specPath, projectRoot: sealed })).toThrow(/daedalus-sealed/);
    const project = materialised('clean');
    const outside = path.join(tmp(), 'secret.ts');
    fs.writeFileSync(outside, 'export const leaked = 1;\n');
    fs.symlinkSync(outside, path.join(project, 'src', 'leak.ts'));
    expect(() => buildBundle(REPO, { caseId: 'case-01', style: 'hexagonal', specPath: HEX.specPath, projectRoot: project })).toThrow(/leaves the project root/);
  });

  it('refuses a case id that is not opaque', () => {
    const project = materialised('clean');
    expect(() => buildBundle(REPO, { caseId: 'v01-domain', style: 'hexagonal', specPath: HEX.specPath, projectRoot: project })).toThrow(/not opaque/);
  });

  it('cuts the v1.2E severity column and keeps rule names and constructs', () => {
    const t = tierTable(fs.readFileSync(path.join(REPO, 'Docs/v1.3/rule-tiers.md'), 'utf8'));
    expect(t.split('\n')[0]).toBe('| Rule | Template or note | v1.3 tier | Construct reason |');
    expect(t).not.toMatch(/\| critical \||\| major \|/);
    expect(t).toContain('| DDD aggregate boundary |');
    expect(t).toContain('| FF-S01 | dependency-direction | **blocking** |');
  });

  it('keeps only the declarations of the DDD spec', () => {
    const d = declarations(fs.readFileSync(path.join(REPO, 'presets/ddd.yaml'), 'utf8'));
    expect(d.yaml).toContain('aggregates:');
    expect(d.yaml).not.toMatch(/FF-|fitness_functions|severity/);
  });
});

describe('H-P2: the frozen hashes', () => {
  const doc = fs.readFileSync(path.join(REPO, 'Docs/v1.3/third-manifest.md'), 'utf8');
  it('the doc names the computed prompt and schema hashes', () => {
    expect(() => checkFrozenHashes(doc)).not.toThrow();
    expect(doc).toContain(PROMPT_SHA256);
    expect(doc).toContain(SCHEMA_SHA256);
  });
  it('a drifted doc stops the run', () => {
    expect(() => checkFrozenHashes(doc.replace(PROMPT_SHA256, '0'.repeat(64)))).toThrow(/TM_HASH_DRIFT|differ/);
  });
});

describe('answer parsing', () => {
  const ok = { verdict: 'fail', expectedGraph: { files: [{ file: 'src/a.ts', layer: 'domain' }], edges: [{ from: 'src/a.ts', to: 'src/b.ts', kind: 'import' }] }, findings: [{ ruleId: 'FF-S01', file: 'src/a.ts', target: 'src/b.ts', tier: 'blocking', reason: 'r', confidence: 'high' }], nearMissOk: [] };
  it('accepts the schema shape, also in a fenced block', () => {
    expect(parseManifestAnswer(JSON.stringify(ok)).findings[0]?.alsoMatches).toEqual([]);
    expect(parseManifestAnswer(`Here:\n\`\`\`json\n${JSON.stringify(ok)}\n\`\`\``).verdict).toBe('fail');
  });
  it('rejects unknown enums, missing fields and prose', () => {
    expect(() => parseManifestAnswer(JSON.stringify({ ...ok, verdict: 'maybe' }))).toThrow(AnswerError);
    expect(() => parseManifestAnswer(JSON.stringify({ ...ok, findings: [{ ...ok.findings[0], tier: 'critical' }] }))).toThrow(AnswerError);
    expect(() => parseManifestAnswer(JSON.stringify({ verdict: 'pass' }))).toThrow(AnswerError);
    expect(() => parseManifestAnswer('I think it passes.')).toThrow(AnswerError);
  });
});

describe('H-P3 and H-P4: the fake dry run and the comparison', () => {
  const variants = ['clean', 'v03-use-case-injects-concrete-adapter'];
  async function dryRun(mode: 'record' | 'replay', cassettes: string, out: string, log: Perturbation[]): Promise<void> {
    const planned = variants.map((v, i) => ({ caseId: `case-0${String(i + 1)}`, variant: v, project: '' }));
    const bundles = planned.map((p) => {
      const v = HEX.variants.find((x) => x.manifest.variant === p.variant);
      if (v === undefined) throw new Error(p.variant);
      const root = tmp();
      const m = materialiseVariant(HEX, v, root);
      const dest = path.join(root, p.caseId, 'project');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(m.projectDir, dest);
      return buildBundle(REPO, { caseId: p.caseId, style: 'hexagonal', specPath: HEX.specPath, projectRoot: dest });
    });
    const writer = fakeWriter((caseId) => {
      const p = planned.find((x) => x.caseId === caseId);
      const v = HEX.variants.find((x) => x.manifest.variant === p?.variant);
      return {
        findings: (v?.manifest.expectedFindings ?? []).map((f) => ({ ruleId: f.ruleId, file: f.file, ...(f.target !== undefined && { target: f.target }), tier: 'blocking' as const, reason: f.reason })),
        files: (bundles.find((b) => b.caseId === caseId)?.sections.files ?? []).map((f) => ({ file: f.path, layer: null })),
        aliasOf: (id) => MAPPING.find((r) => r.ruleId === id && r.styles.includes('hexagonal') && r.basis === 'library-alias')?.name,
      };
    }, log);
    await runCases(bundles, writer, { outDir: out, cassettes: new TmCassetteStore(cassettes, mode), key: Object.fromEntries(planned.map((p) => [p.caseId, p.variant])), label: 'dry run, not a result' });
  }

  it('writes the ue-score blind layout, replays byte-identically, and the comparison equals the logged perturbation', async () => {
    const cas = tmp();
    const out1 = tmp();
    const log: Perturbation[] = [];
    await dryRun('record', cas, out1, log);
    const key = JSON.parse(fs.readFileSync(path.join(out1, 'blind-key.json'), 'utf8')) as Record<string, string>;
    expect(key).toEqual({ 'hexagonal/case-01': 'clean', 'hexagonal/case-02': 'v03-use-case-injects-concrete-adapter' });
    const c2 = JSON.parse(fs.readFileSync(path.join(out1, 'blind-out/hexagonal/case-02.json'), 'utf8')) as { verdict: string; findings: { ruleId: string }[]; expectedGraph: unknown; nearMissOk: unknown[]; provenance: { promptSha256: string } };
    expect(c2.verdict).toBe('fail');
    expect(c2.provenance.promptSha256).toBe(PROMPT_SHA256);
    for (const f of c2.findings) expect(mapRuleName(f.ruleId, 'hexagonal', MAPPING)).toMatch(/^FF-/);
    expect(c2.findings.map((f) => f.ruleId)).toContain('dependency-direction-graph');

    const out2 = tmp();
    await dryRun('replay', cas, out2, []);
    expect(fs.readFileSync(path.join(out2, 'blind-out/hexagonal/case-02.json'), 'utf8')).toBe(fs.readFileSync(path.join(out1, 'blind-out/hexagonal/case-02.json'), 'utf8'));

    // The author side, in the same layout, from the reference manifests.
    const authorDir = tmp();
    fs.writeFileSync(path.join(authorDir, 'blind-key.json'), JSON.stringify(key));
    for (const [k, variant] of Object.entries(key)) {
      const caseId = k.split('/')[1] ?? '';
      const v = HEX.variants.find((x) => x.manifest.variant === variant);
      fs.mkdirSync(path.join(authorDir, 'blind-out/hexagonal'), { recursive: true });
      fs.writeFileSync(path.join(authorDir, 'blind-out/hexagonal', `${caseId}.json`), JSON.stringify({ verdict: (v?.manifest.expectedFindings.length ?? 0) > 0 ? 'fail' : 'pass', findings: v?.manifest.expectedFindings ?? [] }));
    }
    const cmp = compareManifests(loadManifestDir(authorDir, MAPPING), loadManifestDir(out1, MAPPING));
    const all = cmp.rows.find((r) => r.scope === 'all' && r.view === 'all');
    const expectedBoth = variants.reduce((s, v) => { const n = HEX.variants.find((x) => x.manifest.variant === v)?.manifest.expectedFindings.length ?? 0; return s + (n >= 2 ? n - 1 : n); }, 0);
    expect(all).toMatchObject({ both: expectedBoth, onlyA: log.reduce((s, p) => s + p.dropped.length, 0), onlyB: log.reduce((s, p) => s + p.decoys.length, 0), verdictAgree: 2 });
    expect(cmp.rows.find((r) => r.scope === 'hexagonal')?.kappa).toBeNull();
  });

  it('a writer that never answers in schema leaves the case invalid, never pass', async () => {
    const project = materialised('clean');
    const b = buildBundle(REPO, { caseId: 'case-01', style: 'hexagonal', specPath: HEX.specPath, projectRoot: project });
    let calls = 0;
    const prose: ManifestWriter = { id: 'fake', vendor: 'none', model: 'prose', facts: {}, prepare: () => Promise.resolve(), call: () => { calls += 1; return Promise.resolve({ text: 'It looks fine.', servedModel: 'prose' }); } };
    const out = tmp();
    const [r] = await runCases([b], prose, { outDir: out, cassettes: new TmCassetteStore(tmp(), 'record'), key: { 'case-01': 'clean' }, label: 'test' });
    expect(r?.status).toBe('invalid');
    expect(calls).toBe(2);
    expect((JSON.parse(fs.readFileSync(path.join(out, 'blind-out/hexagonal/case-01.json'), 'utf8')) as { verdict: string }).verdict).toBe('invalid');
  });

  it('matches one to one, exact target first, and maps names as ue-score does', () => {
    const m = matchFindings([{ ruleId: 'FF-S01', file: 'a', target: 'b' }, { ruleId: 'FF-S01', file: 'a', target: '' }], [{ ruleId: 'FF-S01', file: 'a', target: 'b' }]);
    expect(m.both).toBe(1);
    expect(m.onlyA).toHaveLength(1);
    expect(mapRuleName('core-isolation', 'hexagonal', MAPPING)).toBe('FF-S04');
    expect(mapRuleName('no-such-rule', 'hexagonal', MAPPING)).toBe('unmapped:no-such-rule');
    expect(cohenKappa(['pass', 'fail', 'fail', 'pass'], ['pass', 'fail', 'pass', 'pass'])).toBeCloseTo(0.5, 6);
    expect(cohenKappa(['pass', 'pass'], ['pass', 'pass'])).toBeNull();
  });
});

describe('the committed dry run (results/v1.3-third-manifest/dry-run)', () => {
  const dir = path.join(REPO, 'results/v1.3-third-manifest/dry-run');
  it('is labelled a dry run and every finding name maps (or is OTHER:)', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, 'k-g-fake/run.json'), 'utf8')) as { label: string; promptSha256: string };
    expect(run.label).toBe('dry run, not a result');
    expect(run.promptSha256).toBe(PROMPT_SHA256);
    const key = JSON.parse(fs.readFileSync(path.join(dir, 'k-g-fake/blind-key.json'), 'utf8')) as Record<string, string>;
    expect(Object.keys(key)).toHaveLength(3);
    for (const k of Object.keys(key)) {
      const [style, caseId] = k.split('/') as [string, string];
      const c = JSON.parse(fs.readFileSync(path.join(dir, 'k-g-fake/blind-out', style, `${caseId}.json`), 'utf8')) as { findings: { ruleId: string }[] };
      for (const f of c.findings) expect(f.ruleId.startsWith('OTHER:') || mapRuleName(f.ruleId, style, MAPPING).startsWith('FF-')).toBe(true);
    }
    expect(fs.readFileSync(path.join(dir, 'compare.md'), 'utf8')).toContain('Dry run, not a result');
  });
});

// ── Adapters (stubs only) ───────────────────────────────────────────────────

function proc(stdout: string, extra: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 5, ...extra };
}
function stubRunner(answers: readonly ((args: readonly string[]) => ProcessResult)[]): ProcessRunner & { seen: { args: readonly string[]; options: ProcessRunOptions }[] } {
  const seen: { args: readonly string[]; options: ProcessRunOptions }[] = [];
  let i = 0;
  return {
    seen,
    run(_c, args, options) {
      seen.push({ args, options });
      const a = answers[Math.min(i, answers.length - 1)];
      i += 1;
      return Promise.resolve(DomainResult.ok((a ?? (() => proc('')))(args)));
    },
  };
}
function agyHome(): string {
  const home = tmp('tm-agy-home-');
  fs.chmodSync(home, 0o700);
  fs.mkdirSync(path.join(home, '.gemini/antigravity-cli'), { recursive: true });
  fs.mkdirSync(path.join(home, '.gemini/config'), { recursive: true });
  fs.writeFileSync(path.join(home, '.gemini/config/mcp_config.json'), '');
  fs.copyFileSync(path.join(REPO, 'tests/fixtures/agy-cli/labeller-settings.json'), path.join(home, '.gemini/antigravity-cli/settings.json'));
  return home;
}
const PREFLIGHT = [(): ProcessResult => proc(`${AGY_PINNED_VERSION}\n`), (): ProcessResult => proc('No MCP servers configured.\n'), (): ProcessResult => proc('No imported plugins.\n')];
const stream = (model: string, structured: unknown, tools: string[] = []): string => [
  JSON.stringify({ event: 'init', init: { model } }),
  ...tools.map((t, i) => JSON.stringify({ event: 'step_update', step_update: { step_type: 'tool', step_index: i, tool_name: t, state: 'DONE' } })),
  JSON.stringify({ event: 'result', result: { status: 'SUCCESS', structured_output: structured, usage: { input_tokens: 100, output_tokens: 20 } } }),
].join('\n');

describe('agy adapter (subscription route)', () => {
  const req = { system: SYSTEM_PROMPT, prompt: 'P', caseId: 'case-01' };
  const answer = { verdict: 'pass', expectedGraph: { files: [], edges: [] }, findings: [], nearMissOk: [] };

  it('pre-flights, sends the frozen schema with the prompt on stdin, the dedicated HOME and no API key', async () => {
    const home = agyHome();
    const runner = stubRunner([...PREFLIGHT, () => proc(stream('gemini-4-argon-high', answer))]);
    const w = agyWriter({ model: 'Gemini 4 Argon (High)', servedModel: 'gemini-4-argon-high', home }, runner, { PATH: '/bin', HOME: '/real', GEMINI_API_KEY: 'secret-key-123456' });
    await w.prepare();
    const a = await w.call(req);
    expect(parseManifestAnswer(a.text).verdict).toBe('pass');
    const call = runner.seen[3];
    expect(call?.args).toEqual(expect.arrayContaining(['--model', 'Gemini 4 Argon (High)', '--json-schema', OUTPUT_SCHEMA_TEXT, '--sandbox', '--disable-slash-commands']));
    expect(call?.options.stdin).toBe(`${SYSTEM_PROMPT}\n\nP`);
    expect(call?.options.env.HOME).toBe(home);
    expect(Object.keys(call?.options.env ?? {})).not.toContain('GEMINI_API_KEY');
    expect(w.facts.cliVersion).toBe(AGY_PINNED_VERSION);
  });

  it('stops on version drift unless the author pins the version they run', async () => {
    const home = agyHome();
    const drift = [(): ProcessResult => proc('1.9.0\n'), PREFLIGHT[1] ?? (() => proc('')), PREFLIGHT[2] ?? (() => proc(''))];
    await expect(agyWriter({ model: 'm', home }, stubRunner(drift), {}).prepare()).rejects.toMatchObject({ code: 'LLM_CLI_VERSION_DRIFT', kind: 'stop' });
    await expect(agyWriter({ model: 'm', home, version: '1.9.0' }, stubRunner(drift), {}).prepare()).resolves.toBeUndefined();
  });

  it('a completed tool step is a retryable invalid call; a served-model mismatch is a stop', async () => {
    const home = agyHome();
    const w1 = agyWriter({ model: 'm', home }, stubRunner([...PREFLIGHT, () => proc(stream('m', answer, ['search_web']))]), {});
    await w1.prepare();
    await expect(w1.call(req)).rejects.toMatchObject({ code: 'LLM_CLI_TOOL_USE', kind: 'retry' });
    const w2 = agyWriter({ model: 'm', home }, stubRunner([...PREFLIGHT, () => proc(stream('other-model', answer))]), {});
    await w2.prepare();
    await expect(w2.call(req)).rejects.toMatchObject({ code: 'LLM_CLI_ISOLATION', kind: 'stop' });
  });

  it('refuses a home that fails the labeller home check', async () => {
    const home = agyHome();
    fs.writeFileSync(path.join(home, 'GEMINI.md'), 'rules');
    await expect(agyWriter({ model: 'm', home }, stubRunner(PREFLIGHT), {}).prepare()).rejects.toMatchObject({ code: 'LLM_CLI_ISOLATION' });
  });
});

describe('dollar routes: key handling and the budget cap', () => {
  it('reads only the named variable from an env file', () => {
    const f = path.join(tmp(), '.env');
    fs.writeFileSync(f, 'OTHER=x\nexport GEMINI_API_KEY="abc123"\nANTHROPIC_API_KEY=nope\n');
    expect(readEnvVar(f, 'GEMINI_API_KEY')).toBe('abc123');
    expect(readEnvVar(f, 'MISSING')).toBeUndefined();
  });

  it('the gemini adapter stops without a key or a model', () => {
    expect(() => geminiWriter({ model: 'gemini-x', apiKey: '' })).toThrow(ProviderError);
    expect(() => geminiWriter({ model: '', apiKey: 'k' })).toThrow(/--model/);
  });

  it('never makes a call whose worst case would pass the cap, and records measured spend', async () => {
    const budget = new Budget(0.045, { inPerMTok: 2, outPerMTok: 10 }, 1000);
    let calls = 0;
    const inner: ManifestWriter = { id: 'gemini', vendor: 'google', model: 'x', facts: {}, prepare: () => Promise.resolve(), call: () => { calls += 1; return Promise.resolve({ text: '{}', servedModel: 'x', inputTokens: 1000, outputTokens: 500 }); } };
    const w = budgeted(inner, budget);
    // worst case per call: ceil(3000/3)=1000 in * 2 + 1000 out * 10 = 12000 / 1e6 = $0.012; measured 1000*2+500*10 = $0.007.
    const req = { system: '', prompt: 'x'.repeat(3000), caseId: 'case-01' };
    for (let i = 0; i < 5; i += 1) await w.call(req);
    expect(budget.spent()).toBeCloseTo(0.035, 9);
    await expect(w.call(req)).rejects.toMatchObject({ code: 'TM_BUDGET', kind: 'stop' });
    expect(calls).toBe(5);
  });
});
