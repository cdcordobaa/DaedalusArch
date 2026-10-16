/**
 * Held-out ISE rename probes (scripts/v1.3/lib/ise-probes.ts): the seeded draw is deterministic and equals the
 * recorded definitions, no probe name is vocabulary or an existing directory name, the path transform maps files,
 * globs and specifiers consistently, and a probed project still type-checks. No inference runs here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { parseSpec, validateSpecAgainstProject } from '../../../../src/spec-parser/index.js';
import {
  PROBE_WORDS, SCRAMBLE_SUFFIXES, applyProbe, drawWords, mulberry32, probeFindingPath, probePath, probeWordsAllowed,
  rewriteProbeSource, scrambleName, scramblePattern, scrambledIdentifiers,
} from '../../../../scripts/v1.3/lib/ise-probes.js';
import type { ProbeDefinition } from '../../../../scripts/v1.3/lib/ise-probes.js';
import {
  ISE_HELDOUT_TARGETS, ISE_TARGETS, REFERENCE_DIR_NAMES, materialiseTarget, probeExclusions, renamedExpectedLayers, targetSet, trueSpecText,
} from '../../../../scripts/v1.3/lib/ise-targets.js';
import { makeTempRoot } from '../../../../scripts/v1.3/lib/materialise.js';
import { loadAllReferences } from '../../../../scripts/v1.3/lib/reference-model.js';
import { typecheckProject } from '../../../../scripts/v1.3/lib/typecheck.js';

const ROOT = path.resolve(__dirname, '../../../..');
const recorded = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/v1.3/lib/ise-probes.json'), 'utf8')) as { probes: ProbeDefinition[]; excluded: string[]; words: string[] };
const probe = (id: string): ProbeDefinition => {
  const t = ISE_HELDOUT_TARGETS.find((x) => x.id === id);
  if (t?.probe === undefined) throw new Error(id);
  return t.probe;
};

describe('held-out probe definitions', () => {
  it('the seeded PRNG and the draw are deterministic', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(drawWords(PROBE_WORDS, 5, mulberry32(7))).toEqual(drawWords(PROBE_WORDS, 5, mulberry32(7)));
    expect(new Set(drawWords(PROBE_WORDS, 20, mulberry32(7))).size).toBe(20);
    expect(() => drawWords(['a'], 2, mulberry32(1))).toThrow();
  });

  it('the generated probes equal the recorded ones (committed before the fixed code ran on them)', () => {
    expect(ISE_HELDOUT_TARGETS.map((t) => t.probe)).toEqual(recorded.probes);
    expect(probeExclusions()).toEqual(recorded.excluded);
    expect([...PROBE_WORDS]).toEqual(recorded.words);
    expect(ISE_HELDOUT_TARGETS.map((t) => t.id)).toHaveLength(15);
  });

  it('no probe word is excluded, and the exclusions cover every reference directory name', () => {
    const allowed = new Set(probeWordsAllowed(probeExclusions()));
    for (const t of ISE_HELDOUT_TARGETS) {
      const p = probe(t.id);
      for (const w of [...Object.values(p.segments), ...p.wrapper, ...(p.inner === null ? [] : [p.inner])]) expect(allowed.has(w)).toBe(true);
    }
    const dirs = new Set<string>();
    for (const ref of loadAllReferences(ROOT)) {
      const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          dirs.add(e.name);
          walk(path.join(d, e.name));
        }
      };
      walk(path.join(ref.projectDir, 'src'));
    }
    expect([...dirs].filter((d) => !REFERENCE_DIR_NAMES.includes(d))).toEqual([]);
  });

  it('N1 and N2 use new names and a different nesting than the development probe; S is N1 plus suffixes', () => {
    const devNames = new Set(ISE_TARGETS.flatMap((t) => Object.values(t.rename).flatMap((p) => p.split('/'))));
    for (const t of ISE_HELDOUT_TARGETS) for (const w of Object.values(probe(t.id).segments)) expect(devNames.has(w)).toBe(false);
    expect(probe('N1-ddd').nesting).toBe('root-wrapper');
    expect(probe('N2-ddd').nesting).toBe('inner-level');
    const s = probe('S-ddd-scrambled');
    expect({ ...s, id: '', family: '', suffixes: {} }).toEqual({ ...probe('N1-ddd'), id: '', family: '', suffixes: {} });
    expect(s.suffixes).toEqual(SCRAMBLE_SUFFIXES);
    expect(targetSet([])).toBe(ISE_TARGETS);
    expect(targetSet(['--set', 'heldout'])).toBe(ISE_HELDOUT_TARGETS);
    expect(targetSet(['--set', 'all'])).toHaveLength(ISE_TARGETS.length + ISE_HELDOUT_TARGETS.length);
    expect(() => targetSet(['--set', 'x'])).toThrow();
  });
});

describe('probe path transform', () => {
  const def: ProbeDefinition = {
    id: 't', family: 'N2', style: 'hexagonal', seed: 0, nesting: 'inner-level', wrapper: [], inner: 'mid',
    segments: { domain: 'kern', adapters: 'grp', 'adapters/inbound': 'in2', '*/application': 'app2' }, suffixes: {},
  };
  it('renames slots, inserts the inner level only above sub-directories, leaves ** tails alone', () => {
    expect(probePath('src/domain/model/Room.ts', def, 'file')).toBe('src/kern/mid/model/Room.ts');
    expect(probePath('src/domain/Room.ts', def, 'file')).toBe('src/kern/Room.ts');
    expect(probePath('src/adapters/inbound/http/C.ts', def, 'file')).toBe('src/grp/mid/in2/http/C.ts');
    expect(probePath('src/adapters/outbound/x/D.ts', def, 'file')).toBe('src/grp/mid/outbound/x/D.ts');
    expect(probePath('src/domain/**', def, 'dir')).toBe('src/kern/**');
    expect(probePath('src/*/application/**', def, 'dir')).toBe('src/*/mid/app2/**');
    expect(probePath('src/*/application/*.ts', def, 'file')).toBe('src/*/mid/app2/*.ts');
    expect(probePath('src/**/value-objects/**', def, 'dir')).toBe('src/**/value-objects/**');
    expect(probePath('src/main.ts', def, 'file')).toBe('src/main.ts');
    expect(probePath('src/ordering/', def, 'dir')).toBe('src/ordering/');
    expect(probePath('lib/x.ts', def, 'file')).toBe('lib/x.ts');
    expect(probeFindingPath('src/domain/a/A.ts,src/domain/B.ts', def)).toBe('src/kern/mid/a/A.ts,src/kern/B.ts');
  });

  it('a root wrapper moves everything one level down', () => {
    const w = probe('N1-clean-architecture');
    const word = w.wrapper[0] ?? '';
    expect(probePath('src/main.ts', w, 'file')).toBe(`src/${word}/main.ts`);
    expect(probePath('src/', w, 'dir')).toBe(`src/${word}/`);
    expect(probePath('src/domain/entities/Book.ts', w, 'file')).toBe(`src/${word}/${w.segments.domain ?? ''}/entities/Book.ts`);
  });

  it('scrambles PascalCase, dotted and kebab suffixes of files, globs and naming patterns', () => {
    expect(scrambleName('InMemoryBookRepository', SCRAMBLE_SUFFIXES)).toBe('InMemoryBookStore');
    expect(scrambleName('attendees.service', SCRAMBLE_SUFFIXES)).toBe('attendees.handler');
    expect(scrambleName('attendee-repository', SCRAMBLE_SUFFIXES)).toBe('attendee-store');
    expect(scrambleName('Repository', SCRAMBLE_SUFFIXES)).toBe('Repository');
    expect(scrambleName('Book', SCRAMBLE_SUFFIXES)).toBe('Book');
    const s = probe('S-nestjs-scrambled');
    expect(probePath('**/*.repository.ts', s, 'file')).toBe('**/*.store.ts');
    expect(probePath('src/*/domain/**/*Repository.ts', probe('S-ddd-scrambled'), 'file')).toMatch(/\*\*\/\*Store\.ts$/);
    expect(scramblePattern('*Repository|*Repo', SCRAMBLE_SUFFIXES)).toBe('*Store|*Repo');
  });

  it('rewrites specifiers to moved and renamed targets, and declared identifiers', () => {
    const s = probe('S-clean-architecture-scrambled');
    const idents = scrambledIdentifiers(['export interface BookRepository {}', 'export class InMemoryBookRepository {}'], s.suffixes);
    expect([...idents]).toEqual([['BookRepository', 'BookStore'], ['InMemoryBookRepository', 'InMemoryBookStore']]);
    const out = rewriteProbeSource(
      "import { BookRepository } from '../../domain/repositories/BookRepository';\nexport class InMemoryBookRepository implements BookRepository {}\n",
      'src/infrastructure/persistence/InMemoryBookRepository.ts', s, new Set(['src/domain', 'src/domain/repositories']), idents,
    );
    const w = s.wrapper[0] ?? '';
    expect(out).toBe(`import { BookStore } from '../../${s.segments.domain ?? ''}/repositories/BookStore';\nexport class InMemoryBookStore implements BookStore {}\n`);
    expect(probePath('src/infrastructure/persistence/InMemoryBookRepository.ts', s, 'file')).toBe(`src/${w}/${s.segments.infrastructure ?? ''}/persistence/InMemoryBookStore.ts`);
  });

  it('applies a probe to a project copy in place', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-probe-'));
    try {
      fs.mkdirSync(path.join(dir, 'src/domain/model'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'src/app'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src/domain/model/A.ts'), 'export class A {}\n');
      fs.writeFileSync(path.join(dir, 'src/app/B.ts'), "import { A } from '../domain/model/A';\nexport const b = new A();\n");
      applyProbe(dir, def);
      expect(fs.readFileSync(path.join(dir, 'src/app/B.ts'), 'utf8')).toBe("import { A } from '../kern/mid/model/A';\nexport const b = new A();\n");
      expect(fs.existsSync(path.join(dir, 'src/kern/mid/model/A.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'src/domain'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('held-out probes on the reference projects (validity only, no inference)', () => {
  const refs = loadAllReferences(ROOT);
  let work: string;
  beforeAll(() => {
    work = makeTempRoot('ise-probes-');
  });
  afterAll(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  for (const t of ISE_HELDOUT_TARGETS) {
    it(`${t.id}: the clean variant type-checks, its ground truth points at its files, the mapped true spec validates`, async () => {
      const ref = refs.find((r) => r.style === t.style);
      const clean = ref?.variants.find((v) => v.manifest.kind === 'clean');
      if (ref === undefined || clean === undefined) throw new Error(t.id);
      const dir = materialiseTarget(ref, clean, t, work);
      expect(typecheckProject(dir)).toEqual([]);
      for (const e of renamedExpectedLayers(ref, t)) expect(fs.existsSync(path.join(dir, e.path))).toBe(true);
      const text = trueSpecText(ref, t);
      const spec = YAML.parse(text) as { architecture: { layers: { directories?: string[] }[] } };
      expect(spec.architecture.layers.length).toBeGreaterThan(0);
      const file = path.join(work, `${t.id}.true.yaml`);
      fs.writeFileSync(file, text);
      const parsed = await parseSpec({ specFilePath: file });
      if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
      expect(validateSpecAgainstProject(parsed.data, dir, { rules: 'v1.3' }).errors).toEqual([]);
    });
  }
});
