/**
 * v1.3 third manifest (key writer K-G; Docs/v1.3/third-manifest.md). Entry file: no exports.
 *
 *   build   --variants <style/variant,...> | --cases <cases.json>  --out <dir> [--seed N] [--root <fixtures root>]
 *           Assembles each case's bundle from allow-listed inputs only and writes bundles.json (hashes) and the
 *           rendered prompts. No adapter is constructed.
 *   run     (same case flags) --adapter fake|gemini|agy|openai --out <dir> --cassettes <dir> [--mode record|replay]
 *           gemini: --model <id> --usd-per-mtok-in <x> --usd-per-mtok-out <y> [--max-usd 5] [--env-file .env]
 *                   [--max-output-tokens N] [--thinking low|high]
 *           agy:    --model "<agy model>" [--agy-served-model <id>] [--agy-home ~/.firewall/labeller-agy-home]
 *                   [--agy-version x.y.z] [--agy-binary agy] [--max-calls 20]
 *           openai: --model <id> --usd-per-mtok-in <x> --usd-per-mtok-out <y> [--max-usd 5]
 *   compare --a <dir> --b <dir> --out <report.md> [--label-a A] [--label-b B] [--banner text] [--mapping <file>]
 *   export-author --key <dir>/blind-key.json --out <dir>     the author manifests of those cases, same layout
 *
 * `cases.json` (new seeds, author's local run): [{ "label": "...", "style": "<style>", "project": "<dir>", "spec": "<yaml>" }].
 * Any path under `daedalus-sealed` is refused.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRng, shuffle } from '../lib/stats.js';
import { ruleTier } from '../../src/scoring-engine/rule-tiers.js';
import { materialiseVariant } from './lib/materialise.js';
import { REFERENCE_ROOT, isReferenceStyle, loadReference } from './lib/reference-model.js';
import type { LoadedReference } from './lib/reference-model.js';
import { ProviderError } from './lib/labelling/providers.js';
import {
  ADAPTER_IDS, AGY_HOME_TM_DEFAULT, Budget, GEMINI_KEY_ENV, OPENAI_KEY_ENV, TM_MAX_OUTPUT_TOKENS_DEFAULT,
  agyWriter, budgeted, callCapped, fakeWriter, geminiWriter, openAiWriter, readEnvVar,
} from './lib/third-manifest/adapters.js';
import type { AdapterId, ManifestWriter, Oracle, Perturbation } from './lib/third-manifest/adapters.js';
import { InputRefusedError, SEALED_SEGMENT, buildBundle } from './lib/third-manifest/bundle.js';
import type { Bundle, CaseInput } from './lib/third-manifest/bundle.js';
import { compareManifests, exportAuthorManifests, loadManifestDir, renderComparison } from './lib/third-manifest/compare.js';
import type { MappingRow } from './lib/third-manifest/compare.js';
import { PROMPT_SHA256, SCHEMA_SHA256 } from './lib/third-manifest/prompt.js';
import { THIRD_MANIFEST_DOC, TmCassetteStore, checkFrozenHashes, runCases } from './lib/third-manifest/run.js';

const REPO = process.cwd();
const DEFAULT_SEED = 20261016;
const DEFAULT_MAPPING = 'results/v1.3-reference/after-member-facts/blind-rule-mapping.json';

const argv = process.argv.slice(2);
const cmd = argv[0] ?? '';
function opt(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
function need(name: string): string {
  const v = opt(name);
  if (v === undefined || v === '') throw new ProviderError('TM_CONFIG', `--${name} is required`, 'stop');
  return v;
}
const num = (name: string, dflt?: number): number => {
  const v = opt(name);
  if (v === undefined) {
    if (dflt === undefined) throw new ProviderError('TM_CONFIG', `--${name} is required`, 'stop');
    return dflt;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ProviderError('TM_CONFIG', `--${name} is not a number`, 'stop');
  return n;
};
const expand = (p: string): string => p.replace(/^~(?=\/|$)/, os.homedir());

for (const a of argv) if (a.includes(SEALED_SEGMENT)) throw new InputRefusedError(`refused: argument ${a} names ${SEALED_SEGMENT}`);

interface PlannedCase extends CaseInput { readonly variantKey: string; readonly ref?: LoadedReference; readonly variant?: string }

/** The cases, shuffled with the seed and numbered case-01..; reference variants are materialised into `work`. */
function planCases(work: string): PlannedCase[] {
  const seed = num('seed', DEFAULT_SEED);
  const variants = opt('variants');
  const casesFile = opt('cases');
  if ((variants === undefined) === (casesFile === undefined)) throw new ProviderError('TM_CONFIG', 'give exactly one of --variants and --cases', 'stop');
  type Raw = { label: string; style: string; project?: string; spec?: string; ref?: LoadedReference; variant?: string };
  const raw: Raw[] = [];
  if (variants !== undefined) {
    const root = opt('root') ?? REFERENCE_ROOT;
    const refs = new Map<string, LoadedReference>();
    for (const sv of variants.split(',').map((s) => s.trim()).filter((s) => s !== '').sort()) {
      const [style, variant] = sv.split('/') as [string, string | undefined];
      if (!isReferenceStyle(style) || variant === undefined) throw new ProviderError('TM_CONFIG', `bad variant ${sv}`, 'stop');
      const ref = refs.get(style) ?? loadReference(REPO, style, root);
      refs.set(style, ref);
      raw.push({ label: variant, style, ref, variant });
    }
  } else {
    const list = JSON.parse(fs.readFileSync(path.resolve(casesFile ?? ''), 'utf8')) as { label: string; style: string; project: string; spec: string }[];
    for (const c of [...list].sort((a, b) => `${a.style}/${a.label}`.localeCompare(`${b.style}/${b.label}`))) raw.push({ label: c.label, style: c.style, project: path.resolve(c.project), spec: path.resolve(c.spec) });
  }
  const order = shuffle(raw, createRng(seed));
  return order.map((r, i) => {
    const caseId = `case-${String(i + 1).padStart(2, '0')}`;
    if (r.ref !== undefined && r.variant !== undefined) {
      const v = r.ref.variants.find((x) => x.manifest.variant === r.variant);
      if (v === undefined) throw new ProviderError('TM_CONFIG', `no variant ${r.style}/${r.variant}`, 'stop');
      // Materialised, then moved under the case id, so the variant id is in no path the writer could see.
      const m = materialiseVariant(r.ref, v, path.join(work, 'staging'));
      const projectRoot = path.join(work, caseId, 'project');
      fs.mkdirSync(path.dirname(projectRoot), { recursive: true });
      fs.renameSync(m.projectDir, projectRoot);
      return { caseId, style: r.style, specPath: r.ref.specPath, projectRoot, variantKey: r.label, ref: r.ref, variant: r.variant };
    }
    return { caseId, style: r.style, specPath: r.spec ?? '', projectRoot: r.project ?? '', variantKey: r.label };
  });
}

