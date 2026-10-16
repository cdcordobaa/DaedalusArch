// Cheap semantic proxies: the cheap-fix before/after re-run (fieldstate-cheapfix Part B) and the facts stated in
// Docs/v1.3/cheap-semantics-design.md (batch 1 and batch 2), regenerated with judge-catch-seed.ts, cheap-semantics-eval.ts
// (--before and defaults), cheapfix-e1-qualification.ts and cheap2-eval.ts, or re-derived from the committed
// results/v1.3-cheap-semantics, results/v1.3-cheap2, results/v1.3-judge-catch/duprule-v2 and src/apg-enrich/cheap.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FS = 'Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md';
const DD = 'Docs/v1.3/cheap-semantics-design.md';
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const kn = (cell) => cell.split(' = ')[0];

// One seeding and the two evaluations, shared by every group of this file within one runner process.
let runs;
function cheapRuns(ctx) {
  if (runs) return runs;
  const w = ctx.out('c-cheap-runs');
  ctx.sh(`npx tsx scripts/v1.3/judge-catch-seed.ts --out "${w}/seed"`);
  ctx.sh(`npx tsx scripts/v1.3/cheap-semantics-eval.ts --out "${w}/before" --seed "${w}/seed" --work "${w}/wb" --before`);
  ctx.sh(`npx tsx scripts/v1.3/cheap-semantics-eval.ts --out "${w}/after" --seed "${w}/seed" --work "${w}/wa"`);
  // The committed cheapfix outputs must come back identical (scores.json without its wall-clock fields).
  const strip = (o) => JSON.stringify(o, (k, v) => (k === 'generatedAt' || k === 'totalMs' || k === 'extractMs' || k === 'timingsMs' ? undefined : v));
  const drift = [];
  for (const [mine, theirs] of [['before', 'cheapfix-before'], ['after', 'cheapfix-after']]) {
    if (ctx.read(join(w, mine, 'rows.csv')) !== ctx.read(`results/v1.3-cheap-semantics/${theirs}/rows.csv`)) drift.push(`${theirs}/rows.csv`);
    for (const f of ctx.ls(`results/v1.3-cheap-semantics/${theirs}/flags`)) if (ctx.read(join(w, mine, 'flags', f)) !== ctx.read(`results/v1.3-cheap-semantics/${theirs}/flags/${f}`)) drift.push(`${theirs}/flags/${f}`);
    if (strip(ctx.json(join(w, mine, 'scores.json'))) !== strip(ctx.json(`results/v1.3-cheap-semantics/${theirs}/scores.json`))) drift.push(`${theirs}/scores.json`);
  }
  if (drift.length) throw new Error(`regenerated cheap-fix outputs differ from the committed ones: ${drift.join(', ')}`);
  runs = { before: ctx.json(join(w, 'before', 'scores.json')), after: ctx.json(join(w, 'after', 'scores.json')) };
  return runs;
}

