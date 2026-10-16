/**
 * Study 2 frozen-tunables manifest (tooling, not a pre-registration; Docs/v1.3/study2-tunables.md §3): every group is
 * present, two writes of the same tree are byte-identical, the judge anchors match their values, and `verify` names
 * every kind of drift. No model, no network, no Neo4j.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ABSENT_GROUPS, buildTunablesManifest, diffManifests, hasDrift, manifestText, parseManifest, renderDrift, TUNABLES_SCHEMA,
} from '../../../../scripts/v1.3/lib/study2-tunables.js';
import type { TunablesManifest } from '../../../../scripts/v1.3/lib/study2-tunables.js';
import { NEURAL_TOOL_NAMES, TOOL_NAMES } from '../../../../src/mcp-server/server.js';
import { FROZEN_SHA256 } from '../../../../src/llm-critic/frozen.js';
import { JUDGE_V2_SHA256 } from '../../../../src/llm-critic/judge-v2.js';

const REPO = process.cwd();
const GROUPS = [
  'template', 'template-meta', 'template-tiers', 'compiler', 'library', 'preset', 'frame', 'mcp', 'mcp-tool', 'judge', 'doc',
  'extractor', 'labelling',
];

let manifest: TunablesManifest;
beforeAll(async () => {
  manifest = await buildTunablesManifest(REPO);
}, 60_000);

describe('buildTunablesManifest', () => {
  it('lists every group of the schema with 64-hex values and sorted keys', () => {
    expect(manifest.schema).toBe(TUNABLES_SCHEMA);
    const keys = Object.keys(manifest.entries);
    expect(keys).toEqual([...keys].sort());
    for (const v of Object.values(manifest.entries)) expect(v).toMatch(/^[0-9a-f]{64}$/);
    for (const g of GROUPS) expect(keys.filter((k) => k.startsWith(`${g}/`)).length).toBeGreaterThan(0);
    expect(manifest.absent).toEqual(ABSENT_GROUPS);
  });

  it('covers each catalogue, preset, frame, sealed doc and every default MCP tool', () => {
    const e = manifest.entries;
    for (const cat of ['frozen', 'hexagonal', 'ddd', 'module-wiring', 'apg2', 'cheap2', 'ddd-member-fact']) {
      expect(Object.keys(e).some((k) => k.startsWith(`template/${cat}/`))).toBe(true);
    }
    expect(e['template/frozen/dependency-direction']).toBeDefined();
    expect(e['template/ddd-literal-view/context-isolation']).toBeDefined();
    for (const f of fs.readdirSync(path.join(REPO, 'presets')).filter((n) => n.endsWith('.yaml'))) expect(e[`preset/${f}`]).toBeDefined();
    for (const k of ['first-step', 'next-step', 'styled-first-step', 'styled-next-step', 'repair', 'rule-plain', 'arm-tool-sentences', 'attention', 'l3-lead', 'l4-sentence', 'fix-clause']) {
      expect(e[`frame/${k}`]).toBeDefined();
    }
    for (const s of ['clean', 'hexagonal', 'ddd']) expect(e[`frame/layout-sentence/${s}`]).toBeDefined();
    expect(e['doc/rule-tiers.md']).toBeDefined();
    expect(e['engine/interp-query-timeout-ms']).toBeDefined();
    expect(e['doc/style-rule-sources.md']).toBeDefined();
    for (const t of TOOL_NAMES) expect(e[`mcp-tool/default/${t}`]).toBeDefined();
    for (const t of NEURAL_TOOL_NAMES) {
      expect(e[`mcp-tool/neural/${t}`]).toBeDefined();
      expect(e[`mcp-tool/default/${t}`]).toBeUndefined();
    }
    for (const t of TOOL_NAMES) expect(e[`mcp-tool/neural/${t}`]).toBeDefined();
  });

  it('records the judge anchors as committed (the anchor tests recompute them from the values)', () => {
    expect(manifest.entries['judge/frozen-anchor']).toBe(FROZEN_SHA256);
    expect(manifest.entries['judge/v2-anchor']).toBe(JUDGE_V2_SHA256);
  });

  it('is deterministic: two builds give the same bytes', async () => {
    expect(manifestText(await buildTunablesManifest(REPO))).toBe(manifestText(manifest));
  }, 60_000);

  it('a preset byte change shows as drift of that preset only', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunables-'));
    try {
      fs.cpSync(path.join(REPO, 'presets'), path.join(tmp, 'presets'), { recursive: true });
      for (const f of ['Docs/v1.3/rule-tiers.md', 'Docs/v1.3/style-rule-sources.md', 'scripts/v1.3/lib/labelling/correctness.ts', 'scripts/v1.3/lib/labelling/findings.ts']) {
        fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
        fs.copyFileSync(path.join(REPO, f), path.join(tmp, f));
      }
      fs.appendFileSync(path.join(tmp, 'presets', 'hexagonal.yaml'), '\n# drift\n');
      const d = diffManifests(manifest, await buildTunablesManifest(tmp));
      expect(d.changed).toEqual(['preset/hexagonal.yaml']);
      expect(hasDrift(d)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('diffManifests', () => {
  it('no drift against itself', () => {
    const d = diffManifests(manifest, parseManifest(manifestText(manifest)));
    expect(hasDrift(d)).toBe(false);
    expect(renderDrift(d)).toBe('');
  });

  it('names a changed value, a missing key, an extra key and a changed absent group', () => {
    const [first, second] = Object.keys(manifest.entries);
    const entries: Record<string, string> = { ...manifest.entries, [first ?? '']: '0'.repeat(64), 'extra/key': '1'.repeat(64) };
    delete entries[second ?? ''];
    const live: TunablesManifest = { ...manifest, entries, absent: { ...manifest.absent, 'mcp-tool/other': 'not on this commit' } };
    const d = diffManifests(manifest, live);
    expect(d.changed).toEqual([first]);
    expect(d.removed).toEqual([second]);
    expect(d.added).toEqual(['extra/key']);
    expect(d.absentChanged).toEqual(['mcp-tool/other']);
    expect(renderDrift(d)).toContain(`changed  ${String(first)}`);
    expect(diffManifests(manifest, { ...manifest, schema: 'other' }).schemaChanged).toBe(true);
  });

  it('parseManifest refuses a file that is not a manifest', () => {
    expect(() => parseManifest('{"schema":"x"}')).toThrow(/not a study2 tunables manifest/);
    expect(() => parseManifest('null')).toThrow(/not a study2 tunables manifest/);
  });
});

describe('CLI', () => {
  it('write then verify exits 0; a tampered manifest exits 1 and names the key', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunables-cli-'));
    const file = path.join(tmp, 'm.json');
    const run = (...args: string[]): { code: number; out: string } => {
      try {
        return { code: 0, out: execFileSync('npx', ['tsx', 'scripts/v1.3/study2-tunables.ts', ...args], { cwd: REPO, encoding: 'utf8' }) };
      } catch (e) {
        const x = e as { status: number; stdout: string };
        return { code: x.status, out: x.stdout };
      }
    };
    try {
      expect(run('write', file).code).toBe(0);
      expect(run('verify', file)).toEqual({ code: 0, out: expect.stringContaining('study2 tunables ok') as unknown as string });
      const m = parseManifest(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, manifestText({ ...m, entries: { ...m.entries, 'frame/repair': 'f'.repeat(64) } }));
      const bad = run('verify', file);
      expect(bad.code).toBe(1);
      expect(bad.out).toContain('changed  frame/repair');
      expect(run('verify').code).toBe(2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});
