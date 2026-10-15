/**
 * v1.3 reference projects (FR-V3): manifests are schema-valid and consistent, every patch applies cleanly, the clean
 * project and every variant compile with tsc, and the hand-written expected graph agrees with an independent scan of
 * the import statements. The scan here is a plain regex over the sources, deliberately not the extractor: the
 * extractor is the instrument the graph is ground truth for (FR-V2), so it must not be used to check it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import YAML from 'yaml';
import { materialiseVariant, makeTempRoot } from '../../../../scripts/v1.3/lib/materialise.js';
import {
  PATCH_REFERENCE_STYLES as REFERENCE_STYLES,
  crossCheck,
  loadReference,
  loadAllReferences,
  validateExpectedGraph,
  validateReferenceDescriptor,
  validateVariantManifest,
} from '../../../../scripts/v1.3/lib/reference-model.js';
import type { LoadedReference } from '../../../../scripts/v1.3/lib/reference-model.js';

const ROOT = path.resolve(__dirname, '../../../..');
const refs: LoadedReference[] = loadAllReferences(ROOT, REFERENCE_STYLES);
let work: string;

function must<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}

beforeAll(() => {
  work = makeTempRoot();
});
afterAll(() => {
  fs.rmSync(work, { recursive: true, force: true });
});

function listSources(projectDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith('.ts')) out.push(path.relative(projectDir, abs).split(path.sep).join('/'));
    }
  };
  walk(path.join(projectDir, 'src'));
  return out.sort();
}

/** Every relative import/export-from specifier, resolved to a project file. */
function scanEdges(projectDir: string): string[] {
  const edges = new Set<string>();
  for (const file of listSources(projectDir)) {
    const text = fs.readFileSync(path.join(projectDir, file), 'utf8');
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/g)) {
      const spec = m[1] ?? '';
      if (!spec.startsWith('.')) continue;
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      const target = fs.existsSync(path.join(projectDir, `${base}.ts`)) ? `${base}.ts` : `${base}/index.ts`;
      edges.add(`${file} -> ${target}`);
    }
  }
  return [...edges].sort();
}

function typecheck(projectDir: string): string[] {
  const configPath = path.join(projectDir, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDir);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const where = d.file ? `${path.relative(projectDir, d.file.fileName)}: ` : '';
    return where + ts.flattenDiagnosticMessageText(d.messageText, '\n');
  });
}

describe('v1.3 reference projects: manifests', () => {
  it('covers the four patch-format styles of this unit (DDD, overlay format, is checked below)', () => {
    expect(refs.map((r) => r.style)).toEqual([...REFERENCE_STYLES]);
  });

  it.each(REFERENCE_STYLES)('%s: every manifest is schema-valid and the cross-checks pass', (style) => {
    const ref = must(refs.find((r) => r.style === style), style);
    expect(crossCheck(ref)).toEqual([]);
  });

  it.each(REFERENCE_STYLES)('%s: 15-40 source files, 8-12 violations, 2-3 near-misses, one clean variant', (style) => {
    const ref = must(refs.find((r) => r.style === style), style);
    const files = listSources(ref.projectDir).length;
    expect(files).toBeGreaterThanOrEqual(15);
    expect(files).toBeLessThanOrEqual(40);
    const kinds = ref.variants.map((v) => v.manifest.kind);
    expect(kinds.filter((k) => k === 'clean')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'violation').length).toBeGreaterThanOrEqual(8);
    expect(kinds.filter((k) => k === 'violation').length).toBeLessThanOrEqual(12);
    expect(kinds.filter((k) => k === 'near-miss').length).toBeGreaterThanOrEqual(2);
    expect(kinds.filter((k) => k === 'near-miss').length).toBeLessThanOrEqual(3);
  });

  it.each(REFERENCE_STYLES)('%s: every blocking-candidate rule has a violating variant or a recorded reason', (style) => {
    const ref = must(refs.find((r) => r.style === style), style);
    const planted = new Set(ref.variants.flatMap((v) => v.manifest.expectedFindings.map((f) => f.ruleId)));
    const waived = new Set(ref.descriptor.noViolatingVariant.map((w) => w.ruleId));
    const uncovered = ref.descriptor.scopeRules.filter((r) => r.blockingCandidate && !planted.has(r.ruleId) && !waived.has(r.ruleId));
    expect(uncovered).toEqual([]);
  });

  it.each(REFERENCE_STYLES)('%s: spec.yaml names the style and every layer the expected graph uses', (style) => {
    const ref = must(refs.find((r) => r.style === style), style);
    const spec = YAML.parse(fs.readFileSync(ref.specPath, 'utf8')) as { architecture: { style: string; layers: { name: string }[] } };
    expect(spec.architecture.style).toBe(style);
    const layers = new Set(spec.architecture.layers.map((l) => l.name));
    for (const f of ref.graph.files) if (f.layer !== null) expect(layers.has(f.layer)).toBe(true);
  });

  it('the schemas reject malformed manifests', () => {
    const v = must(must(refs[0]).variants.find((x) => x.manifest.kind === 'violation')).manifest;
    expect(() => validateVariantManifest(ROOT, { ...v, kind: 'violation', plants: null })).toThrow(/schema violation/);
    expect(() => validateVariantManifest(ROOT, { ...v, expectedFindings: [{ ruleId: 'S01', ruleName: 'x', file: 'src/a.ts', reason: 'long enough reason' }] })).toThrow(/schema violation/);
    expect(() => validateVariantManifest(ROOT, { ...v, kind: 'clean', variant: 'clean', plants: null, patch: 'variant.patch' })).toThrow(/schema violation/);
    expect(() => validateReferenceDescriptor(ROOT, { ...must(refs[0]).descriptor, writtenBeforeToolRun: false })).toThrow(/schema violation/);
    expect(() => validateExpectedGraph(ROOT, { ...must(refs[0]).graph, extra: 1 })).toThrow(/schema violation/);
  });
});