// ---- Part B (fieldstate-cheapfix) --------------------------------------------------------------------------------
const CLEAN = [['clean-architecture/clean', 202], ['layered/clean', 203], ['nestjs/clean', 204], ['hexagonal/clean', 205], ['ddd/clean', 206]];
const B4 = {
  'clean-architecture/clean': ['0', '2', '2 (1)'], 'layered/clean': ['2', '6', '4 (2)'], 'nestjs/clean': ['2', '2', '0'],
  'hexagonal/clean': ['0', '0', '0'], 'ddd/clean': ['6', '8', '2 (1)'], total: ['10', '18', '8 (4 pairs)'],
};
const B3 = [
  ['dup-catch', 164, 'AP-DUP-RULE seed catch, clones (primary)', '1/1'],
  ['dup-twin', 165, 'AP-DUP-RULE twin false flag', '0/1'],
  ['dup-clean', 166, 'AP-DUP-RULE clean false flag', '0/1'],
  ['pooled-catch', 167, 'pooled catch, primary', '11/11 = 1.00 [0.74, 1.00]'],
  ['pooled-twin', 168, 'pooled twin false flag, primary', '2/42 = 0.05 [0.01, 0.16] (paired 0/42)'],
  ['pooled-clean', 169, 'pooled clean false flag, primary', '0/11'],
];
const numbersB = [
  ...B3.flatMap(([id, line, what, v]) => ['before', 'after'].map((ph) => ({ id: `c-cf-${id}-${ph}`, line, what: `${what} (${ph})`, stated: v }))),
  { id: 'c-cf-seeds-ops', line: 167, what: 'seeds and operators in the pooled catch', stated: '11 seeds, 5 operators' },
  { id: 'c-cf-twins', line: 168, what: 'twins in the pooled twin false flag', stated: '42 twins' },
  { id: 'c-cf-other-ops', line: 171, what: 'operators other than AP-DUP-RULE, identical before and after', stated: 'other four operators' },
  { id: 'c-cf-one-seed', line: 172, what: 'AP-DUP-RULE seeds in this set', stated: 'only one DUP-RULE seed' },
  { id: 'c-cf-nest-guard', line: 173, what: 'guards in the antipattern-nest base (all trivial, excluded)', stated: 'one guard' },
  { id: 'c-cf-e1-seeds', line: 175, what: 'E1 seeds of the AP-DUP-RULE v2 run', stated: '8 E1 seeds', basis: 're-derived' },
  { id: 'c-cf-misses', line: 175, what: 'v2 run clones misses (results/v1.3-cheap-semantics/duprule-v2 combined catch 1/9)', stated: '8 of 9 misses', basis: 're-derived' },
  { id: 'c-cf-e1-cells', line: 175, what: 'accepted E1 cells (seed-manifest e1Cells)', stated: '65 E1 cells', basis: 're-derived' },
  { id: 'c-cf-units-before', line: 191, what: 'copied rules that were clone units before', stated: '4/9 rules were units' },
  { id: 'c-cf-v2-catch', line: 191, what: 'v2 run clones catch', stated: '1/9', basis: 're-derived' },
  { id: 'c-cf-units-after', line: 192, what: 'copied rules that are clone units after', stated: '9/9 rules are units' },
  { id: 'c-cf-excl-hit', line: 192, what: 'copied rules hitting the exclusion rule', stated: 'None hits the exclusion rule' },
  { id: 'c-cf-edge-rules', line: 193, what: 'rules with a same-component edge in clone-diagnostic.posthoc.json', stated: 'The 3 rules', basis: 're-derived' },
  { id: 'c-cf-bare-guards', line: 193, what: 'bare-guard rules (no fragment unit before)', stated: 'The 5 bare guards' },
  { id: 'c-cf-projected', line: 193, what: 'projected clones catch after vs before', stated: '9/9 against 1/9' },
  ...CLEAN.flatMap(([p, line]) => ['before', 'after', 'new'].map((c, i) => ({ id: `c-cf-b4-${p.split('/')[0]}-${c}`, line, what: `B.4 clones flags, ${p}: ${c}`, stated: B4[p][i] }))),
  ...['before', 'after', 'new'].map((c, i) => ({ id: `c-cf-b4-total-${c}`, line: 207, what: `B.4 clones flags, total of 5 clean: ${c}`, stated: B4.total[i] })),
  { id: 'c-cf-guard-units', line: 210, what: 'guard units on the 5 clean projects', stated: '25 guard units' },
  { id: 'c-cf-guard-pairs', line: 210, what: 'guard pairs on the 5 clean projects', stated: '0 guard pairs' },
  { id: 'c-cf-trivial', line: 210, what: 'trivial checks excluded on the 5 clean projects', stated: '15 trivial checks excluded' },
  { id: 'c-cf-n03', line: 211, what: 'nestjs/n03 clones flags before and after', stated: '`nestjs/n03` has 4 before and 4 after' },
  { id: 'c-cf-viol-new', line: 217, what: 'new clones flags on violation variants against the clean base', stated: 'One new flag appears' },
  { id: 'c-cf-19', line: 218, what: 'clean and near-miss projects in the precision table', stated: '19 clean and near-miss projects' },
  { id: 'c-cf-36-66', line: 218, what: 'clones flags on the 19 projects, before to after', stated: 'from 36 to 66' },
  { id: 'c-cf-added-kind', line: 218, what: 'kind of every added flag', stated: 'Every added flag is `same-component-*`, and none is a guard' },
  { id: 'c-cf-bare-misses', line: 222, what: 'bare-guard misses fixed', stated: 'the 5 bare-guard misses' },
  { id: 'c-cf-guard-pairs-nm', line: 222, what: 'guard pairs on clean projects and near-misses', stated: '0 guard pairs on 5 clean projects and 14 near-misses' },
  { id: 'c-cf-trivial-2', line: 222, what: 'trivial checks removed by the exclusion rule', stated: '15 trivial checks' },
  { id: 'c-cf-edge-misses', line: 223, what: '"edge but no flag" misses', stated: 'the 3 "edge but no flag" misses', basis: 're-derived' },
  { id: 'c-cf-cost', line: 223, what: 'cost of same-component flags on the 5 clean projects', stated: '8 flags (4 pairs) on the 5 clean projects' },
].map((n) => ({ doc: FS, ...n }));

