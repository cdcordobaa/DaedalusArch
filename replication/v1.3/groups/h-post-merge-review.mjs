// Docs/v1.3/post-merge-review-2026-10-16.md: the review's own tallies, and every result number it cites, re-derived
// from the committed results (ffp06-na-recount, filter-explain score, judge-catch scorers, construct-rescore re-run
// offline; labelling correctness, seed manifest and source constants read directly). Quoted stale values of other docs
// are checked against the cited doc line.
import * as fs from 'node:fs';

const DOC = 'Docs/v1.3/post-merge-review-2026-10-16.md';
const kn = (cell) => cell.split(' = ')[0];
const th = (n) => n.toLocaleString('en-US');

/** Returns `text` when the cited doc line contains it (the review quotes a stale value there), else what is there. */
function quote(ctx, doc, line, text) {
  const l = ctx.read(doc).split('\n')[line - 1] ?? '';
  return l.includes(text) ? text : `(not on ${doc}:${line})`;
}
/** "a+b+c = N" when the summed terms are the same multiset as the non-zero data values. */
function sumExpr(stated, values) {
  const [lhs] = stated.split(' = ');
  const terms = lhs.split('+').map((t) => Number(t.trim().replace(/,/g, '')));
  const vals = values.filter((v) => v !== 0);
  const a = [...terms].sort((x, y) => x - y).join(',');
  const b = [...vals].sort((x, y) => x - y).join(',');
  const total = vals.reduce((s, v) => s + v, 0);
  return a === b ? `${lhs} = ${th(total)}` : `terms ${b} = ${th(total)}`;
}
const N = (id, line, what, stated, extra = {}) => ({ id, doc: DOC, line, what, stated, ...extra });

