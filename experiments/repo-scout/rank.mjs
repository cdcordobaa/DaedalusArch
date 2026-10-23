// REPO-SCOUT (v1.5-exp): merge the measurements into one ranked table (results/ranked.json and a Markdown table on
// stdout). Zero model calls. The boundary judgement and the verified-tsc status are hand-recorded in
// results/judgements.json (each with its evidence); everything else is read from the measurement files.
// Usage: node experiments/repo-scout/rank.mjs
import fs from 'node:fs';

const R = 'experiments/repo-scout/results';
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : undefined);
const measures = [...read(`${R}/measure-v13.json`), ...read(`${R}/measure-new.json`)];
const judgements = read(`${R}/judgements.json`);
const PERMISSIVE = new Set(['MIT', 'Apache-2.0', 'ISC', 'BSD']);
const STRENGTH = { strong: 3, medium: 2, weak: 1, none: 0 };

const rows = measures.map((m) => {
  const j = judgements.repos[m.id] ?? {};
  const ext = read(`${R}/extract/${m.id}.json`);
  const cmp = read(`${R}/compare-${m.id}.json`);
  const fid = j.fidelity;
  const large = m.files >= 300 && m.loc >= 20000;
  const permissive = PERMISSIVE.has(m.licence.family) && !j.licenceCaveatFails;
  const boundaries = j.boundaries ?? (m.boundaries.nestModuleDecorators > 0 ? 'weak' : 'none');
  const tsc = j.tsc ?? (m.tsc.total < 0 ? 'not run' : `no deps: ${m.tsc.other} non-module errors (unverified)`);
  const tscOk = j.tscVerified === true;
  const agreement = cmp ? cmp.questions.map((q) => ({
    id: q.id,
    truth: q.truth.sites,
    indexSiteRecall: q.index.sitesEdgesOnly.recall,
    indexSitePrecision: q.index.sitesEdgesOnly.precision,
    indexFileRecall: q.index.files.recall,
    impactRefFileRecall: q.impact?.referenceFiles?.recall ?? null,
    impactCommandFileRecall: q.impact?.commandFiles?.recall ?? null,
    whoWritesRecall: q.who_writes ? (q.who_writes.error ? 'error' : q.who_writes.commands.recall) : null,
  })) : null;
  const passes = [tscOk, large, STRENGTH[boundaries] >= 2, true, permissive];
  return {
    id: m.id, set: m.set, url: m.url, sha: m.sha, root: m.root, files: m.files, loc: m.loc, tsc, tscVerified: tscOk,
    boundaries, boundaryEvidence: j.boundaryEvidence ?? '', licence: m.licence.family + (j.licenceNote ? ` (${j.licenceNote})` : ''),
    extractMs: ext?.ms ?? null, fidelity: fid ?? null, indexBuildMs: cmp?.index.buildMs ?? null, agreement,
    criteria: { a: tscOk, b: large, c: STRENGTH[boundaries] >= 2, d: true, e: permissive }, passes: passes.filter(Boolean).length,
  };
});
rows.sort((x, y) => y.passes - x.passes || STRENGTH[y.boundaries] - STRENGTH[x.boundaries] || (y.agreement ? 1 : 0) - (x.agreement ? 1 : 0) || y.loc - x.loc);
fs.writeFileSync(`${R}/ranked.json`, `${JSON.stringify(rows, null, 1)}\n`);

const pct = (x) => (x === null || x === undefined ? '–' : typeof x === 'string' ? x : `${Math.round(x * 100)}%`);
const yes = (b) => (b ? '✓' : '✗');
process.stdout.write('| # | Repo | Commit | Files | LOC | tsc | Boundaries | Licence | (a)(b)(c)(d)(e) | Extraction | tsc coverage (literal view) | Graph vs compiler (index site recall per question) |\n');
process.stdout.write('|---|---|---|---:|---:|---|---|---|---|---|---|---|\n');
rows.forEach((r, i) => {
  const c = r.criteria;
  const ag = r.agreement ? r.agreement.map((a) => `${a.id} ${pct(a.indexSiteRecall)}`).join(', ') : '–';
  const fid = r.fidelity ? `${r.fidelity.literal.coverage.toFixed(3)} / ${r.fidelity.literal.confirmation.toFixed(3)} (${r.fidelity.literal.tscEdges} edges)` : '–';
  process.stdout.write(`| ${i + 1} | ${r.id} | \`${r.sha.slice(0, 12)}\` | ${r.files} | ${r.loc} | ${r.tsc} | ${r.boundaries} | ${r.licence} | ${[c.a, c.b, c.c, c.d, c.e].map(yes).join('')} | ${r.extractMs === null ? '–' : `${(r.extractMs / 1000).toFixed(1)} s`} | ${fid} | ${ag} |\n`);
});
