/**
 * v1.5.11 (2026-11-04, exploratory): the fixes the HCAL-08 hand read asked for. HCAL-08 was scored once at v1.5.10
 * (`Docs/DiagnosticRuns/v15-hcal08-admission-2026-11-03.md`), so its cases are development material here. A case is
 * its domain's base with the case folder overlaid and the builder's glossary key cut from the case spec, as the
 * scoring copy does; the base is the baseline. Zero model calls, no Neo4j.
 *   1. the harness tsconfig takes the tree's own `baseUrl` and `paths`, so the in-tree vendor SDK resolves;
 *   2. R-APPVENDOR: an application or port file imports the package an adapter wraps;
 *   3. a pure barrel right in `adapters/out` is no adapter package of its own (R-AXA).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph, loadRules, projectResolution, runTree, writeTsconfig } from '../../../src/v15-instrument/graph.js';
import type { Finding } from '../../../src/v15-instrument/graph.js';
import { structureHolds } from '../../../src/v15-instrument/mirror-sem.js';
import { cypherMessage } from '../../../src/v15-instrument/rule-messages.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const SET = path.join(REPO, 'experiments', 'hcal-08');
const KEY_HEADER = '# --- HCAL-08 builder glossary key';

describe('v1.5.11: HCAL-08 fixes', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-1511-'));
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const all = loadRules();
  const tree = (domain: string, c: string | null): string => {
    const t = path.join(scratch, domain, c ?? 'base');
    if (fs.existsSync(t)) return t;
    fs.cpSync(path.join(SET, domain, 'base'), t, { recursive: true });
    if (c !== null) fs.cpSync(path.join(SET, domain, 'cases', c), t, { recursive: true });
    const spec = path.join(t, 'spec.yaml');
    const text = fs.readFileSync(spec, 'utf8');
    const i = text.indexOf(KEY_HEADER);
    if (i >= 0) fs.writeFileSync(spec, `${text.slice(0, i).replace(/\n+$/, '')}\n`);
    return t;
  };
  const hits = async (domain: string, c: string | null, rule: string): Promise<Finding[]> => {
    const t = tree(domain, c);
    const r = await runTree(t, all.filter((x) => x.id === rule), { spec: path.join(t, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, baseline: path.join(SET, domain, 'base') });
    return r.findings.filter((f) => f.status === 'violation' && f.rule === rule);
  };

  describe('1. the tree\'s own baseUrl and paths', () => {
    it('reads paths through TypeScript, targets made absolute; a tree without a tsconfig gets the earlier tsconfig', () => {
      const t = tree('glacier-guiding', null);
      expect(projectResolution(t)).toEqual({ paths: { 'icetrail-sdk': [path.join(t, 'vendor', 'icetrail-sdk', 'index.d.ts')] } });
      const bare = path.join(scratch, 'no-tsconfig');
      fs.mkdirSync(path.join(bare, 'src'), { recursive: true });
      expect(projectResolution(bare)).toEqual({});
      const co = (JSON.parse(fs.readFileSync(writeTsconfig(bare, path.join(scratch, '_t')), 'utf8')) as { compilerOptions: Record<string, unknown> }).compilerOptions;
      expect(Object.keys(co)).toEqual(['strict', 'target', 'lib', 'module', 'moduleResolution', 'esModuleInterop', 'skipLibCheck', 'noEmit', 'types', 'experimentalDecorators']);
    });

    it('baseUrl is taken (absolute) and paths resolve against it; extends is followed', () => {
      const t = path.join(scratch, 'extends');
      fs.mkdirSync(path.join(t, 'src'), { recursive: true });
      fs.writeFileSync(path.join(t, 'tsconfig.base.json'), '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@sdk/*": ["../vendor/*"] } } }\n');
      fs.writeFileSync(path.join(t, 'tsconfig.json'), '{ "extends": "./tsconfig.base.json", // a comment\n "compilerOptions": { "strict": true } }\n');
      expect(projectResolution(t)).toEqual({ baseUrl: path.join(t, 'src'), paths: { '@sdk/*': [path.join(t, 'vendor', '*')] } });
    });

    it('the three KEY-pos2 cases form their form-C candidate without copying the SDK to node_modules', async () => {
      const expected: [string, string][] = [
        ['glacier-guiding', 'src/domain/permit-rules.ts#outcomeOf:compare(state)'],
        ['luthier-workshop', 'src/domain/surcharge.ts#SURCHARGE_BY_GRADE'],
        ['orchard-cooperative', 'src/domain/payout.ts#payoutRateFor:switch(grade)'],
      ];
      for (const [domain, want] of expected) {
        const t = tree(domain, 'KEY-pos2');
        expect(fs.existsSync(path.join(t, 'node_modules'))).toBe(false);
        const { facts } = await buildGraph(t, { spec: path.join(t, 'spec.yaml'), withApg: false, scratch: path.join(scratch, '_s'), baseline: path.join(SET, domain, 'base') });
        const asked = facts.mirrorCandidates.filter((c) => c.coreKind === 'keys' && structureHolds(c)).map((c) => `${c.file}#${c.coreSet}`);
        expect(asked).toEqual([want]);
      }
    }, 240_000);
  });

  describe('2. R-APPVENDOR', () => {
    const rule = all.find((r) => r.id === 'R-APPVENDOR');
    it('is exploratory: on no Hexagonal row, so neither counted nor delivered', async () => {
      const { HEX_ROW_RULES, scoredRules } = await import('../../../src/v15-instrument/rule-set.js');
      expect(rule).toBeDefined();
      expect(rule!.text).toMatch(/^\/\/ status \(v1\.5\.11, 2026-11-04\): exploratory, not admitted, on no row and not delivered/m);
      expect(Object.values(HEX_ROW_RULES).flat()).not.toContain('R-APPVENDOR');
      expect(scoredRules('hexagonal')).not.toContain('R-APPVENDOR');
    });

    it('fires on the application-layer vendor imports HCAL-08 missed, at the labelled line, in every form', async () => {
      const cases: [string, string, string, number, string][] = [
        ['glacier-guiding', 'EDGE-pos2', 'src/application/book-tour.use-case.ts', 23, 'dynamic'],
        ['glacier-guiding', 'EDGE-pos4', 'src/application/adapters/icetrail-permit.adapter.ts', 1, 'import'],
        ['luthier-workshop', 'EDGE-pos2', 'src/application/order-parts.use-case.ts', 1, 'type-import'],
        ['orchard-cooperative', 'EDGE-pos1', 'src/application/ports/index.ts', 5, 'export-from'],
        ['orchard-cooperative', 'EDGE-pos2', 'src/application/send-to-press.use-case.ts', 1, 'import-equals'],
      ];
      for (const [domain, c, file, line, form] of cases) {
        const h = (await hits(domain, c, 'R-APPVENDOR')).filter((f) => f.file === file);
        expect(h.map((f) => [f.line, new RegExp(`\\(${form}\\), the package the adapter `).test(f.evidence)])).toContainEqual([line, true]);
      }
      const [f] = (await hits('orchard-cooperative', 'EDGE-pos2', 'R-APPVENDOR'));
      const m = cypherMessage(f!, rule);
      expect(m.why).toMatch(/depends on pressmark-sdk \(import-equals\), the vendor package that src\/adapters\/out\/.+ wraps/);
      expect(m.fix).toMatch(/^Remove pressmark-sdk from src\/application\/send-to-press\.use-case\.ts\./);
    }, 240_000);

    it('clean: the three bases and the EDGE twins', async () => {
      for (const d of ['glacier-guiding', 'luthier-workshop', 'orchard-cooperative']) expect(await hits(d, null, 'R-APPVENDOR')).toEqual([]);
      const twins: [string, string][] = [
        ['glacier-guiding', 'EDGE-twin1'], ['glacier-guiding', 'EDGE-twin2'],
        ['luthier-workshop', 'EDGE-twin1'], ['luthier-workshop', 'EDGE-twin2'], ['luthier-workshop', 'EDGE-twin3'], ['luthier-workshop', 'EDGE-twin4'],
        ['orchard-cooperative', 'EDGE-twin1'], ['orchard-cooperative', 'EDGE-twin2'], ['orchard-cooperative', 'EDGE-twin3'], ['orchard-cooperative', 'EDGE-twin4'],
      ];
      for (const [d, c] of twins) expect([d, c, await hits(d, c, 'R-APPVENDOR')]).toEqual([d, c, []]);
    }, 300_000);
  });

  describe('3. a barrel right in adapters/out', () => {
    it('glacier EDGE-twin1: the adapters barrel used by main.ts is no out->out edge (R-AXA clean)', async () => {
      expect(await hits('glacier-guiding', 'EDGE-twin1', 'R-AXA')).toEqual([]);
    }, 120_000);
  });
});
