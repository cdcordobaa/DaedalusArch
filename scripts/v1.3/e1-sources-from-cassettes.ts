/**
 * Rebuilds E1 cell sources from the judge cassettes (`experiments/e1-grid/cassettes`) for reading only. Entry file:
 * no exports. Every judge prompt quotes the files of its unit between `=====SOURCE-BEGIN <path>=====` and
 * `=====SOURCE-END=====`; this writes each quoted file to `<out>/<projectId>/<path>`. Files no judge saw (pure
 * re-export barrels, for example) are absent. Two prompts quoting the same file differently is an error.
 *
 * Usage (repository root): npx tsx scripts/v1.3/e1-sources-from-cassettes.ts --out <dir outside the repo>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const out = oi >= 0 ? argv[oi + 1] : undefined;
if (out === undefined) throw new Error('--out is required');
const CASSETTES = resolve('experiments/e1-grid/cassettes');
const SOURCE = /=====SOURCE-BEGIN (\S+)=====\n([\s\S]*?)=====SOURCE-END=====/g;

const files = new Map<string, string>();
for (const shard of readdirSync(CASSETTES).sort()) {
  for (const f of readdirSync(join(CASSETTES, shard)).sort()) {
    const c = JSON.parse(readFileSync(join(CASSETTES, shard, f), 'utf8')) as { projectId?: string; prompt?: string };
    if (c.projectId === undefined || c.prompt === undefined) continue;
    for (const m of c.prompt.matchAll(SOURCE)) {
      const key = join(c.projectId, m[1] ?? '');
      const body = m[2] ?? '';
      const seen = files.get(key);
      if (seen !== undefined && seen !== body) throw new Error(`${key}: two cassettes quote different text`);
      files.set(key, body);
    }
  }
}
for (const [key, body] of files) {
  const p = join(resolve(out), key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}
console.log(`${String(files.size)} files from ${String(new Set([...files.keys()].map((k) => k.split('/').slice(0, 4).join('/'))).size)} cells`);
