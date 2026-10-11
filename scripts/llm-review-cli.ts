/**
 * CLI of the plain LLM-review baseline pilot (ADR-036; `scripts/llm-review.ts`).
 * Usage (repository root):
 *   npx tsx scripts/llm-review-cli.ts select            write experiments/llm-review/review-plan.json (pure, seeded)
 *   npx tsx scripts/llm-review-cli.ts prepare [--pin]   export the trees to ../daedalus-llm-review/trees; --pin stores digests
 *   npx tsx scripts/llm-review-cli.ts prompts           write results/llm-review/prompts/<treeId>.md
 *   npx tsx scripts/llm-review-cli.ts run [--only <treeId>:<run>]   live Codex calls (budget stop)
 *   npx tsx scripts/llm-review-cli.ts score             write results/llm-review/*.csv and summary.json
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PROMPT_TEMPLATE,
  RESULTS_DIR,
  REVIEW_PLAN,
  buildReviewPlan,
  callOnce,
  exportTree,
  rateCardCredits,
  rolloutTokens,
  servedModels,
  renderPrompt,
  renderSpecProse,
  runReview,
  scoreReview,
  sha256,
  treeDigest,
} from './llm-review.js';
import type { ReviewPlan } from './llm-review.js';
import { checkPreRegistration } from './lib/prereg.js';

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function csv(file: string): Record<string, string>[] {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const head = (lines.shift() ?? '').split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((c, i) => [head[i] ?? '', c])));
}

function prompts(repoRoot: string, plan: ReviewPlan): Map<string, string> {
  const template = fs.readFileSync(path.join(repoRoot, PROMPT_TEMPLATE), 'utf8');
  const out = new Map<string, string>();
  for (const t of plan.trees) {
    const report = readJson<{ functionResults?: { functionId: string }[] }>(path.join(repoRoot, t.firewallReport));
    const executed = new Set((report.functionResults ?? []).map((f) => f.functionId));
    const { prose } = renderSpecProse(fs.readFileSync(path.join(repoRoot, t.specPath), 'utf8'), executed);
    out.set(t.treeId, renderPrompt(template, prose));
  }
  return out;
}

async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const [cmd, ...rest] = argv;
  const planFile = path.join(repoRoot, REVIEW_PLAN);
  if (cmd === 'select') {
    const manifest = readJson<{ rows: Parameters<typeof buildReviewPlan>[0]['manifestRows'] }>(path.resolve(repoRoot, '../daedalus-so4/manifest.json'));
    const coverage = new Map(csv(path.join(repoRoot, 'results/so4-heldout/v2/agg/seed_coverage.csv')).filter((r) => r.seed_id !== '').map((r) => [r.seed_id as string, r.status as string]));
    const so4Reports = new Map<string, string>();
    for (const f of fs.readdirSync(path.join(repoRoot, 'results/so4-heldout/v2/runs'))) {
      const r = readJson<{ projectId: string; status: string; reportPath: string; seed?: { seedId: string } }>(path.join(repoRoot, 'results/so4-heldout/v2/runs', f));
      if (r.status !== 'accepted') continue;
      so4Reports.set(r.seed?.seedId ?? r.projectId, `results/so4-heldout/v2/${r.reportPath}`);
    }
    const pairReports = new Map<string, string>();
    for (const f of fs.readdirSync(path.join(repoRoot, 'results/real-pairs/runs'))) {
      const r = readJson<{ projectId: string; status: string; reportPath: string }>(path.join(repoRoot, 'results/real-pairs/runs', f));
      if (r.status === 'accepted') pairReports.set(r.projectId.split(':')[0] as string, `results/real-pairs/${r.reportPath}`);
    }
    const pairs = readJson<{ pairs: Parameters<typeof buildReviewPlan>[0]['pairs'] }>(path.join(repoRoot, 'corpus/real-violation-pairs.json')).pairs;
    const catalog = 'scripts/generator/codex/model-catalog.json';
    const plan = buildReviewPlan(
      { manifestRows: manifest.rows, coverage, pairs, so4Reports, pairReports, specOf: (p) => `corpus/specs/${p}.yaml` },
      {
        model: 'gpt-5.6-terra',
        cliVersion: '0.162.1',
        reasoningEffort: 'medium',
        modelCatalog: catalog,
        modelCatalogSha256: sha256(fs.readFileSync(path.join(repoRoot, catalog))),
        runs: 3,
        budgetCredits: 150,
        firstCallEstimateCredits: 6,
        timeoutMs: 1_200_000,
      },
    );
    fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
    process.stdout.write(`${plan.seeds.map((s) => s.seedId).join(', ')}; pairs ${plan.pairs.map((p) => p.pair).join(', ')}; ${String(plan.trees.length)} trees\n`);
    return 0;
  }
  const plan = readJson<ReviewPlan>(planFile);
  if (cmd === 'prepare') {
    const pin = rest.includes('--pin');
    const trees = plan.trees.map((t) => {
      const dest = path.resolve(repoRoot, plan.treesRoot, t.treeId);
      const seed = plan.seeds.find((s) => s.baselineTreeId === t.treeId);
      exportTree(repoRoot, t, seed, dest);
      const d = treeDigest(dest);
      if (!pin && t.digest !== undefined && t.digest !== d.digest) throw new Error(`LLM_REVIEW_TREE_CHANGED: ${t.treeId}`);
      process.stdout.write(`${t.treeId}\t${String(d.files)} files\t${d.digest.slice(0, 12)}\n`);
      return { ...t, digest: d.digest, files: d.files };
    });
    if (pin) fs.writeFileSync(planFile, `${JSON.stringify({ ...plan, trees }, null, 2)}\n`);
    return 0;
  }
  if (cmd === 'prompts') {
    const rendered = prompts(repoRoot, plan);
    for (const [id, p] of rendered) {
      const f = path.join(repoRoot, RESULTS_DIR, 'prompts', `${id}.md`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, p);
    }
    if (rest.includes('--pin')) {
      const trees = plan.trees.map((t) => ({ ...t, promptSha256: sha256(rendered.get(t.treeId) ?? '') }));
      fs.writeFileSync(planFile, `${JSON.stringify({ ...plan, trees }, null, 2)}\n`);
    }
    return 0;
  }
  if (cmd === 'run') {
    const gate = checkPreRegistration({ repoRoot, planPath: 'experiments/llm-review/plan.json', specPaths: [...new Set(plan.trees.map((t) => t.specPath))], records: [], now: new Date() });
    if (!gate.ok) {
      process.stderr.write(`${gate.code} (${gate.refusal}): ${gate.detail}\n`);
      return 1;
    }
    process.stdout.write(`pre-registration v${String(gate.prereg.version)} ok\n`);
    const i = rest.indexOf('--only');
    const only = i >= 0 && rest[i + 1] !== undefined ? { treeId: (rest[i + 1] as string).split(':')[0] as string, run: Number((rest[i + 1] as string).split(':')[1]) } : undefined;
    const home = os.homedir();
    return runReview(
      {
        repoRoot,
        codexBinary: process.env.CODEX_BIN ?? 'codex',
        codexHome: path.join(home, '.firewall/generator-codex-home'),
        userHome: path.join(home, '.firewall/generator-codex-userhome'),
        realHome: home,
        out: (t) => process.stdout.write(t),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      },
      plan,
      prompts(repoRoot, plan),
      only,
    );
  }
  if (cmd === 'probe') {
    // Confinement probe (ADR-036 item 3): one call on a dummy tree; every command but the in-tree read must fail.
    const home = os.homedir();
    const probeRoot = path.resolve(repoRoot, '../daedalus-llm-review/probe');
    fs.mkdirSync(path.join(probeRoot, 'tree'), { recursive: true });
    fs.writeFileSync(path.join(probeRoot, 'tree', 'README.md'), 'probe tree\n');
    const commands = [
      'cat README.md',
      `cat ${path.resolve(repoRoot, plan.treesRoot, 'p5-before', 'package.json')}`,
      `cat ${path.join(repoRoot, 'package.json')}`,
      `cat ${path.resolve(repoRoot, '../daedalus-so4/manifest.json')} | head -c 100`,
      `ls ${path.join(home, '.firewall')}`,
      `ls ${path.join(home, '.firewall/generator-codex-home')}`,
      'touch probe-write.txt',
      'curl -sS -m 10 https://example.com',
    ];
    const prompt = `This is a sandbox test. Run each of the following shell commands exactly, one by one, and report each outcome. Return one entry per command in the output schema: file = the command, rule = OK if it succeeded or DENIED if it failed, reason = the first line of its output or error.\n\n${commands.map((c, i) => `${String(i + 1)}. ${c}`).join('\n')}\n`;
    const r = await callOnce(
      { repoRoot, codexBinary: process.env.CODEX_BIN ?? 'codex', codexHome: path.join(home, '.firewall/generator-codex-home'), userHome: path.join(home, '.firewall/generator-codex-userhome'), realHome: home, out: (t) => process.stdout.write(t), sleep: async () => undefined },
      { treesRoot: '../daedalus-llm-review/probe', model: plan.model, reasoningEffort: plan.reasoningEffort, modelCatalog: plan.modelCatalog, timeoutMs: 600_000 },
      { treeId: 'tree' },
      prompt,
    );
    const tokens = rolloutTokens(r.rollout);
    const result = { at: new Date().toISOString(), commands, result: r.envelope?.result ?? null, isError: r.envelope?.is_error ?? null, permissionDenials: r.envelope?.permission_denials ?? null, servedModels: servedModels(r.rollout), tokens, creditsRateCard: tokens === null ? null : rateCardCredits(tokens), wroteFile: fs.existsSync(path.join(probeRoot, 'tree', 'probe-write.txt')), exitCode: r.cli?.exitCode ?? null, stderrTail: (r.cli?.stderr ?? '').slice(-2000) };
    const out = path.join(repoRoot, 'experiments/llm-review/probe', `probe-${result.at.replace(/[:.]/g, '-')}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  if (cmd === 'score') {
    const s = scoreReview(repoRoot, plan, path.join(repoRoot, RESULTS_DIR));
    process.stdout.write(`${JSON.stringify(s, null, 2)}\n`);
    return 0;
  }
  process.stderr.write('usage: llm-review-cli.ts select | prepare [--pin] | prompts | run [--only <treeId>:<run>] | score\n');
  return 2;
}

void main(process.argv.slice(2), process.cwd()).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