function writeBundles(out: string, bundles: readonly Bundle[]): void {
  fs.mkdirSync(path.join(out, 'bundles'), { recursive: true });
  for (const b of bundles) fs.writeFileSync(path.join(out, 'bundles', `${b.caseId}.prompt.md`), b.prompt);
  fs.writeFileSync(path.join(out, 'bundles.json'), `${JSON.stringify({
    promptSha256: PROMPT_SHA256, schemaSha256: SCHEMA_SHA256,
    cases: bundles.map((b) => ({ case: b.caseId, style: b.style, bundleSha256: b.bundleSha256, promptSha256: b.promptSha256, promptChars: b.prompt.length, droppedSpecKeys: b.droppedSpecKeys, inputs: b.inputs })),
  }, null, 2)}\n`);
}

function mappingRows(): MappingRow[] {
  return (JSON.parse(fs.readFileSync(path.resolve(opt('mapping') ?? DEFAULT_MAPPING), 'utf8')) as { mapping: MappingRow[] }).mapping;
}

function makeWriter(id: AdapterId, planned: readonly PlannedCase[], bundles: readonly Bundle[], fakeLog: Perturbation[]): { writer: ManifestWriter; budget?: Budget } {
  switch (id) {
    case 'fake': {
      const mapping = mappingRows();
      const oracleOf = (caseId: string): Oracle => {
        const p = planned.find((c) => c.caseId === caseId);
        const v = p?.ref?.variants.find((x) => x.manifest.variant === p.variant);
        if (p === undefined || v === undefined) throw new ProviderError('TM_FAKE', `the fake needs a reference variant for ${caseId}`, 'stop');
        const files = (bundles.find((b) => b.caseId === caseId)?.sections.files ?? []).map((f) => ({ file: f.path, layer: null }));
        return {
          findings: v.manifest.expectedFindings.map((f) => ({ ruleId: f.ruleId, file: f.file, ...(f.target !== undefined && { target: f.target }), tier: ruleTier(f.ruleId, p.style).tier, reason: f.reason })),
          files,
          aliasOf: (ruleId) => mapping.find((r) => r.ruleId === ruleId && r.styles.includes(p.style) && r.basis === 'library-alias')?.name,
        };
      };
      return { writer: fakeWriter(oracleOf, fakeLog) };
    }
    case 'gemini': {
      const envFile = opt('env-file');
      const key = (envFile !== undefined ? readEnvVar(path.resolve(envFile), GEMINI_KEY_ENV) : undefined) ?? process.env[GEMINI_KEY_ENV] ?? '';
      const maxOut = num('max-output-tokens', TM_MAX_OUTPUT_TOKENS_DEFAULT);
      const thinking = opt('thinking');
      if (thinking !== undefined && thinking !== 'low' && thinking !== 'high') throw new ProviderError('TM_CONFIG', '--thinking is low or high', 'stop');
      const budget = new Budget(num('max-usd', 5), { inPerMTok: num('usd-per-mtok-in'), outPerMTok: num('usd-per-mtok-out') }, maxOut);
      return { writer: budgeted(geminiWriter({ model: need('model'), apiKey: key, maxOutputTokens: maxOut, ...(thinking !== undefined && { thinkingLevel: thinking }) }), budget), budget };
    }
    case 'agy': {
      const served = opt('agy-served-model');
      const version = opt('agy-version');
      const binary = opt('agy-binary');
      return {
        writer: callCapped(agyWriter({
          model: need('model'), home: path.resolve(expand(opt('agy-home') ?? AGY_HOME_TM_DEFAULT)),
          ...(served !== undefined && { servedModel: served }), ...(version !== undefined && { version }), ...(binary !== undefined && { binary }),
        }), num('max-calls', 20)),
      };
    }
    case 'openai': {
      const envFile = opt('env-file');
      const key = (envFile !== undefined ? readEnvVar(path.resolve(envFile), OPENAI_KEY_ENV) : undefined) ?? process.env[OPENAI_KEY_ENV] ?? '';
      const maxOut = num('max-output-tokens', TM_MAX_OUTPUT_TOKENS_DEFAULT);
      const budget = new Budget(num('max-usd', 5), { inPerMTok: num('usd-per-mtok-in'), outPerMTok: num('usd-per-mtok-out') }, maxOut);
      return { writer: budgeted(openAiWriter(need('model'), key, maxOut), budget), budget };
    }
    default:
      throw new ProviderError('TM_CONFIG', `--adapter is one of ${ADAPTER_IDS.join(', ')}`, 'stop');
  }
}

