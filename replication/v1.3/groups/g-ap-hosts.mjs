// Anti-pattern host projects (Docs/v1.3/ap-hosts-notes.md): the site table (scripts/v1.3/ap-hosts-seed.ts
// --count-only), the static clean-base check (scripts/v1.3/lib/ap-hosts-lint.ts), the freeze hashes of
// Docs/v1.3/judge-catch-frozen.md, the antipattern-nest comparison from the committed round-1 / v2 seed manifests, and
// (slow) the full seeding of 6 + 6 copies per operator per host with tsc, plus the in-memory sweep of every site.
// No judge call and no Neo4j: seeding only copies, edits and type-checks.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const DOC = 'Docs/v1.3/ap-hosts-notes.md';
const HOSTS = ['museum-loans', 'coworking-memberships', 'blood-drives', 'translation-jobs'];
const n = (id, line, what, stated, extra = {}) => ({ id: `g-aph-${id}`, doc: DOC, line, what, stated, ...extra });
const sha = (b) => createHash('sha256').update(b).digest('hex');

// §3 site table, as stated (rows in the doc's order, lines 35..46)
const TABLE = [
  ['AP-REPO-BYPASS', 35, ['23 / 23', '15 / 15', '20 / 20', '14 / 14'], '72'],
  ['AP-REPO-BYPASSn', 36, ['23 / 23', '15 / 15', '20 / 20', '14 / 14'], '72'],
  ['AP-FAT-CONTROLLER', 37, ['19 / 20', '14 / 15', '16 / 19', '14 / 15'], '63'],
  ['AP-FAT-CONTROLLERn', 38, ['11 / 11', '16 / 16', '7 / 7', '8 / 8'], '42'],
  ['AP-PERSIST-IN-DOMAIN', 39, ['8 / 8', '7 / 7', '7 / 7', '7 / 7'], '29'],
  ['AP-PERSIST-IN-DOMAINn', 40, ['8 / 8', '7 / 7', '7 / 7', '7 / 7'], '29'],
  ['AP-DUP-RULE', 41, ['100 / 100', '75 / 75', '76 / 76', '105 / 105'], '356'],
  ['AP-DUP-RULEn', 42, ['100 / 100', '75 / 75', '76 / 76', '105 / 105'], '356'],
  ['AP-FRAMEWORK-LEAK', 43, ['21 / 21', '18 / 18', '14 / 14', '11 / 11'], '64'],
  ['AP-FRAMEWORK-LEAKn', 44, ['21 / 21', '18 / 18', '14 / 14', '11 / 11'], '64'],
  ['AP-DUP-RULE2', 45, ['100 / 100', '75 / 75', '76 / 76', '105 / 105'], '356'],
  ['AP-DUP-RULE2n', 46, ['100 / 100', '75 / 75', '76 / 76', '105 / 105'], '356'],
];
const opKey = (op) => op.toLowerCase().replace(/^ap-/, '');
const tableNumbers = TABLE.flatMap(([op, line, cells, total]) => [
  ...cells.map((c, i) => n(`cell-${opKey(op)}-${HOSTS[i]}`, line, `${op} eligible / candidates on ${HOSTS[i]}`, c)),
  n(`total-${opKey(op)}`, line, `${op} total eligible`, total),
]);

const SEEDED = ['AP-REPO-BYPASS', 'AP-FAT-CONTROLLER', 'AP-PERSIST-IN-DOMAIN', 'AP-FRAMEWORK-LEAK', 'AP-DUP-RULE2'];