function partB(ctx) {
  const { before: B, after: A } = cheapRuns(ctx);
  const r = {};
  const op = (S) => S.perOperator['AP-DUP-RULE'];
  for (const [ph, S] of [['before', B], ['after', A]]) {
    r[`c-cf-dup-catch-${ph}`] = kn(op(S).catchPrimary);
    r[`c-cf-dup-twin-${ph}`] = kn(op(S).twinFalsePrimary);
    r[`c-cf-dup-clean-${ph}`] = kn(op(S).cleanFalsePrimary);
    r[`c-cf-pooled-catch-${ph}`] = S.pooled.catchPrimary;
    r[`c-cf-pooled-twin-${ph}`] = `${S.pooled.twinFalsePrimary} (paired ${kn(S.pooled.twinFalsePrimaryPaired)})`;
    r[`c-cf-pooled-clean-${ph}`] = kn(S.pooled.cleanFalsePrimary);
  }
  const ops = Object.keys(A.perOperator);
  const seeds = ops.reduce((a, o) => a + Number(A.perOperator[o].seeds), 0);
  const twins = ops.reduce((a, o) => a + Number(A.perOperator[o].twins), 0);
  r['c-cf-seeds-ops'] = `${seeds} seeds, ${ops.length} operators`;
  r['c-cf-twins'] = `${twins} twins`;
  const others = ops.filter((o) => o !== 'AP-DUP-RULE');
  const same = others.every((o) => JSON.stringify(A.perOperator[o]) === JSON.stringify(B.perOperator[o]));
  r['c-cf-other-ops'] = same ? `other ${WORD[others.length]} operators` : 'other operators differ before/after';
  r['c-cf-one-seed'] = `only ${WORD[Number(op(A).seeds)]} DUP-RULE seed`;
  const fb = A.fixtureBase.summaries.clones;
  r['c-cf-nest-guard'] = fb.guardUnits === 0 ? `${WORD[fb.excludedTrivialGuards]} guard` : `${fb.guardUnits} kept + ${fb.excludedTrivialGuards} excluded guards`;
  // v2 run (committed) and qualification of the copied rules
  const v2 = ctx.json('results/v1.3-cheap-semantics/duprule-v2/scores.json').table;
  r['c-cf-e1-seeds'] = `${v2.e1.seeds} E1 seeds`;
  const cc = v2.combined.clones.catch;
  r['c-cf-misses'] = `${cc.n - cc.k} of ${cc.n} misses`;
  r['c-cf-v2-catch'] = `${cc.k}/${cc.n}`;
  r['c-cf-e1-cells'] = `${ctx.json('results/v1.3-judge-catch/duprule-v2/seed-manifest.json').e1Cells} E1 cells`;
  const q = ctx.sh('npx tsx scripts/v1.3/cheapfix-e1-qualification.ts').trim().split('\n').map((l) => l.split(' | '));
  const n = q.length;
  const frag = q.filter((x) => x[2] === 'fragment=true').length;
  const unitAfter = q.filter((x) => x[2] === 'fragment=true' || (x[3] === 'guard=true' && x[4] === 'excluded=false')).length;
  const excl = q.filter((x) => x[4] === 'excluded=true').length;
  r['c-cf-units-before'] = `${frag}/${n} rules were units`;
  r['c-cf-units-after'] = `${unitAfter}/${n} rules are units`;
  r['c-cf-excl-hit'] = excl === 0 ? 'None hits the exclusion rule' : `${excl} hit the exclusion rule`;
  const ph = ctx.json('results/v1.3-cheap-semantics/duprule-v2/clone-diagnostic.posthoc.json');
  const edgeOnly = ph.filter((x) => x.sameLogicEdges.length > 0 && x.sameLogicEdges.every((e) => !e.crossComponent)).length;
  r['c-cf-edge-rules'] = `The ${edgeOnly} rules`;
  r['c-cf-edge-misses'] = `the ${edgeOnly} "edge but no flag" misses`;
  r['c-cf-bare-guards'] = `The ${n - frag} bare guards`;
  r['c-cf-bare-misses'] = `the ${n - frag} bare-guard misses`;
  r['c-cf-projected'] = `${unitAfter}/${n} against ${cc.k}/${cc.n}`;
  // B.4 precision
  const prec = (S, p) => S.precision.find((x) => x.project === p);
  let tb = 0; let ta = 0; let tp = 0; let gu = 0; let gp = 0; let ex = 0;
  for (const [p] of CLEAN) {
    const b = prec(B, p).flags.clones; const a = prec(A, p).flags.clones; const pairs = prec(A, p).summaries.clones.sameComponentPairs;
    const s = p.split('/')[0];
    r[`c-cf-b4-${s}-before`] = String(b); r[`c-cf-b4-${s}-after`] = String(a);
    r[`c-cf-b4-${s}-new`] = a - b === 0 ? '0' : `${a - b} (${pairs})`;
    tb += b; ta += a; tp += pairs;
    const sc = prec(A, p).summaries.clones; gu += sc.guardUnits; gp += sc.guardPairs; ex += sc.excludedTrivialGuards;
  }
  r['c-cf-b4-total-before'] = String(tb); r['c-cf-b4-total-after'] = String(ta); r['c-cf-b4-total-new'] = `${ta - tb} (${tp} pairs)`;
  r['c-cf-cost'] = `${ta - tb} flags (${tp} pairs) on the ${CLEAN.length} clean projects`;
  r['c-cf-guard-units'] = `${gu} guard units`; r['c-cf-guard-pairs'] = `${gp} guard pairs`;
  r['c-cf-trivial'] = `${ex} trivial checks excluded`; r['c-cf-trivial-2'] = `${ex} trivial checks`;
  const n03 = 'nestjs/n03-service-injects-sibling-service';
  r['c-cf-n03'] = `\`nestjs/n03\` has ${prec(B, n03).flags.clones} before and ${prec(A, n03).flags.clones} after`;
  const cnt = (S) => S.violations.reduce((a, v) => a + v.newFlags.filter((f) => f.startsWith('clones:')).length, 0);
  const nv = cnt(A) - cnt(B);
  r['c-cf-viol-new'] = `${nv === 1 ? 'One' : nv} new flag${nv === 1 ? '' : 's'} appear${nv === 1 ? 's' : ''}`;
  r['c-cf-19'] = `${A.precision.length} clean and near-miss projects`;
  const sum = (S) => S.precision.reduce((a, x) => a + x.flags.clones, 0);
  r['c-cf-36-66'] = `from ${sum(B)} to ${sum(A)}`;
  // added flags: multiset difference of (project, kind) between after and before
  const kinds = (S) => S.precision.flatMap((x) => x.flagList.filter((f) => f.proxy === 'clones').map((f) => `${x.project}|${f.kind}|${f.where}`));
  const bk = kinds(B); const added = kinds(A).filter((k) => { const i = bk.indexOf(k); if (i >= 0) { bk.splice(i, 1); return false; } return true; });
  const allSame = added.every((k) => k.split('|')[1].startsWith('same-component-'));
  const anyGuard = added.some((k) => k.split('|')[1].endsWith('-guard'));
  r['c-cf-added-kind'] = allSame && !anyGuard ? 'Every added flag is `same-component-*`, and none is a guard' : `added kinds: ${[...new Set(added.map((k) => k.split('|')[1]))].join(', ')}`;
  const nm = A.precision.filter((x) => x.kind === 'near-miss');
  const nmPairs = nm.reduce((a, x) => a + x.summaries.clones.guardPairs, 0);
  r['c-cf-guard-pairs-nm'] = `${gp + nmPairs} guard pairs on ${CLEAN.length} clean projects and ${nm.length} near-misses`;
  return r;
}

