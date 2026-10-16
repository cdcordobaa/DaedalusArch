// Judge v2 (TUNE / CHECK) and filter-and-explain (FR-V8), 2026-10-16: the split regenerated, the v2 verdicts and FE
// answers rebuilt from the committed cassettes, then scored by the committed scorers (judge-v2-score.ts,
// filter-explain-run.ts plan + score) in a scratch export of HEAD; call counts from the ledger; targeted jest suites.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { once, sha, walk } from './b-judge-catch.mjs';

const D = 'Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md';
const RES = 'results/v1.3-judge-v2';
const CAS = 'tests/fixtures/judge-cassettes-v13';
const tsx = 'node --import tsx';
const LABELS = ['tune-v2.0', 'tune-v2.1', 'check-v1-current-graph', 'check-v2.1'];
const short = (t) => t.split(' = ')[0];
const num = (t) => short(t).split('/').map(Number);
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const word = (k) => WORDS[k] ?? String(k);

/** HEAD export with the v2 verdicts.json and the FE answers.json rebuilt from the cassettes. */
function rebuilt(ctx) {
  return once('b-v2-rebuilt', () => {
    const tree = ctx.tree();
    const work = ctx.out('b-judge-v2');
    // work on a private copy of results/v1.3-judge-v2 inside a private copy of the tree's results dir
    const root = join(work, 'root');
    mkdirSync(root, { recursive: true });
    for (const d of ['scripts', 'src', 'tests', 'results', 'specs', 'presets', 'package.json', 'tsconfig.json', 'fixtures']) {
      try { cpSync(join(tree, d), join(root, d), { recursive: true, dereference: false }); } catch { /* optional */ }
    }
    ctx.sh(`ln -s "${ctx.p('node_modules')}" "${join(root, 'node_modules')}"`);
    const stats = {};
    for (const label of LABELS) {
      const es = walk(ctx.p(`${CAS}/judge-v2/${label}`)).map((f) => JSON.parse(readFileSync(f, 'utf8')));
      const committed = ctx.json(`${RES}/${label}/verdicts.json`);
      let unmatched = 0;
      const verdicts = committed.verdicts.map((it) => {
        const [, , fn, unit] = it.itemId.split('|');
        const runs = it.runs.map((r) => {
          const e = es.find((x) => x.runIndex === r.runIndex && x.functionId === fn && x.unitId === unit && x.parsedVerdict && x.parsedVerdict.reasoning === r.reasoning);
          if (!e) { unmatched++; return { runIndex: r.runIndex, valid: false }; }
          const v = e.parsedVerdict;
          return e.outcome.kind === 'valid' ? { runIndex: r.runIndex, valid: true, pass: v.pass, confidence: v.confidence, violations: v.violations, reasoning: v.reasoning, recordedAt: e.recordedAt } : { runIndex: r.runIndex, valid: false };
        });
        const valid = runs.filter((r) => r.valid); const fails = valid.filter((r) => r.pass === false).length;
        const verdict = valid.length === 0 ? 'invalid' : fails * 2 > valid.length ? 'fail' : (valid.length - fails) * 2 > valid.length ? 'pass' : 'warning';
        return { itemId: it.itemId, runs, verdict };
      });
      stats[label] = { unmatched, entries: es.length, verdicts, sameAsCommitted: verdicts.every((v, i) => v.verdict === committed.verdicts[i].verdict) };
      writeFileSync(join(root, RES, label, 'verdicts.json'), `${JSON.stringify({ ...committed, verdicts: verdicts.map((v) => ({ ...v, runs: v.runs.map(({ recordedAt, ...r }) => r) })) }, null, 2)}\n`);
    }
    // FE: answers from the cassettes (sha256(prompt) is the plan's prompt key), plan regenerated, then score
    const answers = {};
    for (const f of walk(ctx.p(`${CAS}/filter-explain`))) {
      const e = JSON.parse(readFileSync(f, 'utf8'));
      answers[sha(e.prompt)] = { valid: e.outcome.kind === 'valid', response: e.response };
    }
    const fe = `${RES}/filter-explain`;
    writeFileSync(join(root, fe, 'answers.json'), `${JSON.stringify({ feRevision: ctx.json(`${fe}/answers.json`).feRevision, complete: true, answers }, null, 2)}\n`);
    ctx.sh(`${tsx} scripts/v1.3/filter-explain-run.ts plan --work "${join(work, 'fe-work')}"`, { cwd: root });
    const planSame = readFileSync(join(root, fe, 'plan.json'), 'utf8') === ctx.read(`${fe}/plan.json`);
    const feMd = ctx.sh(`${tsx} scripts/v1.3/filter-explain-run.ts score`, { cwd: root });
    const feScores = JSON.parse(readFileSync(join(root, fe, 'scores.json'), 'utf8'));
    const score = (args) => ctx.sh(`${tsx} scripts/v1.3/judge-v2-score.ts ${args}`, { cwd: root });
    // split regenerated
    ctx.sh(`${tsx} scripts/v1.3/judge-v2-split.ts --out "${join(work, 'split.json')}"`, { cwd: root });
    const split = JSON.parse(readFileSync(join(work, 'split.json'), 'utf8'));
    return {
      root, stats, answers, planSame, feMd, feScores, split,
      tune20: score('--split TUNE --v2 tune-v2.0 --runs first'),
      tune21: score('--split TUNE --v2 tune-v2.1 --runs first'),
      check: score('--split CHECK --v2 check-v2.1 --runs majority --v1-override check-v1-current-graph'),
    };
  });
}

/** `| name | c1 | c2 | ... |` rows of a scorer's markdown -> cells */
const rowOf = (md, name) => md.split('\n').find((l) => l.startsWith(`| ${name} |`)).split('|').slice(2, -1).map((s) => s.trim());

