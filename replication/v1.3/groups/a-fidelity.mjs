// Graph fidelity (v1.3-graph-fidelity-2026-10-14.md): corpus aggregates re-derived by replication/lib/fidelity-reaggregate.mjs
// from the committed per-project JSON, plus per-project figures, disagreement classes, edge kinds (per-edge CSV),
// adjudication and layer-review sheets, all from results/v1.3-fidelity/. The corpora themselves are outside the repo.
const DOC = 'Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md';
const n = (id, line, what, stated, extra = {}) => ({ id: `a-fid-${id}`, doc: DOC, line, what, stated, ...extra });

const numbers = [
  n('e1-cells', 23, 'E1 cells measured', 'all 72 cells'),
  n('e1-judged', 23, 'E1 cells judged (accepted)', '65 of them were judged'),
  n('e1-genfailed', 23, 'E1 cells generation-failed but measured', 'The other 7 are `generation-failed`'),
  n('so4-bases', 24, 'SO4 held-out bases', 'the 7 held-out bases'),
  n('e1-dynreq', 28, 'E1 import()/require() calls', 'E1 has 0 `import()` or `require()` calls'),
  n('so4-dynreq', 28, 'SO4 import()/require() calls (all require of .json)', 'SO4 has only 6'),
  n('so4-unres', 28, 'SO4 specifiers tsc leaves unresolved', 'tsc leaves those 6 unresolved'),
];
// Headline table, lines 32-37.
const HEAD = [
  [32, 'e1', 'depcruise', 'scoped', 'E1 (72)', '3306 / 3334 / 3317', '0.996684', '0.991602', '0.988341'],
  [33, 'e1', 'tsc', 'scoped', 'E1 (72)', '3306 / 3334 / 3317', '0.996684', '0.991602', '0.988341'],
  [34, 'so4', 'depcruise', 'scoped', 'SO4 (7)', '1465 / 2432 / 1545', '0.948220', '0.602385', '0.583201'],
  [35, 'so4', 'tsc', 'scoped', 'SO4 (7)', '2294 / 2432 / 2374', '0.966302', '0.943257', '0.913217'],
  [36, 'so4', 'depcruise', 'raw', 'SO4 (7)', '1465 / 2432 / 2494', '0.587410', '0.602385', '0.423288'],
  [37, 'so4', 'tsc', 'raw', 'SO4 (7)', '2294 / 2432 / 2907', '0.789130', '0.943257', '0.753366'],
];
for (const [line, c, ref, scope, label, counts, cov, conf, jac] of HEAD) {
  const k = `${c}-${ref === 'depcruise' ? 'dc' : 'tsc'}-${scope}`;
  numbers.push(n(`${k}-n`, line, `${c} ${ref} ${scope}: corpus size in the row label`, label));
  numbers.push(n(`${k}-counts`, line, `${c} ${ref} ${scope}: both / APG / ref edges${c === 'e1' ? ' (scoped = raw)' : ''}`, counts));
  numbers.push(n(`${k}-cov`, line, `${c} ${ref} ${scope}: refCoveredByApg (micro)`, cov));
  numbers.push(n(`${k}-conf`, line, `${c} ${ref} ${scope}: apgConfirmedByRef (micro)`, conf));
  numbers.push(n(`${k}-jac`, line, `${c} ${ref} ${scope}: Jaccard (micro)`, jac));
}
numbers.push(
  n('e1-perfect', 43, 'E1 cells with perfect agreement', '70 of the 72 cells agree perfectly'),
  n('e1-imperfect', 43, 'E1 cells with any disagreement', 'The other two'),
  n('tm-cov', 44, 'opus task-management/none/run-1 covered', 'covered 0.7000'),
  n('tm-conf', 44, 'opus task-management/none/run-1 confirmed', 'confirmed 0.4773'),
  n('tm-jac', 44, 'opus task-management/none/run-1 Jaccard', 'Jaccard 0.3962'),
  n('of-cov', 45, 'opus order-fulfilment/full-aac/run-1 covered', 'covered 0.9832'),
  n('of-conf', 45, 'opus order-fulfilment/full-aac/run-1 confirmed', 'confirmed 0.9590'),
  n('nestjslatam', 47, 'SO4 scoped vs tsc nestjslatam__ddd covered / confirmed', '0.8529 / 0.7616'),
  n('realworld', 48, 'SO4 scoped vs tsc realworld-test covered / confirmed', '0.9437 / 0.8816'),
  n('truthy', 49, 'SO4 scoped vs tsc truthy-demo covered / confirmed', '0.9642 / 0.9642'),
  n('other4', 50, 'SO4 scoped vs tsc: the other four projects', 'The other four: 1.0 / 1.0'),
  n('ghost-dc', 51, 'ghostfolio-test apgConfirmedByRef vs dependency-cruiser', 'confirms only 0.1896'),
  n('miss-e1', 53, 'E1 projects that miss the 0.95 raw agreement target (any metric, either reference)', 'missed** in 1 E1 project'),
  n('miss-so4', 53, 'SO4 projects that miss the 0.95 raw agreement target (any metric; tsc - dependency-cruiser)', 'in 2–3 SO4 projects', {
    known: { actual: 'in 4–5 SO4 projects', note: 'Audit finding A-1: 2–3 is the scoped count (tsc 2, dependency-cruiser 2–3); on raw agreement 4 projects miss 0.95 against tsc and 5 against dependency-cruiser.' } }),
);
// Disagreement classes table, lines 61-72.
const CLS = [
  [61, 'e1', 'depcruise', 're-export/barrel', '11', '28'],
  [62, 'e1', 'tsc', 're-export/barrel', '11', '28'],
  [63, 'so4', 'tsc', 're-export/barrel', '80', '138'],
  [64, 'so4', 'tsc', 'excluded-file', '202', '0'],
  [65, 'so4', 'tsc', 'out-of-root', '329', '0'],
  [66, 'so4', 'tsc', '.d.ts', '2', '0'],
  [67, 'so4', 'depcruise', 're-export/barrel', '80', '138'],
  [68, 'so4', 'depcruise', 'path-alias', '0', '829'],
  [69, 'so4', 'depcruise', 'excluded-file', '308', '0'],
  [70, 'so4', 'depcruise', 'out-of-root', '639', '0'],
  [71, 'so4', 'depcruise', '.d.ts', '2', '0'],
  [72, 'both', 'any', 'extractor-bug', '**0**', '**0**'],
];
for (const [line, c, ref, cls, mApg, mRef] of CLS) {
  const k = `cls-${c}-${ref === 'depcruise' ? 'dc' : ref}-${cls.replace(/[^a-z]+/g, '')}`;
  numbers.push(n(`${k}-apg`, line, `${c} vs ${ref}, class ${cls}: missing-in-apg`, mApg));
  numbers.push(n(`${k}-ref`, line, `${c} vs ${ref}, class ${cls}: missing-in-ref`, mRef));
}
numbers.push(
  n('e1-typeonly', 76, 'E1 type-only import occurrences, all agreeing', 'E1 has 142 type-only import occurrences'),
  n('scoped-bydesign', 81, 'scoped agreement with tsc once barrel/excluded/out-of-root/.d.ts are removed, both corpora', 'scoped agreement with tsc is 1.0 on both corpora'),
  n('adj-e1', 87, 'E1 adjudication disagreement rows', '**E1** (39 disagreement rows)'),
  n('adj-so4', 88, 'SO4 adjudication disagreement rows', '**SO4** (1996 disagreement rows)'),
  n('adj-so4-target', 88, 'SO4 rows suggested exists-resolves-to-target', '1852 rows are `exists-resolves-to-target`'),
  n('adj-so4-barrel', 88, 'SO4 rows suggested exists-via-barrel', '138 are `exists-via-barrel`'),
  n('adj-so4-else', 88, 'SO4 rows suggested exists-resolves-elsewhere (ghostfolio JSON require)', 'The remaining 6'),
  n('adj-samples', 89, 'agreement samples per corpus, all exists-resolves-to-target', 'all 50 of each corpus'),
  n('tm-routed', 98, 'opus task-management/none/run-1: routed edges to declaring files', 'become 28 edges', {
    known: { actual: 'become 23 edges', note: 'Audit finding A-2: this project has 23 routed (missing-in-ref) edges; 28 is the E1 corpus total (it adds order-fulfilment run-1).' } }),
  n('tm-dropped', 98, 'opus task-management/none/run-1: barrel edges that disappear', 'the 11 edges to the barrels disappear', {
    known: { actual: 'the 9 edges to the barrels disappear', note: 'Audit finding A-2: this project has 9 missing-in-apg barrel edges; 11 is the E1 corpus total.' } }),
  n('so4-barrel-rows', 104, 'SO4 barrel rows (missing-in-apg + missing-in-ref)', '80 + 138'),
  n('ghost-alias', 107, 'ghostfolio @ghostfolio/api/* edges missing from dependency-cruiser (path-alias)', 'Every one of the 829'),
  n('ghost-dc-2', 107, 'ghostfolio-test apgConfirmedByRef vs dependency-cruiser (repeat)', 'confirms only 0.1896'),
  n('layer-incons', 111, 'files where the matched glob disagrees with annotateNodes', 'disagrees with `annotateNodes` for 0 files'),
  n('e1-layer', 113, 'E1 files assigned to a layer', '1319 of 1332 files assigned (0.990240)'),
  n('e1-layer-min', 113, 'E1 lowest project layer fraction (haiku task-management/none/run-0)', '0.75 (`claude-haiku-4-5/task-management/none/run-0`, 3 of 4 files)'),
  n('e1-unassigned', 113, 'E1 unassigned files', 'All 13 unassigned files'),
  n('e1-unassigned-index', 113, 'E1 unassigned files that are src/index.ts', '12 are `src/index.ts`'),
  n('e1-unassigned-server', 113, 'E1 unassigned files that are src/server.ts', '1 is `src/server.ts`'),
  n('so4-layer', 114, 'SO4 files assigned to a layer', '602 of 833 files assigned (0.722689)'),
  n('so4-layer-min', 114, 'SO4 lowest project layer fraction (truthy-demo)', '0.549618 (truthy-demo, 72 of 131)'),
  n('layer-review', 115, 'layer-review.csv rows per corpus', '40 assignments per corpus'),
  n('ooroot-2', 124, 'ghostfolio libs/common out-of-root tsc edges (repeat)', '329 tsc edges'),
  n('adj-e1-2', 127, 'E1 adjudication rows to fill first (repeat)', 'the 39 E1 rows'),
  n('adj-so4-barrel-2', 127, 'SO4 barrel rows to adjudicate', 'the 218 SO4 barrel rows'),
);