// ---- cheap-semantics-design.md: batch 1 facts ---------------------------------------------------------------------
const COMPONENT_PROBE = `
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
const R = process.argv[2];
const imp = (p: string) => import(pathToFileURL(path.join(R, p)).href);
void (async () => {
  const { loadAllReferences } = await imp('scripts/v1.3/lib/reference-model.ts');
  const { materialiseVariant, makeTempRoot } = await imp('scripts/v1.3/lib/materialise.ts');
  const { parseSpec, specExcludePathsFromYaml } = await imp('src/spec-parser/index.ts');
  const { extractAndEnrich } = await imp('src/apg-enrich/cheap/index.ts');
  const { componentOf } = await imp('src/apg-enrich/cheap/context.ts');
  const { densityOf } = await imp('src/apg-enrich/cheap/behaviour.ts');
  const { Project, SyntaxKind } = await import(pathToFileURL(path.join(R, 'node_modules/ts-morph/dist/ts-morph.js')).href);
  const work = makeTempRoot('rep2-c-comp-');
  const comps: Record<string, Record<string, number>> = {};
  let ids = 0; let badIds = 0;
  for (const ref of loadAllReferences(R)) {
    const v = ref.variants.find((x: any) => x.manifest.kind === 'clean');
    const root = fs.realpathSync(materialiseVariant(ref, v, work).projectDir);
    const lm = (await parseSpec({ specFilePath: ref.specPath })).data.layerModel;
    const r = await extractAndEnrich(root, { layerModel: lm, extractorOptions: { excludePatterns: specExcludePathsFromYaml(fs.readFileSync(ref.specPath, 'utf8')) }, options: { proxies: ['doc-text'] } });
    const by: Record<string, number> = {};
    for (const n of r.apg.nodes) { ids++; if (!/^[0-9a-f]{16}$/.test(n.id)) badIds++; }
    for (const n of r.apg.nodes.filter((x: any) => x.type === 'File')) {
      const p = String(n.filePath ?? n.properties?.filePath ?? n.name); const rel = path.isAbsolute(p) ? path.relative(root, p) : p;
      const c = componentOf(rel, lm); by[c] = (by[c] ?? 0) + 1;
    }
    comps[ref.style] = by;
  }
  fs.rmSync(work, { recursive: true, force: true });
  const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', 'class C { g(x: number) { if (x <= 0) throw new Error("a"); } h(x: string | null) { if (x == null) throw new Error("b"); } }');
  const dens = sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration).map((m: any) => densityOf(m.getBody()).density);
  console.log(JSON.stringify({ comps, ids, badIds, guard: dens[0], nullCheck: dens[1] }));
})();
`;

