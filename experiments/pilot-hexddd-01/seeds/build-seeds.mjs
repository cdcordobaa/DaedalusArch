#!/usr/bin/env node
/**
 * HEXDDD-01 pilot seed builder (exploratory; design `ops/notes/hexddd-01-violation-elicitation-design.md` §4, §5, §7).
 * Plain Node, no dependencies, no network, no model call.
 *
 * Usage (repository root):
 *   node experiments/pilot-hexddd-01/seeds/build-seeds.mjs            # (re)writes seeds/s1-hex-debt and seeds/s2-ddd-debt
 *   node experiments/pilot-hexddd-01/seeds/build-seeds.mjs --check    # rebuilds in memory, compares with the committed trees and seeds.sha256.json
 *
 * S1-debt (Hexagonal): `tests/fixtures/v1.3-reference/hexagonal/project/src` with variant
 * `v05-inbound-adapter-reads-outbound-adapter` applied (planted debt: FF-S03), plus two vendor typing files under
 * `src/types/` (the payments SDK of step 1 and the SQL client of step 5; ambient `declare module` blocks, the way the
 * reference project vendors its framework typings). The harness tsconfig includes only `src/**\/*.ts`, so the typings
 * live under `src/`; the extractor skips `.d.ts` files, so they add no file node.
 *
 * S2-debt (DDD): `tests/fixtures/v1.3-reference/ddd/clean/src` with the overlay of variant
 * `v08-cross-context-internal-import` (planted debt: FF-DS02). The overlay's marker comment line, which names the
 * planted violation, is dropped: it would tell the agent where the debt is. Nothing else is changed.
 *
 * Writes `seeds.sha256.json`: per seed, the sha256 of every file (POSIX path relative to the seed root) and the tree
 * sha256 (sha256 of the sorted `path<TAB>sha256` lines, one per line, trailing newline).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REF = 'tests/fixtures/v1.3-reference';
const HERE = 'experiments/pilot-hexddd-01/seeds';
const MANIFEST = `${HERE}/seeds.sha256.json`;

const PAYSTREAM_DTS = `// Typings of the Paystream Node SDK (package @paystream/node), vendored with the project.
declare module '@paystream/node' {
  export interface PaystreamOptions {
    apiKey: string;
    timeoutMs?: number;
  }
  export interface Charge {
    id: string;
    status: 'succeeded' | 'declined';
    amountMinor: number;
    currency: string;
    declineCode?: 'insufficient_funds' | 'card_expired' | 'suspected_fraud' | 'limit_exceeded';
  }
  export interface Refund {
    id: string;
    chargeId: string;
    status: 'pending' | 'succeeded' | 'failed';
  }
  export class PaystreamError extends Error {
    readonly code: string;
    readonly retryable: boolean;
  }
  export class Paystream {
    constructor(options: PaystreamOptions);
    charges: {
      create(params: { amountMinor: number; currency: string; customerRef: string; idempotencyKey: string }): Promise<Charge>;
      retrieve(chargeId: string): Promise<Charge>;
    };
    refunds: {
      create(params: { chargeId: string; idempotencyKey: string }): Promise<Refund>;
    };
  }
}
`;

const SQLWELL_DTS = `// Typings of the sqlwell PostgreSQL client (package sqlwell), vendored with the project.
declare module 'sqlwell' {
  export interface QueryResult<Row> {
    rows: Row[];
    rowCount: number;
  }
  export interface Queryable {
    query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
  }
  export interface Transaction extends Queryable {
    readonly id: string;
  }
  export class Pool implements Queryable {
    constructor(config: { connectionString: string; max?: number });
    query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
    transaction<T>(work: (tx: Transaction) => Promise<T>, options?: { isolation?: 'read committed' | 'repeatable read' | 'serializable' }): Promise<T>;
    end(): Promise<void>;
  }
}
`;

function walk(root, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(root, r));
    else out.push(r);
  }
  return out;
}

/** Reads a tree into a Map(relPath → content). */
function readTree(root, prefix) {
  const m = new Map();
  for (const rel of walk(root)) m.set(`${prefix}${rel}`, fs.readFileSync(path.join(root, rel), 'utf8'));
  return m;
}

