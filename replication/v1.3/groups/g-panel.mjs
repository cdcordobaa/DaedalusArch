// Model panel (Docs/v1.3/model-panel.md): the fake-rater dry run regenerated in a scratch export of HEAD (no model is
// called; the three raters are deterministic stubs), compared with results/v1.3-panel/dry-run, the authority-rule
// constants, the per-call token sizes re-derived from the dry run's rendered prompts, and the §8 cost arithmetic.
import { join } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const DOC = 'Docs/v1.3/model-panel.md';
const n = (id, line, what, stated, extra = {}) => ({ id: `g-panel-${id}`, doc: DOC, line, what, stated, ...extra });
const r5 = (x) => Math.round(x / 5) * 5;
const money = (x) => (x < 10 ? x.toFixed(1) : x.toFixed(0));

function walk(d) {
  return readdirSync(d).flatMap((e) => { const p = join(d, e); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

export default [{
  id: 'g-panel-dry',
  title: 'Model panel fake-rater dry run, authority constants, prompt sizes and cost arithmetic',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'node --import tsx scripts/v1.3/model-panel.ts dry-run (in a scratch export of HEAD); token sizes = rendered prompt characters / 4 from its cassettes; §8 arithmetic re-derived',
  numbers: [
    n('default-decoys', 31, 'build default decoy mix (--decoys-correct/--decoys-wrong defaults, main.ts)', '15 known-correct and 15 known-wrong'),
    n('floor-31', 31, 'authority rule decoy floor (AUTHORITY_RULE)', 'floor of 20 (≥ 10 per class)'),
    n('blinding-40', 51, 'dry run: items that passed the blinding check (none withheld)', 'all 40 items passed'),
    n('r0', 84, 'R0 minimum decoys per run and per class (AUTHORITY_RULE)', '≥ 20 decoys, with ≥ 10 known-correct and ≥ 10 known-wrong'),
    n('r1a', 88, 'R1(a) minimum decoy accuracy (AUTHORITY_RULE)', '≥ 0.85'),
    n('r1b', 89, 'R1(b) minimum per-class accuracy (AUTHORITY_RULE)', '≥ 0.70'),
    n('r1c', 90, 'R1(c) minimum valid share (AUTHORITY_RULE)', '≥ 0.90'),
    n('r2', 98, 'R2 minimum qualified vendors (AUTHORITY_RULE)', '≥ 2 qualified vendors'),
    n('r3', 102, 'R3 minimum agreeing vendors (AUTHORITY_RULE)', '≥ 2 qualified vendors'),
    n('r4', 107, 'R4 minimum Fleiss kappa (AUTHORITY_RULE)', '≥ 0.60'),
    n('r4-human', 107, 'human protocol kappa gate (Docs/v1.3/human-labelling-protocol.md)', 'same gate value as the human protocol (0.60)'),
    n('dry-items', 142, 'dry run item mix', '40 items: 20 wild targets, 10 known-correct and 10 known-wrong'),
    n('fake-acc', 142, 'fake rater accuracies (DRY_RUN_PROFILES)', '(0.96, 0.94, 0.70)'),
    n('fake-fail', 142, 'dry run: fake raters failing R1', 'one fake rater fails R1'),
    n('stop-exit', 187, 'exit code of a stop (main.ts)', 'exits with code 3'),
    n('calls-100', 194, 'calls per 100 items per vendor (estimatePanel)', '100 items × 2 runs = 200 calls'),
    n('worst-800', 194, 'worst case calls per 100 items (estimatePanel worstCase)', 'The worst case is 800'),
    n('expect-210', 194, 'expected calls per 100 items, from the dry run (max rater calls / items × 100)', 'expect about 210'),
    n('sys-tokens', 196, 'system prompt tokens (chars / 4)', 'About 65 system tokens'),
    n('prompt-range', 196, 'prompt tokens per call (rendered prompt + the response schema every adapter sends), range of the wild and decoy averages, outward to 50', '350–500 prompt tokens'),
    n('wild-avg', 196, 'wild target items: mean prompt tokens per call (rendered prompt + response schema)', 'about 355'),
    n('decoy-avg', 196, 'reference decoys: mean prompt tokens per call (rendered prompt + response schema)', 'about 490'),
    n('largest', 196, 'largest item: prompt tokens per call (rendered prompt + response schema)', 'about 725'),
    n('input-013', 196, 'input tokens per 100 items per vendor (600 × 210)', '≈ 0.13 M input tokens'),
    n('visible-40', 198, 'visible answer tokens of a real rater', 'about 40 tokens', { needs: 'needs-LLM', note: 'Needs real answers; the fake raters record a fixed 20 output tokens.' }),
    n('reasoning', 198, 'hidden reasoning tokens per call', '200–2,000 per call', { needs: 'needs-external', note: 'Vendor behaviour, not measured in the repository.' }),
    n('output-range', 198, 'output tokens per 100 items per vendor ((40 + 200..2000) × 210)', '≈ 0.05–0.43 M output tokens'),
    n('cost-mid', 204, 'cost per 100 items, 1.25 / 10 $/M (0.13 in, 0.05–0.43 out)', '≈ $0.7 – $4.5'),
    n('cost-250', 205, 'cost per 100 items, 2.50 / 15 $/M', '≈ $1.1 – $6.8'),
    n('cost-prem', 206, 'cost per 100 items, 15 / 75 $/M', '≈ $5.7 – $34'),
    n('calls-330', 208, 'minimum calls per vendor for 300 targets + 30 decoys (estimatePanel)', '660 calls per vendor at minimum'),
  ],
  async run(ctx) {
    const tree = ctx.tree();
    const outRel = '.rep2-g-panel-dry';
    const dir = join(tree, outRel);
    ctx.sh(`rm -rf ${outRel} && node --import tsx scripts/v1.3/model-panel.ts dry-run --out-dir ${outRel}`, { cwd: tree });
    // byte comparison with the committed dry run (README excluded: it is hand-written)
    const diff = ctx.sh(`diff -r --exclude=README.md ${outRel} results/v1.3-panel/dry-run >/dev/null && echo same || echo differs`, { cwd: tree }).trim();
    if (diff !== 'same') throw new Error('regenerated dry run differs from results/v1.3-panel/dry-run');

    const consts = JSON.parse(ctx.sh(`node --import tsx --input-type=module -e "import { AUTHORITY_RULE as a } from './scripts/v1.3/lib/panel/stats.ts'; import { DRY_RUN_PROFILES as p } from './scripts/v1.3/lib/panel/adapters.ts'; import { estimatePanel as e } from './scripts/v1.3/lib/panel/run.ts'; import { SYSTEM_PROMPT as s, RESPONSE_SCHEMA_TEXT as rs } from './scripts/v1.3/lib/labelling/meaningful-prompt.ts'; console.log(JSON.stringify({ a, acc: p.map((x) => x.accuracy), e100: e(100, 1), e330: e(330, 1), sys: s.length, schema: rs.length }))"`));
    const a = consts.a;
    const f2 = (x) => x.toFixed(2);
    const r = {};
    const main = ctx.read('scripts/v1.3/lib/panel/main.ts');
    const dc = /decoysCorrect: Number\(args\.get\('decoys-correct'\) \?\? (\d+)\), decoysWrong: Number\(args\.get\('decoys-wrong'\) \?\? (\d+)\)/.exec(main);
    r['g-panel-default-decoys'] = `${dc[1]} known-correct and ${dc[2]} known-wrong`;
    r['g-panel-floor-31'] = `floor of ${a.minDecoys} (≥ ${a.minDecoysPerClass} per class)`;
    r['g-panel-r0'] = `≥ ${a.minDecoys} decoys, with ≥ ${a.minDecoysPerClass} known-correct and ≥ ${a.minDecoysPerClass} known-wrong`;
    r['g-panel-r1a'] = `≥ ${f2(a.minDecoyAccuracy)}`;
    r['g-panel-r1b'] = `≥ ${f2(a.minClassAccuracy)}`;
    r['g-panel-r1c'] = `≥ ${f2(a.minValidShare)}`;
    r['g-panel-r2'] = `≥ ${a.minQualifiedVendors} qualified vendors`;
    r['g-panel-r3'] = `≥ ${a.minAgreeingVendors} qualified vendors`;
    r['g-panel-r4'] = `≥ ${f2(a.minPanelKappa)}`;
    const human = /Cohen's κ ≥ ([\d.]+)/.exec(ctx.read('Docs/v1.3/human-labelling-protocol.md'))[1];
    r['g-panel-r4-human'] = Number(human) === a.minPanelKappa ? `same gate value as the human protocol (${human})` : `differs: human ${human}`;
    r['g-panel-fake-acc'] = `(${consts.acc.map(f2).join(', ')})`;
    r['g-panel-stop-exit'] = /e\.kind === 'stop'\) \{[\s\S]*?return (\d+);/.exec(main) ? `exits with code ${/e\.kind === 'stop'\) \{[\s\S]*?return (\d+);/.exec(main)[1]}` : 'not found';
    r['g-panel-calls-100'] = `100 items × 2 runs = ${consts.e100.calls} calls`;
    r['g-panel-worst-800'] = `The worst case is ${consts.e100.worstCase}`;
    r['g-panel-calls-330'] = `${consts.e330.calls} calls per vendor at minimum`;

    // dry-run outputs
    const set = JSON.parse(readFileSync(join(dir, 'panel-set.json'), 'utf8'));
    const key = JSON.parse(readFileSync(join(dir, 'panel-key.json'), 'utf8'));
    const rep = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    const t = key.rows.filter((x) => x.truth === undefined).length;
    const yes = key.rows.filter((x) => x.truth === 'yes').length;
    const no = key.rows.filter((x) => x.truth === 'no').length;
    const wild = key.rows.filter((x) => x.truth === undefined && x.origin === 'wild').length;
    r['g-panel-dry-items'] = `${set.items.length} items: ${wild === t ? wild : `${t} (${wild} wild)`} wild targets, ${yes} known-correct and ${no} known-wrong`;
    r['g-panel-blinding-40'] = rep.withheld.length === 0 ? `all ${set.items.length} items passed` : `${rep.withheld.length} withheld`;
    const failed = rep.accuracy.filter((x) => !x.qualified).length;
    r['g-panel-fake-fail'] = `${['no', 'one', 'two', 'three'][failed]} fake rater${failed === 1 ? '' : 's'} fail${failed === 1 ? 's' : ''} R1`;
    const maxCalls = Math.max(...rep.usage.map((u) => u.usage.calls));
    r['g-panel-expect-210'] = `expect about ${Math.round((maxCalls / set.items.length) * 100)}`;

    // rendered prompt sizes (run 0 of each item, from the cassettes) and the system prompt
    const originOf = new Map(set.items.map((it) => [it.key, key.rows.find((k) => k.id === it.id).origin]));
    const per = new Map();
    for (const f of walk(join(dir, 'cassettes')).filter((p) => p.endsWith('.json'))) {
      const c = JSON.parse(readFileSync(f, 'utf8'));
      // run 0, first ask: the shortest run-0 prompt of the item (a re-ask appends text)
      // per call: the rendered prompt plus the response schema text, which every adapter sends with the request
      // (responseSchema / json_schema response_format / --json-schema, adapters.ts), so it is billed as input
      if (c.runIndex === 0) per.set(c.itemKey, Math.min(per.get(c.itemKey) ?? Infinity, (c.request.prompt.length + consts.schema) / 4));
    }
    const by = (o) => [...per].filter(([k]) => originOf.get(k) === o).map(([, v]) => v);
    const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const w = mean(by('wild')); const d = mean(by('decoy')); const mx = Math.max(...per.values());
    r['g-panel-sys-tokens'] = `About ${r5(consts.sys / 4)} system tokens`;
    // "about N" is a planning estimate: it reproduces when N is the measured value to the nearest 5 or within 1% of it
    const stated = (id) => Number(/\d+/.exec(this.numbers.find((x) => x.id === id).stated)[0]);
    const about = (id, m) => { const N = stated(id); return N === r5(m) || Math.abs(N - m) <= 0.01 * m ? N : r5(m); };
    r['g-panel-prompt-range'] = `${Math.floor(w / 50) * 50}–${Math.ceil(d / 50) * 50} prompt tokens`;
    r['g-panel-wild-avg'] = `about ${about('g-panel-wild-avg', w)}`;
    r['g-panel-decoy-avg'] = `about ${about('g-panel-decoy-avg', d)}`;
    r['g-panel-largest'] = `about ${about('g-panel-largest', mx)}`;

    // §8 arithmetic, on the doc's own planning figures (600 input tokens, 40 visible + 200..2000 reasoning, 210 calls)
    const calls = 210;
    const inM = Number(((600 * calls) / 1e6).toFixed(2));
    const outLo = Number((((40 + 200) * calls) / 1e6).toFixed(2));
    const outHi = Number((((40 + 2000) * calls) / 1e6).toFixed(2));
    r['g-panel-input-013'] = `≈ ${inM} M input tokens`;
    r['g-panel-output-range'] = `≈ ${outLo}–${outHi} M output tokens`;
    // the table uses the §8 planning figures above (0.13 in, 0.05–0.43 out)
    const cost = (pin, pout) => `≈ $${money(inM * pin + outLo * pout)} – $${money(inM * pin + outHi * pout)}`;
    r['g-panel-cost-mid'] = cost(1.25, 10);
    r['g-panel-cost-250'] = cost(2.5, 15);
    r['g-panel-cost-prem'] = cost(15, 75);
    return r;
  },
}];