export default [{
  id: 'a-fidelity',
  title: 'Graph fidelity E1/SO4 (aggregates, classes, adjudication, layers)',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'node replication/lib/fidelity-reaggregate.mjs . <out>; per-project JSON/CSV, adjudication.csv, layer-review.csv of results/v1.3-fidelity',
  numbers,
  async run(ctx) {
    const out = ctx.out('a-fidelity');
    ctx.sh(`node replication/lib/fidelity-reaggregate.mjs . "${out}"`);
    const R = 'results/v1.3-fidelity';
    const agg = {};
    for (const c of ['e1', 'so4']) {
      agg[c] = JSON.parse(ctx.read(`${out}/${c}/aggregate.json`));
      if (ctx.read(`${out}/${c}/aggregate.json`) !== ctx.read(`${R}/${c}/aggregate.json`)) throw new Error(`${c}/aggregate.json: re-aggregation differs from the committed file`);
    }
    const V = 'apg-v12e-default';
    const slug = (id) => id.replaceAll('/', '__');
    const proj = (c, id) => ctx.json(`${R}/${c}/projects/${slug(id)}.json`);
    const projects = (c) => ctx.ls(`${R}/${c}/projects`).filter((f) => f.endsWith('.json')).map((f) => ctx.json(`${R}/${c}/projects/${f}`));
    const P = { e1: projects('e1'), so4: projects('so4') };
    const r = {};
    const f6 = (x) => x.toFixed(6); const f4 = (x) => x.toFixed(4);

    r['a-fid-e1-cells'] = `all ${agg.e1.measured} cells`;
    r['a-fid-e1-judged'] = `${P.e1.filter((p) => p.meta.runStatus === 'accepted').length} of them were judged`;
    r['a-fid-e1-genfailed'] = `The other ${P.e1.filter((p) => /generation-failed/.test(p.meta.runStatus)).length} are \`generation-failed\``;
    r['a-fid-so4-bases'] = `the ${agg.so4.measured} held-out bases`;
    // Edge kinds from the per-edge CSVs; unresolved specifiers from meta.tsc.
    const kinds = (c) => { let dyn = 0; for (const f of ctx.ls(`${R}/${c}/projects`).filter((x) => x.endsWith('.csv'))) for (const row of ctx.csv(`${R}/${c}/projects/${f}`)) if (/dynamic|require/.test(row.tsc_kinds)) dyn++; return dyn; };
    const unres = (c) => P[c].flatMap((p) => p.meta.tsc.unresolvedSpecifiers);
    r['a-fid-e1-dynreq'] = `E1 has ${kinds('e1') + unres('e1').length} \`import()\` or \`require()\` calls`;
    const so4Unres = unres('so4');
    const so4Json = so4Unres.filter((s) => s.endsWith('.json')).length;
    r['a-fid-so4-dynreq'] = `SO4 has only ${kinds('so4') + so4Json}`;
    r['a-fid-so4-unres'] = `tsc leaves those ${so4Unres.length} unresolved`;

    for (const [line, c, ref, scope] of HEAD) {
      const k = `a-fid-${c}-${ref === 'depcruise' ? 'dc' : 'tsc'}-${scope}`;
      const m = agg[c].variants[V].agreement[`${ref}.${scope}`].micro;
      if (c === 'e1') { const raw = agg[c].variants[V].agreement[`${ref}.raw`].micro; if (JSON.stringify(raw) !== JSON.stringify(m)) throw new Error(`e1 ${ref}: scoped != raw (line ${line})`); }
      r[`${k}-n`] = `${c.toUpperCase()} (${agg[c].measured})`;
      r[`${k}-counts`] = `${m.both} / ${m.apgEdges} / ${m.refEdges}`;
      r[`${k}-cov`] = f6(m.refCoveredByApg);
      r[`${k}-conf`] = f6(m.apgConfirmedByRef);
      r[`${k}-jac`] = f6(m.jaccard);
    }
    const anyDis = agg.e1.variants[V].agreement['tsc.scoped'].projectsWithAnyDisagreement;
    const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
    r['a-fid-e1-perfect'] = `${agg.e1.measured - anyDis} of the ${agg.e1.measured} cells agree perfectly`;
    r['a-fid-e1-imperfect'] = `The other ${words[anyDis] ?? anyDis}`;
    const tm = proj('e1', 'claude-opus-5-5/task-management/none/run-1').agreement[V].tsc;
    r['a-fid-tm-cov'] = `covered ${f4(tm.refCoveredByApg)}`;
    r['a-fid-tm-conf'] = `confirmed ${f4(tm.apgConfirmedByRef)}`;
    r['a-fid-tm-jac'] = `Jaccard ${f4(tm.jaccard)}`;
    const of = proj('e1', 'claude-opus-5-5/order-fulfilment/full-aac/run-1').agreement[V].tsc;
    r['a-fid-of-cov'] = `covered ${f4(of.refCoveredByApg)}`;
    r['a-fid-of-conf'] = `confirmed ${f4(of.apgConfirmedByRef)}`;
    const so4t = (id) => proj('so4', id).agreement[V].tsc;
    for (const [k, id] of [['nestjslatam', 'nestjslatam__ddd'], ['realworld', 'realworld-test'], ['truthy', 'truthy-demo']]) {
      const a = so4t(id); r[`a-fid-${k}`] = `${f4(a.refCoveredByApg)} / ${f4(a.apgConfirmedByRef)}`;
    }
    const others = P.so4.filter((p) => !['nestjslatam__ddd', 'realworld-test', 'truthy-demo'].includes(p.id)).map((p) => p.agreement[V].tsc);
    const allOne = others.every((a) => a.refCoveredByApg === 1 && a.apgConfirmedByRef === 1);
    r['a-fid-other4'] = `The other ${words[others.length] ?? others.length}: ${allOne ? '1.0 / 1.0' : 'not all 1.0'}`;
    const gh = proj('so4', 'ghostfolio-test').agreement[V].depcruise.apgConfirmedByRef;
    r['a-fid-ghost-dc'] = `confirms only ${f4(gh)}`;
    r['a-fid-ghost-dc-2'] = `confirms only ${f4(gh)}`;
    // Projects below 0.95 on raw agreement (either metric), per reference.
    const below = (c, ref) => P[c].filter((p) => { const a = p.agreementRaw[V][ref]; return a.refCoveredByApg < 0.95 || a.apgConfirmedByRef < 0.95; }).length;
    const range = (a, b) => (a === b ? `${a}` : `${Math.min(a, b)}–${Math.max(a, b)}`);
    r['a-fid-miss-e1'] = `missed** in ${range(below('e1', 'tsc'), below('e1', 'depcruise'))} E1 project`;
    r['a-fid-miss-so4'] = `in ${range(below('so4', 'tsc'), below('so4', 'depcruise'))} SO4 projects`;

    for (const [, c, ref, cls] of CLS) {
      const k = `a-fid-cls-${c}-${ref === 'depcruise' ? 'dc' : ref}-${cls.replace(/[^a-z]+/g, '')}`;
      if (c === 'both') {
        let a = 0; let b = 0;
        for (const cc of ['e1', 'so4']) for (const rr of ['depcruise', 'tsc']) for (const v of Object.keys(agg[cc].variants)) {
          const d = agg[cc].variants[v].disagreementClasses[rr];
          a += d['missing-in-apg:extractor-bug'] ?? 0; b += d['missing-in-ref:extractor-bug'] ?? 0;
        }
        r[`${k}-apg`] = `**${a}**`; r[`${k}-ref`] = `**${b}**`;
        continue;
      }
      const d = agg[c].variants[V].disagreementClasses[ref];
      r[`${k}-apg`] = String(d[`missing-in-apg:${cls}`] ?? 0);
      r[`${k}-ref`] = String(d[`missing-in-ref:${cls}`] ?? 0);
    }
    // The dynamic variant must have the same class counts (doc heading of the table).
    for (const c of ['e1', 'so4']) if (JSON.stringify(agg[c].variants[V].disagreementClasses) !== JSON.stringify(agg[c].variants['apg-v13-dynamicImports'].disagreementClasses)) throw new Error(`${c}: variant class counts differ`);

    // Type-only: per-edge CSV rows whose tsc kinds include a type-import, and in all three edge sets.
    let typeOnly = 0; let typeOnlyAgree = 0;
    for (const f of ctx.ls(`${R}/e1/projects`).filter((x) => x.endsWith('.csv'))) for (const row of ctx.csv(`${R}/e1/projects/${f}`)) {
      if (!row.tsc_kinds.split(';').includes('type-import')) continue;
      typeOnly++;
      if (row[`in_${V}`] === '1' && row.in_depcruise === '1' && row.in_tsc === '1') typeOnlyAgree++;
    }
    r['a-fid-e1-typeonly'] = `E1 has ${typeOnly} type-only import occurrences${typeOnlyAgree === typeOnly ? '' : ` (${typeOnlyAgree} agree)`}`;
    // Scoped tsc agreement without the by-design classes: every scoped disagreement is a barrel row.
    const scopedOk = ['e1', 'so4'].every((c) => {
      const m = agg[c].variants[V].agreement['tsc.scoped'].micro; const d = agg[c].variants[V].disagreementClasses.tsc;
      return m.onlyRef === (d['missing-in-apg:re-export/barrel'] ?? 0) && m.onlyApg === (d['missing-in-ref:re-export/barrel'] ?? 0);
    });
    r['a-fid-scoped-bydesign'] = `scoped agreement with tsc is ${scopedOk ? '1.0' : '< 1.0'} on both corpora`;

    const adj = { e1: ctx.csv(`${R}/e1/adjudication.csv`), so4: ctx.csv(`${R}/so4/adjudication.csv`) };
    const dis = (c, v) => adj[c].filter((x) => x.row_type === 'disagreement' && (v === undefined || x.suggested_verdict === v)).length;
    r['a-fid-adj-e1'] = `**E1** (${dis('e1')} disagreement rows)`;
    r['a-fid-adj-so4'] = `**SO4** (${dis('so4')} disagreement rows)`;
    r['a-fid-adj-so4-target'] = `${dis('so4', 'exists-resolves-to-target')} rows are \`exists-resolves-to-target\``;
    r['a-fid-adj-so4-barrel'] = `${dis('so4', 'exists-via-barrel')} are \`exists-via-barrel\``;
    r['a-fid-adj-so4-else'] = `The remaining ${dis('so4', 'exists-resolves-elsewhere')}`;
    const samp = ['e1', 'so4'].map((c) => adj[c].filter((x) => x.row_type === 'agreement-sample'));
    const sampOk = samp.every((s) => s.every((x) => x.suggested_verdict === 'exists-resolves-to-target')) && samp[0].length === samp[1].length;
    r['a-fid-adj-samples'] = sampOk ? `all ${samp[0].length} of each corpus` : `samples ${samp.map((s) => s.length).join('/')}`;
    if ([...adj.e1, ...adj.so4].some((x) => x.human_verdict !== '')) throw new Error('human_verdict not empty');
    r['a-fid-adj-e1-2'] = `the ${dis('e1')} E1 rows`;

    const tmc = proj('e1', 'claude-opus-5-5/task-management/none/run-1').classes[V].tsc;
    r['a-fid-tm-routed'] = `become ${tmc['missing-in-ref:re-export/barrel']} edges`;
    r['a-fid-tm-dropped'] = `the ${tmc['missing-in-apg:re-export/barrel']} edges to the barrels disappear`;
    const so4tsc = agg.so4.variants[V].disagreementClasses.tsc;
    r['a-fid-so4-barrel-rows'] = `${so4tsc['missing-in-apg:re-export/barrel']} + ${so4tsc['missing-in-ref:re-export/barrel']}`;
    r['a-fid-adj-so4-barrel-2'] = `the ${so4tsc['missing-in-apg:re-export/barrel'] + so4tsc['missing-in-ref:re-export/barrel']} SO4 barrel rows`;
    const ghAlias = adj.so4.filter((x) => x.row_type === 'disagreement' && x.project === 'ghostfolio-test' && x['class_apg-v12e-default_vs_depcruise'] === 'missing-in-ref:path-alias' && x.specifier.startsWith('@ghostfolio/api/')).length;
    const ghAliasAll = proj('so4', 'ghostfolio-test').classes[V].depcruise['missing-in-ref:path-alias'];
    r['a-fid-ghost-alias'] = ghAlias === ghAliasAll ? `Every one of the ${ghAlias}` : `${ghAlias} of the ${ghAliasAll}`;
    r['a-fid-ooroot-2'] = `${so4tsc['missing-in-apg:out-of-root']} tsc edges`;

    r['a-fid-layer-incons'] = `disagrees with \`annotateNodes\` for ${agg.e1.layer.inconsistencies + agg.so4.layer.inconsistencies} files`;
    const L = agg.e1.layer;
    r['a-fid-e1-layer'] = `${L.assigned} of ${L.files} files assigned (${f6(L.fractionAssigned)})`;
    const minE1 = [...P.e1].sort((a, b) => a.layer.fractionAssigned - b.layer.fractionAssigned)[0];
    r['a-fid-e1-layer-min'] = `${minE1.layer.fractionAssigned} (\`${minE1.id}\`, ${minE1.layer.assigned} of ${minE1.layer.total} files)`;
    const un = P.e1.flatMap((p) => p.layer.unassigned);
    r['a-fid-e1-unassigned'] = `All ${un.length} unassigned files`;
    r['a-fid-e1-unassigned-index'] = `${un.filter((f) => f === 'src/index.ts').length} are \`src/index.ts\``;
    r['a-fid-e1-unassigned-server'] = `${un.filter((f) => f === 'src/server.ts').length} is \`src/server.ts\``;
    const S = agg.so4.layer;
    r['a-fid-so4-layer'] = `${S.assigned} of ${S.files} files assigned (${f6(S.fractionAssigned)})`;
    const minS = [...P.so4].sort((a, b) => a.layer.fractionAssigned - b.layer.fractionAssigned)[0];
    r['a-fid-so4-layer-min'] = `${minS.layer.fractionAssigned} (${minS.id}, ${minS.layer.assigned} of ${minS.layer.total})`;
    const lr = ['e1', 'so4'].map((c) => ctx.csv(`${R}/${c}/layer-review.csv`).length);
    r['a-fid-layer-review'] = lr[0] === lr[1] ? `${lr[0]} assignments per corpus` : `${lr.join('/')} assignments`;
    return r;
  },
}];