const numbersD1 = [
  { id: 'c-dd-one-cohesion', line: 118, what: 'cohesion flags on the five clean projects', stated: 'The one clean-project flag' },
  { id: 'c-dd-five-ops', line: 120, what: 'frozen AP operators with a designated proxy', stated: 'None of the five operators' },
  { id: 'c-dd-components', line: 178, what: 'components per clean reference project and files per component (componentOf)', stated: '3 to 6 components with 1 to 16 files each' },
  { id: 'c-dd-max-leak', line: 179, what: 'maximum vocabulary leakage on the clean projects', stated: '0.40 (`hexagonal` application → domain)' },
  { id: 'c-dd-ari', line: 196, what: 'ARI against layers on the clean projects', stated: '−0.09 to 0.45' },
  { id: 'c-dd-42', line: 197, what: 'community-component-mismatch flags on the five clean projects', stated: '42 on the five clean projects' },
  { id: 'c-dd-doctext', line: 205, what: 'commented units of all units, clean projects', stated: '1 to 12 commented units of 52 to 63' },
  { id: 'c-dd-hex-ids', line: 231, what: 'APG node id format', stated: '16-hex APG ids' },
  { id: 'c-dd-guard-3', line: 132, what: 'logic density of a guard if (x <op> v) throw', stated: 'scores 3' },
  { id: 'c-dd-null-2', line: 132, what: 'logic density of null-check-and-throw', stated: 'null-check-and-throw (score 2)' },
].map((n) => ({ doc: DD, ...n }));

function designB1(ctx) {
  const A = cheapRuns(ctx).after; // HEAD defaults (cohesion, communities, vocabulary and doc-text do not depend on the cheap-fix options)
  const clean = A.precision.filter((x) => x.kind === 'clean');
  const r = {};
  const coh = clean.reduce((a, x) => a + x.flags.cohesion, 0);
  r['c-dd-one-cohesion'] = `The ${WORD[coh]} clean-project flag`;
  r['c-dd-five-ops'] = `None of the ${WORD[Object.keys(A.designated).length]} operators`;
  let best = { share: -1 };
  for (const x of clean) for (const [c, v] of Object.entries(x.summaries.vocabulary.leakage)) if (v && v.share > best.share) best = { share: v.share, from: c, to: v.to, style: x.project.split('/')[0] };
  r['c-dd-max-leak'] = `${best.share.toFixed(2)} (\`${best.style}\` ${best.from} → ${best.to})`;
  const ari = clean.map((x) => x.summaries.communities.ariLayers);
  const fm = (v) => (v < 0 ? `−${(-v).toFixed(2)}` : v.toFixed(2));
  r['c-dd-ari'] = `${fm(Math.min(...ari))} to ${fm(Math.max(...ari))}`;
  r['c-dd-42'] = `${clean.reduce((a, x) => a + x.flags.communities, 0)} on the five clean projects`;
  const wt = clean.map((x) => x.summaries['doc-text'].withText); const un = clean.map((x) => x.summaries['doc-text'].units);
  r['c-dd-doctext'] = `${Math.min(...wt)} to ${Math.max(...wt)} commented units of ${Math.min(...un)} to ${Math.max(...un)}`;
  const pf = join(ctx.out('c-cheap-design-probe'), 'probe.ts');
  writeFileSync(pf, COMPONENT_PROBE);
  const pr = JSON.parse(ctx.sh(`npx tsx "${pf}" "${ctx.repo}"`).trim().split('\n').pop());
  const nComp = Object.values(pr.comps).map((by) => Object.keys(by).length);
  const nFiles = Object.values(pr.comps).flatMap((by) => Object.values(by));
  r['c-dd-components'] = `${Math.min(...nComp)} to ${Math.max(...nComp)} components with ${Math.min(...nFiles)} to ${Math.max(...nFiles)} files each`;
  r['c-dd-hex-ids'] = pr.badIds === 0 ? '16-hex APG ids' : `${pr.badIds} of ${pr.ids} ids not 16-hex`;
  r['c-dd-guard-3'] = `scores ${pr.guard}`;
  r['c-dd-null-2'] = `null-check-and-throw (score ${pr.nullCheck})`;
  return r;
}