// ---- tallies of the review itself -------------------------------------------------------------------------------
const tally = {
  id: 'h-pmr-tally',
  title: 'post-merge review: finding and severity tallies',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'count the "## Rnn [severity]" headings of Docs/v1.3/post-merge-review-2026-10-16.md',
  numbers: [
    N('h-pmr-findings-raw', 4, 'findings raised before verification', '36', { needs: 'not-checkable', note: 'the workflow v13-post-merge-review output (raised and refuted findings) is not committed; only the 31 confirmed findings are in the doc' }),
    N('h-pmr-findings-confirmed', 4, 'confirmed findings (R headings in the doc)', '31'),
    N('h-pmr-sev-blocking', 6, 'findings with severity blocking', 'blocking 1'),
    N('h-pmr-sev-major', 6, 'findings with severity major', 'major 9'),
    N('h-pmr-sev-minor', 6, 'findings with severity minor', 'minor 21'),
  ],
  async run(ctx) {
    const heads = ctx.read(DOC).split('\n').filter((l) => /^## R\d+ \[/.test(l));
    const sev = (s) => heads.filter((l) => l.includes(`[${s}]`)).length;
    return {
      'h-pmr-findings-confirmed': String(heads.length),
      'h-pmr-sev-blocking': `blocking ${sev('blocking')}`,
      'h-pmr-sev-major': `major ${sev('major')}`,
      'h-pmr-sev-minor': `minor ${sev('minor')}`,
    };
  },
};

// ---- R24: baseline reference figures (reported and FF-P06-corrected) -----------------------------------------------
function parseRecount(text) {
  const t = {}; let run; let view;
  for (const l of text.split('\n')) {
    let m;
    if ((m = /^## (.+)$/.exec(l))) { run = m[1].trim(); continue; }
    if ((m = /^### (.+)$/.exec(l))) { view = m[1].trim(); continue; }
    m = /^\| (clean-architecture|layered|nestjs|hexagonal|ddd|pooled) \| (.+) \|$/.exec(l);
    if (m && run && view) {
      const [rr, rc, pr, pc, na] = m[2].split(' | ');
      t[`${run}|${view}|${m[1]}`] = { rr, rc, pr, pc, na };
    }
  }
  return t;
}
const reference = {
  id: 'h-pmr-reference',
  title: 'R24: baseline reference recall/precision, reported and FF-P06 N/A-corrected',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'node scripts/v1.3/ffp06-na-recount.mjs (reads results/v1.3-reference/*/scores.json and evidence); FF-P06 perRule tp from results/v1.3-reference/baseline-pre-barrel/scores.json',
  numbers: [
    N('h-pmr-r24-l379-clean-r', 379, 'baseline author-normalised recall, clean-architecture (reported)', '13/13'),
    N('h-pmr-r24-l379-nest-r', 379, 'baseline author-normalised recall, nestjs (reported)', '11/11'),
    N('h-pmr-r24-l379-hex-r', 379, 'baseline author-normalised recall, hexagonal (reported)', '13/13'),
    N('h-pmr-r24-l379-pool-r', 379, 'baseline author-normalised pooled recall (reported)', '55/57'),
    N('h-pmr-r24-l379-prec', 379, 'baseline author-normalised precision, clean-architecture and hexagonal (reported)', '13/14'),
    N('h-pmr-r24-l379-pool-p', 379, 'baseline author-normalised pooled precision (reported)', '55/110'),
    N('h-pmr-r24-l379-na', 379, 'FF-P06 FLOWS_TO rows counted as TPs in the baseline', '3'),
    N('h-pmr-r24-l379-corr-r', 379, 'baseline pooled recall, corrected', '52/54'),
    N('h-pmr-r24-l379-corr-p', 379, 'baseline pooled precision, corrected', '52/107'),
    N('h-pmr-r24-l380-nest-lit', 380, 'baseline nestjs author-literal recall cell', '0.91 (10/11)'),
    N('h-pmr-r24-l380-nest-norm', 380, 'baseline nestjs author-normalised recall cell', '1.00 (11/11)'),
    N('h-pmr-r24-l380-tp1', 380, 'FF-P06 perRule tp for clean, nestjs, hexagonal in the author and blind-expanded views', 'tp=1'),
    N('h-pmr-r24-l380-corr-r', 380, 'corrected baseline pooled recall (ffp06-na-recount)', '52/54'),
    N('h-pmr-r24-l380-corr-p', 380, 'corrected baseline pooled precision (ffp06-na-recount)', '52/107'),
    N('h-pmr-r24-l382-clean-r', 382, 'baseline author-normalised recall, clean-architecture (reported)', '13/13'),
    N('h-pmr-r24-l382-nest-r', 382, 'baseline author-normalised recall, nestjs (reported)', '11/11'),
    N('h-pmr-r24-l382-hex-r', 382, 'baseline author-normalised recall, hexagonal (reported)', '13/13'),
    N('h-pmr-r24-l382-pool-r', 382, 'baseline author-normalised pooled recall (reported)', '55/57'),
    N('h-pmr-r24-l382-prec', 382, 'baseline author-normalised precision, clean/hexagonal (reported)', '13/14'),
    N('h-pmr-r24-l382-pool-p', 382, 'baseline author-normalised pooled precision (reported)', '55/110'),
    N('h-pmr-r24-l382-ffp06', 382, 'FF-P06 tp/fn/fp per style (clean, nestjs, hexagonal) in the baseline', '1/0/0'),
    N('h-pmr-r24-l382-corr-r', 382, 'corrected baseline pooled recall', '52/54'),
    N('h-pmr-r24-l382-corr-p', 382, 'corrected baseline pooled precision', '52/107'),
    N('h-pmr-r24-l382-corr-clean', 382, 'corrected baseline recall, clean-architecture', '12/12'),
    N('h-pmr-r24-l382-corr-nest', 382, 'corrected baseline recall, nestjs', '10/10'),
    N('h-pmr-r24-l382-corr-hex', 382, 'corrected baseline recall, hexagonal', '12/12'),
    N('h-pmr-r24-l382-amf-corr', 382, 'after-member-facts pooled recall to quote (corrected)', '54/54'),
    N('h-pmr-r24-l382-amf-rep', 382, 'after-member-facts pooled recall not to quote (reported)', '57/57'),
    N('h-pmr-r24-l384-corr-clean', 384, 'corrected baseline recall, clean-architecture', '12/12'),
    N('h-pmr-r24-l384-corr-nest', 384, 'corrected baseline recall, nestjs', '10/10'),
    N('h-pmr-r24-l384-corr-hex', 384, 'corrected baseline recall, hexagonal', '12/12'),
    N('h-pmr-r24-l384-p-clean', 384, 'corrected baseline normalised precision, clean-architecture and hexagonal', '12/13 = 0.92'),
    N('h-pmr-r24-l384-p-nest', 384, 'corrected baseline normalised precision, nestjs', '10/10'),
    N('h-pmr-r24-l384-p-pool', 384, 'corrected baseline pooled precision (still missed)', '52/107'),
    N('h-pmr-r24-l384-lb', 384, 'no baseline Wilson lower bound reaches this value (max lower bound must be below it)', '0.90'),
  ],
  async run(ctx) {
    const t = parseRecount(ctx.sh('node scripts/v1.3/ffp06-na-recount.mjs'));
    const b = (view, s) => t[`baseline-pre-barrel|${view}|${s}`];
    const acn = (s) => b('author-cycle-normalised', s);
    const same = (a, c) => (a === c ? a : `${a} vs ${c}`);
    const r = {};
    const repClean = kn(acn('clean-architecture').rr); const repNest = kn(acn('nestjs').rr); const repHex = kn(acn('hexagonal').rr);
    const repPool = kn(acn('pooled').rr); const repPrec = same(kn(acn('clean-architecture').pr), kn(acn('hexagonal').pr));
    const repPoolP = kn(acn('pooled').pr);
    const corrR = kn(acn('pooled').rc); const corrP = kn(acn('pooled').pc);
    const cClean = kn(acn('clean-architecture').rc); const cNest = kn(acn('nestjs').rc); const cHex = kn(acn('hexagonal').rc);
    for (const L of ['379', '382']) {
      Object.assign(r, {
        [`h-pmr-r24-l${L}-clean-r`]: repClean, [`h-pmr-r24-l${L}-nest-r`]: repNest, [`h-pmr-r24-l${L}-hex-r`]: repHex,
        [`h-pmr-r24-l${L}-pool-r`]: repPool, [`h-pmr-r24-l${L}-prec`]: repPrec, [`h-pmr-r24-l${L}-pool-p`]: repPoolP,
        [`h-pmr-r24-l${L}-corr-r`]: corrR, [`h-pmr-r24-l${L}-corr-p`]: corrP,
      });
    }
    r['h-pmr-r24-l379-na'] = acn('pooled').na.split('/')[0];
    const lit = b('author-literal', 'nestjs').rr;
    r['h-pmr-r24-l380-nest-lit'] = `${lit.split(' = ')[1].split(' ')[0]} (${kn(lit)})`;
    const nrm = acn('nestjs').rr;
    r['h-pmr-r24-l380-nest-norm'] = `${nrm.split(' = ')[1].split(' ')[0]} (${kn(nrm)})`;
    const sc = ctx.json('results/v1.3-reference/baseline-pre-barrel/scores.json');
    const tps = new Set();
    for (const v of sc.views) {
      if (!['author-literal', 'author-cycle-normalised', 'blind-expanded'].includes(v.view)) continue;
      if (!['clean-architecture', 'nestjs', 'hexagonal'].includes(v.style)) continue;
      const pr = v.blocking && (v.perRule ?? v.blocking.perRule ?? []).find((x) => x.ruleId === 'FF-P06');
      tps.add(pr ? pr.counts.tp : 'missing');
    }
    r['h-pmr-r24-l380-tp1'] = tps.size === 1 ? `tp=${[...tps][0]}` : `tp in {${[...tps].join(',')}}`;
    r['h-pmr-r24-l380-corr-r'] = corrR; r['h-pmr-r24-l380-corr-p'] = corrP;
    const na3 = new Set(['clean-architecture', 'nestjs', 'hexagonal'].map((s) => acn(s).na));
    r['h-pmr-r24-l382-ffp06'] = [...na3].join(' | ');
    r['h-pmr-r24-l382-corr-clean'] = cClean; r['h-pmr-r24-l382-corr-nest'] = cNest; r['h-pmr-r24-l382-corr-hex'] = cHex;
    const amf = t['after-member-facts|author-cycle-normalised|pooled'];
    r['h-pmr-r24-l382-amf-corr'] = kn(amf.rc); r['h-pmr-r24-l382-amf-rep'] = kn(amf.rr);
    r['h-pmr-r24-l384-corr-clean'] = cClean; r['h-pmr-r24-l384-corr-nest'] = cNest; r['h-pmr-r24-l384-corr-hex'] = cHex;
    const pc = (s) => acn(s).pc.split(' [')[0];
    r['h-pmr-r24-l384-p-clean'] = same(pc('clean-architecture'), pc('hexagonal'));
    r['h-pmr-r24-l384-p-nest'] = kn(acn('nestjs').pc);
    r['h-pmr-r24-l384-p-pool'] = corrP;
    // largest Wilson lower bound over every baseline headline cell (all views, styles, pooled; reported and corrected)
    let maxLo = 0;
    for (const [k, row] of Object.entries(t)) {
      if (!k.startsWith('baseline-pre-barrel|')) continue;
      for (const c of [row.rr, row.rc, row.pr, row.pc]) { const m = /\[([\d.]+),/.exec(c); if (m) maxLo = Math.max(maxLo, Number(m[1])); }
    }
    r['h-pmr-r24-l384-lb'] = maxLo < 0.9 ? '0.90' : `max lower bound ${maxLo.toFixed(2)}`;
    return r;
  },
};

// ---- R25: labelling correctness counts -----------------------------------------------------------------------------
const LAB = 'Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md';
const labelling = {
  id: 'h-pmr-labelling',
  title: 'R25: labelling correctness counts (reference and E1) vs the labelling doc',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'count verdicts in results/v1.3-labelling/{reference,e1}/correctness-all/correctness.json; quoted stale values checked on Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md lines 6 and 82; git log for the commit count',
  numbers: [
    N('h-pmr-r25-l386-quote', 386, 'labelling doc headline counts as quoted (stale)', '1,484/179/2,668'),
    N('h-pmr-r25-l386-true', 386, 'reference correct / not-checkable / checkable (reference + E1) from correctness.json', '1,485/178/2,669'),
    N('h-pmr-r25-l389-q-correct', 389, 'labelling doc correct count as quoted (stale)', '1,484'),
    N('h-pmr-r25-l389-q-nc', 389, 'labelling doc not-checkable count as quoted (stale)', '179'),
    N('h-pmr-r25-l389-q-check', 389, 'labelling doc checkable total as quoted (stale)', '2,668'),
    N('h-pmr-r25-l389-correct', 389, 'reference findings correct (committed)', '1,485'),
    N('h-pmr-r25-l389-nc', 389, 'reference findings not-checkable (committed)', '178'),
    N('h-pmr-r25-l389-sum', 389, 'correct + not-checkable = reference findings', '1,485 + 178 = 1,663'),
    N('h-pmr-r25-l389-check', 389, 'checkable findings, reference + E1 (committed)', '2,669'),
    N('h-pmr-r25-l390-jq', 390, "jq '[.summary[]|.correct]|add' on the reference correctness.json", '1485'),
    N('h-pmr-r25-l390-ncsum', 390, 'per-rule notCheckable values summed', '3+30+120+14+1+1+3+1+2+3 = 178'),
    N('h-pmr-r25-l390-q82', 390, 'labelling doc line 82 as quoted (stale)', 'Totals: 1,663 findings, 1,484 correct, 0 incorrect, 179 not-checkable.'),
    N('h-pmr-r25-l391-fix', 391, 'corrected headline values', '1,485 / 178 / 2,669'),
    N('h-pmr-r25-l392-rows', 392, 'rows in the reference correctness.json', '1,663 rows'),
    N('h-pmr-r25-l392-incorrect', 392, 'reference findings incorrect', '0 incorrect'),
    N('h-pmr-r25-l392-correct', 392, 'reference findings correct', '1,485 correct'),
    N('h-pmr-r25-l392-nc', 392, 'reference findings not-checkable', '178 not-checkable'),
    N('h-pmr-r25-l395-block', 395, 'blocking findings correct (per-rule terms)', '54 (1+2+1+1+2+1+7+2+2+11+6+5+5+3+5)'),
    N('h-pmr-r25-l396-adv', 396, 'advisory findings correct (per-rule terms)', '2 + 1426 + 3 = 1,431'),
    N('h-pmr-r25-l397-total', 397, 'total correct', '1,485'),
    N('h-pmr-r25-l398-nc', 398, 'not-checkable (per-rule terms)', '3+3+30+120+14+1+1+3+1+2 = 178'),
    N('h-pmr-r25-l400-q6a', 400, 'labelling doc line 6 checkable count as quoted (stale)', '2,668'),
    N('h-pmr-r25-l400-q6b', 400, 'labelling doc line 6 reference count as quoted (stale)', '1,484 of 1,663'),
    N('h-pmr-r25-l400-q82', 400, 'labelling doc line 82 as quoted (stale)', '1,484 correct, 0 incorrect, 179 not-checkable'),
    N('h-pmr-r25-l400-check', 400, 'reference correct + E1 correct = checkable', '1,485 + 1,184 = 2,669'),
    N('h-pmr-r25-l400-nc', 400, 'reference findings not-checkable', '178 not-checkable'),
    N('h-pmr-r25-l400-commits', 400, 'commits touching the labelling doc (shallow clone: git log at HEAD)', 'one commit'),
    N('h-pmr-r25-l404-incorrect', 404, 'reference findings incorrect', '0 incorrect'),
    N('h-pmr-r25-l404-block', 404, 'blocking findings correct / checkable', '54/54'),
  ],
  async run(ctx) {
    const tally = (rel) => {
      const rows = ctx.json(rel).results; const c = { n: rows.length, correct: 0, incorrect: 0, nc: 0 };
      for (const x of rows) { if (x.verdict === 'correct') c.correct++; else if (x.verdict === 'incorrect') c.incorrect++; else c.nc++; }
      return c;
    };
    const REF = 'results/v1.3-labelling/reference/correctness-all/correctness.json';
    const ref = tally(REF); const e1 = tally('results/v1.3-labelling/e1/correctness-all/correctness.json');
    const refRows = ctx.json(REF).results; const summary = ctx.json(REF).summary;
    const perRule = (tier, verdict) => {
      const m = new Map();
      for (const x of refRows) if (x.tier === tier && x.verdict === verdict) m.set(x.rule, (m.get(x.rule) ?? 0) + 1);
      return [...m.values()];
    };
    const blockC = perRule('blocking', 'correct'); const blockAll = refRows.filter((x) => x.tier === 'blocking' && x.verdict !== 'not-checkable').length;
    const advC = perRule('advisory', 'correct');
    const ncVals = summary.map((s) => s.notCheckable);
    const checkable = ref.correct + e1.correct;
    const q = (line, text) => quote(ctx, LAB, line, text);
    const q6 = (text) => quote(ctx, LAB, 6, text); const q82 = (text) => quote(ctx, LAB, 82, text);
    const quoted = [q82('1,484 correct'), q82('179 not-checkable'), q6('2,668')].every((x) => !x.startsWith('(not'));
    const nCommits = ctx.sh(`git log --oneline -- ${LAB}`).trim().split('\n').filter(Boolean).length;
    const blockSorted = [...blockC].sort((a, b) => a - b).join(',');
    const blockTerms = '1+2+1+1+2+1+7+2+2+11+6+5+5+3+5'.split('+').map(Number).sort((a, b) => a - b).join(',');
    return {
      'h-pmr-r25-l386-quote': quoted ? '1,484/179/2,668' : '(quote not found on labelling doc lines 6/82)',
      'h-pmr-r25-l386-true': `${th(ref.correct)}/${th(ref.nc)}/${th(checkable)}`,
      'h-pmr-r25-l389-q-correct': q(82, '1,484'),
      'h-pmr-r25-l389-q-nc': q(82, '179'),
      'h-pmr-r25-l389-q-check': q(6, '2,668'),
      'h-pmr-r25-l389-correct': th(ref.correct),
      'h-pmr-r25-l389-nc': th(ref.nc),
      'h-pmr-r25-l389-sum': `${th(ref.correct)} + ${th(ref.nc)} = ${th(ref.n)}`,
      'h-pmr-r25-l389-check': th(checkable),
      'h-pmr-r25-l390-jq': String(summary.reduce((s, x) => s + x.correct, 0)),
      'h-pmr-r25-l390-ncsum': sumExpr('3+30+120+14+1+1+3+1+2+3 = 178', ncVals),
      'h-pmr-r25-l390-q82': q82('Totals: 1,663 findings, 1,484 correct, 0 incorrect, 179 not-checkable.'),
      'h-pmr-r25-l391-fix': `${th(ref.correct)} / ${th(ref.nc)} / ${th(checkable)}`,
      'h-pmr-r25-l392-rows': `${th(ref.n)} rows`,
      'h-pmr-r25-l392-incorrect': `${ref.incorrect} incorrect`,
      'h-pmr-r25-l392-correct': `${th(ref.correct)} correct`,
      'h-pmr-r25-l392-nc': `${th(ref.nc)} not-checkable`,
      'h-pmr-r25-l395-block': blockSorted === blockTerms ? `${blockC.reduce((s, v) => s + v, 0)} (1+2+1+1+2+1+7+2+2+11+6+5+5+3+5)` : `${blockC.reduce((s, v) => s + v, 0)} (${blockSorted})`,
      'h-pmr-r25-l396-adv': sumExpr('2 + 1426 + 3 = 1,431', advC),
      'h-pmr-r25-l397-total': th(ref.correct),
      'h-pmr-r25-l398-nc': sumExpr('3+3+30+120+14+1+1+3+1+2 = 178', ncVals),
      'h-pmr-r25-l400-q6a': q6('2,668'),
      'h-pmr-r25-l400-q6b': q6('1,484 of 1,663'),
      'h-pmr-r25-l400-q82': q82('1,484 correct, 0 incorrect, 179 not-checkable'),
      'h-pmr-r25-l400-check': `${th(ref.correct)} + ${th(e1.correct)} = ${th(checkable)}`,
      'h-pmr-r25-l400-nc': `${th(ref.nc)} not-checkable`,
      'h-pmr-r25-l400-commits': nCommits === 1 ? 'one commit' : `${nCommits} commits`,
      'h-pmr-r25-l404-incorrect': `${ref.incorrect} incorrect`,
      'h-pmr-r25-l404-block': `${blockC.reduce((s, v) => s + v, 0)}/${blockAll}`,
    };
  },
};

// ---- R26: filter-and-explain scores, as committed and with the FF-P06 N/A rule applied -----------------------------
const NA_FILES = ['src/domain/services/LoanPolicy.ts', 'src/domain/registration-policy.ts', 'src/domain/services/AvailabilityChecker.ts'];
const fe = {
  id: 'h-pmr-fe',
  title: 'R26: filter-and-explain true rows, blocking rows, precision/recall, with and without the 3 FF-P06 N/A rows',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'npx tsx scripts/v1.3/filter-explain-run.ts score (in a scratch export of HEAD; replays the committed answers/cassettes, no call); the N/A-corrected figures drop the FF-P06 rows on the three FLOWS_TO files',
  numbers: [
    N('h-pmr-r26-l406-na', 406, 'FF-P06 FLOWS_TO N/A rows scored as blocking TPs', '3'),
    N('h-pmr-r26-l409-na', 409, 'field-initialiser FF-P06 rows', '3'),
    N('h-pmr-r26-l409-true', 409, 'true rows (judge-v2 doc §4)', '66 true rows'),
    N('h-pmr-r26-l409-block', 409, 'blocking-tier true rows kept', '(52/52)'),
    N('h-pmr-r26-l409-p0', 409, 'precision before filtering', '66/68'),
    N('h-pmr-r26-l409-p1', 409, 'precision after filtering', '65/66'),
    N('h-pmr-r26-l409-rk', 409, 'recall kept', 'recall kept 65/66'),
    N('h-pmr-r26-l409-c-true', 409, 'true rows with the N/A rule', '63 true'),
    N('h-pmr-r26-l409-c-block', 409, 'blocking-tier true rows kept, with the N/A rule', '49/49'),
    N('h-pmr-r26-l409-c-p0', 409, 'precision before, with the N/A rule', '63/65'),
    N('h-pmr-r26-l409-c-p1', 409, 'precision after, with the N/A rule', '62/63'),
    N('h-pmr-r26-l409-c-rk', 409, 'recall kept, with the N/A rule', 'and 62/63'),
    N('h-pmr-r26-l410-true', 410, "rows with label 'true' in scores.json", "66 rows with label 'true'"),
    N('h-pmr-r26-l410-block', 410, 'true rows with tier blocking', '52 of them'),
    N('h-pmr-r26-l410-ffp06', 410, 'true rows with functionId FF-P06', '3 with functionId FF-P06'),
    N('h-pmr-r26-l410-sum', 410, 'scores.json summary tp0/fp0/tp1', 'tp0=66, fp0=2, tp1=65'),
    N('h-pmr-r26-l414-rows', 414, 'FF-P06 rows in question', 'three rows'),
    N('h-pmr-r26-l414-docs', 414, 'documents that call the FF-P06 field half N/A (rule-tiers.md, after-member-facts correction, fieldstate-cheapfix)', 'three documents'),
    N('h-pmr-r26-l419-sum', 419, 'scores.json summary tp0/fp0/tp1', 'tp0=66, fp0=2, tp1=65'),
    N('h-pmr-r26-l419-md', 419, 'scores.md FF-P06 true rows confirmed', 'FF-P06 true 3/3'),
    N('h-pmr-r26-l419-true', 419, 'true rows (judge-v2 doc section 4)', '66 true rows'),
    N('h-pmr-r26-l419-block', 419, 'blocking-tier true rows kept', '(52/52)'),
    N('h-pmr-r26-l421-c-true', 421, 'true rows with the N/A rule', '63 true'),
    N('h-pmr-r26-l421-c-block', 421, 'blocking-tier true rows kept, with the N/A rule', '49/49'),
    N('h-pmr-r26-l421-c-p0', 421, 'precision before, with the N/A rule', '63/65'),
    N('h-pmr-r26-l421-c-p1', 421, 'precision after, with the N/A rule', '62/63'),
  ],
  async run(ctx) {
    const tree = ctx.tree();
    ctx.sh('npx tsx scripts/v1.3/filter-explain-run.ts score', { cwd: tree });
    const OUT = `${tree}/results/v1.3-judge-v2/filter-explain`;
    const s = ctx.json(`${OUT}/scores.json`);
    const md = ctx.read(`${OUT}/scores.md`);
    const stats = (rows) => {
      const t = rows.filter((r) => r.label === 'true'); const f = rows.filter((r) => r.label === 'false');
      const b = t.filter((r) => r.tier === 'blocking');
      return { t: t.length, tk: t.filter((r) => r.kept).length, f: f.length, fk: f.filter((r) => r.kept).length, b: b.length, bk: b.filter((r) => r.kept).length };
    };
    const all = stats(s.rows);
    const naRows = s.rows.filter((r) => r.functionId === 'FF-P06' && NA_FILES.includes(r.file));
    const c = stats(s.rows.filter((r) => !naRows.includes(r)));
    const p06 = s.rows.filter((r) => r.label === 'true' && r.functionId === 'FF-P06');
    const sm = s.summary;
    const sumStr = `tp0=${sm.tp0}, fp0=${sm.fp0}, tp1=${sm.tp1}`;
    const mdRow = /\| FF-P06 \| true \| (\d+) \| (\d+) \|/.exec(md);
    const docsOk = ctx.read('Docs/v1.3/rule-tiers.md').split('\n')[29].includes('N/A')
      && /Correction/.test(ctx.read('Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md').split('\n').slice(0, 10).join('\n'))
      && ctx.read('Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md').includes('N/A');
    const words = { 3: 'three' };
    return {
      'h-pmr-r26-l406-na': String(naRows.length),
      'h-pmr-r26-l409-na': String(naRows.length),
      'h-pmr-r26-l409-true': `${all.t} true rows`,
      'h-pmr-r26-l409-block': `(${all.bk}/${all.b})`,
      'h-pmr-r26-l409-p0': `${all.t}/${all.t + all.f}`,
      'h-pmr-r26-l409-p1': `${all.tk}/${all.tk + all.fk}`,
      'h-pmr-r26-l409-rk': `recall kept ${all.tk}/${all.t}`,
      'h-pmr-r26-l409-c-true': `${c.t} true`,
      'h-pmr-r26-l409-c-block': `${c.bk}/${c.b}`,
      'h-pmr-r26-l409-c-p0': `${c.t}/${c.t + c.f}`,
      'h-pmr-r26-l409-c-p1': `${c.tk}/${c.tk + c.fk}`,
      'h-pmr-r26-l409-c-rk': `and ${c.tk}/${c.t}`,
      'h-pmr-r26-l410-true': `${all.t} rows with label 'true'`,
      'h-pmr-r26-l410-block': `${all.b} of them`,
      'h-pmr-r26-l410-ffp06': `${p06.length} with functionId FF-P06`,
      'h-pmr-r26-l410-sum': sumStr,
      'h-pmr-r26-l414-rows': `${words[naRows.length] ?? naRows.length} rows`,
      'h-pmr-r26-l414-docs': docsOk ? 'three documents' : 'not all three documents mention N/A',
      'h-pmr-r26-l419-sum': sumStr,
      'h-pmr-r26-l419-md': mdRow ? `FF-P06 true ${mdRow[2]}/${mdRow[1]}` : '(no FF-P06 true row in scores.md)',
      'h-pmr-r26-l419-true': `${all.t} true rows`,
      'h-pmr-r26-l419-block': `(${all.bk}/${all.b})`,
      'h-pmr-r26-l421-c-true': `${c.t} true`,
      'h-pmr-r26-l421-c-block': `${c.bk}/${c.b}`,
      'h-pmr-r26-l421-c-p0': `${c.t}/${c.t + c.f}`,
      'h-pmr-r26-l421-c-p1': `${c.tk}/${c.tk + c.fk}`,
    };
  },
};

// ---- R27/R28: judge-catch rounds 1 and 2 ---------------------------------------------------------------------------
const R1DOC = 'Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md';
const R2DOC = 'Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md';
/** Replays the round 1 and round 2 scorers from the committed cassettes in the scratch tree; returns derived values. */
export function judgeCatch(ctx) {
  const tree = ctx.tree();
  const J = 'results/v1.3-judge-catch';
  ctx.sh(`npx tsx scripts/v1.3/judge-catch-score.ts --results ${J}`, { cwd: tree });
  ctx.sh(`npx tsx scripts/v1.3/judge-catch2-score.ts --results ${J}/round2 --round1 ${J}`, { cwd: tree });
  const r1 = ctx.json(`${tree}/${J}/scores.json`);
  const r2 = ctx.json(`${tree}/${J}/round2/scores.json`);
  const op1 = (id) => r1.perOperator.find((o) => o.operator === id);
  const op2 = (id) => r2.perOperator.find((o) => o.positive === id).combined;
  const fl2 = op2('AP-FRAMEWORK-LEAK').catch; const pd2 = op2('AP-PERSIST-IN-DOMAIN').catch;
  const fl1 = op1('AP-FRAMEWORK-LEAK').catch; const pd1 = op1('AP-PERSIST-IN-DOMAIN').catch;
  const disc = { k: fl2.k + pd2.k, n: fl2.n + pd2.n };
  const both = { k: disc.k + fl1.k + pd1.k, n: disc.n + fl1.n + pd1.n };
  return { r1, r2, op1, fl2, pd2, disc, both };
}
const judgecatch = {
  id: 'h-pmr-judgecatch',
  title: 'R27/R28: judge-catch seed counts and catch rates (rounds 1 and 2)',
  needs: 'offline',
  basis: 'replayed',
  slow: false,
  how: 'npx tsx scripts/v1.3/judge-catch-score.ts --results results/v1.3-judge-catch; npx tsx scripts/v1.3/judge-catch2-score.ts --results results/v1.3-judge-catch/round2 --round1 results/v1.3-judge-catch (scratch export, cassette replay); seed sites from results/v1.3-judge-catch/seed-manifest.json; quoted stale values checked on the judge-catch docs',
  numbers: [
    N('h-pmr-r27-l423-q', 423, "round-2 doc's informative seed count as quoted (stale)", '14 informative seeds'),
    N('h-pmr-r27-l423-sum', 423, 'FRAMEWORK-LEAK + PERSIST-IN-DOMAIN seeds (round 2)', '13 + 3 = 16'),
    N('h-pmr-r27-l426-q', 426, 'round-2 doc line 167 as quoted (stale count)', 'leaves 14 informative seeds'),
    N('h-pmr-r27-l426-fl', 426, 'round 2 FRAMEWORK-LEAK catch', '10/13'),
    N('h-pmr-r27-l426-pd', 426, 'round 2 PERSIST-IN-DOMAIN catch', '3/3'),
    N('h-pmr-r27-l426-pool', 426, 'pooled discounted catch', '13/16'),
    N('h-pmr-r27-l426-den', 426, 'denominators add to', 'add to 16'),
    N('h-pmr-r27-l427-fl', 427, 'round2 combined FRAMEWORK-LEAK catch', '10/13 = 0.77 [0.50, 0.92]'),
    N('h-pmr-r27-l427-pd', 427, 'round2 combined PERSIST-IN-DOMAIN catch', 'PERSIST-IN-DOMAIN 3/3'),
    N('h-pmr-r27-l427-sum', 427, 'seeds', '13 + 3 = 16'),
    N('h-pmr-r27-l428-fix', 428, 'corrected informative seed count', '16 informative seeds'),
    N('h-pmr-r27-l429-q', 429, 'round-2 doc line 167 as quoted (stale count)', 'leaves 14 informative seeds'),
    N('h-pmr-r27-l429-fl', 429, 'round 2 FRAMEWORK-LEAK catch', '10/13 FRAMEWORK-LEAK'),
    N('h-pmr-r27-l429-pd', 429, 'round 2 PERSIST-IN-DOMAIN catch', '3/3 PERSIST-IN-DOMAIN'),
    N('h-pmr-r27-l429-pool', 429, 'pooled discounted catch with Wilson CI', '13/16 = 0.81 [0.57, 0.93]'),
    N('h-pmr-r27-l429-den', 429, 'denominators', '13 + 3 = 16'),
    N('h-pmr-r27-l429-head', 429, 'headline note arithmetic', '10/13 + 3/3 = 13/16'),
    N('h-pmr-r27-l429-groupd', 429, 'repro audit group-D.md:135 records the discounted figure', 'as 13/16'),
    N('h-pmr-r27-l429-n16', 429, 'operator stratum seeds (round 2 pooled operator)', 'n = 16'),
    N('h-pmr-r27-l429-ci', 429, 'ratio and CI', '(13/16, 0.81 [0.57, 0.93])'),
    N('h-pmr-r28-l431-q', 431, "round-1 doc's seed clustering as quoted (stale)", '10 of the 11 seeds'),
    N('h-pmr-r28-l434-pool', 434, 'round 1 pooled catch', '9/11 = 0.82'),
    N('h-pmr-r28-l434-seeds', 434, 'round 1 seeds', '11 seeds'),
    N('h-pmr-r28-l434-lb', 434, 'round 1 pooled catch Wilson lower bound', 'Wilson lower bound of 0.52'),
    N('h-pmr-r28-l434-both', 434, 'both rounds, FRAMEWORK-LEAK + PERSIST-IN-DOMAIN', '16/21 = 0.76'),
    N('h-pmr-r28-l434-q', 434, 'round-1 doc lines 9 and 117 as quoted (stale)', '10 of the 11 seeds'),
    N('h-pmr-r28-l434-all', 434, 'seeds on antipattern-nest', '11 of 11'),
    N('h-pmr-r28-l435-pool', 435, 'round 1 pooled catch', '9/11 = 0.82'),
    N('h-pmr-r28-l435-q', 435, 'round-1 doc line 117 as quoted (stale)', '10 of the 11 seeds sit on one 8-file fixture'),
    N('h-pmr-r28-l435-files', 435, 'source files of the antipattern-nest fixture', '8-file fixture'),
    N('h-pmr-r28-l435-ref', 435, 'AP-REPO-BYPASS eligible/candidates on every reference project', '0/0'),
    N('h-pmr-r28-l435-nest', 435, 'AP-REPO-BYPASS eligible/candidates on antipattern-nest', '4/4'),
    N('h-pmr-r28-l435-all', 435, 'repro audit D-1: seeds on antipattern-nest', '11 of 11'),
    N('h-pmr-r28-l436-lb', 436, 'round 1 pooled catch lower bound', '(lower bound 0.52)'),
    N('h-pmr-r28-l436-all', 436, 'seeds on antipattern-nest', "'11 of 11'"),
    N('h-pmr-r28-l439-q', 439, 'round-1 doc lines 9 and 117 as quoted (stale)', '10 of the 11 seeds'),
    N('h-pmr-r28-l439-repo', 439, 'REPO-BYPASS seeds', 'REPO-BYPASS 4'),
    N('h-pmr-r28-l439-fat', 439, 'FAT-CONTROLLER seeds', 'FAT-CONTROLLER 1'),
    N('h-pmr-r28-l439-pd', 439, 'PERSIST-IN-DOMAIN seeds', 'PERSIST-IN-DOMAIN 1'),
    N('h-pmr-r28-l439-dup', 439, 'DUP-RULE seeds', 'DUP-RULE 1'),
    N('h-pmr-r28-l439-fl', 439, 'FRAMEWORK-LEAK seeds', 'FRAMEWORK-LEAK 4'),
    N('h-pmr-r28-l439-total', 439, 'seeds on antipattern-nest', 'which is 11'),
    N('h-pmr-r28-l439-s4', 439, 'section 4 seed table total (round 1 seeds)', 'sums to 11'),
    N('h-pmr-r28-l440-all', 440, 'repro audit group-D: should be', '11 of 11'),
    N('h-pmr-r28-l445-pool', 445, 'round 1 pooled catch', '9/11 = 0.82'),
    N('h-pmr-r28-l445-lb', 445, 'round 1 pooled catch lower bound', 'lower bound of 0.52'),
    N('h-pmr-r28-l445-both', 445, 'both rounds restricted claim', '16/21'),
    N('h-pmr-r28-l447-all', 447, 'seeds on antipattern-nest', '11-of-11'),
  ],
  async run(ctx) {
    const { r1, r2, op1, fl2, pd2, disc, both } = judgeCatch(ctx);
    const pool1 = r1.pooled.catch;
    const lb = pool1.low.toFixed(2);
    const seeds1 = r1.perOperator.reduce((s, o) => s + o.seeds, 0);
    const man = ctx.json('results/v1.3-judge-catch/seed-manifest.json');
    const seedRows = man.rows.filter((r) => !r.operatorId.endsWith('n'));
    const onNest = seedRows.filter((r) => r.baseId === 'antipattern-nest').length;
    const ofAll = `${onNest} of ${seedRows.length}`;
    const repo = man.table.filter((t) => t.operatorId === 'AP-REPO-BYPASS');
    const refCells = new Set(repo.filter((t) => /^(clean-architecture|layered|nestjs|hexagonal|ddd)\/clean$/.test(t.baseId)).map((t) => `${t.eligible}/${t.candidates}`));
    const nestCell = repo.filter((t) => t.baseId === 'antipattern-nest').map((t) => `${t.eligible}/${t.candidates}`)[0];
    const nFiles = ctx.sh('find fixtures/unit/antipattern-nest/src -type f -name "*.ts"').trim().split('\n').filter(Boolean).length;
    const seedsOf = (id) => op1(id).seeds;
    const q2 = quote(ctx, R2DOC, 167, 'leaves 14 informative seeds');
    const q1a = quote(ctx, R1DOC, 9, '10 of the 11 seeds'); const q1b = quote(ctx, R1DOC, 117, '10 of the 11 seeds');
    const q1 = q1a === q1b ? q1a : `${q1a} / ${q1b}`;
    const discCell = ctx.cell(disc.k, disc.n);
    const groupD = ctx.read('Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16/group-D.md').split('\n')[134] ?? '';
    const fl = `${fl2.k}/${fl2.n}`; const pd = `${pd2.k}/${pd2.n}`;
    const sum = `${fl2.n} + ${pd2.n} = ${disc.n}`;
    return {
      'h-pmr-r27-l423-q': q2.startsWith('(not') ? q2 : '14 informative seeds',
      'h-pmr-r27-l423-sum': sum,
      'h-pmr-r27-l426-q': q2,
      'h-pmr-r27-l426-fl': fl,
      'h-pmr-r27-l426-pd': pd,
      'h-pmr-r27-l426-pool': `${disc.k}/${disc.n}`,
      'h-pmr-r27-l426-den': `add to ${disc.n}`,
      'h-pmr-r27-l427-fl': fl2.text,
      'h-pmr-r27-l427-pd': `PERSIST-IN-DOMAIN ${pd}`,
      'h-pmr-r27-l427-sum': sum,
      'h-pmr-r27-l428-fix': `${disc.n} informative seeds`,
      'h-pmr-r27-l429-q': q2,
      'h-pmr-r27-l429-fl': `${fl} FRAMEWORK-LEAK`,
      'h-pmr-r27-l429-pd': `${pd} PERSIST-IN-DOMAIN`,
      'h-pmr-r27-l429-pool': discCell,
      'h-pmr-r27-l429-den': sum,
      'h-pmr-r27-l429-head': `${fl} + ${pd} = ${disc.k}/${disc.n}`,
      'h-pmr-r27-l429-groupd': groupD.includes(`${disc.k}/${disc.n}`) ? `as ${disc.k}/${disc.n}` : '(group-D.md:135 does not contain it)',
      'h-pmr-r27-l429-n16': `n = ${r2.pooled.operator.seeds}`,
      'h-pmr-r27-l429-ci': `(${disc.k}/${disc.n}, ${discCell.split(' = ')[1]})`,
      'h-pmr-r28-l431-q': q1,
      'h-pmr-r28-l434-pool': `${pool1.k}/${pool1.n} = ${ctx.f2(pool1.rate)}`,
      'h-pmr-r28-l434-seeds': `${seeds1} seeds`,
      'h-pmr-r28-l434-lb': `Wilson lower bound of ${lb}`,
      'h-pmr-r28-l434-both': `${both.k}/${both.n} = ${ctx.f2(both.k / both.n)}`,
      'h-pmr-r28-l434-q': q1,
      'h-pmr-r28-l434-all': ofAll,
      'h-pmr-r28-l435-pool': `${pool1.k}/${pool1.n} = ${ctx.f2(pool1.rate)}`,
      'h-pmr-r28-l435-q': quote(ctx, R1DOC, 117, '10 of the 11 seeds sit on one 8-file fixture'),
      'h-pmr-r28-l435-files': `${nFiles}-file fixture`,
      'h-pmr-r28-l435-ref': [...refCells].join(' | '),
      'h-pmr-r28-l435-nest': nestCell,
      'h-pmr-r28-l435-all': ofAll,
      'h-pmr-r28-l436-lb': `(lower bound ${lb})`,
      'h-pmr-r28-l436-all': `'${ofAll}'`,
      'h-pmr-r28-l439-q': q1,
      'h-pmr-r28-l439-repo': `REPO-BYPASS ${seedsOf('AP-REPO-BYPASS')}`,
      'h-pmr-r28-l439-fat': `FAT-CONTROLLER ${seedsOf('AP-FAT-CONTROLLER')}`,
      'h-pmr-r28-l439-pd': `PERSIST-IN-DOMAIN ${seedsOf('AP-PERSIST-IN-DOMAIN')}`,
      'h-pmr-r28-l439-dup': `DUP-RULE ${seedsOf('AP-DUP-RULE')}`,
      'h-pmr-r28-l439-fl': `FRAMEWORK-LEAK ${seedsOf('AP-FRAMEWORK-LEAK')}`,
      'h-pmr-r28-l439-total': `which is ${onNest}`,
      'h-pmr-r28-l439-s4': `sums to ${seeds1}`,
      'h-pmr-r28-l440-all': ofAll,
      'h-pmr-r28-l445-pool': `${pool1.k}/${pool1.n} = ${ctx.f2(pool1.rate)}`,
      'h-pmr-r28-l445-lb': `lower bound of ${lb}`,
      'h-pmr-r28-l445-both': `${both.k}/${both.n}`,
      'h-pmr-r28-l447-all': `${onNest}-of-${seedRows.length}`,
    };
  },
};

// ---- R10, R30, R31: construct-switch effects ------------------------------------------------------------------------
const construct = {
  id: 'h-pmr-construct',
  title: 'R10/R30/R31: construct-switch effects (Q24 B, Q5 B, Q5 B + Q24 B, Q13 C) re-scored offline',
  needs: 'offline',
  basis: 'regenerated',
  slow: true, // the --effects pass re-extracts every variant graph: ~30 s idle, ~10 min on a loaded machine
  how: 'node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts --effects <out>/effects.md; and --answers {"Q5":"B","Q24":"B"} --style hexagonal --out <out>/q5q24 (blocking = rules with blockingCandidate)',
  numbers: [
    N('h-pmr-r10-l168-rows', 168, 'Q24 B rows added on hexagonal (development set)', 'reports 17 rows'),
    N('h-pmr-r10-l168-now', 168, 'hexagonal blocking precision, status quo', 'from 13/13'),
    N('h-pmr-r10-l168-combo', 168, 'hexagonal blocking precision with Q5 B and Q24 B together', '15/32'),
    N('h-pmr-r10-l168-rows2', 168, 'inbound-adapter to domain rows that become blocking', 'the 17 inbound-adapter'),
    N('h-pmr-r10-l169-rows', 169, 'construct-switches.md:193 Q24 B hexagonal rows', '+17 rows'),
    N('h-pmr-r10-l179-p', 179, 'Q24 B alone: hexagonal blocking precision', 'P 13/13'),
    N('h-pmr-r10-l179-all', 179, 'Q24 B alone: hexagonal all-rules precision', 'P 16/33'),
    N('h-pmr-r10-l179-rows', 179, 'Q24 B alone: hexagonal rows added', '(+17 rows)'),
    N('h-pmr-r10-l179-q5', 179, 'Q5 B alone: hexagonal blocking recall and precision', 'R 15/15, P 15/15'),
    N('h-pmr-r10-l181-rows', 181, 'bypass rows', 'the 17 bypass rows'),
    N('h-pmr-r30-l471-q13', 471, 'Q13 C alone: nestjs blocking precision', 'P 10/68'),
    N('h-pmr-r31-l488-q13', 488, 'Q13 C alone: nestjs blocking precision', 'P 10/68'),
    N('h-pmr-r31-l498-q13', 498, 'Q13 C alone: nestjs blocking precision', 'P at 10/68'),
  ],
  async run(ctx) {
    const tree = ctx.tree(); const out = ctx.out('h-pmr-construct');
    const BASE = 'results/v1.3-reference/after-member-facts';
    ctx.sh(`node --import tsx scripts/v1.3/construct-rescore.ts --base ${BASE} --effects ${out}/effects.md`, { cwd: tree });
    const fx = ctx.read(`${out}/effects.md`).split('\n');
    const row = (q, o, s) => {
      const l = fx.find((x) => x.startsWith(`| ${q} | ${o} | ${s} |`));
      if (!l) throw new Error(`no effects row ${q} ${o} ${s}`);
      const c = l.split(' | ');
      const [bNow, bOpt] = c[3].split(' → '); const [, aOpt] = c[4].split(' → ');
      return { bNow, bOpt, aOpt, added: c[5].split(' / ')[0] };
    };
    const P = (cell) => /P (\d+\/\d+)/.exec(cell)[1];
    const q24 = row('Q24', 'B', 'hexagonal'); const q5 = row('Q5', 'B', 'hexagonal'); const q13 = row('Q13', 'C', 'nestjs');
    fs.writeFileSync(`${out}/q5q24.json`, '{"Q5":"B","Q24":"B"}\n');
    ctx.sh(`node --import tsx scripts/v1.3/construct-rescore.ts --base ${BASE} --answers ${out}/q5q24.json --style hexagonal --out ${out}/q5q24`, { cwd: tree });
    const rep = ctx.json(`${out}/q5q24/report.json`);
    const hex = rep.metrics.find((m) => m.style === 'hexagonal').rules.filter((r) => r.blockingCandidate);
    const tp = hex.reduce((s, r) => s + r.tp, 0); const fp = hex.reduce((s, r) => s + r.fp, 0);
    const n17 = q24.added.replace('+', '');
    return {
      'h-pmr-r10-l168-rows': `reports ${n17} rows`,
      'h-pmr-r10-l168-now': `from ${P(q24.bNow)}`,
      'h-pmr-r10-l168-combo': `${tp}/${tp + fp}`,
      'h-pmr-r10-l168-rows2': `the ${n17} inbound-adapter`,
      'h-pmr-r10-l169-rows': `${q24.added} rows`,
      'h-pmr-r10-l179-p': `P ${P(q24.bOpt)}`,
      'h-pmr-r10-l179-all': `P ${P(q24.aOpt)}`,
      'h-pmr-r10-l179-rows': `(${q24.added} rows)`,
      'h-pmr-r10-l179-q5': q5.bOpt.trim(),
      'h-pmr-r10-l181-rows': `the ${n17} bypass rows`,
      'h-pmr-r30-l471-q13': `P ${P(q13.bOpt)}`,
      'h-pmr-r31-l488-q13': `P ${P(q13.bOpt)}`,
      'h-pmr-r31-l498-q13': `P at ${P(q13.bOpt)}`,
    };
  },
};

// ---- repository facts the review states ---------------------------------------------------------------------------
const repo = {
  id: 'h-pmr-repo',
  title: 'post-merge review: repository facts (FE budget, rename test, edge-view readers, fidelity coverage)',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'FE_SOURCE_BUDGET_CHARS evaluated with tsx; grep of tests/unit/mcp-server/diff-placement.test.ts; rows of the Docs/v1.3/edge-views.md addendum table',
  numbers: [
    N('h-pmr-r11-l186-cov', 186, 'tsc coverage reading for barrels and require', '0.926-of-tsc', { needs: 'not-checkable', note: 'no committed fidelity result has 0.926 (results/v1.3-fidelity e1/so4 and results/v1.3-barrels give tsc refCoveredByApg 0.996684 / 0.966302 / 0.983193 / 0.7); the figure has no traceable source in the repository' }),
    N('h-pmr-r07-l132-sim', 132, 'similarity of the only rename test in diff-placement.test.ts', '90% similarity'),
    N('h-pmr-r12-l203-readers', 203, 'IMPORTS readers fixed in the edge-views 2026-10-15 addendum', 'four other readers'),
    N('h-pmr-r19-l303-budget', 303, 'FE_SOURCE_BUDGET_CHARS', '96,000 chars'),
    N('h-pmr-r19-l306-expr', 306, 'FE_SOURCE_BUDGET_CHARS definition', '24000 * CHARS_PER_TOKEN'),
    N('h-pmr-r19-l306-k', 306, 'FE_SOURCE_BUDGET_CHARS in thousands', '96k characters'),
  ],
  async run(ctx) {
    const v = ctx.sh(`node --import tsx -e "import('./src/llm-critic/filter-explain.ts').then((m) => console.log(m.FE_SOURCE_BUDGET_CHARS))"`).trim();
    const def = /FE_SOURCE_BUDGET_CHARS = ([^;]+);/.exec(ctx.read('src/llm-critic/filter-explain.ts'))[1];
    const sim = /'similarity index (\d+)%'/.exec(ctx.read('tests/unit/mcp-server/diff-placement.test.ts'));
    const ev = ctx.read('Docs/v1.3/edge-views.md').split('\n');
    const start = ev.findIndex((l) => l.startsWith('## Addendum 2026-10-15'));
    let rows = 0; let inTable = false;
    for (const l of ev.slice(start)) {
      if (l.startsWith('|---')) { inTable = true; continue; }
      if (inTable) { if (l.startsWith('| ')) rows++; else break; }
    }
    const words = { 4: 'four' };
    return {
      'h-pmr-r07-l132-sim': sim ? `${sim[1]}% similarity` : '(no similarity line)',
      'h-pmr-r12-l203-readers': `${words[rows] ?? rows} other readers`,
      'h-pmr-r19-l303-budget': `${Number(v).toLocaleString('en-US')} chars`,
      'h-pmr-r19-l306-expr': def,
      'h-pmr-r19-l306-k': `${Number(v) / 1000}k characters`,
    };
  },
};

export default [tally, reference, labelling, fe, judgecatch, construct, repo];
