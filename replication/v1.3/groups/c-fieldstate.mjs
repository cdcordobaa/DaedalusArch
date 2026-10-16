// Field-level state facts (HOLDS_STATE_OF), Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md Part A: regenerated
// with scripts/v1.3/fieldstate-measure.ts on the committed reference set, plus the in-repo fixture recount and the unit
// tests the doc cites (jest, targeted files only).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOC = 'Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md';
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---- Part A.1 table (doc lines 60-65) -----------------------------------------------------------------------------
const STYLES1 = [['clean-architecture', 60], ['layered', 61], ['nestjs', 62], ['hexagonal', 63], ['ddd', 64], ['total', 65]];
const COLS1 = ['variants', 'flows', 'holds', 'declared-type', 'property-injection', 'initializer', 'constructor-new', 'constructor-param', 'rest'];
const T1 = {
  'clean-architecture': ['14', '29', '71', '0', '0', '71', '0', '0', '14/14'],
  layered: ['13', '13', '13', '0', '0', '13', '0', '0', '13/13'],
  nestjs: ['14', '15', '59', '2', '0', '57', '0', '0', '14/14'],
  hexagonal: ['15', '47', '92', '0', '0', '92', '0', '0', '15/15'],
  ddd: ['15', '15', '90', '60', '0', '30', '0', '0', '15/15'],
  total: ['71', '119', '325', '62', '0', '263', '0', '0', '71/71'],
};
// ---- Part A.2 table (doc lines 80-89) -----------------------------------------------------------------------------
const ROWS2 = [
  ['clean-architecture', 'clean', 80], ['clean-architecture', 'near-miss', 81], ['clean-architecture', 'violation', 82],
  ['nestjs', 'clean', 83], ['nestjs', 'near-miss', 84], ['nestjs', 'violation', 85],
  ['hexagonal', 'clean', 86], ['hexagonal', 'near-miss', 87], ['hexagonal', 'violation', 88],
  ['layered', 'all', 89],
];
const COLS2 = ['variants', 'field-flows', 'field-holds', 'ci-rows', 'expecting', 'caught-flows', 'caught-holds', 'fp-flows', 'fp-holds'];
const T2 = {
  clean: ['1', '0', '0', '0', '0', '—', '—', '0', '0'],
  'near-miss': ['3', '0', '0', '0', '0', '—', '—', '0', '0'],
  violation: ['10', '1', '1', '0', '1', '1/1', '1/1', '0', '0'],
  hexviolation: ['11', '1', '1', '0', '1', '1/1', '1/1', '0', '0'],
  layered: ['13', '0', '0', '53', '0', '—', '—', '0', '0'],
};
const t2stated = (style, kind) => (style === 'layered' ? T2.layered : style === 'hexagonal' && kind === 'violation' ? T2.hexviolation : T2[kind]);

