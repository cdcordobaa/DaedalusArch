// Development census for R-MIRROR2 (not a rule): which vendor tokens meet core terms, per tree. Zero model calls.
//   npx tsx experiments/r-mirror2-dev/census.ts [task-prefix]
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph } from '../../src/v15-instrument/index.js';
import { literalToken, nameToken } from '../../src/v15-instrument/vendor-lexicon.js';

const TF = 'experiments/trap-families';
async function main(): Promise<void> {
  const only = process.argv[2];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror2-census-'));
  for (const task of fs.readdirSync(TF).filter((d) => /^f\d+-hex-/.test(d) && (only === undefined || d.startsWith(only))).sort()) {
    const trees: [string, string][] = [['seed', path.join(TF, task, 'seed')]];
    for (const k of ['solutions', 'gaming']) { const d = path.join(TF, task, k); if (fs.existsSync(d)) for (const s of fs.readdirSync(d).sort()) trees.push([`${k}/${s}`, path.join(d, s)]); }
    for (const [name, tree] of trees) {
      const { facts } = await buildGraph(tree, { spec: path.join(TF, task, 'spec.yaml'), withApg: false, scratch });
      const vt = new Map<string, string[]>();
      for (const v of facts.vendorTerms) vt.set(v.kind === 'literal' || v.kind === 'decl' ? literalToken(v.text) : nameToken(v.text), [...(vt.get(v.kind === 'literal' || v.kind === 'decl' ? literalToken(v.text) : nameToken(v.text)) ?? []), `${v.kind}${v.ownedBy ? `/${v.ownedBy}` : ''}`]);
      const hits: string[] = [];
      for (const c of facts.coreTerms) {
        const v = vt.get(c.kind === 'literal' ? literalToken(c.text) : nameToken(c.text));
        if (v) hits.push(`${c.file}:${c.line} ${c.kind}/${c.context} ${c.symbol} '${c.text}' <- ${[...new Set(v)].join(',')}${c.set ? ` [set ${c.set}/${c.setSize}]` : ''}`);
      }
      process.stdout.write(`== ${task} ${name}: vendorTerms ${facts.vendorTerms.length}\n${[...new Set(hits)].map((h) => `   ${h}`).join('\n')}\n`);
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
}
void main();