// ---- cheap-semantics-design.md: code constants (re-derived from src) -----------------------------------------------
const numbersCode = [
  ['shingle', 48, 'shingleSize default', 'token 3-shingle'],
  ['near', 48, 'nearCloneThreshold default', '(default 0.8)'],
  ['body-min', 50, 'cloneMinBodyTokens default', '(30, the default minimum of CCFinder)'],
  ['frag-min', 51, 'cloneMinTokens default', '(12)'],
  ['lit-min', 72, 'literalMinLength default', 'shorter than 4 characters'],
  ['lcom-breadth', 114, 'lcom4Threshold and breadthThreshold defaults', 'LCOM4 ≥ 3, or breadth ≥ 4'],
  ['density', 132, 'densityThreshold default', 'density ≥ 3'],
  ['fw-depth', 152, 'framework type search depth', 'depth ≤ 4'],
  ['term-len', 169, 'vocabulary term minimum length', 'at least 3 letters'],
  ['topk', 170, 'vocabularyTopK default', '(10)'],
  ['leak', 174, 'vocabularyLeakThreshold default and minimum components', '≥ 0.5, only when there are 3 or more components'],
  ['louvain', 190, 'louvainResolution default', '(resolution 1)'],
  ['b2-ids', 229, 'batch-2 proxy numbering (10 batch-1 + 6 batch-2)', 'Proxies 11 to 16'],
  ['b1-ten', 229, 'batch-1 proxies (PROXY_IDS)', 'the ten batch-1 proxies'],
  ['env-shared', 237, 'envSharedComponents default', '`envSharedComponents` (2)'],
  ['cc-support', 237, 'coChangeMinSupport default', '`coChangeMinSupport` (3)'],
  ['cc-conf', 237, 'coChangeMinConfidence default', '`coChangeMinConfidence` (0.5)'],
  ['cc-max', 237, 'coChangeMaxFilesPerCommit default', '`coChangeMaxFilesPerCommit` (30)'],
  ['prov', 237, 'provenance vocabulary defaults', 'concept Jaccard 0.5, member Jaccard 0.3, and at least 2 shared member terms'],
  ['env-shared-2', 381, 'envSharedComponents default', 'more than `envSharedComponents` (2) components'],
  ['cc-max-2', 399, 'coChangeMaxFilesPerCommit default', 'more than 30 files'],
  ['cc-support-2', 401, 'coChangeMinSupport default', 'support ≥ k (3)'],
  ['cc-conf-2', 403, 'coChangeMinConfidence default', 'max confidence ≥ 0.5'],
].map(([id, line, what, stated]) => ({ id: `c-dd-code-${id}`, doc: DD, line, what, stated }));

