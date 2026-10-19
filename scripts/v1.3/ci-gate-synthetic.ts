/**
 * Accuracy of the diff-aware gate on synthetic pull requests built from the 71 reference variants
 * (lib/ci-gate-synthetic.ts). Entry file: no exports.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/ci-gate-synthetic.ts --engine lexical [--out results/v1.3-ci-gate/lexical]
 *   NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... npx tsx scripts/v1.3/ci-gate-synthetic.ts --engine neo4j
 * Options: --style <a,b>; --out <dir> (default results/v1.3-ci-gate/<engine>). Writes cases.json and report.md.
 * The neo4j engine clears the database before each ingestion: use a scratch instance.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { lexicalEngine, neo4jEngine } from '../../src/ci-gate/engines.js';
import type { GateEngine } from '../../src/ci-gate/engines.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { REFERENCE_STYLES, isReferenceStyle, loadAllReferences } from './lib/reference-model.js';
import type { ReferenceStyle } from './lib/reference-model.js';
import { renderSyntheticMarkdown, runSynthetic } from './lib/ci-gate-synthetic.js';

async function main(argv: readonly string[]): Promise<number> {
  let engineName = 'lexical';
  let styles: ReferenceStyle[] = [...REFERENCE_STYLES];
  let out: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--engine' && v !== undefined) engineName = v;
    else if (a === '--out' && v !== undefined) out = v;
    else if (a === '--style' && v !== undefined) {
      const list = v.split(',');
      if (!list.every(isReferenceStyle)) {
        process.stderr.write(`--style takes a comma list of ${REFERENCE_STYLES.join(', ')}\n`);
        return 2;
      }
      styles = list;
    } else {
      process.stderr.write(`unexpected argument ${JSON.stringify(a)}\n`);
      return 2;
    }
    i += 1;
  }
  let engine: GateEngine;
  let release: (() => void) | undefined;
  if (engineName === 'lexical') engine = lexicalEngine();
  else if (engineName === 'neo4j') {
    const uri = process.env.NEO4J_URI ?? '';
    const password = process.env.NEO4J_PASSWORD ?? '';
    if (uri === '' || password === '') {
      process.stderr.write('the neo4j engine needs NEO4J_URI and NEO4J_PASSWORD\n');
      return 2;
    }
    const lock = await acquireNeo4jLock(uri, { label: 'ci-gate synthetic run', env: process.env, onWait: (t) => { process.stderr.write(`${t}\n`); } });
    release = () => { lock.release(); };
    engine = neo4jEngine({
      neo4jUri: uri,
      neo4jUser: process.env.NEO4J_USER ?? 'neo4j',
      neo4jPassword: password,
      apgStorePath: process.env.APG_STORE_PATH ?? '.apg-store',
      makePipeline: (config) => createPipeline({ ...config, postSealRules: false }), // v1.4 U2 (BR-U2-10): sealed v1.3 figure
    });
  } else {
    process.stderr.write('--engine must be one of lexical | neo4j\n');
    return 2;
  }

  const outDir = path.resolve(out ?? path.join('results', 'v1.3-ci-gate', engineName));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-synthetic-'));
  try {
    const refs = loadAllReferences(process.cwd(), styles);
    const started = Date.now();
    const cases = await runSynthetic(refs, engine, work, (t) => { process.stderr.write(t); });
    const variants = refs.reduce((n, r) => n + r.variants.length, 0);
    const header = `# CI gate on synthetic diffs (${engineName} engine, ${String(variants)} reference variants)`;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'cases.json'), JSON.stringify({ engine: engineName, variants, elapsedMs: Date.now() - started, cases }, null, 2) + '\n');
    const md = renderSyntheticMarkdown(cases, header);
    fs.writeFileSync(path.join(outDir, 'report.md'), md);
    process.stdout.write(md);
    return 0;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    release?.();
  }
}

main(process.argv.slice(2)).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