const CHECK_ROWS = [
  [98, 'v1', 'v1', ['13/14 = 0.93 [0.69, 0.99]', '13/14 = 0.93 [0.69, 0.99]', '4/21 = 0.19 [0.08, 0.40]', '2/21 = 0.10 [0.03, 0.29]', '2/26 = 0.08 [0.02, 0.24]', '0']],
  [99, 'v21', 'v2', ['14/14 = 1.00 [0.78, 1.00]', '13/14 = 0.93 [0.69, 0.99]', '5/21 = 0.24 [0.11, 0.45]', '2/21 = 0.10 [0.03, 0.29]', '4/26 = 0.15 [0.06, 0.34]', '0']],
  [100, 'v1-nodup', 'v1, without the v1 AP-DUP-RULEn twins', ['13/14', '13/14', '2/19 = 0.11 [0.03, 0.31]', '0/19 = 0.00 [0.00, 0.17]', '2/26', '0']],
  [101, 'v21-nodup', 'v2, without the v1 AP-DUP-RULEn twins', ['14/14', '13/14', '4/19 = 0.21 [0.09, 0.43]', '1/19 = 0.05 [0.01, 0.25]', '4/26', '0']],
];
const CCOLS = ['catch', 'paired', 'twinff', 'paired-twinff', 'cleanff', 'invalid'];
const TUNE_ROWS = [
  [67, 'v1', ['26/30 = 0.87 [0.70, 0.95]', '24/30 = 0.80 [0.63, 0.90]', '6/35 = 0.17 [0.08, 0.33]', '4/35 = 0.11 [0.05, 0.26]', '3/36 = 0.08 [0.03, 0.22]']],
  [68, 'v20', ['30/30 = 1.00 [0.89, 1.00]', '22/30 = 0.73 [0.56, 0.86]', '8/35 = 0.23 [0.12, 0.39]', '0/35 = 0.00 [0.00, 0.10]', '7/36 = 0.19 [0.10, 0.35]']],
  [69, 'v21', ['30/30 = 1.00 [0.89, 1.00]', '24/30 = 0.80 [0.63, 0.90]', '7/35 = 0.20 [0.10, 0.36]', '1/35 = 0.03 [0.01, 0.15]', '6/36 = 0.17 [0.08, 0.32]']],
];
const FAM = [
  [107, 'dup', 'AP-DUP-RULE', ['3/3', '3/3', '2/2', '1/2']],
  [108, 'dup2', 'AP-DUP-RULE2', ['3/3', '3/3', '0/3', '1/3']],
  [109, 'fl', 'AP-FRAMEWORK-LEAK', ['3/4 = 0.75 [0.30, 0.95]', '4/4 = 1.00 [0.51, 1.00]', '0/11', '0/11']],
  [110, 'pd', 'AP-PERSIST-IN-DOMAIN', [null, null, '2/5', '3/5']],
  [111, 'hp', 'hand-planted', ['4/4 = 1.00 [0.51, 1.00]', '4/4 = 1.00 [0.51, 1.00]', null, null]],
];
const FCOLS = ['v1catch', 'v2catch', 'v1twin', 'v2twin'];
const FE_T = [
  [133, 'true', ['66', '65/66 = 0.98 [0.92, 1.00]', '1/66 = 0.02 [0.00, 0.08]', '0', '0']],
  [134, 'false', ['2', '1/2 = 0.50 [0.09, 0.91]', '1/2 = 0.50 [0.09, 0.91]', '0', '0']],
  [135, 'unscored', ['241', '51/241 = 0.21 [0.16, 0.27]', '190/241 = 0.79 [0.73, 0.84]', '0', '0']],
];
const FECOLS = ['rows', 'confirm', 'dismiss', 'rejected', 'invalid'];
const CALLS = [
  [163, 'tune20', ['90', '1', '15']], [164, 'tune21', ['90', '1', '15']], [165, 'v1graph', ['12', '1', '0']],
  [166, 'check-s1', ['117', '1', '6']], [167, 'check-s2', ['51', '1', '138']], [168, 'fe', ['114', '1', '0']],
];

