/**
 * v1.3 model panel (Docs/v1.3/model-panel.md): items and loaders, blinding, adapters (stubbed, no network, no CLI),
 * the panel run through cassettes, the statistics and the authority rule, and the dry run end to end.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fleissKappa } from '../../../../../scripts/lib/stats';
import {
  DRY_RUN_PROFILES, claimOfPrompt, claudeCliProvider, fakeProvider, fakeRater, openAiBody, openAiProvider, optionsOfPrompt, rater,
} from '../../../../../scripts/v1.3/lib/panel/adapters';
import type { FetchLike } from '../../../../../scripts/v1.3/lib/panel/adapters';
import { NEUTRAL_STYLE, assemble, externalItems, parseCsv, sheetExcerpts, unionItems, wildItems } from '../../../../../scripts/v1.3/lib/panel/items';
import type { Loaded, PanelKeyFile, PanelSet } from '../../../../../scripts/v1.3/lib/panel/items';
import { panelMain } from '../../../../../scripts/v1.3/lib/panel/main';
import { blindingProblems, renderPanelPrompt } from '../../../../../scripts/v1.3/lib/panel/prompt';
import { runPanel } from '../../../../../scripts/v1.3/lib/panel/run';
import type { PanelLabels } from '../../../../../scripts/v1.3/lib/panel/run';
import { AUTHORITY_RULE, fleissOver, krippendorffAlphaNominal, panelReport, renderPanelReport } from '../../../../../scripts/v1.3/lib/panel/stats';
import { ProviderError } from '../../../../../scripts/v1.3/lib/labelling/providers';
import type { UnionKeyRow } from '../../../../../scripts/v1.3/lib/labelling/union';
import { DomainResult } from '../../../../../src/shared/errors/domain-result';
import type { LLMProvider } from '../../../../../src/shared/interfaces/llm-provider';

const REPO = path.resolve(__dirname, '../../../../..');
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'panel-test-'));

describe('items', () => {
  it('parses RFC 4180 CSV with quoted commas, quotes and newlines', () => {
    expect(parseCsv('a,b,c\n1,"x, y","say ""hi"""\n2,"multi\nline",z\n')).toEqual([['a', 'b', 'c'], ['1', 'x, y', 'say "hi"'], ['2', 'multi\nline', 'z']]);
  });

  it('loads every wild review item with its excerpt and the neutral style, and keeps the detector in the key only', () => {
    const sheet = fs.readFileSync(path.join(REPO, 'results/v1.3-wild/review-sheet.md'), 'utf8');
    const key = JSON.parse(fs.readFileSync(path.join(REPO, 'results/v1.3-wild/review-key.json'), 'utf8')) as { items: { id: string; rule: string; repo: string }[] };
    const l = wildItems(sheet, key);
    expect(l.excluded).toEqual([]);
    expect(l.items).toHaveLength(key.items.length);
    expect(l.items.every((i) => i.style === NEUTRAL_STYLE && (i.excerpt ?? '').length > 0)).toBe(true);
    expect(l.key[0]).toMatchObject({ origin: 'wild', sourceId: 'W01', rule: key.items[0]?.rule });
    expect(JSON.stringify(l.items)).not.toContain(key.items[0]?.rule ?? '?');
  });

  it('reads the first fenced block of each matching section', () => {
    const md = '### U001\n\nC01 ddd, `a.ts`\n\n```ts\n    1 | x\n```\n\n### U002\n```ts\ny\n```\n### X9\n```ts\nz\n```\n';
    expect([...sheetExcerpts(md, /^U\d{3}$/)]).toEqual([['U001', '    1 | x'], ['U002', 'y']]);
  });

  it('turns union decoys into known-wrong decoys and everything else into targets', () => {
    const sheet = [
      '| ID | Case | Style | Location | Claim | [Answer] | Note |', '|---|---|---|---|---|---|---|',
      '| U001 | C01 | layered | `src/a.ts:2` | src/a.ts (presentation) imports from src/b.ts (data) (line 2) |  |  |',
      '| U002 | C01 | layered | `src/c.ts` | src/c.ts (presentation) imports from src/d.ts (data) |  |  |',
      '', '### U001', '```ts', '    2 | import { b } from "./b";', '```', '### U002', '```ts', '    1 | export {};', '```',
    ].join('\n');
    const base = { projectId: 'layered/v01', style: 'layered', variant: 'v01', kind: 'violation', ruleId: 'FF-S01', ruleName: 'dependency-direction', expectedNegative: false } as const;
    const rows: UnionKeyRow[] = [
      { ...base, itemId: 'U001', key: 'k1', source: 'both', file: 'src/a.ts' },
      { ...base, itemId: 'U002', key: 'k2', source: 'decoy', file: 'src/c.ts', expectedNegative: true, decoy: { kind: 'target-swap', perturbs: '', check: '' } },
    ];
    const l = unionItems(sheet, rows, '| Style | Rule | Source | Constraint |\n|---|---|---|---|\n| Layered | Layers (FF-S01) | Fowler | Down only |\n');
    expect(l.key.map((k) => [k.origin, k.truth, k.decoyKind])).toEqual([['union', undefined, undefined], ['decoy', 'no', 'union-target-swap']]);
    expect(l.items[0]?.styleDefinition).toBe('- Layers: Down only (Fowler)');
  });

  it('cuts external excerpts from the checkout, strips rule ids and comments, and excludes unreadable files', () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, 'proj/src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'proj/src/a.ts'), '// VIOLATION FF-S01 here\nimport { b } from "./b";\nexport const a = b;\n');
    const csv = [
      'row,project,style,ruleId,file,line,target,message',
      '1,proj,layered,FF-S01,src/a.ts,2,src/b.ts,"src/a.ts imports, against FF-S01, src/b.ts"',
      '2,proj,layered,FF-S01,src/missing.ts,1,,"gone"',
    ].join('\n');
    const l = externalItems(csv, root, '');
    expect(l.excluded).toEqual([{ sourceId: 'ext-2', reason: 'source not readable: proj/src/missing.ts' }]);
    expect(l.items[0]?.claim).toBe('src/a.ts imports, against , src/b.ts (line 2)');
    expect(l.items[0]?.excerpt).not.toMatch(/VIOLATION|FF-S01/);
    expect(l.key[0]).toMatchObject({ origin: 'external', sourceId: 'ext-1', rule: 'FF-S01', project: 'proj' });
  });

  it('assembles a seeded, deduplicated, opaque-id set and a separate key', () => {
    const it = (claim: string): Loaded['items'][number] => ({ key: claim, style: 's', styleDefinition: 'd', file: 'f.ts', claim, excerpt: '1 | x' });
    const a: Loaded = { items: [it('a'), it('b'), it('a')], key: ['a', 'b', 'a'].map((k, i) => ({ key: k, origin: 'wild', sourceId: `W${String(i)}`, project: 'p', rule: 'r' })), excluded: [] };
    const one = assemble([a], 7);
    const two = assemble([a], 7);
    expect(one).toEqual(two);
    expect(one.set.items.map((i) => i.id)).toEqual(['P001', 'P002']);
    expect(one.key.excluded).toEqual([{ sourceId: 'W2', reason: 'duplicate of an earlier item' }]);
    expect(JSON.stringify(one.set)).not.toContain('"origin"');
  });
});

describe('blinding', () => {
  const item = { key: 'k', style: 'layered', styleDefinition: '- Layers: down only', file: 'src/a.ts', claim: 'src/a.ts (ui) imports from src/b.ts (data) (line 2)', excerpt: '    2 | import { b } from "./b";' };
  const order = ['yes', 'no', 'uncertain'] as const;

  it('passes a clean prompt', () => {
    expect(blindingProblems(renderPanelPrompt(item, order))).toEqual([]);
  });

  it.each([
    [{ claim: 'FF-S01: src/a.ts imports src/b.ts' }, 'rule id'],
    [{ claim: 'Violation in src/a.ts' }, 'verdict wording (violation)'],
    [{ claim: 'critical blocking finding' }, 'verdict wording (severity/tier)'],
    [{ claim: 'src/a.ts breaks dependency-direction' }, 'template name dependency-direction'],
    [{ claim: 'decoy: src/a.ts imports src/b.ts' }, 'source wording'],
    [{ excerpt: '    2 | import { b } from "./b"; // VIOLATION (layer skip)' }, 'unscrubbed fixture comment in the excerpt'],
  ])('flags %j', (patch, problem) => {
    expect(blindingProblems(renderPanelPrompt({ ...item, ...patch }, order))).toContain(problem);
  });

  it('withholds a leaking item from every rater and never calls for it', async () => {
    const set: PanelSet = { schemaVersion: 1, seed: 1, items: [{ id: 'P001', ...item }, { id: 'P002', ...item, key: 'k2', claim: 'FF-S01 leak' }] };
    const calls: string[] = [];
    const r = rater('google', { id: 'fake', model: 'm', call: (req) => { calls.push(req.prompt); return Promise.resolve({ text: '{"choice":"A","reason":"r"}', servedModel: 'm' }); } });
    const out = await runPanel(set, [r], { seed: 1, cassetteRoot: tmp(), mode: 'record' });
    expect(out.withheld).toEqual([{ id: 'P002', problems: ['rule id'] }]);
    expect(Object.keys(out.labels['google:m'] ?? {})).toEqual(['P001']);
    expect(calls.every((c) => !c.includes('FF-S01'))).toBe(true);
  });
});

describe('adapters', () => {
  const req = { system: 'sys', prompt: 'p', temperature: 0 };

  it('OpenAI: no tools, strict shared schema, key only in the header, scrubbed from errors', async () => {
    const body = openAiBody('gpt-x', req);
    expect(body).not.toHaveProperty('tools');
    expect(body).toMatchObject({ response_format: { type: 'json_schema', json_schema: { strict: true, schema: { required: ['choice', 'reason'], additionalProperties: false } } } });
    const seen: { headers: Record<string, string>; body: string }[] = [];
    const ok: FetchLike = (_u, init) => { seen.push(init); return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ model: 'gpt-x-2026', choices: [{ message: { content: '{"choice":"A","reason":"r"}' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } })) }); };
    const p = openAiProvider('gpt-x', { OPENAI_API_KEY: 'sk-secret-123456' }, ok);
    await expect(p.call(req)).resolves.toEqual({ text: '{"choice":"A","reason":"r"}', servedModel: 'gpt-x-2026', inputTokens: 5, outputTokens: 3 });
    expect(seen[0]?.headers.authorization).toBe('Bearer sk-secret-123456');
    expect(seen[0]?.body).not.toContain('sk-secret');
    const echo: FetchLike = () => Promise.resolve({ status: 500, text: () => Promise.resolve('bad key sk-secret-123456') });
    await expect(openAiProvider('gpt-x', { OPENAI_API_KEY: 'sk-secret-123456' }, echo).call(req)).rejects.toMatchObject({ kind: 'retry', message: expect.not.stringContaining('sk-secret') as unknown });
  });

  it('OpenAI: a missing key, 401 and 429 stop; a tool call is a retryable failure', async () => {
    expect(() => openAiProvider('m', {})).toThrow(ProviderError);
    const st = (status: number, text = '{}'): FetchLike => () => Promise.resolve({ status, text: () => Promise.resolve(text) });
    await expect(openAiProvider('m', { OPENAI_API_KEY: 'k' }, st(401)).call(req)).rejects.toMatchObject({ code: 'LLM_AUTH', kind: 'stop' });
    await expect(openAiProvider('m', { OPENAI_API_KEY: 'k' }, st(429)).call(req)).rejects.toMatchObject({ code: 'LLM_USAGE_LIMIT', kind: 'stop' });
    const tool = JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 't' }] } }] });
    await expect(openAiProvider('m', { OPENAI_API_KEY: 'k' }, st(200, tool)).call(req)).rejects.toMatchObject({ code: 'LABEL_TOOL_USE', kind: 'retry' });
  });

  it('Claude: sends the shared schema through the judge route and reads structured_output; another model is refused', async () => {
    const envelope = (model: string): string => JSON.stringify({ is_error: false, model, modelUsage: { [model]: { inputTokens: 9, outputTokens: 4 } }, result: '', structured_output: { choice: 'B', reason: 'r' } });
    const calls: unknown[] = [];
    const inner = (model: string): LLMProvider => ({
      name: 'claude-cli', describe: () => ({ provider: 'claude-cli', model: 'x' }),
      evaluate: (prompt, options, call) => { calls.push({ prompt, options, call }); return Promise.resolve(DomainResult.ok({ content: envelope(model), model, usage: { inputTokens: 9, outputTokens: 4 }, usedOptions: {}, ignoredOptions: [] })); },
    });
    const p = claudeCliProvider(inner('claude-x'), 'claude-x');
    await expect(p.call(req)).resolves.toMatchObject({ text: '{"choice":"B","reason":"r"}', servedModel: 'claude-x' });
    expect(calls[0]).toMatchObject({ prompt: 'p', call: { systemPrompt: 'sys', responseSchema: expect.stringContaining('"choice"') as unknown } });
    await expect(claudeCliProvider(inner('claude-other'), 'claude-x').call(req)).rejects.toMatchObject({ code: 'LLM_MODEL_MISMATCH' });
    const failing: LLMProvider = { name: 'c', describe: () => ({ provider: 'claude-cli', model: 'x' }), evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'no' }])) };
    await expect(claudeCliProvider(failing, 'claude-x').call(req)).rejects.toMatchObject({ kind: 'stop' });
  });

  it('fake: deterministic, answers through the option letters, keys on the item not the option order', async () => {
    const it = { key: 'k', style: 's', styleDefinition: 'd', file: 'f.ts', claim: 'c', excerpt: '1 | x' };
    const p0 = renderPanelPrompt(it, ['yes', 'no', 'uncertain']);
    const p1 = renderPanelPrompt(it, ['no', 'uncertain', 'yes']);
    expect(optionsOfPrompt(p1)).toEqual(['no', 'uncertain', 'yes']);
    expect(claimOfPrompt(p0)).toBe(claimOfPrompt(p1));
    const f = fakeProvider({ vendor: 'google', model: 'f', accuracy: 1, uncertainShare: 0, runNoise: 0, invalidRate: 0 }, () => 'yes');
    await expect(f.call({ system: '', prompt: p0, temperature: 0 })).resolves.toMatchObject({ text: expect.stringContaining('"A"') as unknown });
    await expect(f.call({ system: '', prompt: p1, temperature: 0 })).resolves.toMatchObject({ text: expect.stringContaining('"C"') as unknown });
  });
});

describe('statistics', () => {
  it("Krippendorff's α (nominal) matches a hand computation and handles missing values", () => {
    // o_aa 2, o_ab = o_ba = 1, o_bb 4; n_a 3, n_b 5, n 8: α = 1 - 7·2 / (2·3·5) = 0.5333…
    expect(krippendorffAlphaNominal([['a', 'a'], ['a', 'b'], ['b', 'b'], ['b', 'b']])).toBeCloseTo(1 - 14 / 30, 10);
    expect(krippendorffAlphaNominal([['a', 'a'], ['b', 'b'], ['a'], []])).toBe(1);
    expect(krippendorffAlphaNominal([['a', 'a'], ['a', 'a']])).toBeNull();
    expect(krippendorffAlphaNominal([['a']])).toBeNull();
  });

  it("Fleiss' κ uses only items every rater answered", () => {
    const L: Record<string, Record<string, 'yes' | 'no'>> = { r1: { i1: 'yes', i2: 'no', i3: 'yes' }, r2: { i1: 'yes', i2: 'yes' } };
    const f = fleissOver(['i1', 'i2', 'i3'], ['r1', 'r2'], (r, id) => L[r]?.[id], true);
    expect(f.items).toBe(2);
    expect(f.kappa).toBeCloseTo(fleissKappa([[2, 0], [1, 1]]), 10);
  });

  /** A key with `nc` known-correct and `nw` known-wrong decoys and `nt` targets; raters answer by function. */
  function scenario(nc: number, nw: number, nt: number, answer: Record<string, (truth: string | undefined, i: number) => string>, vendors: Record<string, string>): { key: PanelKeyFile; run: PanelLabels } {
    const rows: PanelKeyFile['rows'][number][] = [];
    for (let i = 0; i < nc; i += 1) rows.push({ id: `C${String(i)}`, key: `c${String(i)}`, origin: 'decoy', sourceId: 'x', project: 'p', rule: 'r', truth: 'yes' });
    for (let i = 0; i < nw; i += 1) rows.push({ id: `W${String(i)}`, key: `w${String(i)}`, origin: 'decoy', sourceId: 'x', project: 'p', rule: 'r', truth: 'no' });
    for (let i = 0; i < nt; i += 1) rows.push({ id: `T${String(i)}`, key: `t${String(i)}`, origin: 'wild', sourceId: 'x', project: 'p', rule: 'r' });
    const labels: Record<string, Record<string, PanelLabels['labels'][string][string]>> = {};
    for (const [name, f] of Object.entries(answer)) {
      labels[name] = Object.fromEntries(rows.map((r, i) => [r.id, { label: f(r.truth, i) as 'yes', agreement: 'agree' as const, runs: [] }]));
    }
    const usage = { calls: 0, fromCassette: 0, inputTokens: 0, outputTokens: 0 };
    return {
      key: { schemaVersion: 1, seed: 1, rows, excluded: [] },
      run: { schemaVersion: 1, seed: 1, raters: Object.keys(answer).map((n) => ({ name: n, vendor: vendors[n] ?? n, provider: 'fake', model: n, usage })), labels, withheld: [] },
    };
  }
  const perfect = (truth: string | undefined, i: number): string => truth ?? (i % 2 === 0 ? 'yes' : 'no');

  it('two qualified vendors that agree make the targets authoritative', () => {
    const { key, run } = scenario(10, 10, 6, { a: perfect, b: perfect, c: () => 'yes' }, { a: 'google', b: 'openai', c: 'anthropic' });
    const r = panelReport(key, run);
    expect(r.qualifiedVendors).toEqual(['a', 'b']);
    expect(r.accuracy.find((x) => x.rater === 'c')?.reasons).toEqual([expect.stringContaining('decoy accuracy 0.500'), expect.stringContaining('known-wrong accuracy 0.000')]);
    expect(r.verdict).toBe('authoritative');
    expect(r.targetSummary).toEqual([{ origin: 'wild', n: 6, yes: 3, no: 3, unresolved: 0, unanimous: 6 }]);
    expect(r.items.find((i) => i.id === 'T1')).toMatchObject({ majority: 'no', confidence: 2 / 3, qualifiedMajority: 'no', authoritative: true });
  });

  it('an always-yes rater with high overall accuracy still fails on the known-wrong class', () => {
    // 18 known-correct + 2 known-wrong would give always-yes 0.90 overall; the class bar stops it.
    const { key, run } = scenario(18, 10, 0, { y: () => 'yes' }, { y: 'google' });
    const r = panelReport(key, run);
    expect(r.accuracy[0]?.qualified).toBe(false);
    expect(r.accuracy[0]?.reasons.join()).toContain('known-wrong accuracy 0.000');
  });

  it('too few decoys means no panel, whatever the raters do', () => {
    const { key, run } = scenario(5, 5, 4, { a: perfect, b: perfect }, { a: 'google', b: 'openai' });
    const r = panelReport(key, run);
    expect(r.designOk).toBe(false);
    expect(r.verdict).toBe('no-panel');
    expect(r.items.every((i) => !i.authoritative)).toBe(true);
  });

  it('two raters of one vendor count once', () => {
    const { key, run } = scenario(10, 10, 4, { a1: perfect, a2: perfect }, { a1: 'google', a2: 'google' });
    const r = panelReport(key, run);
    expect(r.qualifiedVendors).toEqual(['a1']);
    expect(r.verdict).toBe('no-panel');
  });

  it('a split between qualified vendors or an `uncertain` majority is unresolved; low panel κ makes it descriptive only', () => {
    const { key, run } = scenario(10, 10, 6, { a: perfect, b: (t, i) => t ?? (i % 3 === 0 ? 'uncertain' : 'yes') }, { a: 'google', b: 'openai' });
    const r = panelReport(key, run);
    expect(r.verdict).toBe('descriptive-only');
    expect(r.items.filter((i) => i.truth === undefined && i.authoritative).every((i) => i.qualifiedMajority === 'yes')).toBe(true);
    expect(r.items.find((i) => i.id === 'T1')?.authoritative).toBe(false);
  });

  it('human labels enter the pairwise table and the human-vs-panel table, never the majority', () => {
    const { key, run } = scenario(10, 10, 4, { a: perfect, b: perfect }, { a: 'google', b: 'openai' });
    const h = new Map([['human:x', new Map([['T0', 'yes'], ['T1', 'yes']])]]);
    const r = panelReport(key, run, h);
    expect(r.pairs.some((p) => p.b === 'human:x')).toBe(true);
    expect(r.humanVsPanel[0]?.binary).toMatchObject({ n: 2, observed: 0.5 });
    expect(Object.keys(r.items[0]?.labels ?? {})).toEqual(['a', 'b']);
    const md = renderPanelReport(r, 't');
    for (const s of ['## 1. Rater accuracy', '## 2. Pairwise', '## 3. Multi-rater', '## 4. Panel labels', 'Human labels against', '## 5. Per item', '## 6. Calls']) expect(md).toContain(s);
  });

  it('freezes the rule constants quoted in the doc', () => {
    expect(AUTHORITY_RULE).toEqual({
      id: 'panel-authority-v1', minDecoys: 20, minDecoysPerClass: 10, minDecoyAccuracy: 0.85, minClassAccuracy: 0.7,
      minValidShare: 0.9, minQualifiedVendors: 2, minAgreeingVendors: 2, minPanelKappa: 0.6,
    });
    const doc = fs.readFileSync(path.join(REPO, 'Docs/v1.3/model-panel.md'), 'utf8');
    expect(doc).toContain('panel-authority-v1');
    for (const v of ['0.85', '0.70', '0.90', '0.60']) expect(doc).toContain(v);
  });
});