function walk(d) {
  return readdirSync(d).flatMap((e) => { const p = join(d, e); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

export default [{
  id: 'g-aph-sites',
  title: 'AP hosts: site table, host sizes, clean-base check, freeze hashes, antipattern-nest comparison',
  needs: 'offline',
  basis: 'regenerated',
  slow: true,
  how: 'node --import tsx scripts/v1.3/ap-hosts-seed.ts --out <scratch> --count-only; lintHost (scripts/v1.3/lib/ap-hosts-lint.ts) per host; sha256 of the files in Docs/v1.3/judge-catch-frozen.md; results/v1.3-judge-catch/{,duprule-v2/}seed-manifest.json',
  numbers: [
    n('n35', 7, 'judge catch seeds pooled over the rounds (duprule-v2/scores.json pooledAcrossRounds)', 'n = 35 seeds'),
    n('nest-8', 7, 'source files of fixtures/unit/antipattern-nest', '8-file'),
    n('src-museum', 15, 'museum-loans src .ts files', '43'),
    n('src-coworking', 16, 'coworking-memberships src .ts files', '36'),
    n('src-blood', 17, 'blood-drives src .ts files', '37'),
    n('src-translation', 18, 'translation-jobs src .ts files', '42'),
    ...tableNumbers,
    n('min6', 48, 'minimum eligible sites of a seeded operator or twin on any host', 'at least 6 eligible sites'),
    n('persist-7-8', 48, 'AP-PERSIST-IN-DOMAIN eligible per host (min or max)', '7 or 8 domain classes'),
    n('fatn-range', 48, 'AP-FAT-CONTROLLERn eligible per host (min to max)', '7 to 16'),
    n('nest-1-site', 48, 'antipattern-nest sites for AP-FAT-CONTROLLER and AP-DUP-RULE2, eligible AP-PERSIST-IN-DOMAIN (committed round-1 and v2 manifests)', '1 site each to AP-FAT-CONTROLLER and AP-DUP-RULE2, and 1 eligible site'),
    n('dup-rules', 50, 'distinct parameter rules per host (AP-DUP-RULE eligible sites)', '20, 15, 19 and 15'),
    n('sample-seed', 54, 'SAMPLE_SEED and default --per-cell (ap-hosts-seed.ts)', '`SAMPLE_SEED = 20261016` and `--per-cell 6`'),
    n('apply-seed', 54, 'fixed apply seed of judge-catch-seed.ts (APPLY_SEED)', '`20261015`'),
    n('lint-advisory', 69, 'clean-base check: advisory rows on the hexagonal host (no blocking row anywhere, none elsewhere)', '7 advisory rows'),
    n('lint-c03', 69, 'FF-C03 (component-instability) rows on use cases / inbound controllers', 'four use cases and one inbound controller'),
    n('frozen-20', 91, 'files with a latest sha256 in judge-catch-frozen.md, all matching', '20 files'),
    n('v2-digest', 91, 'combined v2 registry digest (sorted shasum lines of the catalogue and the 8 antipatterns/*.ts)', '`afe879b51c3d1cd0c84a203e0f819000eccd427e155acb7db2c4480648764444`'),
    n('test-25-45', 100, 'every host has 25 to 45 source files', 'has 25 to 45 source files'),
    n('test-min6', 100, 'every seeded operator and twin has ≥ 6 eligible sites per host', '≥ 6 eligible sites'),
  ],
  async run(ctx) {
    const scr = ctx.out('g-aph-sites');
    ctx.sh(`node --import tsx scripts/v1.3/ap-hosts-seed.ts --out ${scr} --count-only`);
    const man = JSON.parse(readFileSync(join(scr, 'seed-manifest.json'), 'utf8'));
    const cell = (h, op) => man.table.find((x) => x.baseId === h && x.operatorId === op);
    const r = {};
    for (const [op] of TABLE) {
      HOSTS.forEach((h) => { const c = cell(h, op); r[`g-aph-cell-${opKey(op)}-${h}`] = `${c.eligible} / ${c.candidates}`; });
      r[`g-aph-total-${opKey(op)}`] = String(HOSTS.reduce((s, h) => s + cell(h, op).eligible, 0));
    }
    const elig = SEEDED.flatMap((op) => [op, `${op}n`]).flatMap((op) => HOSTS.map((h) => cell(h, op).eligible));
    const min = Math.min(...elig);
    r['g-aph-min6'] = min >= 6 ? 'at least 6 eligible sites' : `minimum ${min}`;
    r['g-aph-test-min6'] = min >= 6 ? '≥ 6 eligible sites' : `minimum ${min}`;
    const per = [...new Set(HOSTS.map((h) => cell(h, 'AP-PERSIST-IN-DOMAIN').eligible))].sort((a, b) => a - b);
    r['g-aph-persist-7-8'] = `${per.join(' or ')} domain classes`;
    const fn = HOSTS.map((h) => cell(h, 'AP-FAT-CONTROLLERn').eligible);
    r['g-aph-fatn-range'] = `${Math.min(...fn)} to ${Math.max(...fn)}`;

    // distinct parameter rules, host sizes, clean-base check (one tsx process)
    const info = JSON.parse(ctx.sh(`node --import tsx --input-type=module -e "
import { AP_HOSTS, hostSiteTable, SAMPLE_SEED, DEFAULT_PER_CELL } from './scripts/v1.3/ap-hosts-seed.ts';
import { lintHost } from './scripts/v1.3/lib/ap-hosts-lint.ts';
import * as path from 'node:path';
const o = { SAMPLE_SEED, DEFAULT_PER_CELL, hosts: {} };
for (const h of AP_HOSTS) {
  const t = await hostSiteTable(process.cwd(), h);
  const rk = (s) => [s.detail.sourceFile ?? '', s.detail.sourceClass ?? '', s.detail.method ?? '', s.detail.guard ?? ''].join('|');
  const lint = await lintHost(process.cwd(), path.join(process.cwd(), h.dir), h.specPath);
  o.hosts[h.id] = { rules: new Set((t.eligible.get('AP-DUP-RULE') ?? []).map(rk)).size, lint };
}
console.log(JSON.stringify(o));"`));
    r['g-aph-dup-rules'] = HOSTS.map((h) => info.hosts[h].rules).join(', ').replace(/, (\d+)$/, ' and $1');
    r['g-aph-sample-seed'] = `\`SAMPLE_SEED = ${info.SAMPLE_SEED}\` and \`--per-cell ${info.DEFAULT_PER_CELL}\``;
    r['g-aph-apply-seed'] = `\`${/const APPLY_SEED = (\d+);/.exec(ctx.read('scripts/v1.3/judge-catch-seed.ts'))[1]}\``;
    const lint = Object.fromEntries(HOSTS.map((h) => [h, info.hosts[h].lint]));
    const blocking = HOSTS.reduce((s, h) => s + lint[h].filter((x) => x.blocking).length, 0);
    const advOther = HOSTS.slice(0, 3).reduce((s, h) => s + lint[h].length, 0);
    const adv = lint['translation-jobs'].filter((x) => !x.blocking);
    r['g-aph-lint-advisory'] = blocking === 0 && advOther === 0 ? `${adv.length} advisory rows` : `blocking ${blocking}, advisory elsewhere ${advOther}, hexagonal ${adv.length}`;
    const c03 = adv.filter((x) => x.rule === 'component-instability');
    const uc = c03.filter((x) => x.file.includes('/use-cases/')).length;
    const ctl = c03.filter((x) => x.file.includes('/adapters/inbound/')).length;
    r['g-aph-lint-c03'] = `${['zero', 'one', 'two', 'three', 'four', 'five'][uc]} use cases and ${['zero', 'one', 'two'][ctl]} inbound controller`;

    // host sizes
    const srcCount = (h) => walk(ctx.p(`fixtures/unit/ap-hosts/${h}/src`)).filter((p) => p.endsWith('.ts')).length;
    const sizes = HOSTS.map(srcCount);
    ['museum', 'coworking', 'blood', 'translation'].forEach((k, i) => { r[`g-aph-src-${k}`] = String(sizes[i]); });
    r['g-aph-test-25-45'] = sizes.every((s) => s >= 25 && s <= 45) ? 'has 25 to 45 source files' : `sizes ${sizes.join('/')}`;
    r['g-aph-nest-8'] = `${walk(ctx.p('fixtures/unit/antipattern-nest/src')).filter((p) => p.endsWith('.ts')).length}-file`;

    // judge catch n and antipattern-nest sites (committed manifests)
    r['g-aph-n35'] = `n = ${ctx.json('results/v1.3-judge-catch/duprule-v2/scores.json').pooledAcrossRounds.withV1DupRule.seedsAll.n} seeds`;
    const m1 = ctx.json('results/v1.3-judge-catch/seed-manifest.json').table;
    const m2 = ctx.json('results/v1.3-judge-catch/duprule-v2/seed-manifest.json').table;
    const nest = (t, op) => t.find((x) => x.baseId === 'antipattern-nest' && x.operatorId === op);
    const fc = nest(m1, 'AP-FAT-CONTROLLER').candidates; const d2 = nest(m2, 'AP-DUP-RULE2').candidates; const pe = nest(m1, 'AP-PERSIST-IN-DOMAIN').eligible;
    r['g-aph-nest-1-site'] = fc === d2 ? `${fc} site each to AP-FAT-CONTROLLER and AP-DUP-RULE2, and ${pe} eligible site` : `${fc} / ${d2} sites, ${pe} eligible`;

    // freeze hashes
    const frozen = ctx.read('Docs/v1.3/judge-catch-frozen.md');
    const latest = new Map();
    for (const mm of frozen.matchAll(/\| `([^`]+)` \| `([0-9a-f]{64})` \|/g)) latest.set(mm[1], mm[2]);
    const bad = [...latest].filter(([f, h]) => sha(readFileSync(ctx.p(f))) !== h).map(([f]) => f);
    r['g-aph-frozen-20'] = bad.length === 0 ? `${latest.size} files` : `${latest.size} files, ${bad.length} changed: ${bad.join(' ')}`;
    const ap = 'scripts/lib/mutation/antipatterns';
    const files = ['Docs/operator-catalogue-antipatterns.md', ...ctx.ls(ap).filter((f) => f.endsWith('.ts')).map((f) => `${ap}/${f}`)].sort();
    const lines = files.map((f) => `${sha(readFileSync(ctx.p(f)))}  ${f}\n`).join('');
    r['g-aph-v2-digest'] = `\`${sha(lines)}\``;
    return r;
  },
}, {
  id: 'g-aph-seed',
  title: 'AP hosts: full seeding (6 + 6 per operator per host, tsc on every copy) and the full in-memory sweep',
  needs: 'offline',
  basis: 'regenerated',
  slow: true,
  how: 'node --import tsx scripts/v1.3/ap-hosts-seed.ts --out <scratch> (in a scratch export of HEAD), then --only <host> --count-only --sweep per host; about 40 to 60 minutes',
  numbers: [
    n('dup-rules-used', 50, 'distinct rules used by the AP-DUP-RULE2 seeds, per host', '6 distinct rules per host'),
    n('per-cell', 56, 'seeds per host and positive operator', 'until 6 seeds type-check'),
    n('seeds', 58, 'seeds and twins (all hosts)', '120 seeds and 120 twins, 6 + 6 per operator per host'),
    n('rejected', 58, 'rejected draws', '0 rejected draws'),
    n('twin-match', 58, 'twin match counts', '96 same-site, 15 same-call, 4 same-file, 5 same-host'),
    n('sweep', 59, 'full sweep: applications, new diagnostics, apply errors', '1,859 applications, 0 that add a diagnostic, 0 apply errors'),
    n('volume', 60, 'copies, clean controls, evaluated projects', '240 copies plus 4 clean controls'),
    n('volume-244', 60, 'evaluated projects (projectedJudgedProjects)', '244 evaluated projects'),
    n('calls-730', 60, 'live judge calls at 3 runs per unit and one function per row (244 × 3, rounded to 10)', 'about 730 live judge calls'),
    n('budget-200', 60, 'call budget of the v2 unit (judge-catch-frozen.md)', '200-call budget'),
    n('rerun-0', 93, 'rejections after the re-run', '0 rejections'),
  ],
  async run(ctx) {
    const tree = ctx.tree();
    const scr = ctx.out('g-aph-seed');
    const so = ctx.sh(`node --import tsx scripts/v1.3/ap-hosts-seed.ts --out ${join(scr, 'all')}`, { cwd: tree });
    const man = JSON.parse(readFileSync(join(scr, 'all', 'seed-manifest.json'), 'utf8'));
    const s = man.summary;
    const ok = man.rows.filter((x) => x.status === 'ok');
    const r = {};
    const cells = man.cells;
    const pc = [...new Set(cells.flatMap((c) => [c.seedsOk, c.twinsOk]))];
    r['g-aph-per-cell'] = pc.length === 1 ? `until ${pc[0]} seeds type-check` : `seeds per cell ${pc.join('/')}`;
    r['g-aph-seeds'] = `${s.seeds} seeds and ${s.twins} twins, ${pc.length === 1 ? `${pc[0]} + ${pc[0]}` : '?'} per operator per host`;
    r['g-aph-rejected'] = `${s.rejectedDraws.length} rejected draws`;
    r['g-aph-rerun-0'] = `${s.rejectedDraws.length} rejections`;
    const tm = (k) => ok.filter((x) => x.twinMatch === k).length;
    r['g-aph-twin-match'] = `${tm('same-site')} same-site, ${tm('same-call')} same-call, ${tm('same-file')} same-file, ${tm('same-host')} same-host`;
    const rk = (st) => [st.detail.sourceFile ?? '', st.detail.sourceClass ?? '', st.detail.method ?? '', st.detail.guard ?? ''].join('|');
    const used = [...new Set(HOSTS.map((h) => new Set(ok.filter((x) => x.baseId === h && x.operatorId === 'AP-DUP-RULE2' && x.role === 'seed').map((x) => rk(x.site))).size))];
    r['g-aph-dup-rules-used'] = used.length === 1 ? `${used[0]} distinct rules per host` : `${used.join('/')} distinct rules`;
    const copies = s.seeds + s.twins; const bases = s.projectedJudgedProjects - copies;
    r['g-aph-volume'] = `${copies} copies plus ${bases} clean controls`;
    r['g-aph-volume-244'] = `${s.projectedJudgedProjects} evaluated projects`;
    r['g-aph-calls-730'] = `about ${Math.round((s.projectedJudgedProjects * 3) / 10) * 10} live judge calls`;
    r['g-aph-budget-200'] = `${/Budget for this unit: at most (\d+) live calls/.exec(ctx.read('Docs/v1.3/judge-catch-frozen.md'))[1]}-call budget`;
    // sweep, one host per process
    let applied = 0; let diag = 0; let errs = 0;
    for (const h of HOSTS) {
      ctx.sh(`node --import tsx scripts/v1.3/ap-hosts-seed.ts --out ${join(scr, `sweep-${h}`)} --only ${h} --count-only --sweep`, { cwd: tree });
      const sw = JSON.parse(readFileSync(join(scr, `sweep-${h}`, 'seed-manifest.json'), 'utf8')).summary.sweep;
      applied += sw.applied; diag += sw.newDiagnostics; errs += sw.applyErrors;
    }
    r['g-aph-sweep'] = `${applied.toLocaleString('en-US')} applications, ${diag} that add a diagnostic, ${errs} apply errors`;
    void so;
    return r;
  },
}];
