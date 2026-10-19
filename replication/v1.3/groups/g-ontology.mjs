// Ontology v0 (Docs/v1.3/ontology-v0-design.md): the mock-provider fixture run (replay of the committed mock cassettes,
// a fresh mock record into scratch, and --estimate), the pipeline's code defaults, and the planted fixture facts.
// No model is called: the mock provider answers from tests/fixtures/v1.3-ontology/mock-answers/.
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

const DOC = 'Docs/v1.3/ontology-v0-design.md';
const RUN = 'node --import tsx scripts/v1.3/ontology-run.ts --fixtures --provider mock';
const n = (id, line, what, stated, extra = {}) => ({ id: `g-onto-${id}`, doc: DOC, line, what, stated, ...extra });

function parseRunLines(out) {
  const cases = {};
  for (const m of out.matchAll(/^(case-[\w-]+): (\d+) Sem nodes, (\d+) Sem edges, (\d+) findings, (\d+) rejected \(hallucinations\); calls (\d+), cache hits (\d+)/gm)) {
    cases[m[1]] = { calls: Number(m[6]), hits: Number(m[7]) };
  }
  return cases;
}

export default [{
  id: 'g-onto-mock',
  title: 'Ontology v0 mock fixture run, estimate, code defaults and planted fixtures',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: `${RUN} --replay --out <scratch>; ${RUN} --cassettes <scratch> --out <scratch>; node --import tsx scripts/v1.3/ontology-run.ts --fixtures --estimate --provider mock --out <scratch>; constants read from src/apg-enrich/ontology/*.ts`,
  numbers: [
    // §3 pipeline: code facts
    n('max-neighbours', 64, 'class unit APG neighbourhood cap (MAX_NEIGHBOURS, units.ts)', 'at most 25 neighbours'),
    n('rule-min-density', 67, 'ruleMinDensity default (DEFAULT_ONTOLOGY_OPTIONS)', 'default 1'),
    n('pair-rule-jaccard', 76, 'rule candidate pair: subject-token Jaccard threshold (clustering.ts)', 'at least 0.5'),
    n('pair-concept-jaccard', 77, 'concept candidate pair: name-token / field-name Jaccard thresholds (clustering.ts)', '0.5 / 0.3'),
    n('pair-cap-jaccard', 78, 'capability candidate pair: name-token Jaccard threshold (clustering.ts)', 'at least 0.34'),
    n('max-adjudication', 79, 'maxAdjudicationPairs default', 'default 40'),
    // §5
    n('min-fragment', 124, 'minFragmentClasses default', '(3)', { known: { actual: '(2)', note: 'decision N4 (ADR-V13-N4, v1.4 U3): concept fragmentation is a finding only inside one declared bounded context, with at least 2 differently-named definers (was 3 across at least 2 components). The v0.1 value stays in §5; the v0.2 baseline is in §13 of the design doc.' } }),
    n('scatter-min', 125, 'scatterMinComponents default', '(3)'),
    n('decimal-scale', 128, 'decimal scale 10^k, k max (decimalScaleMaxPower default)', 'k ≤ 3'),
    // §6 agreement matching
    n('agree-resp-jaccard', 153, 'run agreement, responsibilities: name-token Jaccard threshold (passes.ts)', '≥ 0.34'),
    n('agree-cap-jaccard', 156, 'run agreement, capabilities: name Jaccard threshold (passes.ts)', '≥ 0.5'),
    // §7 cost
    n('chars-per-token', 174, 'estimate: characters per prompt token (pipeline.ts)', '4 characters a token'),
    n('budget-default', 178, 'budget default (provider calls per project)', 'default 200'),
    n('fixture-classes', 181, 'fixture estimate: classes over the six cases', '22 classes'),
    n('fixture-calls-ac', 181, 'fixture estimate: pass (a) + pass (c) calls', '44 + 22 calls'),
    n('fixture-calls-b', 181, 'fixture estimate: pass (b) upper bound, all cases', 'at most 32'),
    n('fixture-calls-d', 181, 'fixture estimate: pass (d) upper bound per case', 'at most 80 per case'),
    n('mock-record-calls', 181, 'calls made by a fresh mock record of the six cases', '110 calls'),
    // §8 ground truth (planted fixture facts)
    n('case01-50', 189, 'case-01 checkout threshold literal', 'total >= 50'),
    n('case01-5000', 189, 'case-01 invoicing constant FREE_SHIPPING_MIN_CENTS', '5000 cents'),
    n('case02-10pct', 190, 'case-02 discount rate inside sendConfirmation', '10%'),
    n('case04a-50', 192, 'case-04a: rules of shape x >= N sharing the constant 50 (count)', 'Two share the constant 50'),
    n('cheap-caught', 209, 'cheap proxies: planted defects caught', '0 of 3'),
    n('cheap-flag-50', 210, 'cheap proxies: flagged control pair shares literal', 'share the literal 50'),
    // §9 results (mock)
    n('found', 218, 'planted defects found (mock)', '3 of 3', { known: { actual: '2 of 3', note: 'decision N4 (ADR-V13-N4, v1.4 U3): case-03 plants Customer across three directory components with no declared context, which N4 makes correct DDD, so its expected fragmentation is out of scope (the runner prints the N4 note on its own line). The v0.1 figure stays in §9; the v0.2 mock baseline (2 of 3) is in §13 of the design doc.' } }),
    n('forbidden', 219, 'forbidden hits / unexpected (mock)', '0 of 14 / 0'),
    n('halluc', 220, 'planted hallucinations rejected (mock)', '4 of 4'),
    n('accepted', 221, 'accepted assertions (mock)', '128'),
    n('jaccard-case02', 222, 'case-02 pass (a) mean Jaccard (planted disagreement)', '0.875'),
    // §11 threats
    n('budget-default-2', 266, 'default budget (repeat of §7)', 'default budget of 200'),
    n('case-sizes', 269, 'classes per planted case (min to max)', '2 to 6 classes'),
    n('decimal-50-5000', 272, 'equalUpToDecimalScale(50, 5000) holds', '50 match 5000'),
    n('decimal-5-500', 273, 'equalUpToDecimalScale(5, 500) holds', '5 and 500 match'),
  ],
  async run(ctx) {
    const scr = ctx.out('g-onto');
    const replay = ctx.sh(`${RUN} --replay --out ${join(scr, 'replay')}`);
    const recCas = join(scr, 'cassettes');
    const rec = ctx.sh(`${RUN} --cassettes ${recCas} --out ${join(scr, 'record')}`);
    const est = ctx.sh(`node --import tsx scripts/v1.3/ontology-run.ts --fixtures --estimate --provider mock --out ${join(scr, 'est')}`);
    const opts = JSON.parse(ctx.sh(`node --import tsx --input-type=module -e "import { DEFAULT_ONTOLOGY_OPTIONS as o } from './src/apg-enrich/ontology/index.ts'; import { equalUpToDecimalScale as e } from './src/apg-enrich/ontology/text.ts'; console.log(JSON.stringify({ ...o, d50: e(50, 5000), d5: e(5, 500) }))"`));

    const r = {};
    const src = (f) => ctx.read(`src/apg-enrich/ontology/${f}`);
    r['g-onto-max-neighbours'] = `at most ${/const MAX_NEIGHBOURS = (\d+);/.exec(src('units.ts'))[1]} neighbours`;
    r['g-onto-rule-min-density'] = `default ${opts.ruleMinDensity}`;
    const cl = src('clustering.ts');
    r['g-onto-pair-rule-jaccard'] = `at least ${/else if \(subj >= ([\d.]+)\)/.exec(cl)[1]}`;
    const cm = /if \(nameJ >= ([\d.]+) \|\| fieldJ >= ([\d.]+)\)/.exec(cl);
    r['g-onto-pair-concept-jaccard'] = `${cm[1]} / ${cm[2]}`;
    r['g-onto-pair-cap-jaccard'] = `at least ${/a\.kind === 'capability' && nameJ >= ([\d.]+)/.exec(cl)[1]}`;
    r['g-onto-max-adjudication'] = `default ${opts.maxAdjudicationPairs}`;
    r['g-onto-min-fragment'] = `(${opts.minFragmentClasses})`;
    r['g-onto-scatter-min'] = `(${opts.scatterMinComponents})`;
    r['g-onto-decimal-scale'] = `k ≤ ${opts.decimalScaleMaxPower}`;
    const ps = src('passes.ts');
    r['g-onto-agree-resp-jaccard'] = `≥ ${/a\.naturalLayer === b\.naturalLayer && \(jaccard\(tokens\(a\.name\), tokens\(b\.name\)\) >= ([\d.]+)/.exec(ps)[1]}`;
    r['g-onto-agree-cap-jaccard'] = `≥ ${/jaccard\(tokens\(a\.name\), tokens\(b\.name\)\) >= ([\d.]+) \|\| jaccard\(a\.realizedBy/.exec(ps)[1]}`;
    r['g-onto-chars-per-token'] = `${/promptTokensKnown: Math\.ceil\(chars \/ (\d+)\)/.exec(src('pipeline.ts'))[1]} characters a token`;
    r['g-onto-budget-default'] = `default ${opts.budget}`;
    r['g-onto-budget-default-2'] = `default budget of ${opts.budget}`;

    // --estimate
    const e = [...est.matchAll(/^(case-[\w-]+): classes (\d+), groups (\d+), rule-candidate classes (\d+); calls a=(\d+) b<=(\d+) c=(\d+) d<=(\d+)/gm)]
      .map((m) => ({ classes: +m[2], a: +m[5], b: +m[6], c: +m[7], d: +m[8] }));
    if (e.length !== 6) throw new Error(`estimate: ${e.length} cases`);
    const sum = (k) => e.reduce((s, x) => s + x[k], 0);
    r['g-onto-fixture-classes'] = `${sum('classes')} classes`;
    r['g-onto-fixture-calls-ac'] = `${sum('a')} + ${sum('c')} calls`;
    r['g-onto-fixture-calls-b'] = `at most ${sum('b')}`;
    const ds = [...new Set(e.map((x) => x.d))];
    r['g-onto-fixture-calls-d'] = ds.length === 1 ? `at most ${ds[0]} per case` : `varies ${ds.join('/')}`;
    const cls = e.map((x) => x.classes);
    r['g-onto-case-sizes'] = `${Math.min(...cls)} to ${Math.max(...cls)} classes`;

    // fresh mock record: provider calls; replay must not call
    const recCases = parseRunLines(rec);
    r['g-onto-mock-record-calls'] = `${Object.values(recCases).reduce((s, x) => s + x.calls, 0)} calls`;
    const repCases = parseRunLines(replay);
    if (Object.values(repCases).some((x) => x.calls !== 0)) throw new Error('replay made provider calls');

    // scores of the replay
    const sc = JSON.parse(readFileSync(join(scr, 'replay', 'scores.json'), 'utf8'));
    const a = sc.aggregate;
    r['g-onto-found'] = `${a.found} of ${a.expected}`;
    r['g-onto-forbidden'] = `${a.forbiddenHits} of ${a.forbidden} / ${a.unexpected}`;
    r['g-onto-accepted'] = String(a.acceptedAssertions);
    r['g-onto-cheap-caught'] = `${a.cheapCaughtExpected} of ${a.expected}`;
    // hallucinations: every rejection must sit in a run-1 (planted) answer, and the four reasons must be the four named
    const hall = [];
    for (const c of readdirSync(join(scr, 'replay')).filter((d) => d.startsWith('case-'))) {
      hall.push(...JSON.parse(readFileSync(join(scr, 'replay', c, 'result.json'), 'utf8')).hallucinations);
    }
    const reasons = [...new Set(hall.flatMap((h) => h.reasons.map((x) => x.reason)))].sort().join(',');
    const allPlantedRun = hall.every((h) => h.runIndex === 1);
    r['g-onto-halluc'] = reasons === 'node-outside-item,quote-mismatch,span-out-of-range,unknown-node' && allPlantedRun
      ? `${a.hallucinations} of ${hall.length}` : `${a.hallucinations} rejected; reasons ${reasons}`;
    const c02 = JSON.parse(readFileSync(join(scr, 'replay', 'case-02-misplaced-pricing', 'result.json'), 'utf8'));
    r['g-onto-jaccard-case02'] = String(c02.agreement.responsibility.meanJaccard);
    // the flagged control pair
    const flagged = sc.cases.flatMap((c) => c.items).filter((i) => i.polarity === 'forbidden' && i.cheap === 'flagged').map((i) => i.id);
    const fx = 'tests/fixtures/v1.3-ontology/case-04a-control-near-miss-rules/src';
    const bulk = ctx.read(`${fx}/catalog/domain/bulk-discount.ts`); const free = ctx.read(`${fx}/shipping/domain/free-shipping.ts`);
    const lit = (s) => /if \(\w+ >= (\d+)\)/.exec(s)?.[1];
    r['g-onto-cheap-flag-50'] = flagged.length === 1 && flagged[0] === 'BulkDiscount.rateFor+FreeShippingRule.costFor' && lit(bulk) === lit(free)
      ? `share the literal ${lit(bulk)}` : `flagged ${flagged.join(';')}`;

    // planted fixture facts
    const f1 = 'tests/fixtures/v1.3-ontology/case-01-rule-dup-shapes/src';
    r['g-onto-case01-50'] = `total >= ${/total >= (\d+)/.exec(ctx.read(`${f1}/checkout/domain/shipping-policy.ts`))[1]}`;
    r['g-onto-case01-5000'] = `${/FREE_SHIPPING_MIN_CENTS = (\d+);/.exec(ctx.read(`${f1}/invoicing/application/invoice-assembler.ts`))[1]} cents`;
    const disc = /subtotal \* ([\d.]+)/.exec(ctx.read('tests/fixtures/v1.3-ontology/case-02-misplaced-pricing/src/notifications/application/order-notification.service.ts'))[1];
    r['g-onto-case02-10pct'] = `${Math.round(Number(disc) * 100)}%`;
    const age = ctx.read(`${fx}/accounts/domain/age-check.ts`);
    const consts = [lit(bulk), lit(free), lit(age)];
    const fifty = consts.filter((x) => x === '50').length;
    r['g-onto-case04a-50'] = `${['Zero', 'One', 'Two', 'Three'][fifty]} share the constant 50`;
    r['g-onto-decimal-50-5000'] = opts.d50 ? '50 match 5000' : '50 does not match 5000';
    r['g-onto-decimal-5-500'] = opts.d5 ? '5 and 500 match' : '5 and 500 do not match';
    return r;
  },
}];