async function main(): Promise<void> {
  if (cmd === 'compare') {
    const mapping = mappingRows();
    const a = loadManifestDir(path.resolve(need('a')), mapping);
    const b = loadManifestDir(path.resolve(need('b')), mapping);
    const c = compareManifests(a, b);
    const out = path.resolve(need('out'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, renderComparison(c, opt('label-a') ?? 'A', opt('label-b') ?? 'B', opt('banner') ?? 'Exploratory comparison; nothing is adjudicated.'));
    fs.writeFileSync(out.replace(/\.md$/, '.json'), `${JSON.stringify(c, null, 2)}\n`);
    process.stdout.write(`wrote ${path.relative(REPO, out)}\n`);
    return;
  }
  if (cmd === 'export-author') {
    const keyFile = path.resolve(need('key'));
    const key = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as Record<string, string>;
    const byCase: Record<string, string> = {};
    for (const [k, variant] of Object.entries(key)) { const [style, caseId] = k.split('/') as [string, string]; byCase[caseId] = `${style}/${variant}`; }
    const styles = [...new Set(Object.values(byCase).map((sv) => sv.split('/')[0] ?? ''))].filter(isReferenceStyle);
    exportAuthorManifests(styles.map((s) => loadReference(REPO, s, opt('root') ?? REFERENCE_ROOT)), byCase, path.resolve(need('out')));
    process.stdout.write(`wrote author manifests for ${String(Object.keys(byCase).length)} case(s)\n`);
    return;
  }
  if (cmd !== 'build' && cmd !== 'run') throw new ProviderError('TM_CONFIG', 'usage: third-manifest.ts build|run|compare|export-author ...', 'stop');
  checkFrozenHashes(fs.readFileSync(path.join(REPO, THIRD_MANIFEST_DOC), 'utf8'));
  const out = path.resolve(need('out'));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-tm-'));
  try {
    const planned = planCases(work);
    // Every bundle is built (and every input checked) before any adapter is constructed.
    const bundles = planned.map((c) => buildBundle(REPO, c));
    fs.mkdirSync(out, { recursive: true });
    writeBundles(out, bundles);
    if (cmd === 'build') {
      process.stdout.write(`built ${String(bundles.length)} bundle(s); prompt chars ${bundles.map((b) => String(b.prompt.length)).join(', ')}\n`);
      return;
    }
    const adapter = need('adapter') as AdapterId;
    const fakeLog: Perturbation[] = [];
    const { writer, budget } = makeWriter(adapter, planned, bundles, fakeLog);
    const mode = (opt('mode') ?? 'record') as 'record' | 'replay';
    const key: Record<string, string> = Object.fromEntries(planned.map((c) => [c.caseId, c.variantKey]));
    try {
      const results = await runCases(bundles, writer, {
        outDir: out, cassettes: new TmCassetteStore(path.resolve(need('cassettes')), mode), key,
        label: adapter === 'fake' ? 'dry run, not a result' : `${writer.vendor}:${writer.model}`,
      });
      process.stdout.write(`${results.map((r) => `${r.style}/${r.caseId}: ${r.status}`).join('\n')}\n`);
    } finally {
      if (budget !== undefined) fs.writeFileSync(path.join(out, 'ledger.json'), `${JSON.stringify({ maxUsd: budget.maxUsd, prices: budget.prices, spentUsd: budget.spent(), entries: budget.entries }, null, 2)}\n`);
      if (adapter === 'fake') fs.writeFileSync(path.join(out, 'fake-perturbations.json'), `${JSON.stringify(fakeLog, null, 2)}\n`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e: unknown) => {
  const code = e instanceof ProviderError || e instanceof InputRefusedError ? e.code : 'TM_ERROR';
  process.stderr.write(`${code}: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