describe('panel run', () => {
  it('records through cassettes, re-asks an unparsable answer, and replays identically without calling', async () => {
    const set: PanelSet = {
      schemaVersion: 1, seed: 3,
      items: ['a', 'b', 'c'].map((c, i) => ({ id: `P00${String(i + 1)}`, key: c, style: 's', styleDefinition: 'd', file: `${c}.ts`, claim: `claim ${c}`, excerpt: '1 | x' })),
    };
    const root = tmp();
    const r = fakeRater({ ...(DRY_RUN_PROFILES[0] ?? DRY_RUN_PROFILES[1]!), invalidRate: 1 }, () => 'yes');
    const rec = await runPanel(set, [r], { seed: 3, cassetteRoot: root, mode: 'record' });
    const runs = Object.values(rec.labels[r.name] ?? {}).flatMap((x) => x.runs);
    expect(runs.every((x) => x.reasked && x.label !== null)).toBe(true);
    expect(rec.raters[0]?.usage.calls).toBe(12);
    const never = { ...r, provider: { ...r.provider, call: () => Promise.reject(new Error('called')) } };
    const rep = await runPanel(set, [never], { seed: 3, cassetteRoot: root, mode: 'replay' });
    expect(rep.labels).toEqual(rec.labels);
    expect(rep.raters[0]?.usage.fromCassette).toBe(12);
  });

  it('a stop error propagates and stores nothing for that call', async () => {
    const set: PanelSet = { schemaVersion: 1, seed: 3, items: [{ id: 'P001', key: 'a', style: 's', styleDefinition: 'd', file: 'a.ts', claim: 'c', excerpt: '1 | x' }] };
    const root = tmp();
    const r = rater('openai', { id: 'openai-api', model: 'm', call: () => Promise.reject(new ProviderError('LLM_USAGE_LIMIT', 'quota', 'stop')) });
    await expect(runPanel(set, [r], { seed: 3, cassetteRoot: root, mode: 'record' })).rejects.toMatchObject({ code: 'LLM_USAGE_LIMIT' });
    expect(fs.readdirSync(root).flatMap((d) => fs.readdirSync(path.join(root, d)))).toEqual([]);
  });
});

describe('dry run', () => {
  it('builds 40 items, runs three fakes, replays identically and writes every table', async () => {
    const out = tmp();
    const lines: string[] = [];
    const code = await panelMain(['dry-run', '--out-dir', out], REPO, { env: {}, out: (t) => lines.push(t), err: (t) => lines.push(t) });
    expect(code).toBe(0);
    expect(lines.join('')).toContain('40 items (20 targets, 10 known-correct, 10 known-wrong decoys');
    expect(lines.join('')).toContain('replay identical: true');
    const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) as { verdict: string; withheld: unknown[]; qualifiedVendors: string[] };
    expect(report.withheld).toEqual([]);
    expect(report.verdict).toBe('authoritative');
    expect(report.qualifiedVendors).toEqual(['google:fake-gemini', 'openai:fake-gpt']);
    const committed = path.join(REPO, 'results/v1.3-panel/dry-run/report.md');
    expect(fs.readFileSync(path.join(out, 'report.md'), 'utf8')).toBe(fs.readFileSync(committed, 'utf8'));
    const set = fs.readFileSync(path.join(out, 'panel-set.json'), 'utf8');
    expect(set).not.toMatch(/FF-[A-Z]+\d+|"truth"|"origin"/);
  }, 60_000);
});