const scoreNumbers = [
  { id: 'b-v2-check-partial', doc: D, line: 3, what: 'CHECK items judged when session 1 stopped ((ledger attempts + hits) / 3 runs)', stated: '41 of 63 items' },
  { id: 'b-v2-check-complete', doc: D, line: 3, what: 'CHECK items with 3 valid runs', stated: '63/63' },
  { id: 'b-v2-fe-prompts-hdr', doc: D, line: 3, what: 'FE prompts', stated: '114 prompts' },
  { id: 'b-v2-frozensha', doc: D, line: 10, what: 'FROZEN_SHA256 = computeFrozenSha256() at HEAD', stated: 'f8b2dabb…' },
  { id: 'b-v2-v1graph-items4', doc: D, line: 94, what: 'antipattern-nest items replaced by the current-graph re-judgement', stated: 'the 4 `antipattern-nest` items' },
  { id: 'b-v2-hp-four', doc: D, line: 223, what: 'hand-planted CHECK seeds v1 caught and v2.1 keeps', stated: 'the four hand-planted ones' },
  { id: 'b-v2-v1graph-items', doc: D, line: 39, what: 'CHECK items re-judged with v1 on the current graph', stated: '4 CHECK items' },
  { id: 'b-v2-v1graph-twins', doc: D, line: 39, what: 'of which PERSIST-IN-DOMAINn twins', stated: 'two PERSIST-IN-DOMAINn twins' },
  { id: 'b-v2-v1graph-calls', doc: D, line: 39, what: 'v1 current-graph calls', stated: '12 calls' },
  { id: 'b-v2-v1graph-fail', doc: D, line: 39, what: 'v1 current-graph items still failing', stated: 'All 4 still fail' },
  { id: 'b-v2-tune-changed', doc: D, line: 40, what: 'TUNE items whose v1 prompt changed with the alias fix', stated: '28 changed TUNE items', needs: 'needs-Neo4j',
    note: 'which items changed needs the current-graph v1 harvest (Neo4j); 30 TUNE items sit on round-1 antipattern-nest targets, so 2 of them kept their prompt' },
  { id: 'b-v2-split-items', doc: D, line: 43, what: 'split items (regenerated split)', stated: '168 items: 45 seeds, 61 twins and 62 clean-control units' },
  { id: 'b-v2-split-clusters', doc: D, line: 48, what: 'clusters', stated: '44 clusters' },
  { id: 'b-v2-split-tune', doc: D, line: 49, what: 'TUNE items (share)', stated: 'TUNE: 105 items (62.5%)' },
  { id: 'b-v2-split-tune-kinds', doc: D, line: 49, what: 'TUNE items by kind', stated: '31 seed, 38 twin and 36 clean units' },
  { id: 'b-v2-split-tune-targets', doc: D, line: 49, what: 'TUNE seed and twin targets', stated: '30 seed targets, 35 twin targets' },
  { id: 'b-v2-split-check', doc: D, line: 50, what: 'CHECK items (share)', stated: 'CHECK: 63 items (37.5%)' },
  { id: 'b-v2-split-check-kinds', doc: D, line: 50, what: 'CHECK items by kind', stated: '14 seed, 23 twin and 26 clean units' },
  { id: 'b-v2-split-ratio', doc: D, line: 51, what: 'split ratio', stated: '62.5/37.5' },
  { id: 'b-v2-revisions', doc: D, line: 63, what: 'v2 revisions used (tune labels after v2.0)', stated: '1 was used' },
  ...TUNE_ROWS.flatMap(([line, s, st]) => st.map((v, i) => ({ id: `b-v2-tune-${s}-${CCOLS[i]}`, doc: D, line, what: `TUNE ${s} ${CCOLS[i]}`, stated: v }))),
  { id: 'b-v2-tune-v1miss', doc: D, line: 72, what: 'v1 misses on TUNE caught by v2.0', stated: 'all four v1 misses' },
  { id: 'b-v2-tune-fln', doc: D, line: 77, what: 'antipattern-nest FRAMEWORK-LEAKn twins failed by v2.0 (run 0)', stated: '4 `antipattern-nest` FRAMEWORK-LEAKn twins' },
  { id: 'b-v2-tune-svc', doc: D, line: 77, what: 'antipattern-nest base service units failed by v2.0', stated: 'both base service units' },
  { id: 'b-v2-tune-clean6', doc: D, line: 84, what: 'clean false fails remaining under v2.1 on TUNE', stated: 'All 6 remaining clean false fails' },
  { id: 'b-v2-tune-haiku', doc: D, line: 85, what: 'v2.1 TUNE clean fails on the haiku usecases unit', stated: '2 items' },
  { id: 'b-v2-tune-gpt', doc: D, line: 86, what: 'v2.1 TUNE clean fails on the gpt src/application unit', stated: '2 items' },
  { id: 'b-v2-check-sha', doc: D, line: 92, what: 'JUDGE_V2_SHA256 (computeJudgeV2Sha256 at HEAD = verdicts.json judgeV2Sha256)', stated: '0add6562…' },
  { id: 'b-v2-check-stored', doc: D, line: 92, what: 'CHECK (prompt, run) results from session 1 (ledger attempts + hits)', stated: '123 stored' },
  { id: 'b-v2-check-identical', doc: D, line: 92, what: 'byte-identical prompts answered in session 2 beyond those', stated: '15 more entries' },
  { id: 'b-v2-check-new', doc: D, line: 92, what: 'new calls in session 2', stated: '51 new calls' },
  { id: 'b-v2-check-valid', doc: D, line: 92, what: 'CHECK items with 3 valid runs', stated: 'All 63 items have 3 valid runs' },
  ...CHECK_ROWS.flatMap(([line, s, , st]) => st.map((v, i) => ({ id: `b-v2-check-${s}-${CCOLS[i]}`, doc: D, line, what: `CHECK ${s} ${CCOLS[i]}`, stated: v }))),
  { id: 'b-v2-check-twin-targets', doc: D, line: 103, what: 'CHECK twin targets and twin units', stated: '21 twin targets cover the 23 twin units' },
  ...FAM.flatMap(([line, s, , st]) => st.map((v, i) => (v === null ? null : { id: `b-v2-fam-${s}-${FCOLS[i]}`, doc: D, line, what: `CHECK family ${s} ${FCOLS[i]}`, stated: v })).filter(Boolean)),
  { id: 'b-v2-fl-yes', doc: D, line: 114, what: 'FRAMEWORK-LEAK CHECK seeds caught by v2.1', stated: 'yes, 4/4' },
  { id: 'b-v2-fl-runs', doc: D, line: 114, what: 'fail runs of each FL seed under v2.1', stated: 'each 3 runs of 3' },
  { id: 'b-v2-fl-twinpass', doc: D, line: 114, what: 'twin and clean base of AdvanceOrderUseCase pass', stated: 'pass 3/3' },
  { id: 'b-v2-fln-all', doc: D, line: 114, what: 'FRAMEWORK-LEAKn twins passing under both judges', stated: 'All 11 FRAMEWORK-LEAKn twins' },
  { id: 'b-v2-hp-yes', doc: D, line: 115, what: 'hand-planted CHECK seeds caught by v2.1', stated: 'yes, 4/4' },
  { id: 'b-v2-hp-v1', doc: D, line: 115, what: 'hand-planted CHECK seeds caught by v1', stated: 'v1 also caught all 4' },
  { id: 'b-v2-hp-paired', doc: D, line: 115, what: 'v2.1 paired catch on CHECK', stated: 'stays at 13/14' },
  { id: 'b-v2-seeds-333', doc: D, line: 116, what: 'CHECK seeds failing in all v2.1 runs', stated: 'All 14 CHECK seeds fail in 3 of 3' },
  { id: 'b-v2-differ', doc: D, line: 118, what: 'CHECK items whose verdict differs v1 -> v2.1', stated: '6 of 63' },
  { id: 'b-v2-verdict-catch', doc: D, line: 125, what: 'v2.1 against v1 catch on CHECK', stated: '14/14 against 13/14' },
  { id: 'b-v2-verdict-clean', doc: D, line: 125, what: 'additional clean fails under v2.1', stated: '2 more clean fails' },
  { id: 'b-v2-verdict-twin', doc: D, line: 125, what: 'net twin fail difference', stated: 'net +1 twin fail' },
  { id: 'b-v2-verdict-seeds', doc: D, line: 125, what: 'CHECK seeds', stated: 'With 14 seeds' },
  { id: 'b-v2-r-tune', doc: D, line: 186, what: 'TUNE catch v2.1 against v1', stated: "30/30 against v1's 26/30" },
  { id: 'b-v2-r-tune-ptw', doc: D, line: 186, what: 'TUNE paired twin false fail v2.1 (v1)', stated: '1/35 (v1 4/35)' },
  { id: 'b-v2-r-check', doc: D, line: 187, what: 'CHECK catch v2.1 against v1', stated: '14/14 against 13/14' },
  { id: 'b-v2-r-check-clean', doc: D, line: 187, what: 'CHECK clean fails v2.1 against v1', stated: '4/26 against 2/26' },
  { id: 'b-v2-r-check-layered', doc: D, line: 187, what: 'v2.1 CHECK clean fails on the layered OrderService.ts', stated: 'Two of the four' },
  { id: 'b-v2-layered-runs', doc: D, line: 192, what: 'v2.1 fail runs on each layered OrderService.ts item', stated: '2 of 3 runs' },
  { id: 'b-v2-layered-v1', doc: D, line: 196, what: 'layered OrderService.ts items v1 passes', stated: 'the same three items' },
  { id: 'b-v2-s-fl-runs', doc: D, line: 222, what: 'v2.1 fail runs on the held-out FL seed', stated: '3 of 3 runs' },
  { id: 'b-v2-s-diff', doc: D, line: 228, what: 'catch difference on CHECK', stated: 'one item out of 14' },
  { id: 'b-v2-s-ffdiff', doc: D, line: 228, what: 'false-fail differences (twin, clean)', stated: 'the false-fail differences are 1 to 2 items' },
  { id: 'b-v2-s-families', doc: D, line: 230, what: 'CHECK seeds and their operator families / hand-planted variants', stated: '14 CHECK seeds from 7 operator families or hand-planted variants' },
  { id: 'b-v2-s-layered', doc: D, line: 230, what: 'closed-layering bases in CHECK', stated: 'one closed-layering base' },
  // filter-and-explain
  { id: 'b-v2-fe-distinct', doc: D, line: 129, what: 'FE distinct prompts', stated: '114 distinct prompts' },
  { id: 'b-v2-fe-rows', doc: D, line: 129, what: 'FE finding rows covered', stated: '309 finding rows' },
  ...FE_T.flatMap(([line, s, st]) => st.map((v, i) => ({ id: `b-v2-fe-${s}-${FECOLS[i]}`, doc: D, line, what: `FE ${s} ${FECOLS[i]}`, stated: v }))),
  { id: 'b-v2-fe-scored', doc: D, line: 137, what: 'FE scored rows', stated: '68 scored rows (66 true, 2 known false)' },
  { id: 'b-v2-fe-prec0', doc: D, line: 138, what: 'precision before', stated: '66/68 = 0.97 [0.90, 0.99]' },
  { id: 'b-v2-fe-prec1', doc: D, line: 138, what: 'precision after', stated: '65/66 = 0.98 [0.92, 1.00]' },
  { id: 'b-v2-fe-gain', doc: D, line: 138, what: 'precision gain', stated: 'Gain +0.014' },
  { id: 'b-v2-fe-recall', doc: D, line: 139, what: 'recall kept', stated: '65/66 = 0.98 [0.92, 1.00]' },
  { id: 'b-v2-fe-loss', doc: D, line: 139, what: 'recall loss', stated: 'Recall loss 1/66 = 0.02 [0.00, 0.08]' },
  { id: 'b-v2-fe-other65', doc: D, line: 146, what: 'other true rows confirmed', stated: 'The other 65 true rows' },
  { id: 'b-v2-fe-blocking', doc: D, line: 146, what: 'blocking-tier rows confirmed', stated: '52/52' },
  { id: 'b-v2-fe-c02', doc: D, line: 149, what: 'FF-C02 dismissed', stated: '30/30 dismissed' },
  { id: 'b-v2-fe-c03', doc: D, line: 150, what: 'FF-C03 dismissed', stated: '116/120 dismissed' },
  { id: 'b-v2-fe-cv03', doc: D, line: 151, what: 'FF-CV03 dismissed', stated: '2/2 dismissed' },
  { id: 'b-v2-fe-c01', doc: D, line: 152, what: 'FF-C01 confirmed', stated: '3/3 confirmed' },
  { id: 'b-v2-fe-cv05', doc: D, line: 153, what: 'FF-CV05 rows confirmed / dismissed', stated: '86 rows): 44 confirmed, 42 dismissed' },
  { id: 'b-v2-fe-grounded', doc: D, line: 157, what: 'grounded answers (rows)', stated: '114/114 distinct answers (309/309 rows)' },
  { id: 'b-v2-fe-keeps', doc: D, line: 188, what: 'true findings kept by FE', stated: '98% of true findings' },
  { id: 'b-v2-fe-s-confirm', doc: D, line: 225, what: 'true findings confirmed', stated: '65/66 true findings' },
  { id: 'b-v2-fe-s-gain', doc: D, line: 231, what: 'precision gain', stated: 'Precision moves by +0.014' },
  { id: 'b-v2-fe-s-loss', doc: D, line: 231, what: 'recall loss', stated: 'recall loss of 0.015' },
  { id: 'b-v2-fe-s-dismiss', doc: D, line: 231, what: 'unscored rows dismissed', stated: '79% dismissal' },
  // calls
  ...CALLS.flatMap(([line, s, st]) => st.map((v, i) => ({ id: `b-v2-calls-${s}-${['calls', 'probes', 'hits'][i]}`, doc: D, line, what: `calls table ${s} ${['judge/FE calls', 'init probes', 'cassette hits'][i]}`, stated: v }))),
  { id: 'b-v2-calls-v1graph-items', doc: D, line: 165, what: 'v1 current-graph phase size', stated: '4 items × 3' },
  { id: 'b-v2-calls-total', doc: D, line: 169, what: 'total judge or FE calls', stated: '474' },
  { id: 'b-v2-calls-total-probes', doc: D, line: 169, what: 'total init probes', stated: '6' },
  { id: 'b-v2-calls-ledger', doc: D, line: 171, what: 'recorded calls in the ledger', stated: '480 recorded calls' },
  { id: 'b-v2-calls-inflight', doc: D, line: 171, what: 'calls in flight at the session-1 limit', stated: 'up to 3 calls', needs: 'not-checkable', note: 'refused calls are not recorded anywhere' },
  { id: 'b-v2-calls-s2hits', doc: D, line: 172, what: 'session 2 hits', stated: "Session 2's 138 hits" },
  { id: 'b-v2-calls-s1', doc: D, line: 172, what: 'session-1 results', stated: 'the 123 entries' },
  { id: 'b-v2-calls-ident', doc: D, line: 172, what: 'byte-identical prompts', stated: '15 byte-identical prompts' },
  { id: 'b-v2-calls-new', doc: D, line: 172, what: 'session 2 new calls', stated: 'Its 51 new calls' },
  { id: 'b-v2-calls-proj', doc: D, line: 172, what: 'projected session-2 calls (63 x 3 - 123)', stated: '~66' },
  { id: 'b-v2-scrub', doc: D, line: 174, what: 'files changed by judge-v2-scrub.ts on copies of the v2/FE cassettes and results', stated: '0 files changed' },
  { id: 'b-v2-scrubbed4', doc: D, line: 83, what: 'v2.0 cassettes path-scrubbed (not byte-replayable)', stated: 'The 4 affected v2.0 cassettes', needs: 'not-checkable', note: 'checking it needs the cassette request-key function on the unscrubbed prompts, which are not committed' },
  { id: 'b-v2-reseed-rows', doc: D, line: 32, what: 'rows of the three committed seed manifests (round 1 also regenerated by b-jc-r1-sites)', stated: '125, 67 and 28 rows', basis: 're-derived' },
];