const numbersA = [
  { id: 'c-fs-styles', line: 3, what: 'reference set: styles', stated: '5 styles' },
  { id: 'c-fs-variants', line: 3, what: 'reference set: variants', stated: '71 variants' },
  { id: 'c-fs-all-variants', line: 56, what: 'variants extracted with V13_FIELD_STATE_OPTIONS', stated: 'All 71 variants' },
  ...STYLES1.flatMap(([s, line]) => COLS1.map((c, i) => ({ id: `c-fs-t1-${s}-${c}`, line, what: `A.1 table, ${s}: ${c}`, stated: T1[s][i] }))),
  { id: 'c-fs-ratio', line: 68, what: 'HOLDS_STATE_OF / FLOWS_TO edge ratio', stated: '2.7×' },
  { id: 'c-fs-nest-declared', line: 70, what: 'NestJS declared-type HOLDS_STATE_OF fields', stated: 'two NestJS fields' },
  { id: 'c-fs-empty-kinds', line: 71, what: 'source kinds with 0 edges on the reference set', stated: 'Three kinds are empty' },
  { id: 'c-fs-fixtures-n', line: 72, what: 'fixtures/ projects in the v1.2E byte-identity list (at 037e8c9e; HEAD has 17, the 4 ap-hosts added later)', stated: '13' },
  { id: 'c-fs-fixtures-flows', line: 72, what: 'in-repo fixtures: FLOWS_TO edges', stated: 'FLOWS_TO is 3' },
  { id: 'c-fs-fixtures-holds', line: 72, what: 'in-repo fixtures: HOLDS_STATE_OF edges (all initializer)', stated: 'HOLDS_STATE_OF 9 (all `initializer`)' },
  { id: 'c-fs-fixtures-ci', line: 72, what: 'in-repo fixtures: CONSTRUCTOR_INJECTS edges', stated: 'CONSTRUCTOR_INJECTS 14' },
  ...ROWS2.flatMap(([s, k, line]) => COLS2.map((c, i) => ({ id: `c-fs-t2-${s}-${k}-${c}`, line, what: `A.2 table, ${s} ${k}: ${c}`, stated: t2stated(s, k)[i] }))),
  { id: 'c-fs-field-rows', line: 100, what: 'field rows, both views (= planted FF-P06 violations)', stated: 'the same three field rows' },
  { id: 'c-fs-field-caught', line: 100, what: 'planted FF-P06 field violations caught', stated: '3/3' },
  { id: 'c-fs-new-fp', line: 100, what: 'new false positives on clean and near-miss variants of FF-P06 styles', stated: '0 new false positives' },
  { id: 'c-fs-clean-nm', line: 100, what: 'clean and near-miss variants of the FF-P06 styles', stated: '3 clean and 9 near-miss variants' },
  { id: 'c-fs-325', line: 101, what: 'HOLDS_STATE_OF edges on the reference set', stated: '325' },
  { id: 'c-fs-denominator', line: 106, what: 'measured field-half denominator', stated: '3 field rows (3 expected, 3 found, 0 false)' },
  { id: 'c-fs-325-119', line: 106, what: 'HOLDS_STATE_OF against FLOWS_TO edges', stated: '325 edges against 119' },
].map((n) => ({ doc: DOC, ...n }));

// In-repo fixture recount (doc line 72): every fixtures/ project of the pinned v1.2E byte-identity list as it was at the
// doc's code commit (the 4 fixtures/unit/ap-hosts projects were added after it), extracted with V13_FIELD_STATE_OPTIONS.
const FIXTURE_PROBE = `
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const R = process.argv[2];
void (async () => {
  const { extractAPG } = await import(pathToFileURL(R + '/src/apg-extractor/index.ts').href);
  const { V13_FIELD_STATE_OPTIONS } = await import(pathToFileURL(R + '/src/apg-extractor/types.ts').href);
  const pinned = JSON.parse(fs.readFileSync(R + '/tests/fixtures/v1.3-byte-identity/v12e-hashes.json', 'utf8')).v12e;
  const all = Object.keys(pinned).filter((p) => p.startsWith('fixtures/'));
  const projs = all.filter((p) => !p.startsWith('fixtures/unit/ap-hosts/'));
  const c: Record<string, number> = {}; const src: Record<string, number> = {};
  for (const p of projs) {
    const r = await extractAPG(p, V13_FIELD_STATE_OPTIONS);
    if (!r.success) throw new Error(p);
    for (const e of r.data.edges) { c[e.type] = (c[e.type] ?? 0) + 1; if (e.type === 'HOLDS_STATE_OF') src[String(e.properties.source)] = (src[String(e.properties.source)] ?? 0) + 1; }
  }
  console.log(JSON.stringify({ n: projs.length, nHead: all.length, flows: c.FLOWS_TO ?? 0, holds: c.HOLDS_STATE_OF ?? 0, ci: c.CONSTRUCTOR_INJECTS ?? 0, src }));
})();
`;

function cells(md, header) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.startsWith(header));
  const out = [];
  for (let j = i + 3; j < lines.length && lines[j].startsWith('|'); j++) out.push(lines[j].split('|').slice(1, -1).map((x) => x.trim()));
  return out;
}

