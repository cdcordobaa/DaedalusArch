/**
 * POST-HOC diagnostic (written after `cheap-semantics-v2-eval.ts` had run; not part of the frozen v2 harness).
 * DEVELOPMENT SET. Why the clone proxy flags no AP-DUP-RULE2 seed on the E1 copies.
 *
 * For each ok AP-DUP-RULE2 seed: does the clones proxy emit a SAME_LOGIC_AS edge between the copied rule (the second
 * service, the seed's file) and the original (the first service's file)? With which clone type, and is the pair
 * cross-component (the condition under which the proxy flags)? And does the rule fragment pass the proxy's density
 * filter (a value comparison or numeric arithmetic, `densityOf`)?
 *
 * Usage: npx tsx scripts/v1.3/cheap-v2-clone-diagnostic.ts --seed <work> [--out results/v1.3-cheap-semantics/duprule-v2]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { extractAndEnrich } from '../../src/apg-enrich/cheap/index.js';
import { densityOf } from '../../src/apg-enrich/cheap/behaviour.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import { paramRuleAt } from '../lib/mutation/antipatterns/common.js';
import type { V2Row } from './judge-catch-v2-seed.js';

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const arg = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const seedDir = path.resolve(arg('--seed') ?? '');
  const out = path.resolve(arg('--out') ?? 'results/v1.3-cheap-semantics/duprule-v2');
  const rows = (JSON.parse(fs.readFileSync(path.join(seedDir, 'seed-manifest.json'), 'utf8')) as { rows: V2Row[] }).rows.filter((r) => r.status === 'ok' && r.role === 'seed');
  const res: Record<string, unknown>[] = [];
  for (const row of rows) {
    const specPath = path.resolve(repoRoot, row.specPath);
    const parsed = await parseSpec({ specFilePath: specPath });
    if (!parsed.success) throw new Error('spec');
    const dir = fs.realpathSync(path.join(seedDir, row.copyDir));
    const r = await extractAndEnrich(dir, { layerModel: parsed.data.layerModel, extractorOptions: { excludePatterns: specExcludePathsFromYaml(fs.readFileSync(specPath, 'utf8')) } });
    const s1 = row.site.detail.sourceFile ?? '';
    const s2 = row.site.filePath;
    const edges = r.enrichment.edges.filter((e) => e.proxy === 'clones' && e.evidence.some((x) => x.file === s1) && e.evidence.some((x) => x.file === s2));
    const project = new Project({ tsConfigFilePath: path.join(dir, 'tsconfig.json') });
    const rule = paramRuleAt(project.getSourceFile(path.join(dir, s1)), row.site.detail.sourceClass ?? '', row.site.detail.method ?? '', Number(row.site.detail.guard ?? '-1'));
    const density = rule === undefined ? null : densityOf(rule.rule.statement);
    res.push({
      rowId: row.rowId, stratum: row.stratum, rule: rule?.rule.statement.getText().split('\n')[0] ?? null,
      ruleDensity: density, sameLogicEdges: edges.map((e) => ({ cloneType: e.properties['cloneType'], granularity: e.properties['granularity'], crossComponent: e.properties['crossComponent'], components: e.properties['components'], similarity: e.score })),
    });
    process.stderr.write(`${row.rowId}: edges ${String(edges.length)}\n`);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'clone-diagnostic.posthoc.json'), `${JSON.stringify(res, null, 1)}\n`);
  for (const x of res) process.stdout.write(`${JSON.stringify(x)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('cheap-v2-clone-diagnostic.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
