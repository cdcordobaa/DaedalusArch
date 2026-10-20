// Construct decisions (Docs/v1.3/construct-decisions.md, construct-decisions-answer-sheet.md, construct-switches.md):
// the construct-switches effect table and its notes regenerated with scripts/v1.3/construct-rescore.ts from the committed
// results/v1.3-reference/after-member-facts (graphs re-extracted in-process, no Neo4j); the construct-decisions figures
// re-derived from the committed construct-decisions-impact.csv (its generator is not committed) and adjudication.csv;
// the FF-P06 N/A correction regenerated with scripts/v1.3/ffp06-na-recount.mjs; rule and fixture facts from the tree.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CS = 'Docs/v1.3/construct-switches.md';
const CD = 'Docs/v1.3/construct-decisions.md';
const AS = 'Docs/v1.3/construct-decisions-answer-sheet.md';
const BASE = 'results/v1.3-reference/after-member-facts';
const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// =====================================================================================================================
// Group 1: construct-switches.md, regenerated with construct-rescore.ts (and the switch catalogue).
// =====================================================================================================================
const s = (id, line, what, stated, extra = {}) => ({ id: `f-cs-${id}`, doc: CS, line, what, stated, ...extra });

// The "Expected effect on the development set" table, lines 134-194: [line, Q, option, style, blocking, all, rows].
const EFFECTS = [
  [134, 'Q1', 'B', 'layered', 'R 11/11, P 11/11 → R 11/11, P 11/11', 'R 11/11, P 11/11 → R 11/11, P 11/64', '+0 / -0'],
  [135, 'Q1', 'C', 'layered', 'R 11/11, P 11/11 → R 11/11, P 11/64', 'R 11/11, P 11/11 → R 11/11, P 11/64', '+0 / -0'],
  [136, 'Q2', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 12/13, P 12/12', 'R 15/16, P 15/15 → R 14/16, P 14/14', '+0 / -1'],
  [137, 'Q2', 'B', 'layered', 'R 11/11, P 11/11 → R 9/11, P 9/9', 'R 11/11, P 11/11 → R 9/11, P 9/9', '+0 / -2'],
  [138, 'Q2', 'B', 'nestjs', 'R 11/11, P 11/11 → R 10/11, P 10/10', 'R 12/13, P 12/14 → R 11/13, P 11/13', '+0 / -1'],
  [139, 'Q2', 'B', 'ddd', 'R 9/9, P 9/9 → R 4/9, P 4/4', 'R 12/12, P 12/12 → R 6/12, P 6/6', '+0 / -6'],
  [140, 'Q3', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 12/13, P 12/12', 'R 15/16, P 15/15 → R 14/16, P 14/14', '+0 / -1'],
  [141, 'Q3', 'B', 'layered', 'R 11/11, P 11/11 → R 9/11, P 9/9', 'R 11/11, P 11/11 → R 9/11, P 9/9', '+0 / -2'],
  [142, 'Q3', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 12/13, P 12/12', 'R 16/16, P 16/16 → R 15/16, P 15/15', '+0 / -1'],
  [143, 'Q3', 'C', 'clean-architecture', 'R 13/13, P 13/13 → R 12/12, P 12/12', 'R 15/16, P 15/15 → R 15/16, P 15/15', '+0 / -0'],
  [144, 'Q3', 'C', 'layered', 'R 11/11, P 11/11 → R 9/9, P 9/9', 'R 11/11, P 11/11 → R 11/11, P 11/11', '+0 / -0'],
  [145, 'Q3', 'C', 'hexagonal', 'R 13/13, P 13/13 → R 12/12, P 12/12', 'R 16/16, P 16/16 → R 16/16, P 16/16', '+0 / -0'],
  [146, 'Q4', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 13/13, P 13/18', 'R 15/16, P 15/15 → R 15/16, P 15/20', '+5 / -0'],
  [147, 'Q4', 'B', 'layered', 'R 11/11, P 11/11 → R 11/11, P 11/13', 'R 11/11, P 11/11 → R 11/11, P 11/13', '+2 / -0'],
  [148, 'Q4', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/14', 'R 12/13, P 12/14 → R 12/13, P 12/17', '+3 / -0'],
  [149, 'Q4', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 13/13, P 13/18', 'R 16/16, P 16/16 → R 16/16, P 16/21', '+5 / -0'],
  [150, 'Q5', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 15/15, P 15/15', 'R 16/16, P 16/16 → R 16/16, P 16/16', '+0 / -0'],
  [151, 'Q5', 'B', 'ddd', 'R 9/9, P 9/9 → R 10/10, P 10/10', 'R 12/12, P 12/12 → R 12/12, P 12/12', '+0 / -0'],
  [152, 'Q5', 'C', 'hexagonal', 'R 13/13, P 13/13 → R 15/15, P 15/15', 'R 16/16, P 16/16 → R 16/16, P 16/16', '+2 / -2'],
  [153, 'Q5', 'C', 'ddd', 'R 9/9, P 9/9 → R 10/10, P 10/10', 'R 12/12, P 12/12 → R 12/12, P 12/12', '+1 / -1'],
  [154, 'Q5', 'D', 'hexagonal', 'R 13/13, P 13/13 → R 15/15, P 15/15', 'R 16/16, P 16/16 → R 16/16, P 16/16', '+2 / -2'],
  [155, 'Q5', 'D', 'ddd', 'R 9/9, P 9/9 → R 10/10, P 10/10', 'R 12/12, P 12/12 → R 12/12, P 12/12', '+1 / -1'],
  [156, 'Q6', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 12/13, P 12/14', 'R 16/16, P 16/16 → R 15/16, P 15/17', '+2 / -1'],
  [157, 'Q7', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 13/13, P 13/14', 'R 15/16, P 15/15 → R 15/16, P 15/16', '+1 / -0'],
  [158, 'Q7', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/13', 'R 12/13, P 12/14 → R 12/13, P 12/16', '+2 / -0'],
  [159, 'Q7', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 13/13, P 13/17', 'R 16/16, P 16/16 → R 16/16, P 16/20', '+4 / -0'],
  [160, 'Q8', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 12/12, P 12/12', 'R 15/16, P 15/15 → R 14/15, P 14/14', '+0 / -0, N/A 1'],
  [161, 'Q8', 'B', 'nestjs', 'R 11/11, P 11/11 → R 10/10, P 10/10', 'R 12/13, P 12/14 → R 11/12, P 11/13', '+0 / -0, N/A 1'],
  [162, 'Q8', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 12/12, P 12/12', 'R 16/16, P 16/16 → R 15/15, P 15/15', '+0 / -0, N/A 1'],
  [163, 'Q9', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 13/13, P 13/13', 'R 15/16, P 15/15 → R 15/16, P 15/16', '+1 / -0'],
  [164, 'Q9', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/11', 'R 12/13, P 12/14 → R 12/13, P 12/15', '+1 / -0'],
  [165, 'Q9', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 13/13, P 13/13', 'R 16/16, P 16/16 → R 16/16, P 16/18', '+2 / -0'],
  [166, 'Q9', 'C', 'clean-architecture', 'R 13/13, P 13/13 → R 12/13, P 12/12', 'R 15/16, P 15/15 → R 14/16, P 14/14', '+0 / -1'],
  [167, 'Q9', 'C', 'nestjs', 'R 11/11, P 11/11 → R 10/11, P 10/10', 'R 12/13, P 12/14 → R 11/13, P 11/13', '+0 / -1'],
  [168, 'Q9', 'C', 'hexagonal', 'R 13/13, P 13/13 → R 12/13, P 12/12', 'R 16/16, P 16/16 → R 15/16, P 15/15', '+0 / -1'],
  [169, 'Q10', 'B', 'layered', 'R 11/11, P 11/11 → R 10/11, P 10/10', 'R 11/11, P 11/11 → R 10/11, P 10/10', '+0 / -1'],
  [170, 'Q10', 'C', 'layered', 'R 11/11, P 11/11 → R 9/9, P 9/10', 'R 11/11, P 11/11 → R 9/9, P 9/10', '+1 / -0'],
  [171, 'Q10', 'D', 'layered', 'R 11/11, P 11/11 → R 9/9, P 9/9', 'R 11/11, P 11/11 → R 9/9, P 9/9', '+0 / -0'],
  [172, 'Q11', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 11/13, P 11/11', 'R 16/16, P 16/16 → R 14/16, P 14/14', '+0 / -2'],
  [173, 'Q11', 'B', 'ddd', 'R 9/9, P 9/9 → R 8/9, P 8/8', 'R 12/12, P 12/12 → R 11/12, P 11/11', '+0 / -1'],
  [174, 'Q12', 'B', 'layered', 'R 11/11, P 11/11 → R 9/11, P 9/9', 'R 11/11, P 11/11 → R 9/11, P 9/9', '+0 / -2'],
  [175, 'Q13', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/11', 'R 12/13, P 12/14 → R 12/13, P 12/13', '+0 / -1'],
  [176, 'Q13', 'C', 'nestjs', 'R 11/11, P 11/11 → R 10/11, P 10/68', 'R 12/13, P 12/14 → R 11/13, P 11/71', '+0 / -0'],
  [177, 'Q14', 'B', 'ddd', 'R 9/9, P 9/9 → R 7/7, P 7/7', 'R 12/12, P 12/12 → R 12/12, P 12/12', '+0 / -0'],
  [178, 'Q15', 'B', 'ddd', 'R 9/9, P 9/9 → R 8/8, P 8/8', 'R 12/12, P 12/12 → R 12/12, P 12/12', '+0 / -0'],
  [179, 'Q16', 'B', 'ddd', 'R 9/9, P 9/9 → R 9/9, P 9/10', 'R 12/12, P 12/12 → R 12/12, P 12/13', '+0 / -0'],
  [180, 'Q17', 'B', 'ddd', 'R 9/9, P 9/9 → R 9/9, P 9/10', 'R 12/12, P 12/12 → R 12/12, P 12/13', '+1 / -0'],
  [181, 'Q17', 'C', 'ddd', 'R 9/9, P 9/9 → R 9/9, P 9/9', 'R 12/12, P 12/12 → R 12/12, P 12/14', '+2 / -0'],
  [182, 'Q18', 'B', 'ddd', 'R 9/9, P 9/9 → R 9/9, P 9/10', 'R 12/12, P 12/12 → R 12/12, P 12/13', '+1 / -0'],
  [183, 'Q19', 'B', 'ddd', 'R 9/9, P 9/9 → R 8/9, P 8/8', 'R 12/12, P 12/12 → R 11/12, P 11/11', '+0 / -1'],
  [184, 'Q20', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 13/13, P 13/16', 'R 15/16, P 15/15 → R 15/16, P 15/18', '+3 / -0'],
  [185, 'Q20', 'B', 'layered', 'R 11/11, P 11/11 → R 11/11, P 11/16', 'R 11/11, P 11/11 → R 11/11, P 11/16', '+5 / -0'],
  [186, 'Q20', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/15', 'R 12/13, P 12/14 → R 12/13, P 12/18', '+4 / -0'],
  [187, 'Q20', 'B', 'ddd', 'R 9/9, P 9/9 → R 9/9, P 9/11', 'R 12/12, P 12/12 → R 12/12, P 12/14', '+2 / -0'],
  [188, 'Q21', 'B', 'ddd', 'R 9/9, P 9/9 → R 10/10, P 10/10', 'R 12/12, P 12/12 → R 12/12, P 12/12', '+0 / -0'],
  [189, 'Q22', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/11', 'R 12/13, P 12/14 → R 12/13, P 12/13', '+0 / -1'],
  [190, 'Q23', 'B', '(all)', 'no change', 'no change', '+0 / -0'],
  [191, 'Q24', 'B', 'clean-architecture', 'R 13/13, P 13/13 → R 13/13, P 13/13', 'R 15/16, P 15/15 → R 15/16, P 15/15', '+2 / -0'],
  [192, 'Q24', 'B', 'nestjs', 'R 11/11, P 11/11 → R 11/11, P 11/11', 'R 12/13, P 12/14 → R 12/13, P 12/14', '+2 / -0'],
  [193, 'Q24', 'B', 'hexagonal', 'R 13/13, P 13/13 → R 13/13, P 13/13', 'R 16/16, P 16/16 → R 16/16, P 16/33', '+17 / -0'],
  [194, 'Q25', 'B', '(all)', 'no change', 'no change', '+0 / -0'],
];
const effKey = (q, o, st) => `${q}-${o}-${st === '(all)' ? 'all' : st.replace('clean-architecture', 'clean').replace('hexagonal', 'hex')}`.toLowerCase();

const csNumbers = [
  s('questions', 50, 'construct questions in the switch catalogue (heading "The 25 questions")', 'The 25 questions'),
  s('nocode', 92, 'no-code options in the catalogue (every A and Q14 C)', '26 options'),
  s('code', 92, 'code options in the catalogue', '34 options'),
  s('q23-csv', 106, 'Q23 B clean all-rule recall after the change in construct-decisions-impact.csv', 'The CSV figure (16/16)'),
  s('q13c-module-rows', 108, 'Q13 C alone: FF-S01 rows on nestjs *.module.ts files per variant', '4 distinct rows on 13 variants, 5 on n02-domain-port-named-dot-repository'),
  s('q13c-variants', 108, 'nestjs variants in after-member-facts', 'of the 14 variants'),
  s('q13c-p', 108, 'Q13 C alone: nestjs blocking precision', 'nestjs blocking P 10/68'),
  s('q13c-q25b', 109, 'Q13 C with Q25 B: nestjs blocking recall and precision', 'blocking R and P are 10/11'),
  s('q20-range', 110, 'Q20 B rows added per style (min to max)', '2 to 5 new rows'),
  s('q4-rows', 112, 'Q4 B rows added in clean and hexagonal', '5 rows in clean and'),
  s('q4-blind', 113, 'blind-only FF-S02 blocking rows in adjudication.csv', "the blind manifest's 4"),
  s('q24-rows', 114, 'Q24 B hexagonal rows added', '17 hexagonal rows'),
  s('cur-clean', 129, 'status-quo blocking recall, clean', 'clean R 13/13'),
  s('cur-layered', 129, 'status-quo blocking recall, layered', 'layered 11/11'),
  s('cur-nestjs', 129, 'status-quo blocking recall, nestjs', 'nestjs 11/11'),
  s('cur-hex', 129, 'status-quo blocking recall, hexagonal', 'hexagonal 13/13'),
  s('cur-ddd', 129, 'status-quo blocking recall, ddd', 'ddd 9/9'),
  s('cur-p', 130, 'status-quo blocking precision, every style', 'at P 1.00'),
];
for (const [line, q, o, st, b, a, r] of EFFECTS) {
  const k = effKey(q, o, st);
  csNumbers.push(s(`eff-${k}-b`, line, `${q} ${o} ${st}: blocking (current → option)`, b));
  csNumbers.push(s(`eff-${k}-a`, line, `${q} ${o} ${st}: all rules (current → option)`, a));
  csNumbers.push(s(`eff-${k}-r`, line, `${q} ${o} ${st}: rows added / dropped`, r));
}
csNumbers.push(
  s('rowcount-zero', 201, 'Q1, Q13 C and Q16 B rows added / dropped', '`+0 / -0`'),
  s('saved-outputs', 209, 'saved outputs of after-member-facts (raw/)', 'all 71 saved'),
);
// shared with construct-decisions.md / the answer sheet: the ddd v09 cycle under the Q16 B stand-in
csNumbers.push(
  { id: 'f-cs-cd-cycle', doc: CD, line: 530, what: 'ddd v09 cycle length (distinct files) under the Q16 B stand-in', stated: 'a real three-file cycle' },
  { id: 'f-cs-as-cycle', doc: AS, line: 518, what: 'ddd v09 cycle length (distinct files) under the Q16 B stand-in', stated: 'a three-file cycle' },
);

const effectsGroup = {
  id: 'f-construct-switches',
  title: 'construct-switches effect table and notes, regenerated with construct-rescore.ts (no Neo4j)',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts --effects <f> [--answers <f> --out <d>]',
  numbers: csNumbers,
  async run(ctx) {
    const out = ctx.out('f-construct-switches');
    const cache = join(out, 'graphs.json');
    const rescore = (args) => ctx.sh(`node --import tsx scripts/v1.3/construct-rescore.ts --base ${BASE} --graph-cache "${cache}" ${args}`);
    const answers = (name, obj) => { const f = join(out, `${name}.json`); writeFileSync(f, JSON.stringify(obj)); return f; };
    const res = {};

    // the effect table
    rescore(`--effects "${join(out, 'effects.md')}"`);
    const eff = {};
    for (const l of ctx.read(join(out, 'effects.md')).split('\n').slice(2)) {
      if (!l.startsWith('|')) continue;
      const c = l.split('|').slice(1, -1).map((x) => x.trim());
      eff[effKey(c[0], c[1], c[2])] = { b: c[3], a: c[4], r: c[5], q: c[0], o: c[1], st: c[2] };
    }
    for (const [, q, o, st] of EFFECTS) {
      const k = effKey(q, o, st); const e = eff[k];
      for (const p of ['b', 'a', 'r']) res[`f-cs-eff-${k}-${p}`] = e ? e[p] : '(row missing)';
    }
    const extra = Object.keys(eff).filter((k) => !EFFECTS.some(([, q, o, st]) => effKey(q, o, st) === k));
    if (extra.length) throw new Error(`regenerated effect table has rows the doc does not: ${extra.join(', ')}`);
    const rowsOf = (k) => eff[k]?.r;
    res['f-cs-rowcount-zero'] = ['q1-b-layered', 'q1-c-layered', 'q13-c-nestjs', 'q16-b-ddd'].every((k) => rowsOf(k) === '+0 / -0') ? '`+0 / -0`' : 'not all +0 / -0';
    const q20 = Object.values(eff).filter((e) => e.q === 'Q20' && e.o === 'B').map((e) => Number(/^\+(\d+)/.exec(e.r)[1]));
    res['f-cs-q20-range'] = `${Math.min(...q20)} to ${Math.max(...q20)} new rows`;
    const q4c = /^\+(\d+)/.exec(rowsOf('q4-b-clean'))[1]; const q4h = /^\+(\d+)/.exec(rowsOf('q4-b-hex'))[1];
    res['f-cs-q4-rows'] = q4c === q4h ? `${q4c} rows in clean and` : `${q4c} / ${q4h} rows in clean and`;
    res['f-cs-q24-rows'] = `${/^\+(\d+)/.exec(rowsOf('q24-b-hex'))[1]} hexagonal rows`;

    // status quo (every question at A). Explicit since the author's answers were applied to the switch file (U6, ADR-V13-03).
    rescore(`--answers "${answers('sq', {})}" --out "${join(out, 'sq')}"`);
    const sq = ctx.json(join(out, 'sq', 'report.json'));
    const bl = (m) => m.blocking;
    const met = (r, st) => r.metrics.find((m) => m.style === st);
    const rcl = (m) => `${m.tp}/${m.tp + m.fn}`;
    const prc = (m) => `${m.tp}/${m.tp + m.fp}`;
    res['f-cs-cur-clean'] = `clean R ${rcl(bl(met(sq, 'clean-architecture')))}`;
    res['f-cs-cur-layered'] = `layered ${rcl(bl(met(sq, 'layered')))}`;
    res['f-cs-cur-nestjs'] = `nestjs ${rcl(bl(met(sq, 'nestjs')))}`;
    res['f-cs-cur-hex'] = `hexagonal ${rcl(bl(met(sq, 'hexagonal')))}`;
    res['f-cs-cur-ddd'] = `ddd ${rcl(bl(met(sq, 'ddd')))}`;
    const ps = [...new Set(STYLES.map((st) => { const m = bl(met(sq, st)); return ctx.f2(m.tp / (m.tp + m.fp)); }))];
    res['f-cs-cur-p'] = `at P ${ps.join('/')}`;

    // Q13 C alone, and with Q25 B
    rescore(`--answers "${answers('q13c', { Q13: 'C' })}" --out "${join(out, 'q13c')}"`);
    const q13 = ctx.json(join(out, 'q13c', 'report.json'));
    const nest = q13.comparisons.filter((c) => c.style === 'nestjs');
    res['f-cs-q13c-variants'] = `of the ${nest.length} variants`;
    const perVariant = nest.map((c) => [c.variant, new Set(c.mismatches.filter((m) => m.ruleId === 'FF-S01' && m.kind === 'unexpected' && /\.module\.ts$/.test(m.file)).map((m) => `${m.file}>${m.target}`)).size]);
    const counts = [...new Set(perVariant.map(([, n]) => n))];
    if (counts.length === 1) res['f-cs-q13c-module-rows'] = `${counts[0]} distinct rows on each`;
    else {
      const mode = counts.map((n) => [n, perVariant.filter(([, x]) => x === n).length]).sort((a, b) => b[1] - a[1])[0][0];
      res['f-cs-q13c-module-rows'] = `${mode} distinct rows on ${perVariant.filter(([, x]) => x === mode).length} variants, ${perVariant.filter(([, x]) => x !== mode).map(([v, x]) => `${x} on ${v}`).join(', ')}`;
    }
    res['f-cs-q13c-p'] = `nestjs blocking P ${prc(bl(met(q13, 'nestjs')))}`;
    rescore(`--answers "${answers('q13c-q25b', { Q13: 'C', Q25: 'B' })}" --out "${join(out, 'q13c-q25b')}"`);
    const both = bl(met(ctx.json(join(out, 'q13c-q25b', 'report.json')), 'nestjs'));
    res['f-cs-q13c-q25b'] = rcl(both) === prc(both) ? `blocking R and P are ${rcl(both)}` : `blocking R ${rcl(both)}, P ${prc(both)}`;

    // Q16 B: the ddd v09 cycle the stand-in reports
    rescore(`--answers "${answers('q16b', { Q16: 'B' })}" --out "${join(out, 'q16b')}"`);
    const v09 = ctx.json(join(out, 'q16b', 'report.json')).comparisons.find((c) => c.style === 'ddd' && c.variant.startsWith('v09-'));
    const cyc = [...v09.mismatches, ...v09.matched].filter((m) => m.ruleId === 'FF-S02');
    const nFiles = cyc.length === 1 ? new Set(cyc[0].file.split(',')).size : -1;
    res['f-cs-cd-cycle'] = `a real ${words[nFiles] ?? nFiles}-file cycle`;
    res['f-cs-as-cycle'] = `a ${words[nFiles] ?? nFiles}-file cycle`;

    // the switch catalogue
    const ts = join(out, 'catalogue.ts');
    writeFileSync(ts, `import { CONSTRUCT_QUESTIONS, optionsOf } from '${ctx.p('src/shared/construct-switch-catalogue.ts')}';
let code = 0, nocode = 0;
for (const q of CONSTRUCT_QUESTIONS) for (const o of optionsOf(q.id)) { if (q.options[o]?.kind === 'code') code++; else nocode++; }
console.log(JSON.stringify({ questions: CONSTRUCT_QUESTIONS.length, code, nocode }));\n`);
    const cat = JSON.parse(ctx.sh(`node --import tsx "${ts}"`).trim().split('\n').pop());
    res['f-cs-questions'] = `The ${cat.questions} questions`;
    res['f-cs-nocode'] = `${cat.nocode} options`;
    res['f-cs-code'] = `${cat.code} options`;

    // committed inputs
    res['f-cs-saved-outputs'] = `all ${STYLES.reduce((n, st) => n + ctx.ls(`${BASE}/raw/${st}`).filter((f) => f.endsWith('.json')).length, 0)} saved`;
    const adj = ctx.csv('results/v1.3-reference/after-fixes/adjudication.csv');
    res['f-cs-q4-blind'] = `the blind manifest's ${adj.filter((r) => r.rule === 'FF-S02' && r.tier === 'blocking' && r.pattern === 'blind only').length}`;
    const imp = ctx.csv('Docs/v1.3/construct-decisions-impact.csv');
    const q23 = imp.find((r) => r.question === 'Q23' && r.option === 'B' && r.tool === 'after-change' && r.style === 'clean-architecture');
    res['f-cs-q23-csv'] = `The CSV figure (${q23.all_tp}/${q23.all_expected})`;
    return res;
  },
};

// =====================================================================================================================
// Group 2: construct-decisions.md figures, re-derived from construct-decisions-impact.csv and adjudication.csv.
// =====================================================================================================================
const d = (id, line, what, stated, extra = {}) => ({ id: `f-cd-${id}`, doc: CD, line, what, stated, ...extra });
const ST = { clean: 'clean-architecture', layered: 'layered', nestjs: 'nestjs', hex: 'hexagonal', ddd: 'ddd', pooled: 'pooled' };

// Effect figures: [id, line, stated, Q, option, style, R|P, b(locking)|a(ll), mode ('both' = "x → y" when they differ)].
const FIG = [
  ['q1-a-r', 104, 'layered R 8/8', 'Q1', 'A', 'layered', 'R', 'b'],
  ['q1-a-p', 104, 'P 8/8', 'Q1', 'A', 'layered', 'P', 'b'],
  ['q1-b-allp', 105, 'all-rule precision falls to 8/61', 'Q1', 'B', 'layered', 'P', 'a', 'after'],
  ['q1-c-r', 106, 'layered R 8/8', 'Q1', 'C', 'layered', 'R', 'b'],
  ['q1-c-p', 106, 'P 8/8 → 8/61', 'Q1', 'C', 'layered', 'P', 'b'],
  ['q2-a-clean-r', 131, 'clean R 13/13', 'Q2', 'A', 'clean', 'R', 'b'],
  ['q2-a-clean-p', 131, 'P 13/13', 'Q2', 'A', 'clean', 'P', 'b'],
  ['q2-a-layered-r', 131, 'layered 8/8', 'Q2', 'A', 'layered', 'R', 'b'],
  ['q2-a-layered-p', 131, '8/8; nestjs', 'Q2', 'A', 'layered', 'P', 'b'],
  ['q2-a-nestjs-r', 131, 'nestjs 11/11', 'Q2', 'A', 'nestjs', 'R', 'b'],
  ['q2-a-nestjs-p', 131, '11/11; ddd', 'Q2', 'A', 'nestjs', 'P', 'b'],
  ['q2-a-ddd-r', 131, 'ddd 8/8', 'Q2', 'A', 'ddd', 'R', 'b'],
  ['q2-a-ddd-p', 131, '8/8.', 'Q2', 'A', 'ddd', 'P', 'b'],
  ['q2-b-clean-r', 132, 'clean R 12/12', 'Q2', 'B', 'clean', 'R', 'b'],
  ['q2-b-clean-p', 132, 'P 12/13 → 12/12', 'Q2', 'B', 'clean', 'P', 'b'],
  ['q2-b-layered-r', 132, 'layered 6/6', 'Q2', 'B', 'layered', 'R', 'b'],
  ['q2-b-layered-p', 132, '6/8 → 6/6', 'Q2', 'B', 'layered', 'P', 'b'],
  ['q2-b-nestjs-r', 132, 'nestjs 10/10', 'Q2', 'B', 'nestjs', 'R', 'b'],
  ['q2-b-nestjs-p', 132, '10/11 → 10/10', 'Q2', 'B', 'nestjs', 'P', 'b'],
  ['q2-b-ddd-r', 132, 'ddd R 1/1', 'Q2', 'B', 'ddd', 'R', 'b'],
  ['q2-b-ddd-p', 132, 'P 1/8 → 1/1', 'Q2', 'B', 'ddd', 'P', 'b'],
  ['q2-b-pooled-p', 132, 'Pooled P 45/56 → 45/45', 'Q2', 'B', 'pooled', 'P', 'b'],
  ['q3-a-clean-r', 163, 'clean R 13/13', 'Q3', 'A', 'clean', 'R', 'b'],
  ['q3-a-clean-p', 163, 'P 13/13', 'Q3', 'A', 'clean', 'P', 'b'],
  ['q3-a-layered-r', 163, 'layered 8/8', 'Q3', 'A', 'layered', 'R', 'b'],
  ['q3-a-layered-p', 163, '8/8; hex', 'Q3', 'A', 'layered', 'P', 'b'],
  ['q3-a-hex-r', 163, 'hex 16/16', 'Q3', 'A', 'hex', 'R', 'b'],
  ['q3-a-hex-p', 163, '16/16.', 'Q3', 'A', 'hex', 'P', 'b'],
  ['q3-b-clean-r', 164, 'clean R 12/12', 'Q3', 'B', 'clean', 'R', 'b'],
  ['q3-b-clean-p', 164, 'P 12/13 → 12/12', 'Q3', 'B', 'clean', 'P', 'b'],
  ['q3-b-layered-r', 164, 'layered 6/6', 'Q3', 'B', 'layered', 'R', 'b'],
  ['q3-b-layered-p', 164, '6/8 → 6/6', 'Q3', 'B', 'layered', 'P', 'b'],
  ['q3-b-hex-r', 164, 'hex 15/15', 'Q3', 'B', 'hex', 'R', 'b'],
  ['q3-b-hex-p', 164, '15/16 → 15/15', 'Q3', 'B', 'hex', 'P', 'b'],
  ['q3-c-clean-r', 165, 'clean R 12/12', 'Q3', 'C', 'clean', 'R', 'b'],
  ['q3-c-clean-p', 165, 'P 12/12', 'Q3', 'C', 'clean', 'P', 'b'],
  ['q3-c-layered-r', 165, 'layered 6/6', 'Q3', 'C', 'layered', 'R', 'b'],
  ['q3-c-layered-p', 165, '6/6; hex', 'Q3', 'C', 'layered', 'P', 'b'],
  ['q3-c-hex-r', 165, 'hex 15/15', 'Q3', 'C', 'hex', 'R', 'b'],
  ['q3-c-hex-p', 165, '15/15.', 'Q3', 'C', 'hex', 'P', 'b'],
  ['q4-a-clean-r', 192, 'clean R 13/13', 'Q4', 'A', 'clean', 'R', 'b'],
  ['q4-a-clean-p', 192, 'P 13/13', 'Q4', 'A', 'clean', 'P', 'b'],
  ['q4-a-layered-r', 192, 'layered 8/8', 'Q4', 'A', 'layered', 'R', 'b'],
  ['q4-a-layered-p', 192, '8/8.', 'Q4', 'A', 'layered', 'P', 'b'],
  ['q4-b-clean-r', 193, 'clean R 13/15 → 15/15', 'Q4', 'B', 'clean', 'R', 'b'],
  ['q4-b-layered-r', 193, 'layered 8/10 → 10/10', 'Q4', 'B', 'layered', 'R', 'b'],
  ['q5-a-hex-r', 220, 'hex R 14/14', 'Q5', 'A', 'hex', 'R', 'b'],
  ['q5-a-ddd-r', 220, 'ddd 7/7', 'Q5', 'A', 'ddd', 'R', 'b'],
  ['q5-b-hex-r', 221, 'hex R 16/16', 'Q5', 'B', 'hex', 'R', 'b'],
  ['q5-b-hex-p', 221, 'P 16/16', 'Q5', 'B', 'hex', 'P', 'b'],
  ['q5-b-ddd-r', 221, 'ddd 8/8', 'Q5', 'B', 'ddd', 'R', 'b'],
  ['q5-b-ddd-p', 221, '8/8.', 'Q5', 'B', 'ddd', 'P', 'b'],
  ['q5-c-hex-r', 222, 'hex R 14/16 → 16/16', 'Q5', 'C', 'hex', 'R', 'b'],
  ['q5-c-ddd-r', 222, 'ddd 7/7', 'Q5', 'C', 'ddd', 'R', 'b'],
  ['q5-d-hex-after', 223, 'hex 16/16', 'Q5', 'B', 'hex', 'R', 'b', 'after'],
  ['q5-d-ddd-after', 223, 'ddd 8/8', 'Q5', 'B', 'ddd', 'R', 'b', 'after'],
  ['q6-a-hex-r', 249, 'hex R 15/15', 'Q6', 'A', 'hex', 'R', 'b'],
  ['q6-a-hex-p', 249, 'P 15/15', 'Q6', 'A', 'hex', 'P', 'b'],
  ['q6-b-hex-r', 250, 'hex R 14/16 → 16/16', 'Q6', 'B', 'hex', 'R', 'b'],
  ['q6-b-hex-p', 250, 'P 14/15 → 16/16', 'Q6', 'B', 'hex', 'P', 'b'],
  ['q7-a-nestjs-r', 275, 'nestjs R 11/11', 'Q7', 'A', 'nestjs', 'R', 'b'],
  ['q7-a-hex-r', 275, 'hex 16/16', 'Q7', 'A', 'hex', 'R', 'b'],
  ['q7-b-nestjs-r', 276, 'nestjs R 11/12 → 12/12', 'Q7', 'B', 'nestjs', 'R', 'b'],
  ['q7-b-hex-r', 276, 'hex 16/18 → 18/18', 'Q7', 'B', 'hex', 'R', 'b'],
  ['q8-a-clean-r', 309, 'clean R 13/13', 'Q8', 'A', 'clean', 'R', 'b'],
  ['q8-a-nestjs-r', 309, 'nestjs 11/11', 'Q8', 'A', 'nestjs', 'R', 'b'],
  ['q8-a-hex-r', 309, 'hex 16/16', 'Q8', 'A', 'hex', 'R', 'b'],
  ['q8-b-clean-r', 310, 'clean R 12/12', 'Q8', 'B', 'clean', 'R', 'b'],
  ['q8-b-clean-p', 310, 'P 12/13 → 12/12', 'Q8', 'B', 'clean', 'P', 'b'],
  ['q8-b-nestjs-r', 310, 'nestjs 10/10', 'Q8', 'B', 'nestjs', 'R', 'b'],
  ['q8-b-nestjs-p', 310, '10/11 → 10/10', 'Q8', 'B', 'nestjs', 'P', 'b'],
  ['q8-b-hex-r', 310, 'hex 15/15', 'Q8', 'B', 'hex', 'R', 'b'],
  ['q8-b-hex-p', 310, '15/16 → 15/15', 'Q8', 'B', 'hex', 'P', 'b'],
  ['q9-b-pooled-allr', 325, 'pooled 66/71 → 70/71', 'Q9', 'B', 'pooled', 'R', 'a'],
  ['q9-a-clean-r', 337, 'clean R 13/13', 'Q9', 'A', 'clean', 'R', 'b'],
  ['q9-a-nestjs-r', 337, 'nestjs 11/11', 'Q9', 'A', 'nestjs', 'R', 'b'],
  ['q9-a-hex-r', 337, 'hex 16/16', 'Q9', 'A', 'hex', 'R', 'b'],
  ['q9-c-clean-r', 339, 'clean R 12/12', 'Q9', 'C', 'clean', 'R', 'b'],
  ['q9-c-clean-p', 339, 'P 12/13 → 12/12', 'Q9', 'C', 'clean', 'P', 'b'],
  ['q9-c-nestjs-r', 339, 'nestjs 10/10', 'Q9', 'C', 'nestjs', 'R', 'b'],
  ['q9-c-nestjs-p', 339, '10/11 → 10/10', 'Q9', 'C', 'nestjs', 'P', 'b'],
  ['q9-c-hex-r', 339, 'hex 15/15', 'Q9', 'C', 'hex', 'R', 'b'],
  ['q9-c-hex-p', 339, '15/16 → 15/15', 'Q9', 'C', 'hex', 'P', 'b'],
  ['q10-a-r', 366, 'layered R 9/9', 'Q10', 'A', 'layered', 'R', 'b'],
  ['q10-a-p', 366, 'P 9/9', 'Q10', 'A', 'layered', 'P', 'b'],
  ['q10-b-r', 367, 'layered R 8/8', 'Q10', 'B', 'layered', 'R', 'b'],
  ['q10-b-p', 367, 'P 8/9 → 8/8', 'Q10', 'B', 'layered', 'P', 'b'],
  ['q10-c-r', 368, 'layered R 7/8 → 8/8', 'Q10', 'C', 'layered', 'R', 'b'],
  ['q10-c-p', 368, 'P 7/9 → 8/8', 'Q10', 'C', 'layered', 'P', 'b'],
  ['q10-d-r', 369, 'layered R 7/7', 'Q10', 'D', 'layered', 'R', 'b'],
  ['q10-d-p', 369, 'P 7/9 → 7/7', 'Q10', 'D', 'layered', 'P', 'b'],
  ['q11-a-hex-r', 399, 'hex R 16/16', 'Q11', 'A', 'hex', 'R', 'b'],
  ['q11-a-ddd-r', 399, 'ddd 8/8', 'Q11', 'A', 'ddd', 'R', 'b'],
  ['q11-b-hex-r', 400, 'hex R 15/15', 'Q11', 'B', 'hex', 'R', 'b'],
  ['q11-b-hex-p', 400, 'P 15/16 → 15/15', 'Q11', 'B', 'hex', 'P', 'b'],
  ['q11-b-ddd-r', 400, 'ddd 7/7', 'Q11', 'B', 'ddd', 'R', 'b'],
  ['q11-b-ddd-p', 400, '7/8 → 7/7', 'Q11', 'B', 'ddd', 'P', 'b'],
  ['q12-a-r', 424, 'layered R 10/10', 'Q12', 'A', 'layered', 'R', 'b'],
  ['q12-a-p', 424, 'P 10/10', 'Q12', 'A', 'layered', 'P', 'b'],
  ['q12-b-r', 425, 'layered R 8/8', 'Q12', 'B', 'layered', 'R', 'b'],
  ['q12-b-p', 425, 'P 8/10 → 8/8', 'Q12', 'B', 'layered', 'P', 'b'],
  ['q13-a-r', 459, 'nestjs R 11/11', 'Q13', 'A', 'nestjs', 'R', 'b'],
  ['q13-a-p', 459, 'P 11/11', 'Q13', 'A', 'nestjs', 'P', 'b'],
  ['q13-a-allp', 459, 'all-rule P 14/14', 'Q13', 'A', 'nestjs', 'P', 'a', 'both'],
  ['q13-b-allp', 460, 'all-rule P 13/14 → 13/13', 'Q13', 'B', 'nestjs', 'P', 'a'],
  ['q13-c-r', 461, 'nestjs R 10/11 → 11/11', 'Q13', 'C', 'nestjs', 'R', 'b', 'both'],
  ['q13-c-p', 461, 'P 10/11 → 11/11', 'Q13', 'C', 'nestjs', 'P', 'b'],
  ['q14-a-r', 487, 'ddd R 9/10', 'Q14', 'A', 'ddd', 'R', 'b'],
  ['q14-b-r', 488, 'ddd R 8/8', 'Q14', 'B', 'ddd', 'R', 'b'],
  ['q14-c-r', 489, 'ddd R 9/10 → 10/10', 'Q14', 'C', 'ddd', 'R', 'b'],
  ['q15-a-r', 516, 'ddd R 9/9', 'Q15', 'A', 'ddd', 'R', 'b'],
  ['q15-b-r', 517, 'ddd R 8/8', 'Q15', 'B', 'ddd', 'R', 'b'],
  ['q16-a-r', 543, 'ddd R 7/7', 'Q16', 'A', 'ddd', 'R', 'b'],
  ['q16-b-r', 544, 'ddd R 7/8 → 8/8', 'Q16', 'B', 'ddd', 'R', 'b'],
  ['q17-a-r', 566, 'ddd R 8/8', 'Q17', 'A', 'ddd', 'R', 'b'],
  ['q17-b-r', 567, 'ddd R 8/9 → 9/9', 'Q17', 'B', 'ddd', 'R', 'b'],
  ['q18-a-r', 592, 'ddd R 8/8', 'Q18', 'A', 'ddd', 'R', 'b'],
  ['q18-b-r', 593, 'ddd R 8/9 → 9/9', 'Q18', 'B', 'ddd', 'R', 'b'],
  ['q19-a-r', 617, 'ddd R 8/8', 'Q19', 'A', 'ddd', 'R', 'b'],
  ['q19-b-r', 618, 'ddd R 7/7', 'Q19', 'B', 'ddd', 'R', 'b'],
  ['q19-b-p', 618, 'P 7/8 → 7/7', 'Q19', 'B', 'ddd', 'P', 'b'],
  ['q20-a-r', 642, 'nestjs R 11/11', 'Q20', 'A', 'nestjs', 'R', 'b'],
  ['q20-b-r', 643, 'nestjs R 11/12 → 12/12', 'Q20', 'B', 'nestjs', 'R', 'b'],
  ['q21-a-r', 668, 'ddd R 8/8', 'Q21', 'A', 'ddd', 'R', 'b'],
  ['q21-b-r', 669, 'ddd R 9/9', 'Q21', 'B', 'ddd', 'R', 'b'],
  ['q22-a-allp', 694, 'nestjs all-rule P 14/14', 'Q22', 'A', 'nestjs', 'P', 'a'],
  ['q22-b-allp', 695, 'nestjs all-rule P 13/14 → 13/13', 'Q22', 'B', 'nestjs', 'P', 'a'],
  ['q23-b-clean-allr', 721, 'clean all-rule R 15/16 → 16/16', 'Q23', 'B', 'clean', 'R', 'a'],
  ['q23-b-nestjs-allr', 721, 'nestjs 12/13 → 13/13', 'Q23', 'B', 'nestjs', 'R', 'a'],
  ['q24-a-pooled-allr', 752, 'pooled all-rule R 66/67', 'Q24', 'A', 'pooled', 'R', 'a'],
  ['q24-b-hex-allr', 753, 'hex all-rule R 17/18 → 18/18', 'Q24', 'B', 'hex', 'R', 'a'],
  ['q24-b-clean-allr', 753, 'clean 16/17 → 17/17', 'Q24', 'B', 'clean', 'R', 'a'],
];

// Summary table (lines 60-84): sheet rows per question, as the adjudication.csv rows the question text names
// ([style, variant prefix, rule]); "other rows" as stated.
const SHEET = {
  Q1: [], Q2: [], Q3: [],
  Q4: [['clean-architecture', 'v01', 'FF-S02'], ['clean-architecture', 'v09', 'FF-S02'], ['layered', 'v01', 'FF-S02'], ['layered', 'v02', 'FF-S02']],
  Q5: [['hexagonal', 'v05', 'FF-S03'], ['hexagonal', 'v05', 'FF-S01'], ['hexagonal', 'v06', 'FF-S03'], ['hexagonal', 'v06', 'FF-S01'], ['ddd', 'v10', 'FF-P02']],
  Q6: [['hexagonal', 'v03', 'FF-S04'], ['hexagonal', 'v04', 'FF-S04']],
  Q7: [['nestjs', 'v07', 'FF-P03'], ['hexagonal', 'v03', 'FF-P03'], ['hexagonal', 'v05', 'FF-P03']],
  Q8: [],
  Q9: [['clean-architecture', 'v06', 'FF-P02'], ['nestjs', 'v08', 'FF-P02'], ['hexagonal', 'v08', 'FF-P02'], ['hexagonal', 'v09', 'FF-P02']],
  Q10: [['layered', 'v07', 'FF-P01'], ['layered', 'v08', 'FF-P01'], ['layered', 'v08', 'FF-S01']],
  Q11: [['ddd', 'v09', 'FF-S04']],
  Q12: [['layered', 'v01', 'FF-S03'], ['layered', 'v02', 'FF-S03']],
  Q13: [['nestjs', 'v02', 'FF-SO01'], ['nestjs', 'v07', 'FF-P04'], ['nestjs', 'v07', 'FF-S01']],
  Q14: [['ddd', 'g01', 'FF-DT03']],
  Q15: [['ddd', 'v07', 'FF-C04']],
  Q16: [['ddd', 'v09', 'FF-S02']],
  Q17: [['ddd', 'g02', 'OTHER']],
  Q18: [], Q19: [],
  Q20: [['nestjs', 'v10', 'FF-P01']],
  Q21: [],
  Q22: [['nestjs', 'n03', 'FF-P02']],
  Q23: [['clean-architecture', 'v07', 'FF-P05'], ['nestjs', 'v09', 'FF-P05']],
  Q24: [['hexagonal', 'n01', 'FF-S03'], ['clean-architecture', 'v07', 'FF-P04'], ['clean-architecture', 'v07', 'FF-S03'], ['nestjs', 'v09', 'FF-S03'], ['layered', 'v03', 'OTHER']],
  Q25: [],
};
const SUMMARY = [ // [Q, line, sheet rows, other rows]
  ['Q1', 60, '0', '53 (baseline)'], ['Q2', 61, '0', '12'], ['Q3', 62, '0', '4'], ['Q4', 63, '4', '0'], ['Q5', 64, '5', '1'],
  ['Q6', 65, '2', '1'], ['Q7', 66, '3', '0'], ['Q8', 67, '0', '3'], ['Q9', 68, '4', '3'], ['Q10', 69, '3', '0'],
  ['Q11', 70, '1', '3'], ['Q12', 71, '2', '0'], ['Q13', 72, '3', '1'], ['Q14', 73, '1', '1'], ['Q15', 74, '1', '1'],
  ['Q16', 75, '1', '0'], ['Q17', 76, '1', '1'], ['Q18', 77, '0', '1'], ['Q19', 78, '0', '1'], ['Q20', 79, '1', '0'],
  ['Q21', 80, '0', '1'], ['Q22', 81, '1', '0'], ['Q23', 82, '2', '0'], ['Q24', 83, '5', '0'], ['Q25', 84, '0', '0'],
];
// "Other rows" that a committed file determines: Q1 (ffp06-na-recount, baseline), Q2/Q3/Q9 (pooled CSV deltas), Q8.
const OTHER_CHECKED = new Set(['Q1', 'Q2', 'Q3', 'Q8', 'Q9']);
const OTHER_NOTE = 'which agreed rows a question puts at stake was chosen by the uncommitted row-dump script; no committed file lists them per question.';

const cdNumbers = [
  d('adj-rows', 11, 'rows of after-fixes/adjudication.csv', 'all 40 rows'),
  d('tier-adrs', 13, 'tier ADRs proposed in Docs/v1.3-ddd-notes.md §2', 'the three tier ADRs'),
  d('questions', 15, 'construct questions (switch catalogue)', 'The result is 25 questions'),
  d('dev-cases', 46, 'cases (saved outputs) of the development set, after-fixes raw/', 'the 71-case development set'),
  d('rev1-changed', 48, 'questions whose recommendation revision 1 changed (bold rows of the summary table)', 'those six questions'),
  d('sheet-40', 56, 'rows of the adjudication sheet', 'the 40-row adjudication sheet'),
  d('sheet-all', 86, 'sheet rows counted once across the summary (sum of the column, all distinct)', 'All 40 sheet rows are counted once'),
  d('two-outside', 86, 'named blind ids outside every compared set, present and not compared in adjudication.csv', 'The two blind ids'),
  d('q1-53', 92, 'FF-P06 rows the baseline reported in layered (CONSTRUCTOR_INJECTS)', 'the 53 FF-P06 rows'),
  d('q2-12', 120, 'findings resting only on type-only edges (pooled all-rule TP, Q2 A minus B)', '12 findings'),
  d('q2-11', 120, 'of them blocking (pooled blocking TP, Q2 A minus B)', '11 of them blocking'),
  d('q2-7of8', 130, "DDD blocking findings that leave the reference under B", "7 of DDD's 8"),
  d('q3-4', 151, 'blocking in-layer cycle rows (pooled blocking TP, Q3 A minus B)', 'There are 4 blocking rows'),
  d('q3-c-4', 165, 'rows that move to advisory under Q3 C (pooled blocking TP, A minus C)', 'The 4 rows move to advisory'),
  d('q3-c-allsame', 165, 'Q3 C all-rule figures equal A', 'all-rule figures do not change'),
  d('q4-4', 181, 'blind-only blocking rows of Q4', 'There are 4 blind-only blocking rows'),
  d('q4-b-p', 193, 'Q4 B blocking precision after the change (clean, layered)', 'P stays 1.00'),
  d('q5-c-p', 222, 'Q5 C hexagonal blocking precision (as-is and after)', 'P 1.00'),
  d('q7-3', 264, 'blind-only blocking rows of Q7', 'are 3 blind-only blocking rows'),
  d('q8-ap', 309, 'Q8 A blocking precision (clean, nestjs, hex)', '(P 1.00)'),
  d('q9-four', 325, 'blind-only FF-P02 rows on the four variants', 'FF-P02 to all four'),
  d('q10-2of4', 353, 'Q10 rows among layered blind-view false positives (tool + author, blind silent)', "2 of layered's 4"),
  d('q12-2of4', 413, 'Q12 rows among layered blind-view false positives', "the other 2 of layered's 4"),
  d('q17-c', 568, 'Q17 C blocking figures equal A (ddd)', 'blocking is the same as A'),
  d('q22-ratio', 683, 'nestjs n03 FF-P02 ratio of injected interfaces (after-fixes evidence)', 'a 0.75 ratio'),
  d('q24-five', 735, 'blind-only, non-blocking rows of Q24', 'Five blind-only rows, none blocking'),
  d('q9-three', 325, 'variants whose patch or overlay drops an `implements` clause', 'Three variants drop an `implements` clause'),
  { id: 'f-as-q9-three', doc: AS, line: 314, what: 'variants whose patch or overlay drops an `implements` clause', stated: 'Three variants drop an `implements` clause' },
  { id: 'f-as-p02-threshold', doc: AS, line: 671, what: 'FF-P02 threshold in the template registry', stated: 'a 0.85 threshold' },
  d('review-challenge', 813, 'recommendations the review challenged (verdict table)', 'It challenged two recommendations'),
  d('review-ewc', 813, 'recommendations endorsed with changes (verdict table)', 'endorsed nine with changes'),
];
for (const [id, line, stated, , , , , , , known] of FIG) cdNumbers.push(d(`fig-${id}`, line, `effect figure ${id} (construct-decisions-impact.csv)`, stated, known ? { known } : {}));
for (const [q, line, sheet, other] of SUMMARY) {
  cdNumbers.push(d(`sum-${q.toLowerCase()}-sheet`, line, `${q}: sheet rows`, `| ${sheet} |`));
  cdNumbers.push(d(`sum-${q.toLowerCase()}-other`, line, `${q}: other rows`, `| ${other} |`,
    OTHER_CHECKED.has(q) ? {} : { needs: 'not-checkable', note: OTHER_NOTE }));
}

const csvGroup = {
  id: 'f-construct-decisions',
  title: 'construct-decisions figures re-derived from construct-decisions-impact.csv, adjudication.csv and fixtures',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'node replication/v1.3/run.mjs --group f-construct-decisions (reads Docs/v1.3/construct-decisions-impact.csv, results/v1.3-reference/after-fixes/adjudication.csv)',
  numbers: cdNumbers,
  async run(ctx) {
    const res = {};
    const imp = ctx.csv('Docs/v1.3/construct-decisions-impact.csv');
    const row = (q, o, st, tool) => {
      const r = imp.find((x) => x.question === q && x.option === o && x.style === ST[st] && x.tool === tool);
      if (!r) throw new Error(`no CSV row ${q} ${o} ${st} ${tool}`);
      return r;
    };
    const val = (r, m, k) => `${r[`${k}_tp`]}/${r[`${k}_${m === 'R' ? 'expected' : 'reported'}`]}`;
    const fig = (q, o, st, m, kk, mode = 'both') => {
      const k = kk === 'b' ? 'blocking' : 'all';
      const a = val(row(q, o, st, 'as-is'), m, k); const b = val(row(q, o, st, 'after-change'), m, k);
      if (mode === 'after') return b;
      if (mode === 'asis') return a;
      return a === b ? a : `${a} → ${b}`;
    };
    // effect figures: replace the figure inside the stated fragment with the CSV value
    for (const [id, , stated, q, o, st, m, kk, mode] of FIG) {
      const v = fig(q, o, st, m, kk, mode);
      res[`f-cd-fig-${id}`] = stated.replace(/\d+\/\d+( → \d+\/\d+)?/, v);
    }
    const tp = (q, o, st, k, tool = 'after-change') => Number(row(q, o, st, tool)[`${k}_tp`]);
    res['f-cd-q2-12'] = `${tp('Q2', 'A', 'pooled', 'all') - tp('Q2', 'B', 'pooled', 'all')} findings`;
    res['f-cd-q2-11'] = `${tp('Q2', 'A', 'pooled', 'blocking') - tp('Q2', 'B', 'pooled', 'blocking')} of them blocking`;
    res['f-cd-q2-7of8'] = `${tp('Q2', 'A', 'ddd', 'blocking') - tp('Q2', 'B', 'ddd', 'blocking')} of DDD's ${tp('Q2', 'A', 'ddd', 'blocking')}`;
    res['f-cd-q3-4'] = `There are ${tp('Q3', 'A', 'pooled', 'blocking') - tp('Q3', 'B', 'pooled', 'blocking')} blocking rows`;
    res['f-cd-q3-c-4'] = `The ${tp('Q3', 'A', 'pooled', 'blocking') - tp('Q3', 'C', 'pooled', 'blocking')} rows move to advisory`;
    const same = (q1, o1, q2, o2, k, styles) => styles.every((st) => ['R', 'P'].every((m) => fig(q1, o1, st, m, k) === fig(q2, o2, st, m, k)));
    res['f-cd-q3-c-allsame'] = same('Q3', 'C', 'Q3', 'A', 'a', ['clean', 'layered', 'hex']) ? 'all-rule figures do not change' : 'all-rule figures change';
    res['f-cd-q17-c'] = same('Q17', 'C', 'Q17', 'A', 'b', ['ddd']) ? 'blocking is the same as A' : 'blocking differs from A';
    const prec = (q, o, st, tool) => { const r = row(q, o, st, tool); return ctx.f2(Number(r.blocking_tp) / Number(r.blocking_reported)); };
    const one = (xs) => { const u = [...new Set(xs)]; return u.length === 1 ? u[0] : u.join('/'); };
    res['f-cd-q4-b-p'] = `P stays ${one(['clean', 'layered'].flatMap((st) => ['as-is', 'after-change'].map((t) => prec('Q4', 'B', st, t))))}`;
    res['f-cd-q5-c-p'] = `P ${one(['as-is', 'after-change'].map((t) => prec('Q5', 'C', 'hex', t)))}`;
    res['f-cd-q8-ap'] = `(P ${one(['clean', 'nestjs', 'hex'].map((st) => prec('Q8', 'A', st, 'as-is')))})`;

    // adjudication.csv: the sheet rows of each question
    const adj = ctx.csv('results/v1.3-reference/after-fixes/adjudication.csv');
    res['f-cd-adj-rows'] = `all ${adj.length} rows`;
    res['f-cd-sheet-40'] = `the ${adj.length}-row adjudication sheet`;
    const pick = (q) => SHEET[q].map(([st, v, rule]) => {
      const hits = adj.filter((r) => r.style === st && r.variant.startsWith(`${v}-`) && (rule === 'OTHER' ? r.rule.startsWith('OTHER') : r.rule === rule));
      if (hits.length !== 1) throw new Error(`${q}: ${st} ${v} ${rule} matches ${hits.length} adjudication rows`);
      return hits[0];
    });
    const used = new Set(); let sum = 0;
    for (const [q] of SUMMARY) {
      const rows = pick(q); sum += rows.length;
      for (const r of rows) used.add(adj.indexOf(r));
      res[`f-cd-sum-${q.toLowerCase()}-sheet`] = `| ${rows.length} |`;
    }
    res['f-cd-sheet-all'] = sum === used.size && used.size === adj.length ? `All ${sum} sheet rows are counted once` : `sum ${sum}, distinct ${used.size} of ${adj.length}`;
    const blindOnlyBlocking = (q) => pick(q).filter((r) => r.pattern === 'blind only' && r.tier === 'blocking').length;
    res['f-cd-q4-4'] = `There are ${blindOnlyBlocking('Q4')} blind-only blocking rows`;
    res['f-cd-q7-3'] = `are ${blindOnlyBlocking('Q7')} blind-only blocking rows`;
    res['f-cd-q9-four'] = `FF-P02 to all ${words[pick('Q9').filter((r) => r.pattern === 'blind only').length]}`;
    const fpLayered = adj.filter((r) => r.style === 'layered' && r.pattern === 'tool + author, blind silent' && r.tier === 'blocking').length;
    const fpOf = (q) => pick(q).filter((r) => r.pattern === 'tool + author, blind silent').length;
    res['f-cd-q10-2of4'] = `${fpOf('Q10')} of layered's ${fpLayered}`;
    res['f-cd-q12-2of4'] = `the other ${fpOf('Q12')} of layered's ${fpLayered}`;
    const q24 = pick('Q24');
    res['f-cd-q24-five'] = q24.every((r) => r.pattern.startsWith('blind only') && r.tier !== 'blocking') ? `${cap(words[q24.length])} blind-only rows, none blocking` : 'not all blind-only and non-blocking';
    const outside = adj.filter((r) => (r.style === 'nestjs' && r.variant.startsWith('v02-') && r.rule === 'FF-SO01') || (r.style === 'ddd' && r.variant.startsWith('v10-') && r.rule === 'FF-P02'));
    res['f-cd-two-outside'] = `The ${words[outside.filter((r) => r.tier === 'not compared').length]} blind ids`;

    // other rows determined by committed files
    const pooledDelta = (q, o, k) => tp(q, 'A', 'pooled', k) - tp(q, o, 'pooled', k);
    res['f-cd-sum-q2-other'] = `| ${pooledDelta('Q2', 'B', 'all')} |`;
    res['f-cd-sum-q3-other'] = `| ${pooledDelta('Q3', 'B', 'blocking')} |`;
    res['f-cd-sum-q9-other'] = `| ${pooledDelta('Q9', 'C', 'all')} |`;
    const na = ctx.sh('node scripts/v1.3/ffp06-na-recount.mjs baseline-pre-barrel after-fixes');
    const sec = (run) => na.split(/^## /m).find((x) => x.startsWith(`${run}\n`));
    const ci = (run, st) => Number(new RegExp(`^- FF-P06 ${st}: FLOWS_TO (\\d+) \\(N/A\\), CONSTRUCTOR_INJECTS (\\d+)`, 'm').exec(sec(run))?.[2] ?? 0);
    const flows = (run) => STYLES.reduce((n, st) => n + Number(new RegExp(`^- FF-P06 ${st}: FLOWS_TO (\\d+)`, 'm').exec(sec(run))?.[1] ?? 0), 0);
    res['f-cd-q1-53'] = `the ${ci('baseline-pre-barrel', 'layered')} FF-P06 rows`;
    res['f-cd-sum-q1-other'] = `| ${ci('baseline-pre-barrel', 'layered')} (baseline) |`;
    res['f-cd-sum-q8-other'] = `| ${flows('after-fixes')} |`;

    // repository facts
    res['f-cd-dev-cases'] = `the ${STYLES.reduce((n, st) => n + ctx.ls(`results/v1.3-reference/after-fixes/raw/${st}`).filter((f) => f.endsWith('.json')).length, 0)}-case development set`;
    const notes = ctx.read('Docs/v1.3-ddd-notes.md').split('\n');
    const at = notes.findIndex((l) => l.startsWith('Proposed ADRs'));
    let adrs = 0; for (let i = at + 1; i < notes.length && !/^#/.test(notes[i]); i++) if (/^\d+\. \*\*/.test(notes[i])) adrs++;
    res['f-cd-tier-adrs'] = `the ${words[adrs]} tier ADRs`;
    const cat = ctx.read('src/shared/construct-switch-catalogue.ts');
    const qids = new Set([...cat.matchAll(/\bid: '(Q\d+)'/g)].map((m) => m[1]));
    res['f-cd-questions'] = `The result is ${qids.size} questions`;
    const doc = ctx.read(CD).split('\n');
    res['f-cd-rev1-changed'] = `those ${words[doc.slice(59, 84).filter((l) => /^\| \*\*\d+\*\* \|/.test(l)).length]} questions`;
    const verdicts = doc.slice(825, 845).filter((l) => /^\| [\d, ]+ \| /.test(l)).map((l) => l.split('|')[2].replace(/\*/g, '').trim());
    res['f-cd-review-challenge'] = `It challenged ${words[verdicts.filter((v) => v === 'challenge').length]} recommendations`;
    res['f-cd-review-ewc'] = `endorsed ${words[verdicts.filter((v) => v === 'endorse-with-change').length]} with changes`;
    const ev = ctx.json('results/v1.3-reference/after-fixes/evidence/nestjs/n03-service-injects-sibling-service.json');
    const p02 = ev.violations.find((v) => v.functionId === 'FF-P02');
    res['f-cd-q22-ratio'] = `a ${/ratio=([\d.]+)/.exec(p02.evidence.join(' '))[1]} ratio`;
    const reg = /ff\('FF-P02'[^\n]*threshold: ([\d.]+)/.exec(ctx.read('src/spec-parser/template-registry.ts'));
    res['f-as-p02-threshold'] = `a ${reg[1]} threshold`;

    // variants that drop `implements`: a patch that removes an implements line and adds none, or a ddd overlay file
    // with fewer `implements` than the same file of the clean project
    const F = 'tests/fixtures/v1.3-reference';
    let dropped = 0;
    for (const st of STYLES) {
      for (const v of ctx.ls(`${F}/${st}/variants`)) {
        const dir = `${F}/${st}/variants/${v}`;
        if (ctx.exists(`${dir}/variant.patch`)) {
          const p = ctx.read(`${dir}/variant.patch`).split('\n');
          if (p.some((l) => /^-(?!--).*\bimplements\b/.test(l)) && !p.some((l) => /^\+(?!\+\+).*\bimplements\b/.test(l))) dropped++;
        } else if (ctx.exists(`${dir}/overlay`)) {
          const files = ctx.sh(`find "${ctx.p(`${dir}/overlay`)}" -type f`).trim().split('\n').filter(Boolean);
          const cleanRoot = ctx.exists(`${F}/${st}/clean`) ? `${F}/${st}/clean` : `${F}/${st}/project`;
          const lost = files.some((f) => {
            const rel = f.slice(ctx.p(`${dir}/overlay`).length + 1);
            const orig = `${cleanRoot}/${rel}`;
            const n = (t) => (t.match(/\bimplements\b/g) ?? []).length;
            return ctx.exists(orig) && n(ctx.read(f)) < n(ctx.read(orig));
          });
          if (lost) dropped++;
        }
      }
    }
    res['f-cd-q9-three'] = `${cap(words[dropped])} variants drop an \`implements\` clause`;
    res['f-as-q9-three'] = res['f-cd-q9-three'];
    return res;
  },
};

// =====================================================================================================================
// Group 3: the FF-P06 N/A correction cited in construct-decisions.md (footnote 1 and the Method paragraph).
// =====================================================================================================================
const ffNumbers = [
  d('fn1-flows', 52, 'FF-P06 FLOWS_TO rows reported N/A (after-fixes)', 'with the 3 FF-P06 FLOWS_TO rows'),
  d('fn1-af-r', 52, 'after-fixes author (cycle-normalised) pooled blocking recall, corrected', '53/54 recall'),
  d('fn1-af-p', 52, 'after-fixes author pooled blocking precision, corrected', '53/53 precision'),
  d('fn1-amf', 52, 'after-member-facts author pooled blocking recall and precision, corrected', '54/54 after member facts'),
  d('fn1-af-r-rep', 52, 'after-fixes author pooled blocking recall, as reported', 'not 56/57'),
  d('fn1-af-p-rep', 52, 'after-fixes author pooled blocking precision, as reported', '56/56 or'),
  d('fn1-amf-rep', 52, 'after-member-facts author pooled blocking recall and precision, as reported', 'or 57/57'),
  d('m-author-r', 807, 'after-fixes author pooled blocking recall, as reported', 'author R 56/57'),
  d('m-author-p', 807, 'after-fixes author pooled blocking precision, as reported', 'P 56/56;'),
  d('m-blind-r', 807, 'after-fixes blind (expanded) pooled blocking recall, as reported', 'blind R 52/67'),
  d('m-blind-p', 807, 'after-fixes blind (expanded) pooled blocking precision, as reported', 'P 52/56)'),
  d('m-flows', 807, 'FF-P06 FLOWS_TO rows counted as blocking TPs', 'with the 3 FF-P06 FLOWS_TO rows counted'),
  d('m-author-r-na', 807, 'after-fixes author pooled blocking recall, FLOWS_TO N/A', 'author R 53/54'),
  d('m-author-p-na', 807, 'after-fixes author pooled blocking precision, FLOWS_TO N/A', 'P 53/53;'),
  d('m-blind-r-na', 807, 'after-fixes blind pooled blocking recall, FLOWS_TO N/A', 'blind R 49/64'),
  d('m-blind-p-na', 807, 'after-fixes blind pooled blocking precision, FLOWS_TO N/A', 'P 49/53 (note'),
  d('q8-3-det', 298, 'FF-P06 detections, all from FLOWS_TO (after-fixes)', 'All 3 FF-P06 detections'),
  d('q8-3-listed', 304, 'FF-P06 FLOWS_TO detections listed N/A under B', 'its 3 detections'),
  d('q8-3-agree', 306, 'FF-P06 FLOWS_TO rows that agree', 'its 3 agreeing rows'),
];
const ffGroup = {
  id: 'f-construct-ffp06',
  title: 'FF-P06 N/A correction as cited in construct-decisions.md (ffp06-na-recount.mjs)',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'node scripts/v1.3/ffp06-na-recount.mjs after-fixes after-member-facts',
  numbers: ffNumbers,
  async run(ctx) {
    const out = ctx.sh('node scripts/v1.3/ffp06-na-recount.mjs after-fixes after-member-facts');
    const sec = (run) => out.split(/^## /m).find((x) => x.startsWith(`${run}\n`));
    const pooled = (run, view) => {
      const v = sec(run).split(/^### /m).find((x) => x.startsWith(`${view}\n`));
      const c = /^\| pooled \|(.*)\|$/m.exec(v)[1].split('|').map((x) => x.trim().split(' = ')[0]);
      return { rRep: c[0], rCor: c[1], pRep: c[2], pCor: c[3] };
    };
    const flows = STYLES.reduce((n, st) => n + Number(new RegExp(`^- FF-P06 ${st}: FLOWS_TO (\\d+)`, 'm').exec(sec('after-fixes'))?.[1] ?? 0), 0);
    const ci = STYLES.reduce((n, st) => n + Number(new RegExp(`^- FF-P06 ${st}: FLOWS_TO \\d+ \\(N/A\\), CONSTRUCTOR_INJECTS (\\d+)`, 'm').exec(sec('after-fixes'))?.[1] ?? 0), 0);
    const af = pooled('after-fixes', 'author-cycle-normalised');
    const bl = pooled('after-fixes', 'blind-expanded');
    const amf = pooled('after-member-facts', 'author-cycle-normalised');
    const both = (x, y) => (x === y ? x : `${x}|${y}`);
    return {
      'f-cd-fn1-flows': `with the ${flows} FF-P06 FLOWS_TO rows`,
      'f-cd-fn1-af-r': `${af.rCor} recall`,
      'f-cd-fn1-af-p': `${af.pCor} precision`,
      'f-cd-fn1-amf': `${both(amf.rCor, amf.pCor)} after member facts`,
      'f-cd-fn1-af-r-rep': `not ${af.rRep}`,
      'f-cd-fn1-af-p-rep': `${af.pRep} or`,
      'f-cd-fn1-amf-rep': `or ${both(amf.rRep, amf.pRep)}`,
      'f-cd-m-author-r': `author R ${af.rRep}`,
      'f-cd-m-author-p': `P ${af.pRep};`,
      'f-cd-m-blind-r': `blind R ${bl.rRep}`,
      'f-cd-m-blind-p': `P ${bl.pRep})`,
      'f-cd-m-flows': `with the ${flows} FF-P06 FLOWS_TO rows counted`,
      'f-cd-m-author-r-na': `author R ${af.rCor}`,
      'f-cd-m-author-p-na': `P ${af.pCor};`,
      'f-cd-m-blind-r-na': `blind R ${bl.rCor}`,
      'f-cd-m-blind-p-na': `P ${bl.pCor} (note`,
      'f-cd-q8-3-det': ci === 0 ? `All ${flows} FF-P06 detections` : `${flows} of ${flows + ci} FF-P06 detections`,
      'f-cd-q8-3-listed': `its ${flows} detections`,
      'f-cd-q8-3-agree': `its ${flows} agreeing rows`,
    };
  },
};

// =====================================================================================================================
// Group 4: numbers in construct-decisions.md that no committed input determines.
// =====================================================================================================================
const notRun = {
  id: 'f-construct-notrun',
  title: 'construct-decisions numbers with no committed producer or input',
  needs: 'not-checkable',
  basis: '',
  how: '(none committed)',
  numbers: [
    d('ambiguities', 12, 'ambiguities in the blind summary', 'the 13 ambiguities', { needs: 'needs-external', note: 'daedalus-sealed/v1.3-blind/blind-out/summary.md is outside the repository (sealed by design).' }),
    d('fn1-rev0', 52, 'revision 0: adopting every recommendation yields', 'yields 56/56', { note: 'a revision-0 output of the uncommitted row-dump script; the CSV holds one option at a time, not all recommendations together (the doc says it holds by construction).' }),
    d('review-rev0', 815, 'revision 0 "where this lands" claim', 'The 56/56', { note: 'same revision-0 figure as footnote 1; not reproducible from a committed file.' }),
    d('q5-d-hex-before', 223, 'Q5 D hexagonal recall before the change', 'hex R is 14/16', { note: 'Q5 D has no rows in the CSV (the doc says so); 14/16 equals the CSV as-is figure of Q5 C, but D itself is not scored anywhere committed.' }),
    d('q5-d-ddd-before', 223, 'Q5 D ddd recall before the change', 'ddd R 7/8', { note: 'Q5 D has no rows in the CSV; no committed figure gives 7/8 for ddd.' }),
  ],
};

export default [effectsGroup, csvGroup, ffGroup, notRun];