export default [
  {
    id: 'c-fieldstate',
    title: 'HOLDS_STATE_OF on the reference set and FF-P06 field half (fieldstate-cheapfix Part A)',
    needs: 'offline',
    basis: 'regenerated',
    slow: false,
    how: 'npx tsx scripts/v1.3/fieldstate-measure.ts --out <scratch>; fixture recount with extractAPG(V13_FIELD_STATE_OPTIONS) on the 13 fixtures/ projects',
    numbers: numbersA,
    async run(ctx) {
      const out = ctx.out('c-fieldstate');
      const md = ctx.sh(`npx tsx scripts/v1.3/fieldstate-measure.ts --out "${out}"`);
      const r = {};
      // A.1
      const t1 = cells(md, '### Edges per style');
      const tot = Array(9).fill(0);
      const kept = (x) => Number(x.split(' / ')[0]);
      for (const row of t1) {
        const [s, ...v] = row;
        const vals = [v[0], v[1], v[2], kept(v[3]), kept(v[4]), kept(v[5]), kept(v[6]), kept(v[7]), v[8]].map(String);
        COLS1.forEach((c, i) => { r[`c-fs-t1-${s}-${c}`] = vals[i]; });
        for (let i = 0; i < 8; i++) tot[i] += Number(vals[i]);
        const [a, b] = vals[8].split('/').map(Number); tot[8] = [(tot[8]?.[0] ?? 0) + a, (tot[8]?.[1] ?? 0) + b];
      }
      COLS1.forEach((c, i) => { r[`c-fs-t1-total-${c}`] = i === 8 ? `${tot[8][0]}/${tot[8][1]}` : String(tot[i]); });
      const flows = tot[1]; const holds = tot[2];
      r['c-fs-styles'] = `${t1.length} styles`;
      r['c-fs-variants'] = `${tot[0]} variants`;
      r['c-fs-all-variants'] = `All ${tot[0]} variants`;
      r['c-fs-ratio'] = `${(holds / flows).toFixed(1)}×`;
      r['c-fs-nest-declared'] = `${WORD[Number(r['c-fs-t1-nestjs-declared-type'])]} NestJS fields`;
      const empty = COLS1.slice(3, 8).filter((c) => r[`c-fs-t1-total-${c}`] === '0').length;
      r['c-fs-empty-kinds'] = `${cap(WORD[empty])} kinds are empty`;
      r['c-fs-325'] = String(holds);
      r['c-fs-325-119'] = `${holds} edges against ${flows}`;
      // A.2
      const t2 = cells(md, '### FF-P06 field half');
      const agg = {};
      for (const row of t2) {
        const style = row[0].replace(' (v1.3 N/A style)', '');
        const kind = style === 'layered' ? 'all' : row[1];
        const k = `${style}|${kind}`;
        const v = row.slice(2).map(Number);
        agg[k] = agg[k] ? agg[k].map((x, i) => x + v[i]) : v;
      }
      let field = 0; let caught = 0; let expected = 0; let fp = 0; let cleanN = 0; let nmN = 0;
      for (const [s, k] of ROWS2) {
        const v = agg[`${s}|${k}`];
        const cell = (c) => (v[4] === 0 ? '—' : `${c}/${v[4]}`);
        const vals = [v[0], v[1], v[2], v[3], v[4], cell(v[5]), cell(v[6]), v[7], v[8]].map(String);
        COLS2.forEach((c, i) => { r[`c-fs-t2-${s}-${k}-${c}`] = vals[i]; });
        if (s !== 'layered') {
          field += v[2]; caught += v[6]; expected += v[4]; fp += v[8];
          if (k === 'clean') cleanN += v[0];
          if (k === 'near-miss') nmN += v[0];
        }
      }
      const fieldF = ROWS2.filter(([s]) => s !== 'layered').reduce((a, [s, k]) => a + agg[`${s}|${k}`][1], 0);
      r['c-fs-field-rows'] = field === fieldF ? `the same ${WORD[field]} field rows` : `${fieldF} vs ${field} field rows`;
      r['c-fs-field-caught'] = `${caught}/${expected}`;
      const fpNonViol = ROWS2.filter(([s, k]) => s !== 'layered' && k !== 'violation').reduce((a, [s, k]) => a + agg[`${s}|${k}`][2] + agg[`${s}|${k}`][8], 0);
      r['c-fs-new-fp'] = `${fpNonViol} new false positives`;
      r['c-fs-clean-nm'] = `${cleanN} clean and ${nmN} near-miss variants`;
      r['c-fs-denominator'] = `${field} field rows (${expected} expected, ${caught} found, ${fp} false)`;
      // fixtures (line 72)
      const pf = join(out, 'fixture-probe.ts');
      writeFileSync(pf, FIXTURE_PROBE);
      const fx = JSON.parse(ctx.sh(`npx tsx "${pf}" "${ctx.repo}"`).trim().split('\n').pop());
      r['c-fs-fixtures-n'] = String(fx.n);
      r['c-fs-fixtures-flows'] = `FLOWS_TO is ${fx.flows}`;
      r['c-fs-fixtures-holds'] = `HOLDS_STATE_OF ${fx.holds}${fx.src.initializer === fx.holds ? ' (all `initializer`)' : ` (${JSON.stringify(fx.src)})`}`;
      r['c-fs-fixtures-ci'] = `CONSTRUCTOR_INJECTS ${fx.ci}`;
      // committed output: tables.md byte-identical, fieldstate.json identical without generatedAt (checked here, thrown on drift)
      if (md !== ctx.read('results/v1.3-fieldstate/tables.md')) throw new Error('regenerated tables.md differs from results/v1.3-fieldstate/tables.md');
      const strip = (o) => { delete o.generatedAt; return JSON.stringify(o); };
      if (strip(ctx.json(join(out, 'fieldstate.json'))) !== strip(ctx.json('results/v1.3-fieldstate/fieldstate.json'))) throw new Error('regenerated fieldstate.json differs (without generatedAt)');
      return r;
    },
  },
  {
    id: 'c-fieldstate-tests',
    title: 'Unit tests cited by fieldstate-cheapfix (field-state, guards, byte identity)',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: 'npx jest tests/unit/apg-extractor/v13-field-state.test.ts tests/unit/apg-enrich/cheap/guards.test.ts tests/unit/apg-extractor/v12e-byte-identity.test.ts --maxWorkers=2 --json',
    numbers: [
      { id: 'c-fs-byteid', line: 38, what: 'v12e-byte-identity.test.ts result', stated: 'passes' },
      { id: 'c-fs-tests-fieldstate', line: 39, what: 'tests in v13-field-state.test.ts', stated: '14 tests' },
      { id: 'c-fs-tests-guards', line: 147, what: 'tests in guards.test.ts', stated: '20 tests' },
      { id: 'c-fs-tests-excl-kept', line: 150, what: 'excluded and kept guard conditions tested', stated: '7 excluded and 6 kept conditions' },
    ].map((n) => ({ doc: DOC, ...n })),
    async run(ctx) {
      const out = join(ctx.out('c-fieldstate-tests'), 'jest.json');
      try {
        ctx.sh(`npx jest tests/unit/apg-extractor/v13-field-state.test.ts tests/unit/apg-enrich/cheap/guards.test.ts tests/unit/apg-extractor/v12e-byte-identity.test.ts --maxWorkers=2 --json --outputFile="${out}"`);
      } catch { /* failures are reported through the counts below */ }
      const j = ctx.json(out);
      const file = (s) => j.testResults.find((t) => t.name.endsWith(s)).assertionResults;
      const passed = (a) => a.filter((x) => x.status === 'passed').length;
      const bi = file('v12e-byte-identity.test.ts'); const fs = file('v13-field-state.test.ts'); const gd = file('guards.test.ts');
      const ex = gd.filter((a) => a.status === 'passed' && / excluded: /.test(a.fullName)).length;
      const kp = gd.filter((a) => a.status === 'passed' && / kept: /.test(a.fullName)).length;
      return {
        'c-fs-byteid': passed(bi) === bi.length ? 'passes' : `${passed(bi)}/${bi.length} pass`,
        'c-fs-tests-fieldstate': passed(fs) === fs.length ? `${fs.length} tests` : `${passed(fs)}/${fs.length} pass`,
        'c-fs-tests-guards': passed(gd) === gd.length ? `${gd.length} tests` : `${passed(gd)}/${gd.length} pass`,
        'c-fs-tests-excl-kept': `${ex} excluded and ${kp} kept conditions`,
      };
    },
  },
];
