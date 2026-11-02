/**
 * V158 (2026-11-02, instrument v1.5.8, exploratory): the import and scope fact fixes of the v1.5 rule review
 * (`Docs/DiagnosticRuns/v15-rule-review-2026-11-02.md` #3, #5, #8, #17) and R-MIRROR2's one-word vendor values (the
 * Hexagonal hand read, t03). Fixtures: `tests/fixtures/v158-facts/` (one standalone tree; the rest are overlays on the
 * f24, hxa3 and f14 seeds and on the CAL-03 drones base). Zero model calls, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
import type { Finding } from '../../../src/v15-instrument/index.js';
import { importEqualsModules, ioCategoryOf, typeOnlyImport } from '../../../src/v15-instrument/facts.js';
import { loadSpec } from '../../../src/v15-instrument/spec.js';
import { codedValueSet } from '../../../src/v15-instrument/vendor-lexicon.js';
import { cypherMessage } from '../../../src/v15-instrument/rule-messages.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const FX = path.join(REPO, 'tests', 'fixtures', 'v158-facts');
const F24 = path.join(REPO, 'experiments', 'trap-families', 'f24-hex-laundry-lockers');
const F14 = path.join(REPO, 'experiments', 'trap-families', 'f14-hex-geocoding');
const HXA3 = path.join(REPO, 'experiments', 'hx-study-set', 'part-a', 'hxa3-balloon-flights');
const DRONES = path.join(REPO, 'experiments', 'cal-03', 'drones', 'base');

describe('v1.5.8 fact fixes', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v158-facts-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const all = loadRules();
  const run = async (name: string, base: string, overlay: string | null, spec: string, ids: string[], baseline?: string): Promise<Finding[]> => {
    const tree = path.join(scratch, name);
    fs.cpSync(base, tree, { recursive: true });
    if (overlay !== null) fs.cpSync(overlay, tree, { recursive: true });
    const r = await runTree(tree, all.filter((x) => ids.includes(x.id)), { spec, scratch: path.join(scratch, '_s'), withApg: false, ...(baseline !== undefined ? { baseline } : {}) });
    return r.findings.filter((f) => f.status === 'violation');
  };
  const subjects = (xs: Finding[], rule: string, file?: string): string[] => xs.filter((f) => f.rule === rule && (file === undefined || f.file === file)).map((f) => f.subject).sort();

  describe('review #3: adapter packages from the spec layers', () => {
    const tree = path.join(FX, 'hex-own-layers');
    it('the spec names the layer folder of each adapter file', () => {
      const spec = loadSpec(tree, path.join(tree, 'spec.yaml'));
      expect(spec.adapterLayerOf?.('src/http/OrderRoutes.ts')).toEqual({ name: 'http', kind: 'presentation', base: 'src/http', splitsSides: true });
      expect(spec.adapterLayerOf?.('src/adapters/pg/PgClient.ts')?.base).toBe('src/adapters');
      expect(spec.adapterLayerOf?.('src/domain/Order.ts')).toBeUndefined();
      // a glob with a wildcard folder names the concrete folder; a glob with `**` before the end names none
      const drones = loadSpec(DRONES, path.join(DRONES, 'spec.yaml'));
      expect(drones.adapterLayerOf?.('src/pilots/infrastructure/InMemoryPilotRepository.ts')?.base).toBe('src/pilots/infrastructure');
      expect(drones.adapterLayerOf?.('src/pilots/api/PilotController.ts')).toMatchObject({ kind: 'presentation', base: 'src/pilots/api' });
    });

    it('R-AXA sees src/http -> src/persistence and a flat src/adapters file; not imports inside one layer or one folder', async () => {
      const hits = await run('own-layers', tree, null, path.join(tree, 'spec.yaml'), ['R-AXA']);
      expect(hits.map((f) => `${f.file}|${f.subject}`).sort()).toEqual([
        'src/adapters/Flat.ts|src/adapters -> src/adapters/pg/PgClient.ts', // a file right in the container folder (regex: unseen)
        'src/http/OrderRoutes.ts|src/http -> src/persistence/PgOrderStore.ts', // a layer of its own (regex: unseen)
      ]);
    }, 120_000);

    it('R-ENTITY-OUT reads a declared presentation layer that the folder regex does not name', async () => {
      const hits = await run('own-layers-eo', tree, null, path.join(tree, 'spec.yaml'), ['R-ENTITY-OUT']);
      expect(subjects(hits, 'R-ENTITY-OUT', 'src/http/OrderRoutes.ts')).toEqual(['OrderRoutes.getOrder']);
    }, 120_000);

    it('a regex layout keeps its package names (the f24 reference finding is unchanged)', async () => {
      const hits = await run('f24-ref', path.join(F24, 'solutions', 'trap'), null, path.join(F24, 'spec.yaml'), ['R-AXA']);
      expect(subjects(hits, 'R-AXA', 'src/adapters/in/mqtt/LockBankMqtt.ts')).toEqual([
        'src/adapters/in/mqtt -> src/adapters/in/http/reply.ts',
        'src/adapters/in/mqtt -> src/adapters/out/memory/MemoryLockers.ts',
      ]);
    }, 120_000);
  });

  describe('review #5: re-exports, barrels and dynamic import() are edges', () => {
    let hits: Finding[] = [];
    beforeAll(async () => { hits = await run('f24-edges', path.join(F24, 'seed'), path.join(FX, 'f24-edges'), path.join(F24, 'spec.yaml'), ['R-AXA']); }, 120_000);

    it('a shared file that re-exports an outbound adapter is reported, and is no helper for its importers', () => {
      expect(subjects(hits, 'R-AXA', 'src/adapters/in/shared/index.ts')).toEqual(['src/adapters/in/shared -> src/adapters/out/memory/MemoryLockers.ts']);
      // the import of the shared barrel is reported (it is no helper now); the domain-only re-export is still a helper
      expect(subjects(hits, 'R-AXA', 'src/adapters/in/http/StockRoutes.ts')).toEqual(['src/adapters/in/http -> src/adapters/in/shared/index.ts']);
      expect(hits.some((f) => f.file === 'src/adapters/in/shared/time.ts')).toBe(false);
    });

    it('a dynamic import() and a name imported through a barrel outside the layers are reported', () => {
      expect(subjects(hits, 'R-AXA', 'src/adapters/in/http/LazyRoutes.ts')).toEqual(['src/adapters/in/http -> src/adapters/out/memory/MemoryDrops.ts']);
      expect(subjects(hits, 'R-AXA', 'src/adapters/in/http/BarrelRoutes.ts')).toEqual(['src/adapters/in/http -> src/adapters/out/memory/MemoryBuildings.ts']);
    });
  });

  describe('review #8: inline type modifiers, import = require, catalogue', () => {
    it('typeOnlyImport, importEqualsModules and ioCategoryOf', () => {
      const p = new Project({ useInMemoryFileSystem: true });
      const sf = p.createSourceFile('a.ts', "import { type Pool } from 'pg';\nimport { type A, B } from 'pg';\nimport type { C } from 'pg';\nimport 'pg';\nimport pg = require('pg');\nimport type pt = require('pg');\n");
      expect(sf.getImportDeclarations().map(typeOnlyImport)).toEqual([true, false, true, false]);
      expect(importEqualsModules(sf)).toEqual([{ module: 'pg', line: 5 }]);
      expect(['postgres', 'kysely', '@supabase/supabase-js', 'fs-extra', 'ky', 'pg', 'left-pad'].map(ioCategoryOf)).toEqual(['db', 'db', 'db', 'fs', 'http-client', 'db', null]);
    });

    it('R-COREIO: no finding for `import { type Pool }`, a finding for `import pg = require`; R-PURE likewise, plus the new catalogue', async () => {
      const hits = await run('f24-io', path.join(F24, 'seed'), path.join(FX, 'f24-io'), path.join(F24, 'spec.yaml'), ['R-COREIO', 'R-PURE']);
      const io = (file: string): string[] => hits.filter((f) => f.rule === 'R-COREIO' && f.file === file).map((f) => f.evidence).sort();
      expect(io('src/application/services/TypedPool.ts')).toEqual([]);
      expect(io('src/application/services/LegacyPg.ts')).toHaveLength(1);
      expect(io('src/application/services/LegacyPg.ts')[0]).toMatch(/import = require\('pg'\)/);
      const pure = hits.filter((f) => f.rule === 'R-PURE' && f.file === 'src/domain/QueryShape.ts').map((f) => f.evidence).join('\n');
      expect(pure).toMatch(/kysely/);
      expect(pure).toMatch(/fs-extra/);
      // one `pg` finding: `import pgRequired = require('pg')`; the inline-type `import { type Pool }` is not one
      expect(hits.filter((f) => f.rule === 'R-PURE' && f.file === 'src/domain/QueryShape.ts' && /imports pg \(/.test(f.evidence)).map((f) => f.line)).toEqual([4]);
    }, 120_000);
  });

  describe('review #17: R-D9 reads export * from a published file', () => {
    it('`export * from ./domain/pilot/Pilot` in the context index exposes Pilot; a star re-export of DTOs does not', async () => {
      const before = await run('drones-base', DRONES, null, path.join(DRONES, 'spec.yaml'), ['R-D9']);
      const after = await run('drones-star', DRONES, path.join(FX, 'drones-star'), path.join(DRONES, 'spec.yaml'), ['R-D9']);
      const added = after.filter((f) => !before.some((b) => b.file === f.file && b.subject === f.subject));
      expect(added.map((f) => `${f.file}|${f.subject}`)).toEqual(['src/pilots/index.ts|Pilot']);
      expect(added[0]!.evidence).toMatch(/via re-export \*/);
    }, 120_000);
  });

  describe('Hexagonal hand read t03: R-MIRROR2 one-word vendor values', () => {
    const spec = path.join(HXA3, 'spec.yaml');
    const seed = path.join(HXA3, 'seed');
    const words = (xs: Finding[]): Finding[] => xs.filter((f) => f.rule === 'R-MIRROR2' && f.evidence.startsWith('[word]'));

    it('a coded vendor value set is one with a member written as a code', () => {
      expect(codedValueSet(['accepted', 'insufficient_balance', 'voucher_blocked'])).toBe(true);
      expect(codedValueSet(['accepted', 'declined'])).toBe(false);
      expect(codedValueSet(['ROOFTOP'])).toBe(false);
    });

    it("the vendor's 'accepted' kept in the port union its adapter translates into, and decided on in the core, is reported", async () => {
      const hits = words(await run('hxa3-word', seed, path.join(FX, 'hxa3-word'), spec, ['R-MIRROR2'], seed));
      expect(hits.map((f) => `${f.file}|${f.subject}`)).toEqual(["src/application/ports/out/VoucherRedemptions.ts|Redemption.outcome 'accepted'"]);
      expect(hits[0]!.evidence).toMatch(/GiftjarRedemptionResult of giftjar-sdk/);
      const m = cypherMessage(hits[0]!, all.find((r) => r.id === 'R-MIRROR2'));
      expect(m.why).toMatch(/'accepted'/);
      expect(m.fix).toMatch(/giftjar-sdk/);
    }, 120_000);

    it('twins: a core set no vendor adapter imports, a comparison only, and a union the core never decides on are not reported', async () => {
      expect(words(await run('hxa3-far', seed, path.join(FX, 'hxa3-word-far'), spec, ['R-MIRROR2'], seed))).toEqual([]);
      expect(words(await run('hxa3-own', seed, path.join(FX, 'hxa3-word-own'), spec, ['R-MIRROR2'], seed))).toEqual([]);
      expect(words(await run('hxa3-union', seed, path.join(FX, 'hxa3-word-union-only'), spec, ['R-MIRROR2'], seed))).toEqual([]);
    }, 120_000);

    it('the seed is its own baseline: no word finding on it', async () => {
      expect(words(await run('hxa3-seed', seed, null, spec, ['R-MIRROR2'], seed))).toEqual([]);
    }, 120_000);

    it('left out: a one-word vendor field name (t09 `precision`) with core values is not reported', async () => {
      const f14seed = path.join(F14, 'seed');
      expect(words(await run('f14-word', f14seed, path.join(FX, 'f14-word'), path.join(F14, 'spec.yaml'), ['R-MIRROR2'], f14seed))).toEqual([]);
    }, 120_000);
  });
});