function designCode(ctx) {
  const t = ctx.read('src/apg-enrich/cheap/types.ts');
  const d = Object.fromEntries([...t.slice(t.indexOf('DEFAULT_CHEAP_OPTIONS')).split('});')[0].matchAll(/(\w+): ([\d.]+),/g)].map((m) => [m[1], m[2]]));
  const ids = (name) => t.slice(t.indexOf(`export const ${name} = [`)).split('] as const')[0].match(/'[^']+'/g).length;
  const b1 = ids('PROXY_IDS'); const b2 = ids('BATCH2_PROXY_IDS');
  const fw = ctx.read('src/apg-enrich/cheap/framework-core.ts').match(/if \(depth > (\d+)/)[1];
  const voc = ctx.read('src/apg-enrich/cheap/vocabulary.ts');
  const termLen = voc.match(/t\.length >= (\d+)/)[1]; const minN = voc.match(/N >= (\d+) &&/)[1];
  const pv = ctx.read('src/apg-enrich/cheap/provenance.ts').match(/concept: opts\.conceptThreshold \?\? ([\d.]+), member: opts\.memberThreshold \?\? ([\d.]+), minShared: opts\.minSharedMembers \?\? (\d+)/);
  return {
    'c-dd-code-shingle': `token ${d.shingleSize}-shingle`,
    'c-dd-code-near': `(default ${d.nearCloneThreshold})`,
    'c-dd-code-body-min': `(${d.cloneMinBodyTokens}, the default minimum of CCFinder)`,
    'c-dd-code-frag-min': `(${d.cloneMinTokens})`,
    'c-dd-code-lit-min': `shorter than ${d.literalMinLength} characters`,
    'c-dd-code-lcom-breadth': `LCOM4 ≥ ${d.lcom4Threshold}, or breadth ≥ ${d.breadthThreshold}`,
    'c-dd-code-density': `density ≥ ${d.densityThreshold}`,
    'c-dd-code-fw-depth': `depth ≤ ${fw}`,
    'c-dd-code-term-len': `at least ${termLen} letters`,
    'c-dd-code-topk': `(${d.vocabularyTopK})`,
    'c-dd-code-leak': `≥ ${d.vocabularyLeakThreshold}, only when there are ${minN} or more components`,
    'c-dd-code-louvain': `(resolution ${d.louvainResolution})`,
    'c-dd-code-b2-ids': `Proxies ${b1 + 1} to ${b1 + b2}`,
    'c-dd-code-b1-ten': `the ${WORD[b1]} batch-1 proxies`,
    'c-dd-code-env-shared': `\`envSharedComponents\` (${d.envSharedComponents})`,
    'c-dd-code-cc-support': `\`coChangeMinSupport\` (${d.coChangeMinSupport})`,
    'c-dd-code-cc-conf': `\`coChangeMinConfidence\` (${d.coChangeMinConfidence})`,
    'c-dd-code-cc-max': `\`coChangeMaxFilesPerCommit\` (${d.coChangeMaxFilesPerCommit})`,
    'c-dd-code-prov': `concept Jaccard ${pv[1]}, member Jaccard ${pv[2]}, and at least ${pv[3]} shared member terms`,
    'c-dd-code-env-shared-2': `more than \`envSharedComponents\` (${d.envSharedComponents}) components`,
    'c-dd-code-cc-max-2': `more than ${d.coChangeMaxFilesPerCommit} files`,
    'c-dd-code-cc-support-2': `support ≥ k (${d.coChangeMinSupport})`,
    'c-dd-code-cc-conf-2': `max confidence ≥ ${d.coChangeMinConfidence}`,
  };
}

// ---- cheap-semantics-design.md: batch 2 (cheap2-eval.ts) -----------------------------------------------------------
const numbersD2 = [
  { id: 'c-dd-b2-both', line: 305, what: 'unreachable test-support modules on clean and near-miss projects (false flags the exemption removed)', stated: 'removed both false flags' },
  { id: 'c-dd-b2-commits', line: 411, what: 'enclosing-history commits per clean reference project', stated: 'one or two commits each' },
  { id: 'c-dd-b2-none', line: 463, what: 'violation analogues with a new batch-2 flag', stated: 'batch 2 catches none' },
].map((n) => ({ doc: DD, ...n }));

export default [
  {
    id: 'c-cheapfix',
    title: 'Cheap-proxy duplicate fixes before/after (fieldstate-cheapfix Part B)',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: 'npx tsx scripts/v1.3/judge-catch-seed.ts --out W/seed; npx tsx scripts/v1.3/cheap-semantics-eval.ts --seed W/seed --out W/before --before; ... --out W/after; npx tsx scripts/v1.3/cheapfix-e1-qualification.ts; v2 figures from results/v1.3-cheap-semantics/duprule-v2',
    numbers: numbersB,
    run: (ctx) => partB(ctx),
  },
  {
    id: 'c-cheapdesign-b1',
    title: 'cheap-semantics-design.md batch-1 facts on the clean reference projects',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: 'cheap-semantics-eval.ts (HEAD defaults) on the judge-catch seeds; componentOf / densityOf / APG ids via a tsx probe on the 5 clean variants',
    numbers: numbersD1,
    run: (ctx) => designB1(ctx),
  },
  {
    id: 'c-cheapdesign-code',
    title: 'cheap-semantics-design.md: documented defaults and constants in src/apg-enrich/cheap',
    needs: 'offline',
    basis: 're-derived',
    slow: false,
    how: 'read DEFAULT_CHEAP_OPTIONS, PROXY_IDS, BATCH2_PROXY_IDS (types.ts), framework-core.ts, vocabulary.ts, provenance.ts',
    numbers: numbersCode,
    run: (ctx) => designCode(ctx),
  },
  {
    id: 'c-cheapdesign-timing',
    title: 'cheap-semantics-design.md: run times, from the committed timings',
    needs: 'offline',
    basis: 're-derived',
    slow: false,
    how: 'sum of timingsMs per project in results/v1.3-cheap-semantics/scores.json; provenance ms / snapshots in results/v1.3-cheap2/scores.json (wall-clock, not regenerable byte for byte)',
    numbers: [
      { id: 'c-dd-time-proxies', line: 9, what: 'proxy time per reference project (sum of timingsMs, 19 clean and near-miss projects)', stated: 'about 60 to 130 ms' },
      { id: 'c-dd-time-snapshot', line: 453, what: 'provenance time per snapshot (loop demo arms and synthetic fixture)', stated: 'about 0.3 to 0.5 s per snapshot' },
    ].map((n) => ({ doc: DD, ...n })),
    run(ctx) {
      const s = ctx.json('results/v1.3-cheap-semantics/scores.json');
      const t = s.precision.map((p) => Object.values(p.timingsMs).reduce((a, b) => a + b, 0));
      const c2 = ctx.json('results/v1.3-cheap2/scores.json');
      const per = [...Object.values(c2.provenance.demo).map((d) => d.ms / d.snapshots), c2.fixtures.provenance.ms / c2.provenance.synthetic.summary.snapshots].map((ms) => ms / 1000);
      return {
        'c-dd-time-proxies': `about ${Math.floor(Math.min(...t) / 10) * 10} to ${Math.ceil(Math.max(...t) / 10) * 10} ms`,
        'c-dd-time-snapshot': `about ${Math.min(...per).toFixed(1)} to ${Math.max(...per).toFixed(1)} s per snapshot`,
      };
    },
  },
  {
    id: 'c-cheapdesign-b2',
    title: 'cheap-semantics-design.md batch-2 facts (cheap2-eval.ts)',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: 'npx tsx scripts/v1.3/cheap2-eval.ts --out <scratch> --work <scratch> (run in the working tree: co-change reads the enclosing git history)',
    numbers: numbersD2,
    run(ctx) {
      const w = ctx.out('c-cheap2');
      ctx.sh(`npx tsx scripts/v1.3/cheap2-eval.ts --out "${w}/out" --work "${w}/work"`);
      const a = ctx.json(join(w, 'out', 'scores.json'));
      const strip = (o) => JSON.stringify(o, (k, v) => (k === 'generatedAt' || k === 'ms' || k === 'timingsMs' || /Ms$/.test(k) ? undefined : v));
      if (strip(a) !== strip(ctx.json('results/v1.3-cheap2/scores.json'))) throw new Error('regenerated cheap2 scores.json differs from results/v1.3-cheap2/scores.json (timings stripped)');
      const ts = a.precision.reduce((n, p) => n + (p.summaries.reachability?.unreachableTestSupport?.length ?? 0), 0);
      const commits = [...new Set(a.precision.filter((p) => p.kind === 'clean').map((p) => p.enclosingCoChange.commits))].sort();
      const caught = a.violations.filter((v) => v.newFlags.length > 0).length;
      return {
        'c-dd-b2-both': ts === 2 ? 'removed both false flags' : `removed ${ts} false flags`,
        'c-dd-b2-commits': `${commits.map((c) => WORD[c]).join(' or ')} commits each`,
        'c-dd-b2-none': caught === 0 ? 'batch 2 catches none' : `batch 2 catches ${caught}`,
      };
    },
  },
  {
    id: 'c-cheapdesign-history',
    title: 'cheap-semantics-design.md: counts of definitional changes made during development',
    needs: 'not-checkable',
    basis: '',
    how: 'history claims; the pre-change runs are not committed',
    numbers: [
      { id: 'c-dd-four-changes', line: 36, what: 'definitional changes after the first clean-project run (batch 1)', stated: 'Four definitional changes', note: 'The first-run outputs are not committed; the results doc lists them in prose only.' },
      { id: 'c-dd-one-change', line: 237, what: 'definitional changes after the first batch-2 run', stated: 'One definitional change', note: 'The pre-change batch-2 run is not committed; c-dd-b2-both checks its effect (2 test-support modules exempted).' },
    ].map((n) => ({ doc: DD, ...n })),
  },
];
