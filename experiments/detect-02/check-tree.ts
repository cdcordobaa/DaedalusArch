/** DETECT-02: run the rules on one tree and print the findings (zero calls). `npx tsx experiments/detect-02/check-tree.ts <tree> [--spec <yaml>] [--json]` */
import { loadRules, runTree } from './lib/graph.js';
const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const tree = argv[0]!;
runTree(tree, loadRules(), { spec: arg('spec'), style: arg('style'), withApg: !argv.includes('--no-apg') }).then((r) => {
  if (argv.includes('--json')) { process.stdout.write(`${JSON.stringify({ findings: r.findings, stats: r.stats, rootSource: r.facts.rootSource, roots: r.facts.roots, ms: r.ms }, null, 1)}\n`); return; }
  process.stdout.write(`roots(${r.facts.rootSource}): ${r.facts.roots.map((x) => x.name).join(', ')} | ${r.ms} ms | ${JSON.stringify(r.stats)}\n`);
  for (const f of r.findings) process.stdout.write(`${f.status === 'violation' ? '' : `[${f.status}] `}${f.rule} ${f.file}:${f.line} ${f.subject} :: ${f.evidence}${f.path.length ? `  <${f.path.join(' > ')}>` : ''}\n`);
}, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`); process.exitCode = 1; });