/** Applies a unified diff (the v05 patch: plain hunks, no renames) to the files of a tree map. */
function applyPatch(tree, patchText) {
  const files = patchText.split(/^--- /m).slice(1);
  for (const block of files) {
    const lines = block.split('\n');
    const target = /^\+\+\+ b\/(.*)$/.exec(lines[1] ?? '')?.[1];
    if (target === undefined || !tree.has(target)) throw new Error(`patch target not found: ${String(target)}`);
    const old = tree.get(target).split('\n');
    const result = [];
    let cursor = 0;
    let i = 2;
    while (i < lines.length) {
      const h = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i] ?? '');
      if (h === null) {
        i++;
        continue;
      }
      const start = Number(h[1]) - 1;
      while (cursor < start) result.push(old[cursor++]);
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('@@')) {
        const l = lines[i] ?? '';
        if (l.startsWith(' ')) {
          if (old[cursor] !== l.slice(1)) throw new Error(`context mismatch in ${target} at line ${cursor + 1}`);
          result.push(old[cursor++]);
        } else if (l.startsWith('-')) {
          if (old[cursor] !== l.slice(1)) throw new Error(`removal mismatch in ${target} at line ${cursor + 1}`);
          cursor++;
        } else if (l.startsWith('+')) result.push(l.slice(1));
        i++;
      }
    }
    while (cursor < old.length) result.push(old[cursor++]);
    tree.set(target, result.join('\n'));
  }
}

function buildS1() {
  const tree = readTree(`${REF}/hexagonal/project/src`, 'src/');
  applyPatch(tree, fs.readFileSync(`${REF}/hexagonal/variants/v05-inbound-adapter-reads-outbound-adapter/variant.patch`, 'utf8'));
  tree.set('src/types/paystream-node.d.ts', PAYSTREAM_DTS);
  tree.set('src/types/sqlwell.d.ts', SQLWELL_DTS);
  return tree;
}

function buildS2() {
  const tree = readTree(`${REF}/ddd/clean/src`, 'src/');
  const overlayRoot = `${REF}/ddd/variants/v08-cross-context-internal-import/overlay`;
  const variant = JSON.parse(fs.readFileSync(`${REF}/ddd/variants/v08-cross-context-internal-import/variant.json`, 'utf8'));
  for (const d of variant.delete ?? []) tree.delete(d);
  for (const rel of walk(overlayRoot)) {
    const text = fs.readFileSync(path.join(overlayRoot, rel), 'utf8');
    // Drop the marker comment that names the planted violation (module header).
    tree.set(rel, text.split('\n').filter((l) => !/^\s*\/\/\s*VIOLATION\b/.test(l)).join('\n'));
  }
  return tree;
}

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function manifestOf(tree) {
  const files = Object.fromEntries([...tree.keys()].sort().map((k) => [k, sha(tree.get(k))]));
  const lines = Object.entries(files).map(([k, v]) => `${k}\t${v}`);
  return { fileCount: lines.length, treeSha256: sha(`${lines.join('\n')}\n`), files };
}

const SEEDS = { 's1-hex-debt': buildS1, 's2-ddd-debt': buildS2 };
const check = process.argv.includes('--check');
const manifest = { schema: 'hexddd-01-seeds/v1', treeHashRule: 'sha256 of sorted "path<TAB>sha256" lines, LF, trailing newline', seeds: {} };
let bad = 0;
for (const [name, build] of Object.entries(SEEDS)) {
  const tree = build();
  manifest.seeds[name] = manifestOf(tree);
  const dir = `${HERE}/${name}`;
  if (check) {
    const onDisk = fs.existsSync(dir) ? readTree(dir, '') : new Map();
    const same = onDisk.size === tree.size && [...tree].every(([k, v]) => onDisk.get(k) === v);
    if (!same) {
      process.stderr.write(`${name}: committed tree differs from the build\n`);
      bad++;
    }
    continue;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [rel, text] of tree) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}
const text = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  if (!fs.existsSync(MANIFEST) || fs.readFileSync(MANIFEST, 'utf8') !== text) {
    process.stderr.write('seeds.sha256.json is stale\n');
    bad++;
  }
  process.stdout.write(bad === 0 ? 'seeds OK\n' : '');
  process.exit(bad === 0 ? 0 : 1);
}
fs.writeFileSync(MANIFEST, text);
for (const [name, m] of Object.entries(manifest.seeds)) process.stdout.write(`${name}: ${m.fileCount} files, tree sha256 ${m.treeSha256}\n`);
