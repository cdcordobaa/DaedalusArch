// Edge views, FF-P05 type edges, APG v2 design and scope ADR, ADR-V13-01/02: the edge-view counts and APG v2 constants
// re-derived from src/, the FF-P05 signature-branch scan and the APG v2 ablation regenerated offline, the live-run row
// counts re-derived from the committed Docs/DiagnosticRuns/apg2-live-2026-10-15/*.json (that run needs Neo4j), and the
// ADR-V13-02 baseline counts from the committed results/v1.3-reference/baseline-pre-barrel/scores.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EV = 'Docs/v1.3/edge-views.md';
const P5 = 'Docs/v1.3/ffp05-type-edges.md';
const AD = 'Docs/v1.3/apg2-design.md';
const SC = 'Docs/v1.3/apg2-scope-adr-draft.md';
const A2 = 'Docs/v1.3/adr-v13-02-draft.md';
const at = (doc) => (id, line, what, stated, extra = {}) => ({ id, doc, line, what, stated, ...extra });
const ev = at(EV); const p5 = at(P5); const ad = at(AD); const sc = at(SC); const a2 = at(A2);
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const LIVE = 'Docs/DiagnosticRuns/apg2-live-2026-10-15';

function tsx(ctx, name, code) {
  const f = join(ctx.out(name), `${name}.mjs`);
  writeFileSync(f, code);
  return JSON.parse(ctx.sh(`node --import tsx ${f}`).trim().split('\n').pop());
}

