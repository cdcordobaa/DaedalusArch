/**
 * The blind union sheet and its multi-rater agreement (Docs/v1.3/human-labelling-protocol.md), on synthetic cases and
 * on one development reference style (a stand-in; no hold-out data exists in the repository).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  EDGE_TEMPLATES, buildCaseItems, caseLabels, claimFor, importLine, mayReference, parseUnionAnswers, renderUnionAgreement,
  renderedClaim, selectCases, selectUnion, unionAgreement, unionAsSampled, unionKeyRows, unionSheet,
} from '../../../../../scripts/v1.3/lib/labelling/union.js';
import type { UnionItem, UnionKeyRow } from '../../../../../scripts/v1.3/lib/labelling/union.js';
import { claimText } from '../../../../../scripts/v1.3/lib/labelling/meaningful-prompt.js';
import { auditMain } from '../../../../../scripts/v1.3/lib/labelling/mains.js';
import type { LoadedReference, VariantKind } from '../../../../../scripts/v1.3/lib/reference-model.js';

const ROOT = path.resolve(__dirname, '../../../../..');
const RUN = path.join(ROOT, 'results/v1.3-reference/after-member-facts');

const LAYERS: Record<string, string> = {
  'src/domain/Order.ts': 'domain', 'src/domain/Money.ts': 'domain', 'src/app/PlaceOrder.ts': 'application',
  'src/app/ListOrders.ts': 'application', 'src/infra/Db.ts': 'infrastructure', 'src/infra/Http.ts': 'infrastructure',
};
const layerOf = (f: string): string | null => LAYERS[f] ?? null;

const SOURCES = new Map<string, string>([
  ['src/domain/Order.ts', "import { Money } from './Money';\nimport { PlaceOrder } from '../app/PlaceOrder';\n// the domain imports the application\nexport class Order {}\n"],
  ['src/domain/Money.ts', 'export class Money {}\n'],
  ['src/app/PlaceOrder.ts', "import { Order } from '../domain/Order';\nimport { Db } from '../infra/Db';\nexport class PlaceOrder {}\n"],
  ['src/app/ListOrders.ts', "import type { Order } from '../domain/Order';\nexport class ListOrders {}\n"],
  ['src/infra/Db.ts', "import express from 'express';\nexport class Db {}\n"],
  ['src/infra/Http.ts', "import { PlaceOrder } from '../app/PlaceOrder';\nexport class Http {}\n"],
]);

function ref(variants: { id: string; kind: VariantKind; expected?: { ruleId: string; file: string; target?: string }[] }[]): LoadedReference {
  return {
    style: 'clean-architecture', format: 'patch', dir: '/x', projectDir: '/x/project', specPath: '/x/spec.yaml',
    descriptor: {
      schemaVersion: 1, style: 'clean-architecture', spec: 'spec.yaml', project: 'p', canonicalSource: 's', styleDefinition: [], authored: '2026-10-15',
      writtenBeforeToolRun: true, notApplicable: [], noViolatingVariant: [], outOfScope: '', variants: variants.map((v) => v.id),
      scopeRules: [
        { ruleId: 'FF-S01', ruleName: 'dependency-direction', severity: 'critical', blockingCandidate: true },
        { ruleId: 'FF-S02', ruleName: 'no-cyclic-deps', severity: 'critical', blockingCandidate: true },
        { ruleId: 'FF-P01', ruleName: 'domain-purity', severity: 'critical', blockingCandidate: true },
        { ruleId: 'FF-C03', ruleName: 'component-instability', severity: 'advisory', blockingCandidate: false },
      ],
    },
    graph: {
      schemaVersion: 1, style: 'clean-architecture', variant: 'clean', note: '',
      files: Object.entries(LAYERS).map(([p, layer]) => ({ path: p, layer })),
      edges: [
        { from: 'src/app/PlaceOrder.ts', to: 'src/domain/Order.ts', kind: 'import' },
        { from: 'src/infra/Http.ts', to: 'src/app/PlaceOrder.ts', kind: 'import' },
      ],
    },
    variants: variants.map((v) => ({
      manifest: {
        schemaVersion: 1, style: 'clean-architecture', variant: v.id, kind: v.kind, plants: v.kind === 'violation' ? 'FF-S01' : null, description: '', patch: null,
        expectedFindings: (v.expected ?? []).map((e) => ({ ...e, ruleName: 'x', reason: 'r' })),
      },
      patchPath: null,
    })),
  };
}

const R = ref([
  { id: 'clean', kind: 'clean' },
  { id: 'v01-domain-imports-app', kind: 'violation', expected: [{ ruleId: 'FF-S01', file: 'src/domain/Order.ts', target: 'src/app/PlaceOrder.ts' }, { ruleId: 'FF-P01', file: 'src/infra/Db.ts', target: 'express' }] },
  { id: 'n01-near', kind: 'near-miss' },
]);

describe('wording and import checks', () => {
  it('writes the same claim from rule, file, target and layers, with no rule id', () => {
    expect(claimFor('dependency-direction', 'src/domain/Order.ts', 'src/app/PlaceOrder.ts', layerOf)).toBe('src/domain/Order.ts (domain) imports from src/app/PlaceOrder.ts (application)');
    expect(claimFor('no-cyclic-deps', 'src/b.ts', 'src/a.ts', layerOf)).toBe('Circular dependency between src/a.ts, src/b.ts');
    expect(claimFor('domain-purity', 'src/domain/Order.ts', 'typeorm', layerOf)).toBe('Domain file src/domain/Order.ts imports forbidden package typeorm');
    expect(claimFor('something-new', 'src/x.ts', undefined, layerOf)).toBe('src/x.ts breaks a constraint of the style');
    for (const t of EDGE_TEMPLATES) expect(claimFor(t, 'src/a.ts', 'src/b.ts', layerOf)).not.toMatch(/FF-[A-Z]+\d+/);
  });

  it('detects relative, barrel, alias and package imports conservatively', () => {
    const src = "import { A } from '../app/PlaceOrder';\nimport * as d from '../domain';\nimport { X } from '@app/ListOrders';\nimport 'reflect-metadata';\nimport { Router } from 'express/lib/router';\n";
    const f = 'src/infra/Http.ts';
    expect(mayReference(f, src, 'src/app/PlaceOrder.ts')).toBe(true);
    expect(mayReference(f, src, 'src/domain/Money.ts')).toBe(true); // through the barrel directory
    expect(mayReference(f, src, 'src/app/ListOrders.ts')).toBe(true); // alias ending in its name
    expect(mayReference(f, src, 'src/infra/Db.ts')).toBe(false);
    expect(mayReference(f, src, 'express')).toBe(true);
    expect(mayReference(f, src, 'typeorm')).toBe(false);
    expect(importLine(f, src, 'src/app/ListOrders.ts')).toBe(3);
    expect(importLine(f, src, 'src/infra/Db.ts')).toBeUndefined();
  });
});

describe('buildCaseItems', () => {
  const tool = [
    { ruleId: 'FF-S01', file: 'src/domain/Order.ts', target: 'src/app/PlaceOrder.ts' },
    { ruleId: 'FF-S01', file: 'src/app/ListOrders.ts', target: 'src/domain/Order.ts' },
    { ruleId: 'FF-C03', file: 'src/app/PlaceOrder.ts' },
  ];
  const build = (variant: string, t = tool, decoysPerCase: 1 | 2 = 2): ReturnType<typeof buildCaseItems> =>
    buildCaseItems({ ref: R, variant, tool: t, sources: SOURCES, layerOf }, { seed: 7, decoysPerCase, tiers: 'blocking' });

  it('splits the union into both, manifest-only and tool-only, blocking rules only', () => {
    const { items } = build('v01-domain-imports-app');
    const real = items.filter((i) => i.source !== 'decoy');
    expect(real.map((i) => [i.source, i.ruleId, i.file])).toEqual([
      ['both', 'FF-S01', 'src/domain/Order.ts'],
      ['manifest-only', 'FF-P01', 'src/infra/Db.ts'],
      ['tool-only', 'FF-S01', 'src/app/ListOrders.ts'],
    ]);
    // The line is the target's import line, whatever the source.
    expect(real.map((i) => i.line)).toEqual([2, 1, 1]);
    expect(real.every((i) => !i.expectedNegative)).toBe(true);
  });

  it('builds false decoys: no decoy claims an import the file has', () => {
    const { items, decoyShortfall } = build('v01-domain-imports-app');
    const decoys = items.filter((i) => i.source === 'decoy');
    expect(decoys).toHaveLength(2);
    expect(decoyShortfall).toBe(0);
    for (const d of decoys) {
      expect(d.expectedNegative).toBe(true);
      expect(mayReference(d.file, SOURCES.get(d.file) ?? '', d.target ?? '')).toBe(false);
      expect(d.decoy?.check).toMatch(/no import specifier/);
    }
    const again = build('v01-domain-imports-app').items.filter((i) => i.source === 'decoy');
    expect(again.map((d) => d.key)).toEqual(decoys.map((d) => d.key));
  });

  it('tool-only rows on near-misses are expected negatives; a case without findings flips a graph edge', () => {
    const nm = build('n01-near', [{ ruleId: 'FF-S01', file: 'src/app/ListOrders.ts', target: 'src/domain/Order.ts' }]);
    expect(nm.items.find((i) => i.source === 'tool-only')?.expectedNegative).toBe(true);
    const clean = build('clean', [], 1);
    expect(clean.items).toHaveLength(1);
    const d = clean.items[0];
    expect(d?.decoy?.kind).toBe('graph-flip');
    expect(d?.claim).toMatch(/^src\/(domain\/Order|app\/PlaceOrder)\.ts \((domain|application)\) imports from src\/(app\/PlaceOrder|infra\/Http)\.ts/);
  });
});

function item(i: number, style: string, source: UnionItem['source'], neg = source === 'decoy'): UnionItem {
  return {
    key: `${style}-${source}-${String(i).padStart(3, '0')}`, projectId: `${style}/v${String(i % 7)}`, style, variant: `v${String(i % 7)}`, kind: 'violation',
    source, ruleId: 'FF-S01', ruleName: 'dependency-direction', file: `src/f${String(i)}.ts`, target: 'src/t.ts', line: 1, claim: `claim ${String(i)}`, expectedNegative: neg,
  };
}

describe('selectUnion', () => {
  const styles = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];
  const pool = styles.flatMap((s) => [
    ...Array.from({ length: 20 }, (_, i) => item(i, s, 'both')),
    ...Array.from({ length: 6 }, (_, i) => item(100 + i, s, 'tool-only')),
    ...Array.from({ length: 3 }, (_, i) => item(200 + i, s, 'manifest-only')),
    ...Array.from({ length: 10 }, (_, i) => item(300 + i, s, 'decoy')),
  ]);

  it('draws n items with about 25% negatives, every stratum represented, deterministically', () => {
    for (const n of [60, 120]) {
      const d = selectUnion(pool, n, 11);
      expect(d.items).toHaveLength(n);
      expect(d.negatives).toBe(Math.round(0.25 * n));
      expect(d.items.filter((i) => i.expectedNegative)).toHaveLength(d.negatives);
      expect(Object.keys(d.allocation)).toHaveLength(20);
      expect(d.warnings).toEqual([]);
      expect(selectUnion([...pool].reverse(), n, 11).items.map((i) => i.key)).toEqual(d.items.map((i) => i.key));
    }
    expect(selectUnion(pool, 60, 12).items.map((i) => i.key)).not.toEqual(selectUnion(pool, 60, 11).items.map((i) => i.key));
    // Small strata are taken whole.
    expect(selectUnion(pool, 120, 11).allocation['ddd/manifest-only']).toBe(3);
  });

  it('shrinks rather than inflating the negative share when positives run short', () => {
    const few = [...Array.from({ length: 9 }, (_, i) => item(i, 'ddd', 'both')), ...Array.from({ length: 30 }, (_, i) => item(50 + i, 'ddd', 'decoy'))];
    const d = selectUnion(few, 60, 1);
    expect(d.items).toHaveLength(12);
    expect(d.negatives).toBe(3);
    expect(d.warnings[0]).toMatch(/the sheet has 12 items, not 60/);
  });

  it('subsamples 20 cases for the anything-else pass', () => {
    const d = selectUnion(pool, 120, 3);
    const cases = selectCases(d.items, 3);
    expect(cases).toHaveLength(20);
    expect(new Set(cases).size).toBe(20);
  });
});

describe('rendering, key and labeller items', () => {
  const chosen = [item(1, 'layered', 'both'), item(2, 'ddd', 'decoy')];
  it('the sheet shows no source, rule id or template; the key holds them', () => {
    const md = unionSheet(chosen, () => 'export const x = 1; // the answer is yes\n', caseLabels(chosen, 1));
    expect(md).toContain('| U001 | C0');
    expect(md).not.toMatch(/decoy|both|FF-S01|dependency-direction|answer is yes/);
    const key = unionKeyRows(chosen);
    expect(key[1]).toMatchObject({ itemId: 'U002', source: 'decoy', ruleId: 'FF-S01', expectedNegative: true });
  });

  it('the labeller sees the same claim as the raters', () => {
    const [s] = unionAsSampled([item(5, 'nestjs', 'tool-only')]);
    if (s === undefined) throw new Error('no item');
    expect(claimText(s)).toBe(renderedClaim(item(5, 'nestjs', 'tool-only')));
    expect(s.ruleId).toBe('');
  });

  it('parses a filled sheet and a CSV', () => {
    const md = '| ID | Case | Style | Location | Claim | [Answer] | Note |\n|---|---|---|---|---|---|---|\n| U001 | C01 | layered | `a` | x \\| y | **Yes** | fine |\n| U002 | C02 | ddd | `b` | z |  |  |\n';
    expect(parseUnionAnswers(md, false)).toEqual([{ itemId: 'U001', answer: 'yes', note: 'fine' }, { itemId: 'U002', answer: '', note: '' }]);
    expect(parseUnionAnswers('itemId,answer,note\nU001,No,a, b\n', true)).toEqual([{ itemId: 'U001', answer: 'no', note: 'a, b' }]);
  });
});

describe('unionAgreement', () => {
  const sources: UnionKeyRow['source'][] = ['both', 'both', 'tool-only', 'manifest-only', 'decoy', 'decoy', 'both', 'tool-only'];
  const key: UnionKeyRow[] = sources.map((source, i) => ({
    itemId: `U00${String(i + 1)}`, key: `k${String(i)}`, projectId: 'p/v', style: 'layered', variant: 'v', kind: 'violation', source,
    ruleId: 'FF-S01', ruleName: 'dependency-direction', file: 'src/a.ts', expectedNegative: source === 'decoy',
  }));
  const answers = (xs: string[]): Map<string, string> => new Map(xs.map((x, i) => [`U00${String(i + 1)}`, x]));

  it('gives κ = AC1 = 1 for identical raters and counts decoy false accepts', () => {
    const a = ['yes', 'yes', 'no', 'yes', 'no', 'yes', 'yes', 'uncertain'];
    const r = unionAgreement(key, new Map([['second', answers(a)], ['author', answers(a)]]));
    expect(r.pairs[0]?.binary.kappa).toBeCloseTo(1);
    expect(r.pairs[0]?.binary.ac1).toBeCloseTo(1);
    expect(r.pairs[0]?.gate.pass).toBe(true);
    expect(r.fleissKappaBinary).toBeCloseTo(1);
    const s = r.summaries[0];
    expect(s?.decoyFalseAccept).toMatchObject({ k: 1, n: 2 });
    expect(s?.toolYes).toMatchObject({ k: 3, n: 5 });
    expect(s?.manifestYes).toMatchObject({ k: 4, n: 4 });
    expect(s?.uncertain).toBe(1);
    expect(r.primary).toBe('second');
  });

  it('pairs every rater, reports unanswered and invalid answers, and needs two raters', () => {
    const r = unionAgreement(key, new Map([
      ['second', answers(['yes', 'no', 'no', 'yes', 'no', 'no', 'yes', 'no'])],
      ['author', answers(['yes', 'yes', 'no', 'yes', 'no', 'no', 'no', ''])],
      ['gemini', answers(['yes', 'yes', 'yes', 'maybe', 'no', 'yes', 'yes', 'no'])],
    ]));
    expect(r.pairs.map((p) => `${p.a}-${p.b}`)).toEqual(['second-author', 'second-gemini', 'author-gemini']);
    expect(r.pairs[0]?.binary.n).toBe(7);
    expect(r.summaries[1]?.unanswered).toEqual(['U008']);
    expect(r.summaries[2]?.invalid).toEqual(['U004']);
    expect(r.fleissItems).toBe(6);
    expect(renderUnionAgreement(r)).toContain('| second – author | 7 |');
    expect(() => unionAgreement(key, new Map([['x', answers([])]]))).toThrow(/two raters/);
  });
});

describe('audit-sheet union and union-agreement on a development style (stand-in)', () => {
  let tmp: string;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-union-test-'));
  });
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes the sheet, the anything-else pass, a separate key and labeller inputs, then scores two raters', () => {
    const out: string[] = [];
    const io = { env: {}, out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    const sheet = path.join(tmp, 'sheet.md');
    const keyFile = path.join(tmp, 'key', 'key.json');
    const code = auditMain(['union', '--run', RUN, '--materialise', path.join(tmp, 'mat'), '--seed', '5', '--n', '60', '--style', 'layered,hexagonal',
      '--sheet-out', sheet, '--key-out', keyFile, '--sample-out', path.join(tmp, 'sample.json'), '--jobs-out', path.join(tmp, 'jobs.json')], io, ROOT);
    expect(code).toBe(0);
    const key = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as { rows: UnionKeyRow[]; size: number; negatives: number; anythingElse: unknown[]; cases: Record<string, string> };
    expect(key.size).toBe(key.rows.length);
    expect(key.negatives / key.size).toBeCloseTo(0.25, 1);
    expect(key.anythingElse).toHaveLength(20);
    const md = fs.readFileSync(sheet, 'utf8');
    expect(md.match(/^\| U\d{3} \|/gm)).toHaveLength(key.size);
    expect(md).not.toMatch(/FF-[A-Z]+\d{2}|decoy|manifest-only|tool-only/);
    expect(fs.readFileSync(path.join(tmp, 'sheet.anything-else.md'), 'utf8')).toContain('[Other violations]');
    const sample = JSON.parse(fs.readFileSync(path.join(tmp, 'sample.json'), 'utf8')) as { items: { key: string }[] };
    expect(sample.items.map((i) => i.key)).toEqual(key.rows.map((r) => r.key));

    // Two raters fill the sheet: one answers by the key, one accepts every decoy and disagrees on every fifth item.
    const fill = (flip: (i: number) => boolean): string => md.split('\n').map((l) => {
      const m = /^\| (U\d{3}) \|/.exec(l);
      if (m === null) return l;
      const i = Number((m[1] ?? 'U0').slice(1)) - 1;
      const row = key.rows[i];
      let a = row?.source === 'decoy' ? 'no' : 'yes';
      if (flip(i)) a = a === 'yes' ? 'no' : 'yes';
      return l.replace(/\| {2}\| {2}\|$/, `| ${a} |  |`);
    }).join('\n');
    fs.writeFileSync(path.join(tmp, 'r1.md'), fill(() => false));
    const flipped = (i: number): boolean => i % 5 === 0 || key.rows[i]?.source === 'decoy';
    fs.writeFileSync(path.join(tmp, 'r2.md'), fill(flipped));
    const decoys = key.rows.filter((r) => r.source === 'decoy').length;
    const agr = path.join(tmp, 'agreement.json');
    expect(auditMain(['union-agreement', '--key', keyFile, '--raters', `second=${path.join(tmp, 'r1.md')},author=${path.join(tmp, 'r2.md')}`, '--out', agr, '--md-out', path.join(tmp, 'agreement.md')], io, ROOT)).toBe(0);
    const report = JSON.parse(fs.readFileSync(agr, 'utf8')) as ReturnType<typeof unionAgreement>;
    expect(report.pairs[0]?.binary.n).toBe(key.size);
    expect(report.summaries[0]?.decoyFalseAccept.k).toBe(0);
    expect(decoys).toBeGreaterThan(0);
    expect(report.summaries[1]?.decoyFalseAccept).toMatchObject({ k: decoys, n: decoys });
    expect(report.pairs[0]?.binary.observed).toBeCloseTo(1 - key.rows.filter((_, i) => flipped(i)).length / key.size);
  }, 120_000);
});
