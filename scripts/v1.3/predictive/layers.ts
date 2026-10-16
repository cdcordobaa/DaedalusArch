/**
 * v1.3-validity-predictive: layer name per file (for the exact-layer matched-pairs sensitivity).
 *
 *   node --import tsx scripts/v1.3/predictive/layers.ts
 *
 * Applies the tool's own layer annotator (directories, then file patterns) to the paths of every
 * exposure/<id>.<label>.csv. Decorator matches need the parsed class decorators, which this path-only pass does not
 * have: a file the tool reported as mapped that the path pass leaves unmapped gets the layer `decorator`.
 * Writes exposure/<id>.<label>.layers.csv.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import { parseSpec } from '../../../src/spec-parser/index.js';
import type { APGNode } from '../../../src/shared/types/apg.js';

const OUT = path.join(process.cwd(), 'results/v1.3-validity-predictive');

async function main(): Promise<void> {
  for (const f of fs.readdirSync(path.join(OUT, 'exposure')).filter((x) => /\.(T|T_alt)\.csv$/.test(x)).sort()) {
    const id = f.replace(/\.(T|T_alt)\.csv$/, '');
    const spec = await parseSpec({ specFilePath: path.join(OUT, 'specs', `${id}.yaml`) });
    if (!spec.success) throw new Error(`${id}: spec does not parse`);
    const rows = fs.readFileSync(path.join(OUT, 'exposure', f), 'utf8').trim().split('\n').slice(1).map((l) => {
      const m = /^"((?:[^"\\]|\\.)*)",(\d)/.exec(l);
      if (m === null) throw new Error(`bad row ${l}`);
      return { file: JSON.parse(`"${m[1]!}"`) as string, mapped: m[2] === '1' };
    });
    const nodes = rows.map((r, i) => ({ id: `f${String(i)}`, type: 'File', filePath: r.file, name: path.basename(r.file), decorators: [], properties: {} }) as unknown as APGNode);
    const ann = annotateNodes(nodes, spec.data.layerModel).annotations;
    const out = ['file,layer', ...rows.map((r, i) => {
      const l = ann.get(`f${String(i)}`)?.layer ?? null;
      return `${JSON.stringify(r.file)},${l ?? (r.mapped ? 'decorator' : '')}`;
    })];
    fs.writeFileSync(path.join(OUT, 'exposure', f.replace(/\.csv$/, '.layers.csv')), out.join('\n') + '\n');
  }
}

main().catch((err: unknown) => { process.stderr.write(`${String(err)}\n`); process.exit(2); });
