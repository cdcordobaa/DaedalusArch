/**
 * ISE anti-leakage: the inferrer reads only a source snapshot (src/ + tsconfig.json), its own presets and the
 * TypeScript library files. A bait project carries every forbidden input next to its source (a spec, expected
 * findings, the expected graph, reference.json, a variant patch and its metadata) in a directory named after the
 * style and the variant; the snapshot must leave them behind and inference must never open a path outside the
 * allowed roots. Every `fs` entry point the extractor, the spec parser and the inferrer use is spied on.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { inferSpec } from '../../../src/ise/infer.js';
import { SNAPSHOT_ENTRIES, listSnapshotFiles, snapshotSource } from '../../../src/ise/snapshot.js';

const REPO = process.cwd();
const FIXTURE = path.join(REPO, 'tests/fixtures/v1.3-reference/clean-architecture/project');
const BAIT = ['spec.yaml', 'expected-findings.json', 'expected-graph.json', 'reference.json', 'variant.patch', 'variant.json', 'package.json'];
const SPIED = ['readFileSync', 'readdirSync', 'existsSync', 'statSync', 'lstatSync', 'openSync', 'realpathSync', 'accessSync', 'opendirSync', 'readFile', 'readdir', 'stat', 'lstat', 'open'] as const;

describe('ISE anti-leakage', () => {
  let baitRoot: string;
  let project: string;

  beforeAll(() => {
    baitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-bait-'));
    project = path.join(baitRoot, 'clean-architecture', 'v05-use-case-injects-concrete-repository');
    fs.cpSync(FIXTURE, project, { recursive: true });
    for (const b of BAIT) fs.writeFileSync(path.join(project, b), 'BAIT\n');
    fs.mkdirSync(path.join(project, 'variants', 'v01'), { recursive: true });
    fs.writeFileSync(path.join(project, 'variants', 'v01', 'expected-findings.json'), 'BAIT\n');
  });

  afterAll(() => { fs.rmSync(baitRoot, { recursive: true, force: true }); });

  it('copies only src/ and tsconfig.json into a neutrally named directory', () => {
    const snap = snapshotSource(project);
    try {
      const files = listSnapshotFiles(snap.dir);
      expect(files.length).toBeGreaterThan(20);
      expect(files.every((f) => SNAPSHOT_ENTRIES.some((e) => f === e || f.startsWith(`${e}/`)))).toBe(true);
      expect(snap.dir).not.toMatch(/clean-architecture|v05|variant|reference|fixtures/);
      expect(path.basename(snap.dir)).toBe('project');
    } finally {
      snap.dispose();
    }
  });

  it('never opens a path outside the snapshot, the presets and the TypeScript libraries while inferring', async () => {
    const snap = snapshotSource(project);
    const holder = path.dirname(snap.dir);
    const realHolder = fs.realpathSync(holder);
    const seen: string[] = [];
    // The CommonJS module object every importer shares (ts-jest's namespace wrappers read it through getters).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFs = require('node:fs') as Record<string, unknown>;
    const originals = new Map<string, (...a: unknown[]) => unknown>();
    for (const m of SPIED) {
      const original = nodeFs[m];
      if (typeof original !== 'function') continue;
      const fn = original as (...a: unknown[]) => unknown;
      originals.set(m, fn);
      const wrapped = (...args: unknown[]): unknown => {
        const p = args[0];
        if (typeof p === 'string') seen.push(path.resolve(p));
        else if (p instanceof URL) seen.push(p.pathname);
        return fn.apply(nodeFs, args);
      };
      Object.assign(wrapped, fn);
      nodeFs[m] = wrapped;
    }
    let inference: Awaited<ReturnType<typeof inferSpec>>;
    try {
      inference = await inferSpec(snap.dir, { presetsDir: path.join(REPO, 'presets') });
    } finally {
      for (const [m, fn] of originals) nodeFs[m] = fn;
    }
    snap.dispose();

    expect(inference.style).toBe('clean-architecture');
    expect(inference.check.valid).toBe(true);
    // The wrappers are live: the extractor read the snapshot's sources.
    expect(seen.some((p) => p.startsWith(path.join(realHolder, 'project', 'src')) || p.startsWith(path.join(holder, 'project', 'src')))).toBe(true);

    const allowedRoots = [holder, realHolder, path.join(REPO, 'node_modules'), path.join(REPO, 'presets')];
    // The emitted spec is written to its own temporary directory and read back by the spec validator.
    const ownOutput = /[/\\]ise-spec-[^/\\]+([/\\]|$)/;
    // Ancestors of the snapshot (tsconfig and module resolution walk up from it) hold no project input.
    const ancestor = (p: string): boolean => [holder, realHolder].some((h) => h === p || h.startsWith(p.endsWith(path.sep) ? p : p + path.sep));
    // TypeScript's own module resolution probes `<ancestor>/node_modules/...` and `<ancestor>/package.json` upward
    // from the snapshot (lib overrides such as @typescript/lib-es2021, @types): tool lookups, not project inputs.
    const resolution = (p: string): boolean => {
      const i = p.indexOf(`${path.sep}node_modules`);
      if (i >= 0) return ancestor(p.slice(0, i) || path.sep);
      return path.basename(p) === 'package.json' && ancestor(path.dirname(p));
    };
    const outside = [...new Set(seen)].filter((p) => !allowedRoots.some((r) => p === r || p.startsWith(r + path.sep)) && !ownOutput.test(p) && !ancestor(p) && !resolution(p));
    expect(outside).toEqual([]);
    // Negative control: the same filter flags a read of the original project's spec.
    const leak = path.join(project, 'spec.yaml');
    expect([leak].filter((p) => !allowedRoots.some((r) => p === r || p.startsWith(r + path.sep)) && !ownOutput.test(p) && !ancestor(p) && !resolution(p))).toEqual([leak]);
    expect(seen.filter((p) => p.startsWith(baitRoot) || p.includes(`${path.sep}fixtures${path.sep}`))).toEqual([]);
    // No forbidden input is opened anywhere, except the package.json lookups of module resolution above.
    expect(seen.filter((p) => BAIT.includes(path.basename(p)) && !p.startsWith(path.join(REPO, 'node_modules')) && !resolution(p))).toEqual([]);
  }, 60_000);
});