async function scoreValues(ctx) {
  const R = rebuilt(ctx);
  if (!R.planSame) throw new Error('filter-explain plan.json regenerated differently');
  for (const [l, s] of Object.entries(R.stats)) if (s.unmatched || !s.sameAsCommitted) throw new Error(`${l}: ${s.unmatched} verdict runs without a cassette entry, or a rebuilt verdict differs from the committed one`);
  const out = {};
  const ledger = ctx.json(`${RES}/call-ledger.json`);
  const ph = ledger.phases;
  const chk = R.stats['check-v2.1'].verdicts;
  // session 1 judged (attempts + hits) runs, 3 per item (ledger); recordedAt cannot tell, because session 2 answered
  // byte-identical prompts of unjudged items from entries stored in session 1
  out['b-v2-check-partial'] = `${(ph.filter((p) => p.label === 'check-v2.1')[0].judgeAttempts + ph.filter((p) => p.label === 'check-v2.1')[0].hits) / 3} of ${chk.length} items`;
  out['b-v2-check-complete'] = `${chk.filter((v) => v.runs.filter((r) => r.valid).length === 3).length}/${chk.length}`;
  const plan = JSON.parse(readFileSync(join(R.root, RES, 'filter-explain/plan.json'), 'utf8'));
  out['b-v2-fe-prompts-hdr'] = `${plan.selected.length} prompts`;
  const ov = R.stats['check-v1-current-graph'].verdicts;
  const split = R.split;
  const item = (id) => split.items.find((i) => i.itemId === id);
  out['b-v2-v1graph-items'] = `${ov.length} CHECK items`;
  out['b-v2-v1graph-items4'] = `the ${ov.filter((v) => item(v.itemId)?.baseId === 'antipattern-nest').length} \`antipattern-nest\` items`;
  out['b-v2-frozensha'] = `${ctx.sh(`${tsx} --eval "import {computeFrozenSha256} from './src/llm-critic/frozen.ts'; console.log(computeFrozenSha256())"`).trim().slice(0, 8)}…`;
  out['b-v2-v1graph-twins'] = `${word(ov.filter((v) => item(v.itemId)?.operatorId === 'AP-PERSIST-IN-DOMAINn').length)} PERSIST-IN-DOMAINn twins`;
  out['b-v2-v1graph-calls'] = `${ph.find((p) => p.label === 'check-v1-current-graph').judgeAttempts} calls`;
  out['b-v2-v1graph-fail'] = ov.every((v) => v.verdict === 'fail') ? `All ${ov.length} still fail` : `${ov.filter((v) => v.verdict === 'fail').length} fail`;
  const c = split.counts;
  const all = (k) => c.TUNE[k] + c.CHECK[k];
  out['b-v2-split-items'] = `${split.items.length} items: ${all('seed')} seeds, ${all('twin')} twins and ${all('clean')} clean-control units`;
  out['b-v2-split-clusters'] = `${split.clusters.length} clusters`;
  const pc = (k) => (100 * c[k].items / split.items.length).toFixed(1);
  out['b-v2-split-tune'] = `TUNE: ${c.TUNE.items} items (${pc('TUNE')}%)`;
  out['b-v2-split-tune-kinds'] = `${c.TUNE.seed} seed, ${c.TUNE.twin} twin and ${c.TUNE.clean} clean units`;
  const t20v1 = rowOf(R.tune20, 'v1');
  out['b-v2-split-tune-targets'] = `${num(t20v1[0])[1]} seed targets, ${num(t20v1[2])[1]} twin targets`;
  out['b-v2-split-check'] = `CHECK: ${c.CHECK.items} items (${pc('CHECK')}%)`;
  out['b-v2-split-check-kinds'] = `${c.CHECK.seed} seed, ${c.CHECK.twin} twin and ${c.CHECK.clean} clean units`;
  out['b-v2-split-ratio'] = `${pc('TUNE')}/${pc('CHECK')}`;
  out['b-v2-revisions'] = `${LABELS.filter((l) => l.startsWith('tune-')).length - 1} was used`;
  const tune = { v1: t20v1, v20: rowOf(R.tune20, 'v2'), v21: rowOf(R.tune21, 'v2') };
  for (const [, s] of TUNE_ROWS) tune[s].slice(0, 5).forEach((v, i) => { out[`b-v2-tune-${s}-${CCOLS[i]}`] = v; });
  out['b-v2-tune-v1miss'] = `all ${word(num(t20v1[0])[1] - num(t20v1[0])[0])} v1 misses`;
  const t20 = R.stats['tune-v2.0'].verdicts; const t21 = R.stats['tune-v2.1'].verdicts;
  const r0fail = (v) => v.runs.find((r) => r.runIndex === 0)?.pass === false;
  const it = (v) => item(v.itemId);
  out['b-v2-tune-fln'] = `${t20.filter((v) => it(v).operatorId === 'AP-FRAMEWORK-LEAKn' && it(v).baseId === 'antipattern-nest' && r0fail(v)).length} \`antipattern-nest\` FRAMEWORK-LEAKn twins`;
  const svc = t20.filter((v) => it(v).kind === 'clean' && it(v).baseId === 'antipattern-nest' && it(v).unitId.endsWith('.service.ts') && r0fail(v)).length;
  out['b-v2-tune-svc'] = `${svc === 2 ? 'both' : svc} base service units`;
  const clean21 = t21.filter((v) => it(v).kind === 'clean' && r0fail(v));
  out['b-v2-tune-clean6'] = `All ${clean21.length} remaining clean false fails`;
  out['b-v2-tune-haiku'] = `${clean21.filter((v) => it(v).baseId.includes('claude-haiku') && it(v).unitId === 'src/application/usecases').length} items`;
  out['b-v2-tune-gpt'] = `${clean21.filter((v) => it(v).baseId.includes('gpt-5.6-terra') && it(v).unitId === 'src/application').length} items`;
  const hash = ctx.sh(`${tsx} scripts/v1.3/judge-v2-hash.ts`).trim().split(' ')[1];
  out['b-v2-check-sha'] = hash === ctx.json(`${RES}/check-v2.1/verdicts.json`).judgeV2Sha256 ? `${hash.slice(0, 8)}…` : `${hash.slice(0, 8)}… (verdicts differ)`;
  const c1 = ph.filter((p) => p.label === 'check-v2.1')[0]; const c2 = ph.filter((p) => p.label === 'check-v2.1')[1];
  out['b-v2-check-stored'] = `${c1.judgeAttempts + c1.hits} stored`;
  out['b-v2-check-identical'] = `${c2.hits - (c1.judgeAttempts + c1.hits)} more entries`;
  out['b-v2-check-new'] = `${c2.judgeAttempts} new calls`;
  out['b-v2-check-valid'] = `All ${chk.filter((v) => v.runs.filter((r) => r.valid).length === 3).length} items have 3 valid runs`;
  for (const [, s, name, st] of CHECK_ROWS) {
    const cells = rowOf(R.check, name);
    st.forEach((v, i) => { out[`b-v2-check-${s}-${CCOLS[i]}`] = / = /.test(v) ? cells[i] : short(cells[i]); });
  }
  const chkItems = split.items.filter((i) => i.split === 'CHECK');
  const v1c = rowOf(R.check, 'v1');
  out['b-v2-check-twin-targets'] = `${num(v1c[2])[1]} twin targets cover the ${chkItems.filter((i) => i.kind === 'twin').length} twin units`;
  const fam = (name, judge) => R.check.split('\n').find((l) => l.startsWith(`| ${name} | ${judge} |`)).split('|').slice(3, -1).map((s) => s.trim());
  for (const [, s, name, st] of FAM) {
    const a = fam(name, 'v1'); const b = fam(name, 'v2');
    const vals = [a[0], b[0], a[1], b[1]];
    st.forEach((v, i) => { if (v !== null) out[`b-v2-fam-${s}-${FCOLS[i]}`] = / = /.test(v) ? vals[i] : short(vals[i]); });
  }
  const vmap = new Map(chk.map((v) => [v.itemId, v]));
  const fails = (id) => vmap.get(id).runs.filter((r) => r.valid && r.pass === false).length;
  const seedsC = chkItems.filter((i) => i.kind === 'seed');
  const flSeeds = seedsC.filter((i) => i.operatorId === 'AP-FRAMEWORK-LEAK');
  out['b-v2-fl-yes'] = `yes, ${short(fam('AP-FRAMEWORK-LEAK', 'v2')[0])}`;
  out['b-v2-fl-runs'] = flSeeds.every((i) => fails(i.itemId) === 3) ? 'each 3 runs of 3' : `min ${Math.min(...flSeeds.map((i) => fails(i.itemId)))} runs of 3`;
  const gain = flSeeds.find((i) => i.unitId.endsWith('AdvanceOrderUseCase.ts'));
  const partners = chkItems.filter((i) => i.baseId === gain.baseId && i.unitId === gain.unitId && i.kind !== 'seed');
  out['b-v2-fl-twinpass'] = partners.length === 2 && partners.every((i) => fails(i.itemId) === 0) ? 'pass 3/3' : `${partners.length} partners, fails ${partners.map((i) => fails(i.itemId)).join('/')}`;
  const fln = chkItems.filter((i) => i.operatorId === 'AP-FRAMEWORK-LEAKn');
  out['b-v2-fln-all'] = `All ${fln.length} FRAMEWORK-LEAKn twins`;
  out['b-v2-hp-yes'] = `yes, ${short(fam('hand-planted', 'v2')[0])}`;
  out['b-v2-hp-v1'] = `v1 also caught all ${num(fam('hand-planted', 'v1')[0])[0]}`;
  const hpC = seedsC.filter((i) => i.operatorId.startsWith('HP:'));
  out['b-v2-hp-four'] = hpC.every((i) => fails(i.itemId) >= 2) ? `the ${word(hpC.length)} hand-planted ones` : 'lost one';
  out['b-v2-hp-paired'] = `stays at ${short(rowOf(R.check, 'v2')[1])}`;
  out['b-v2-seeds-333'] = seedsC.every((i) => fails(i.itemId) === 3) ? `All ${seedsC.length} CHECK seeds fail in 3 of 3` : `${seedsC.filter((i) => fails(i.itemId) === 3).length} of ${seedsC.length}`;
  const differ = R.check.split('\n').filter((l) => /^- (seed|twin|clean) /.test(l)).length;
  out['b-v2-differ'] = `${differ} of ${chkItems.length}`;
  const v2c = rowOf(R.check, 'v2');
  out['b-v2-verdict-catch'] = `${short(v2c[0])} against ${short(v1c[0])}`;
  out['b-v2-verdict-clean'] = `${num(v2c[4])[0] - num(v1c[4])[0]} more clean fails`;
  out['b-v2-verdict-twin'] = `net +${num(v2c[2])[0] - num(v1c[2])[0]} twin fail`;
  out['b-v2-verdict-seeds'] = `With ${num(v1c[0])[1]} seeds`;
  const t21v = rowOf(R.tune21, 'v2');
  out['b-v2-r-tune'] = `${short(t21v[0])} against v1's ${short(t20v1[0])}`;
  out['b-v2-r-tune-ptw'] = `${short(t21v[3])} (v1 ${short(t20v1[3])})`;
  out['b-v2-r-check'] = `${short(v2c[0])} against ${short(v1c[0])}`;
  out['b-v2-r-check-clean'] = `${short(v2c[4])} against ${short(v1c[4])}`;
  const layered = chkItems.filter((i) => i.kind !== 'seed' && i.baseId === 'layered/clean' && i.unitId === 'src/business/services/OrderService.ts');
  const layeredClean = layered.filter((i) => i.kind === 'clean' && vmap.get(i.itemId).verdict === 'fail').length;
  out['b-v2-r-check-layered'] = `${layeredClean === 2 ? 'Two' : layeredClean} of the ${word(num(v2c[4])[0])}`;
  const lf = [...new Set(layered.map((i) => fails(i.itemId)))];
  out['b-v2-layered-runs'] = lf.length === 1 ? `${lf[0]} of 3 runs` : `${lf.join('/')} of 3 runs`;
  const v1pass = layered.filter((i) => !/fail → /.test(R.check.split('\n').find((l) => l.includes(i.targetId) && l.includes(i.round) && l.includes(i.unitId)) ?? 'fail → ')).length;
  out['b-v2-layered-v1'] = `the same ${word(v1pass)} items`;
  out['b-v2-s-fl-runs'] = `${fails(gain.itemId)} of 3 runs`;
  out['b-v2-s-diff'] = `${word(num(v2c[0])[0] - num(v1c[0])[0])} item out of ${num(v1c[0])[1]}`;
  const d1 = num(v2c[2])[0] - num(v1c[2])[0]; const d2 = num(v2c[4])[0] - num(v1c[4])[0];
  out['b-v2-s-ffdiff'] = `the false-fail differences are ${Math.min(d1, d2)} to ${Math.max(d1, d2)} items`;
  const famOf = (o) => (o.startsWith('HP:') ? o : o.replace(/n$/, ''));
  out['b-v2-s-families'] = `${seedsC.length} CHECK seeds from ${new Set(seedsC.map((i) => famOf(i.operatorId))).size} operator families or hand-planted variants`;
  const layBases = new Set(chkItems.filter((i) => /^layered\//.test(i.baseId)).map((i) => i.baseId));
  out['b-v2-s-layered'] = `${word(layBases.size)} closed-layering base`;
  // FE
  const rows = R.feScores.rows;
  const fe = (label) => R.feMd.split('\n').find((l) => l.startsWith(`| ${label} |`)).split('|').slice(2, -1).map((s) => s.trim());
  out['b-v2-fe-distinct'] = `${Object.keys(R.answers).length === plan.selected.length ? plan.selected.length : `${plan.selected.length} (answers ${Object.keys(R.answers).length})`} distinct prompts`;
  out['b-v2-fe-rows'] = `${rows.length} finding rows`;
  for (const [, s] of FE_T) fe(s).forEach((v, i) => { out[`b-v2-fe-${s}-${FECOLS[i]}`] = v; });
  const sm = R.feScores.summary;
  out['b-v2-fe-scored'] = `${sm.tp0 + sm.fp0} scored rows (${sm.tp0} true, ${sm.fp0} known false)`;
  out['b-v2-fe-prec0'] = ctx.cell(sm.tp0, sm.tp0 + sm.fp0);
  out['b-v2-fe-prec1'] = ctx.cell(sm.tp1, sm.tp1 + sm.fp1);
  out['b-v2-fe-gain'] = `Gain +${(sm.precisionAfter - sm.precisionBefore).toFixed(3)}`;
  out['b-v2-fe-recall'] = ctx.cell(sm.tp1, sm.tp0);
  out['b-v2-fe-loss'] = `Recall loss ${ctx.cell(sm.tp0 - sm.tp1, sm.tp0)}`;
  const tr = rows.filter((r) => r.label === 'true');
  out['b-v2-fe-other65'] = `The other ${tr.filter((r) => r.status === 'confirm').length} true rows`;
  const bl = rows.filter((r) => r.tier === 'blocking');
  out['b-v2-fe-blocking'] = `${bl.filter((r) => r.status === 'confirm').length}/${bl.length}`;
  const rule = (fn, st) => { const rs = rows.filter((r) => r.functionId === fn && r.label === 'unscored'); return `${rs.filter((r) => r.status === st).length}/${rs.length}`; };
  out['b-v2-fe-c02'] = `${rule('FF-C02', 'dismiss')} dismissed`;
  out['b-v2-fe-c03'] = `${rule('FF-C03', 'dismiss')} dismissed`;
  out['b-v2-fe-cv03'] = `${rule('FF-CV03', 'dismiss')} dismissed`;
  out['b-v2-fe-c01'] = `${rule('FF-C01', 'confirm')} confirmed`;
  const cv = rows.filter((r) => r.functionId === 'FF-CV05');
  out['b-v2-fe-cv05'] = `${cv.length} rows): ${cv.filter((r) => r.status === 'confirm').length} confirmed, ${cv.filter((r) => r.status === 'dismiss').length} dismissed`;
  const outcomes = R.feMd.match(/Distinct prompts: (\d+); grounded (\d+)\/(\d+)/);
  const g = R.feMd.match(/Grounding: (\d+)\/(\d+)/);
  out['b-v2-fe-grounded'] = `${outcomes[2]}/${outcomes[3]} distinct answers (${g[1]}/${g[2]} rows)`;
  out['b-v2-fe-keeps'] = `${Math.floor(100 * sm.recallKept)}% of true findings`;
  out['b-v2-fe-s-confirm'] = `${sm.tp1}/${sm.tp0} true findings`;
  out['b-v2-fe-s-gain'] = `Precision moves by +${(sm.precisionAfter - sm.precisionBefore).toFixed(3)}`;
  out['b-v2-fe-s-loss'] = `recall loss of ${((sm.tp0 - sm.tp1) / sm.tp0).toFixed(3)}`;
  const un = rows.filter((r) => r.label === 'unscored');
  out['b-v2-fe-s-dismiss'] = `${Math.round(100 * un.filter((r) => r.status === 'dismiss').length / un.length)}% dismissal`;
  // calls
  const phOf = { tune20: ph[0], tune21: ph[1], v1graph: ph[2], 'check-s1': ph[3], 'check-s2': ph[4], fe: ph[5] };
  for (const [, s] of CALLS) { const p = phOf[s]; out[`b-v2-calls-${s}-calls`] = String(p.judgeAttempts); out[`b-v2-calls-${s}-probes`] = String(p.initProbes); out[`b-v2-calls-${s}-hits`] = String(p.hits); }
  out['b-v2-calls-v1graph-items'] = `${ov.length} items × ${ov[0].runs.length}`;
  out['b-v2-calls-total'] = String(ph.reduce((s, p) => s + p.judgeAttempts, 0));
  out['b-v2-calls-total-probes'] = String(ph.reduce((s, p) => s + p.initProbes, 0));
  out['b-v2-calls-ledger'] = `${ledger.calls} recorded calls`;
  out['b-v2-calls-s2hits'] = `Session 2's ${c2.hits} hits`;
  out['b-v2-calls-s1'] = `the ${c1.judgeAttempts + c1.hits} entries`;
  out['b-v2-calls-ident'] = `${c2.hits - (c1.judgeAttempts + c1.hits)} byte-identical prompts`;
  out['b-v2-calls-new'] = `Its ${c2.judgeAttempts} new calls`;
  out['b-v2-calls-proj'] = `~${chk.length * 3 - (c1.judgeAttempts + c1.hits)}`;
  // scrub on copies
  const sd = ctx.out('b-judge-v2-scrub');
  for (const d of [`${CAS}/judge-v2`, `${CAS}/filter-explain`, RES]) cpSync(ctx.p(d), join(sd, d), { recursive: true });
  const sc = ctx.sh(`${tsx} scripts/v1.3/judge-v2-scrub.ts "${join(sd, CAS, 'judge-v2')}" "${join(sd, CAS, 'filter-explain')}" "${join(sd, RES)}"`).match(/scrubbed (\d+)/)[1];
  out['b-v2-scrub'] = `${sc} files changed`;
  const rowsOf = (r) => ctx.json(`results/v1.3-judge-catch/${r}seed-manifest.json`).rows.length;
  out['b-v2-reseed-rows'] = `${rowsOf('')}, ${rowsOf('round2/')} and ${rowsOf('duprule-v2/')} rows`;
  return out;
}

// targeted jest suites (offline). Run in the repository with a minimal environment: tests/unit/cli/llm-options.test.ts
// needs a git work tree (ISO-04), and session variables of an interactive Claude Code shell change the cassette keys
// of tests/unit/llm-critic/replay-no-binary.test.ts.
const jestNumbers = [
  { id: 'b-v2-jest-judgev2', doc: D, line: 26, what: 'tests/unit/llm-critic/judge-v2.test.ts passing tests', stated: '(10)' },
  { id: 'b-v2-jest-fe', doc: D, line: 26, what: 'tests/unit/llm-critic/filter-explain.test.ts passing tests', stated: '(4)' },
  { id: 'b-v2-jest-dirs', doc: D, line: 27, what: 'tests/unit/llm-critic + tests/unit/cli suites and tests, all passing', stated: '31 suites, 615 tests' },
  { id: 'b-v2-jest-ap', doc: D3x(), line: 37, what: 'tests/unit/scripts/mutation/antipatterns.test.ts passing / total', stated: '21/21' },
];
function D3x() { return 'Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md'; }

async function jestValues(ctx) {
  const dir = ctx.out('b-jest');
  const run = (name, paths) => {
    const f = join(dir, `${name}.json`);
    try {
      ctx.sh(`env -i PATH="$PATH" HOME="$HOME" TMPDIR="${dir}" npx jest --maxWorkers=2 --forceExit ${paths} --json --outputFile="${f}"`, { timeout: 30 * 60_000 });
    } catch { /* failures are counted below */ }
    return JSON.parse(readFileSync(f, 'utf8'));
  };
  const a = run('files', 'tests/unit/llm-critic/judge-v2.test.ts tests/unit/llm-critic/filter-explain.test.ts tests/unit/scripts/mutation/antipatterns.test.ts');
  const per = (suffix) => { const t = a.testResults.find((x) => x.name.endsWith(suffix)); return [t.assertionResults.filter((x) => x.status === 'passed').length, t.assertionResults.length]; };
  const b = run('dirs', 'tests/unit/llm-critic tests/unit/cli');
  const [jv, jvn] = per('judge-v2.test.ts'); const [fe, fen] = per('filter-explain.test.ts'); const [ap, apn] = per('antipatterns.test.ts');
  return {
    'b-v2-jest-judgev2': jv === jvn ? `(${jv})` : `(${jv} of ${jvn})`,
    'b-v2-jest-fe': fe === fen ? `(${fe})` : `(${fe} of ${fen})`,
    'b-v2-jest-ap': `${ap}/${apn}`,
    'b-v2-jest-dirs': b.numPassedTests === b.numTotalTests ? `${b.numTotalTestSuites} suites, ${b.numTotalTests} tests` : `${b.numTotalTestSuites} suites, ${b.numTotalTests} tests, ${b.numFailedTests} failing`,
  };
}

const neo = [
  { id: 'b-v2-replay-r2', doc: D, line: 36, what: 'round 2 targets replaying from the cassettes on the current graph', stated: '56/56' },
  { id: 'b-v2-replay-dv2', doc: D, line: 37, what: 'DUP v2 targets replaying', stated: '27/27' },
  { id: 'b-v2-replay-r1', doc: D, line: 38, what: 'round 1 targets replaying', stated: '27/51' },
  { id: 'b-v2-replay-miss', doc: D, line: 38, what: 'round-1 replay misses, all antipattern-nest', stated: 'All 24 misses' },
  { id: 'b-v2-flags-unavail', doc: D, line: 55, what: 'JUDGE_V2_FLAGS_UNAVAILABLE during the harvest', stated: '0 times' },
];

export default [
  { id: 'b-jv2-scores', title: 'Judge v2 TUNE/CHECK, FE, split and calls (verdicts and FE answers rebuilt from cassettes)', needs: 'offline', basis: 'replayed', slow: false,
    how: 'judge-v2-split.ts --out <scratch>; verdicts.json + answers.json rebuilt from tests/fixtures/judge-cassettes-v13/{judge-v2,filter-explain}; judge-v2-score.ts --split TUNE|CHECK ...; filter-explain-run.ts plan, score (in a HEAD export); call-ledger.json; judge-v2-scrub.ts on copies',
    numbers: scoreNumbers, run: scoreValues },
  { id: 'b-jv2-jest', title: 'Judge v2 / DUP v2 unit tests (targeted jest)', needs: 'offline', basis: 'regenerated', slow: true,
    how: 'env -i PATH HOME TMPDIR npx jest --maxWorkers=2 <judge-v2, filter-explain, antipatterns tests>; ... tests/unit/llm-critic tests/unit/cli', numbers: jestNumbers, run: jestValues },
  { id: 'b-jv2-neo4j', title: 'Judge v2: v1 replay check and v2 prompt harvest', needs: 'needs-Neo4j', basis: 'regenerated',
    how: 'judge-catch-run.ts replay / judge-v2-run.ts harvest (firewall evaluate against Neo4j)', numbers: neo },
];