describe('v1.3 reference projects: expected graph (hand-written ground truth)', () => {
  it.each(REFERENCE_STYLES)('%s: lists exactly the source files of the clean project', (style) => {
    const ref = must(refs.find((r) => r.style === style), style);
    expect(ref.graph.files.map((f) => f.path).sort()).toEqual(listSources(ref.projectDir));
  });

  it.each(REFERENCE_STYLES)('%s: lists exactly the internal import edges an independent scan finds', (style) => {
    const ref = must(refs.find((r) => r.style === style), style);
    expect(ref.graph.edges.map((e) => `${e.from} -> ${e.to}`).sort()).toEqual(scanEdges(ref.projectDir));
  });
});

describe('v1.3 reference projects: patches and compilation', () => {
  it.each(REFERENCE_STYLES)('%s: the clean project compiles', (style) => {
    expect(typecheck(must(refs.find((r) => r.style === style), style).projectDir)).toEqual([]);
  });

  const cases = refs.flatMap((ref) => ref.variants.filter((v) => v.patchPath !== null).map((v) => [`${ref.style}/${v.manifest.variant}`, ref, v] as const));

  it.each(cases)('%s: the patch applies cleanly, touches only src/ and the variant compiles', (_label, ref, v) => {
    const m = materialiseVariant(ref, v, work);
    expect(m.touched.length).toBeGreaterThan(0);
    for (const t of m.touched) expect(t.startsWith('src/')).toBe(true);
    expect(typecheck(m.projectDir)).toEqual([]);
  });

  it('materialising never writes into the repository copy', () => {
    const ref = must(refs[0]);
    const before = listSources(ref.projectDir).map((f) => fs.readFileSync(path.join(ref.projectDir, f), 'utf8')).join('\0');
    for (const v of ref.variants) materialiseVariant(ref, v, work);
    const after = listSources(ref.projectDir).map((f) => fs.readFileSync(path.join(ref.projectDir, f), 'utf8')).join('\0');
    expect(after).toBe(before);
  });
});

describe('v1.3 reference projects: the DDD project (overlay format, U-C1) in the common model', () => {
  const ddd = loadReference(ROOT, 'ddd');

  it('loads with the overlay format, the preset as spec and every preset function as a compared rule', () => {
    expect(ddd.format).toBe('overlay');
    expect(path.relative(ROOT, ddd.specPath)).toBe('presets/ddd.yaml');
    expect(ddd.descriptor.scopeRules.map((r) => r.ruleId)).toEqual([
      'FF-DS01', 'FF-DS02', 'FF-DT01', 'FF-DT02', 'FF-DT03', 'FF-DT04', 'FF-DT05', 'FF-DT06', 'FF-S01', 'FF-S03',
    ]);
    expect(crossCheck(ddd)).toEqual([]);
  });

  it('the blocking set is the v1.3 tiers, not the severity', () => {
    const blocking = ddd.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId);
    expect(blocking).toEqual(['FF-DS01', 'FF-DS02', 'FF-DT01', 'FF-DT02', 'FF-DT03', 'FF-DT04', 'FF-S01']);
  });

  it('one clean variant, the violations plant their rule, the negative controls expect nothing', () => {
    const kinds = ddd.variants.map((v) => v.manifest.kind);
    expect(kinds.filter((k) => k === 'clean')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'violation')).toHaveLength(12);
    expect(kinds.filter((k) => k === 'near-miss')).toHaveLength(2);
    expect(ddd.graph.files.map((f) => f.path).sort()).toEqual(listSources(ddd.projectDir));
  });

  it.each(ddd.variants.filter((v) => v.overlay !== undefined).map((v) => [v.manifest.variant, v] as const))(
    '%s: the overlay and delete list apply and touch only src/', (_label, v) => {
      const m = materialiseVariant(ddd, v, work);
      expect(m.touched.length).toBeGreaterThan(0);
      for (const t of m.touched) expect(t.startsWith('src/')).toBe(true);
      expect(fs.existsSync(path.join(m.projectDir, 'expected-findings.json'))).toBe(false);
      for (const d of v.overlay?.delete ?? []) expect(fs.existsSync(path.join(m.projectDir, d))).toBe(false);
    });

  it('the hexagonal outbound ports are present (they were once dropped by the out/ ignore rule)', () => {
    const hex = must(refs.find((r) => r.style === 'hexagonal'), 'hexagonal');
    const ports = hex.graph.files.filter((f) => f.path.startsWith('src/application/ports/out/')).map((f) => f.path);
    expect(ports).toHaveLength(5);
    for (const p of ports) expect(fs.existsSync(path.join(hex.projectDir, p))).toBe(true);
  });
});