export default [
  {
    id: 'e-ev-code',
    title: 'edge views per template (TEMPLATE_EDGE_VIEWS) counted by view and catalogue; the IMPORTS readers of the addendum',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'TEMPLATE_EDGE_VIEWS (src/fitness-compiler/edge-views.ts) joined with CYPHER_TEMPLATES and V13_EXTENSION_TEMPLATE_CATALOGUES; grep of the four reader files for the literal-view filter',
    numbers: [
      ev('e-ev-names', 71, 'template names with a recorded view', '38'),
      ev('e-ev-lit', 71, 'literal view', '13'),
      ev('e-ev-lit-frozen', 71, 'literal, frozen', '9'),
      ev('e-ev-lit-hex', 71, 'literal, hexagonal', '3'),
      ev('e-ev-lit-ddd', 71, 'literal, DDD', '1'),
      ev('e-ev-res', 71, 'resolved view', '4'),
      ev('e-ev-res-frozen', 71, 'resolved, frozen', '2'),
      ev('e-ev-res-ddd', 71, 'resolved, DDD', '2'),
      ev('e-ev-none', 71, 'view none', '21'),
      ev('e-ev-none-frozen', 71, 'none, frozen', '14'),
      ev('e-ev-none-hex', 71, 'none, hexagonal', '2'),
      ev('e-ev-none-mw', 71, 'none, module-wiring', '1'),
      ev('e-ev-none-ddd', 71, 'none, DDD', '4'),
      ev('e-ev-metrics', 75, 'coupling metrics on the literal view (frozen literal templates that are neither layer nor cycle rules)', 'five'),
      ev('e-ev-metrics-add', 88, 'coupling templates (addendum)', 'five'),
      ev('e-ev-readers', 84, 'IMPORTS readers outside the templates that now drop viaReExport edges', 'four'),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-ev-code', `
const R = process.cwd();
const { TEMPLATE_EDGE_VIEWS } = await import(R + '/src/fitness-compiler/edge-views.ts');
const { CYPHER_TEMPLATES } = await import(R + '/src/fitness-compiler/cypher-templates.ts');
const { V13_EXTENSION_TEMPLATE_CATALOGUES: C } = await import(R + '/src/fitness-compiler/extension-templates.ts');
const cat = (name) => CYPHER_TEMPLATES.has(name) ? 'frozen' : C.get('hexagonal').has(name) ? 'hex' : C.get('module-wiring').has(name) ? 'mw' : C.get('ddd').has(name) ? 'ddd' : 'other';
const rows = [...TEMPLATE_EDGE_VIEWS].map(([name, e]) => ({ name, view: e.view, cat: cat(name), reason: e.reason }));
console.log(JSON.stringify(rows));
`);
      const c = (view, cat) => String(r.filter((x) => x.view === view && (cat === undefined || x.cat === cat)).length);
      const metrics = r.filter((x) => x.cat === 'frozen' && x.view === 'literal' && !/^(layer-direction|layer-skip|cycle) rule/.test(x.reason)).length;
      const readers = ['src/scoring-engine/universal-metrics.ts', 'src/neo4j-ingestion/drift-detector.ts', 'src/llm-critic/judge-graph.ts', 'src/report/graph-data-builder.ts']
        .filter((f) => /viaReExport|apg-edge-view/.test(ctx.read(f))).length;
      return {
        'e-ev-names': String(r.length), 'e-ev-lit': c('literal'), 'e-ev-lit-frozen': c('literal', 'frozen'), 'e-ev-lit-hex': c('literal', 'hex'), 'e-ev-lit-ddd': c('literal', 'ddd'),
        'e-ev-res': c('resolved'), 'e-ev-res-frozen': c('resolved', 'frozen'), 'e-ev-res-ddd': c('resolved', 'ddd'),
        'e-ev-none': c('none'), 'e-ev-none-frozen': c('none', 'frozen'), 'e-ev-none-hex': c('none', 'hex'), 'e-ev-none-mw': c('none', 'mw'), 'e-ev-none-ddd': c('none', 'ddd'),
        'e-ev-metrics': WORDS[metrics], 'e-ev-metrics-add': WORDS[metrics], 'e-ev-readers': WORDS[readers],
      };
    },
  },
  {
    id: 'e-ffp05-scan',
    title: 'FF-P05 signature branch (in-memory mirror) on APG v2 extractions of the clean-architecture, nestjs, layered and hexagonal variants',
    needs: 'offline', basis: 'regenerated', slow: true,
    how: 'ffp05SignatureEntity(memGraph(extractAPG(variant, V13_APG2_OPTIONS))) per reference variant, as tests/unit/fitness-compiler/v13-ffp05-signature.test.ts does',
    numbers: [
      p5('e-p5-variants', 72, 'variants scanned', '56'),
      p5('e-p5-rows', 73, 'signature-branch rows over the scan (nestjs v09)', 'one'),
      p5('e-p5-misses', 25, 'FF-P05 dev-set misses (false negatives) in the after-member-facts live run', 'Two', { basis: 're-derived', how: 'sum of FF-P05 fn over the styles of results/v1.3-reference/after-member-facts/report.json' }),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-ffp05-scan', `
import * as fs from 'node:fs';
const R = process.cwd();
const { ffp05SignatureEntity } = await import(R + '/src/fitness-compiler/v13-signature-types.ts');
const { memGraph } = await import(R + '/src/fitness-compiler/apg2-in-memory.ts');
const { bindLayerParams } = await import(R + '/src/fitness-compiler/layer-binding.ts');
const { extractAPG, V13_APG2_OPTIONS } = await import(R + '/src/apg-extractor/index.ts');
const { parseSpec } = await import(R + '/src/spec-parser/spec-parser.ts');
const { loadReference } = await import(R + '/scripts/v1.3/lib/reference-model.ts');
const { makeTempRoot, materialiseVariant } = await import(R + '/scripts/v1.3/lib/materialise.ts');
const work = makeTempRoot('rep2-e-ffp05-');
let variants = 0; const rows = [];
try {
  for (const style of ['clean-architecture', 'nestjs', 'layered', 'hexagonal']) {
    const ref = loadReference(R, style);
    const p = await parseSpec({ specFilePath: ref.specPath });
    const lm = p.data.layerModel; const b = bindLayerParams(lm.layers);
    for (const v of ref.variants) {
      variants++;
      const m = materialiseVariant(ref, v, work);
      const apg = await extractAPG(m.projectDir, V13_APG2_OPTIONS);
      if (!apg.success) throw new Error('extract failed');
      for (const r of ffp05SignatureEntity(memGraph(apg.data, lm), { ...(b.controllerLayer !== undefined ? { controllerLayer: b.controllerLayer } : {}), ...(b.domainLayer !== undefined ? { domainLayer: b.domainLayer } : {}) }))
        rows.push({ style, variant: v.manifest.variant, ...r });
    }
  }
} finally { fs.rmSync(work, { recursive: true, force: true }); }
console.log(JSON.stringify({ variants, rows }));
`);
      const only = r.rows.length === 1 && r.rows[0].style === 'nestjs' && r.rows[0].variant.startsWith('v09');
      const fn = ctx.json('results/v1.3-reference/after-member-facts/report.json').metrics.flatMap((m) => m.rules).filter((x) => x.ruleId === 'FF-P05').reduce((t, x) => t + x.fn, 0);
      return { 'e-p5-misses': ['No', 'One', 'Two', 'Three'][fn] ?? String(fn), 'e-p5-variants': String(r.variants), 'e-p5-rows': only ? 'one' : `${r.rows.length} (${r.rows.map((x) => `${x.style} ${x.variant}`).join(', ')})` };
    },
  },
  {
    id: 'e-apg2-code',
    title: 'APG v2 constants stated by the design doc (origin walk depth, type walk depth, apg2Params defaults)',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'src/apg-extractor/apg2/common.ts (originOfValue), type-flow.ts (MAX_DEPTH), apg2Params(layered layer model)',
    numbers: [
      ad('e-ad-origin-depth', 66, 'originOfValue walk bound', '6'),
      ad('e-ad-type-depth', 84, 'declarationsOfType depth limit', '4'),
      ad('e-ad-threshold', 251, 'apg2Params default threshold', '0.7'),
      ad('e-ad-mintypes', 251, 'apg2Params default minTypes', '4'),
      ad('e-ad-enrich', 12, 'generic enrichments', 'five', { needs: 'not-checkable', note: 'a design enumeration (the table rows 1, 2, 2b, 4, 5); no artefact counts enrichments' }),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-apg2-code', `
const R = process.cwd();
const { apg2Params } = await import(R + '/src/fitness-compiler/apg2-in-memory.ts');
const { parseSpec } = await import(R + '/src/spec-parser/spec-parser.ts');
const p = await parseSpec({ specFilePath: R + '/presets/layered.yaml' });
const a = apg2Params(p.data.layerModel);
console.log(JSON.stringify({ threshold: a.threshold, minTypes: a.minTypes }));
`);
      const origin = /export function originOfValue[^{]*\{\s*if \(depth > (\d+)\) return undefined;/.exec(ctx.read('src/apg-extractor/apg2/common.ts'));
      const type = /const MAX_DEPTH = (\d+);/.exec(ctx.read('src/apg-extractor/apg2/type-flow.ts'));
      return { 'e-ad-origin-depth': origin?.[1] ?? 'not found', 'e-ad-type-depth': type?.[1] ?? 'not found', 'e-ad-threshold': String(r.threshold), 'e-ad-mintypes': String(r.minTypes) };
    },
  },
  {
    id: 'e-apg2-live',
    title: 'APG v2 live run (before the scope change) row counts, re-derived from the committed raw rows',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'npx tsx scripts/v1.3/apg2-live.ts (needs Neo4j); here: counts over Docs/DiagnosticRuns/apg2-live-2026-10-15/{reference-live,fixtures-live}.json',
    numbers: [
      ad('e-ad-live-fixtures', 260, 'ablation projects with Cypher and mirrors equal row for row', '7'),
      ad('e-ad-live-variants', 260, 'dev variants with Cypher and mirrors equal row for row', '71'),
      sc('e-sc-main-per-ddd', 20, 'src/main.ts deep-import-declared-api rows on every DDD variant', '9'),
      sc('e-sc-acl', 21, 'additional deep-import-declared-api row from the DDD ACL (n01)', 'one'),
      sc('e-sc-n02', 22, 'boundary-type-leak rows from the hexagonal test composition root (n02)', 'a'),
      sc('e-sc-cn', 88, 'clean and near-miss variants', '19'),
      sc('e-sc-block-before', 90, 'blocking rows on clean and near-miss variants, before', '29'),
      sc('e-sc-block-pred', 90, 'blocking rows predicted after (before minus the rows the changes remove)', '0'),
      sc('e-sc-main-rows', 90, 'src/main.ts rows among them', '27'),
      sc('e-sc-adv-before', 91, 'advisory rows on clean and near-miss variants, before', '40'),
      sc('e-sc-adv-pred', 91, 'advisory rows predicted after (before minus the main-sequence-on-layer and layered n03 rows)', '21'),
      sc('e-sc-msd-layers', 91, 'main-sequence rows on layer components', '15'),
      sc('e-sc-msd-clean', 91, 'main-sequence rows, clean-architecture domain', '×4'),
      sc('e-sc-msd-hex', 91, 'main-sequence rows, hexagonal domain and config', '×4 each'),
      sc('e-sc-msd-ddd', 91, 'main-sequence rows, DDD domain', '×3'),
      sc('e-sc-n03', 91, 'layered n03 inferred-API rows', '4'),
      sc('e-sc-clock', 91, 'nondeterminism-in-core rows kept', '18'),
      sc('e-sc-ordering', 91, 'DDD ordering module main-sequence distance and row count', 'D = 0.71 ×3'),
      sc('e-sc-main-viol', 92, 'main.ts rows on each DDD violation variant', '9'),
      sc('e-sc-ddd-viol', 92, 'DDD violation variants', '12'),
      sc('e-sc-adp-viol', 92, 'violation variants with layer-level ADP rows', '16'),
      sc('e-sc-note-pred', 3, 'the "predicted" counts restated in the note', '0 blocking, 21 advisory'),
    ],
    async run(ctx) {
      const d = ctx.json(`${LIVE}/reference-live.json`);
      const f = ctx.json(`${LIVE}/fixtures-live.json`);
      const fixturesEqual = Object.values(f.projects).filter((p) => p.templates.every((t) => t.multisetEqual && t.orderEqual)).length;
      const cn = d.filter((x) => x.kind === 'clean' || x.kind === 'near-miss');
      const rowsOf = (xs, pred) => xs.flatMap((x) => x.apg2Rows.filter(pred).map((r) => ({ ...r, style: x.style, variant: x.variant })));
      const main = (x) => x.apg2Rows.filter((r) => r.template === 'deep-import-declared-api' && r.filePath === 'src/main.ts').length;
      const ddd = d.filter((x) => x.style === 'ddd');
      const perDdd = [...new Set(ddd.map(main))];
      const n01 = ddd.find((x) => x.variant.startsWith('n01'));
      const blocking = rowsOf(cn, (r) => r.tier === 'blocking');
      const advisory = rowsOf(cn, (r) => r.tier === 'advisory');
      const mainRows = blocking.filter((r) => r.filePath === 'src/main.ts').length;
      const aclRow = n01.apg2Rows.filter((r) => r.template === 'deep-import-declared-api' && r.filePath !== 'src/main.ts').length;
      const n02 = blocking.filter((r) => r.style === 'hexagonal' && r.variant.startsWith('n02')).length;
      const msdL = advisory.filter((r) => r.template === 'component-main-sequence-distance' && r.kind === 'layer');
      const msd = (st, comp) => msdL.filter((r) => r.style === st && r.component === comp).length;
      const n03 = advisory.filter((r) => r.style === 'layered' && r.variant.startsWith('n03') && r.template === 'deep-import-inferred-api').length;
      const clock = advisory.filter((r) => r.template === 'nondeterminism-in-core').length;
      const ord = advisory.filter((r) => r.template === 'component-main-sequence-distance' && r.component === 'ordering');
      const dddViol = ddd.filter((x) => x.kind === 'violation');
      const mv = [...new Set(dddViol.map(main))];
      const adp = d.filter((x) => x.kind === 'violation' && x.apg2Rows.some((r) => r.template === 'component-adp-cycle' && r.kind === 'layer')).length;
      const predB = blocking.length - mainRows - aclRow - n02;
      const predA = advisory.length - msdL.length - n03;
      return {
        'e-ad-live-fixtures': String(fixturesEqual), 'e-ad-live-variants': String(d.filter((x) => x.mirrorEqual).length),
        'e-sc-main-per-ddd': perDdd.length === 1 ? String(perDdd[0]) : perDdd.join('/'),
        'e-sc-acl': WORDS[aclRow], 'e-sc-cn': String(cn.length), 'e-sc-n02': n02 === 1 ? 'a' : String(n02),
        'e-sc-block-before': String(blocking.length), 'e-sc-block-pred': String(predB), 'e-sc-main-rows': String(mainRows),
        'e-sc-adv-before': String(advisory.length), 'e-sc-adv-pred': String(predA), 'e-sc-msd-layers': String(msdL.length),
        'e-sc-msd-clean': `×${msd('clean-architecture', 'domain')}`,
        'e-sc-msd-hex': msd('hexagonal', 'domain') === msd('hexagonal', 'config') ? `×${msd('hexagonal', 'domain')} each` : `×${msd('hexagonal', 'domain')} and ×${msd('hexagonal', 'config')}`,
        'e-sc-msd-ddd': `×${msd('ddd', 'domain')}`, 'e-sc-n03': String(n03), 'e-sc-clock': String(clock),
        'e-sc-ordering': `D = ${[...new Set(ord.map((r) => r.distance.toFixed(2)))].join('/')} ×${ord.length}`,
        'e-sc-main-viol': mv.length === 1 ? String(mv[0]) : mv.join('/'), 'e-sc-ddd-viol': String(dddViol.length), 'e-sc-adp-viol': String(adp),
        'e-sc-note-pred': `${predB} blocking, ${predA} advisory`,
      };
    },
  },
  {
    id: 'e-apg2-hash',
    title: 'APG v2 byte identity of the v1.2E / v1.3 extraction on the repo fixtures, re-derived from the committed hash record',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'Docs/DiagnosticRuns/apg2-ablation-2026-10-15/byte-identity.json (two scripts/apg-hash.ts runs, origin/v1.3 and the branch; the hashes embed the author\'s checkout path, so they cannot be regenerated elsewhere: audit C-4)',
    numbers: [
      ad('e-ad-hash-projects', 34, 'fixture projects hashed', '21'),
      ad('e-ad-hash-identical', 34, 'hashes identical before and after (projects x two option sets)', '42'),
    ],
    async run(ctx) {
      const b = ctx.json('Docs/DiagnosticRuns/apg2-ablation-2026-10-15/byte-identity.json');
      const keys = Object.keys(b.before);
      const same = keys.flatMap((k) => Object.keys(b.before[k]).filter((o) => b.after?.[k]?.[o] === b.before[k][o])).length;
      return { 'e-ad-hash-projects': String(keys.length), 'e-ad-hash-identical': String(same) };
    },
  },
  {
    id: 'e-apg2-ablation',
    title: 'APG v2 ablation fixtures: planted and near-miss case counts (regenerated at HEAD)',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'npx tsx scripts/apg2-ablation.ts (in a HEAD export; exits 1 at HEAD because CP4 and CP5 fail, audit C-1; the case counts are unaffected)',
    numbers: [
      sc('e-sc-abl-planted', 94, 'planted cases in the ablation fixtures', '27'),
      sc('e-sc-abl-nearmiss', 94, 'near-misses in the ablation fixtures', '19'),
    ],
    async run(ctx) {
      const tree = ctx.tree();
      try { ctx.sh('npx tsx scripts/apg2-ablation.ts', { cwd: tree }); } catch { /* exits 1 while CP4/CP5 fail at HEAD */ }
      const a = JSON.parse(readFileSync(join(tree, 'Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json'), 'utf8'));
      return { 'e-sc-abl-planted': String(a.filter((c) => c.kind === 'planted').length), 'e-sc-abl-nearmiss': String(a.filter((c) => c.kind === 'near-miss').length) };
    },
  },
  {
    id: 'e-adr02',
    title: 'ADR-V13-02 draft: layered preset, applicability table and the U-E baseline FF-P06 false positives',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'presets/layered.yaml (parseSpec), V13_STYLE_APPLICABILITY, results/v1.3-reference/baseline-pre-barrel/scores.json (author-literal view; ue-score.ts needs the sealed blind manifests outside the repo to regenerate it)',
    numbers: [
      a2('e-a2-layers', 11, 'layers of the layered preset', 'three'),
      a2('e-a2-fp', 13, 'FF-P06 layered blocking false positives of all author-view blocking false positives (all styles)', '53 of the 60'),
      a2('e-a2-distinct', 13, 'distinct FF-P06 rows', '5'),
      a2('e-a2-layers-b', 31, 'layers of the layered preset (option B)', 'three'),
      a2('e-a2-styles', 42, 'styles V13_STYLE_APPLICABILITY maps domain-state-purity to', 'four'),
      a2('e-a2-rows', 48, 'FF-P06 rows in layered', '53'),
      a2('e-a2-layers-c', 49, 'layers of the current binding', 'three'),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-adr02', `
const R = process.cwd();
const { parseSpec } = await import(R + '/src/spec-parser/spec-parser.ts');
const { V13_STYLE_APPLICABILITY } = await import(R + '/src/fitness-compiler/v13-applicability.ts');
const p = await parseSpec({ specFilePath: R + '/presets/layered.yaml' });
console.log(JSON.stringify({ layers: p.data.layerModel.layers.length, styles: V13_STYLE_APPLICABILITY.get('domain-state-purity').styles.length }));
`);
      const s = ctx.json('results/v1.3-reference/baseline-pre-barrel/scores.json');
      const views = s.views.filter((v) => v.view === 'author-literal');
      const total = views.reduce((t, v) => t + v.blocking.fp, 0);
      const p06 = views.find((v) => v.style === 'layered').perRule.find((x) => x.ruleId === 'FF-P06').counts;
      return {
        'e-a2-layers': WORDS[r.layers], 'e-a2-layers-b': WORDS[r.layers], 'e-a2-layers-c': WORDS[r.layers], 'e-a2-styles': WORDS[r.styles],
        'e-a2-fp': `${p06.fp} of the ${total}`, 'e-a2-distinct': String(p06.fpDistinct), 'e-a2-rows': String(p06.fp),
      };
    },
  },
];
