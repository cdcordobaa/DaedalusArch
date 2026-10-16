// MCP v2 (Docs/v1.3/mcp-v2.md, Docs/v1.3/mcp-smoke.md): check_diff consistency and the latency call counts
// regenerated offline (scripts/v1.3/mcp-consistency.ts, mcp-latency.ts with the built server), the smoke harness run
// in its dry-run mode, the tool and hint counts and infer_spec on the reference projects re-derived from src/; the
// latency timings re-derived from the committed results/v1.3-reference/mcp-v2/latency.json (machine-dependent).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const V2 = 'Docs/v1.3/mcp-v2.md';
const SM = 'Docs/v1.3/mcp-smoke.md';
const n = (id, line, what, stated, extra = {}) => ({ id, doc: V2, line, what, stated, ...extra });
const s = (id, line, what, stated, extra = {}) => ({ id, doc: SM, line, what, stated, ...extra });
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (w) => w[0].toUpperCase() + w.slice(1);

function tsx(ctx, name, code) {
  const f = join(ctx.out(name), `${name}.mjs`);
  writeFileSync(f, code);
  return JSON.parse(ctx.sh(`node --import tsx ${f}`).trim().split('\n').pop());
}

// §4.2 table (lines 76-81): per style the variant count, after-write a/r/l, before-write a/r/l, spec-only a/r, silent.
const STYLES = [['clean-architecture', 76], ['layered', 77], ['nestjs', 78], ['hexagonal', 79], ['ddd', 80], ['all', 81]];
const DOC42 = {
  'clean-architecture': ['14', '14 / 14 / 14', '14 / 14 / 14', '13 / 13', '4/4'],
  layered: ['13', '13 / 13 / 13', '13 / 13 / 13', '11 / 11', '4/4'],
  nestjs: ['14', '14 / 14 / 14', '14 / 14 / 14', '13 / 13', '4/4'],
  hexagonal: ['15', '15 / 15 / 15', '15 / 15 / 15', '14 / 14', '4/4'],
  ddd: ['15', '15 / 15 / 15', '15 / 15 / 15', '13 / 13', '3/3'],
  all: ['71', '71 / 71 / 71', '71 / 71 / 71', '64 / 64', '19/19'],
};
const COLS42 = ['variants', 'after', 'before', 'speconly', 'silent'];
const table42 = STYLES.flatMap(([st, line]) => COLS42.map((c, j) => n(`e-mcp-c-${st}-${c}`, line, `consistency per style: ${st}, ${c}`, DOC42[st][j])));

// §4.3 table (lines 91-95): variants where both block, per style and rule (after-write).
const DOC43 = {
  'clean-architecture': [91, 'FF-S01 5, FF-S04 3, FF-P01 2, FF-P03 1, FF-S02 1'],
  layered: [92, 'FF-S03 5, FF-S01 2, FF-S02 2, FF-P01 2'],
  nestjs: [93, 'FF-S01 4, FF-S04 2, FF-P01 2, FF-P03 1, FF-S02 1'],
  hexagonal: [94, 'FF-S01 5, FF-S04 3, FF-P03 2, FF-P01 1, FF-S02 1'],
  ddd: [95, 'FF-DS02 2, FF-DT03 2, FF-DS01 1, FF-DT01 1, FF-DT02 1, FF-DT04 1, FF-S01 1'],
};
const table43 = Object.entries(DOC43).flatMap(([st, [line, txt]]) => txt.split(', ').map((cell) => {
  const [rule, k] = cell.split(' ');
  return n(`e-mcp-r-${st}-${rule.toLowerCase()}`, line, `variants where ${rule} blocks in both (${st}, with a project root)`, k);
}));

// §9 latency table (lines 189-199): calls (regenerated) and p50 / p95 / cold max (committed record).
const LAT = [
  ['check_file', 'check_file', 189, '455', '6.0', '15.7', '15.6'],
  ['check_diff (before-write)', 'check_diff', 190, '325', '14.2', '39.6', '56.0'],
  ['check_diff (after-write)', 'check_diff (after-write)', 191, '325', '19.2', '45.2', '27.8'],
  ['check_import', 'check_import', 192, '1875', '0.1', '0.4', '0.8'],
  ['get_architecture_spec', 'get_architecture_spec', 193, '20', '5.4', '8.0', '25.9'],
  ['explain_finding', 'explain_finding', 194, '285', '0.1', '0.3', '1.1'],
  ['suggest_placement', 'suggest_placement', 195, '70', '0.8', '1.6', '3.3'],
  ['infer_spec', 'infer_spec', 196, '10', '152.9', '334.6', '450.2'],
  ['stdio: check_file', 'stdio: check_file', 197, '455', '6.5', '13.2', '23.0'],
  ['stdio: check_diff', 'stdio: check_diff', 198, '325', '13.3', '35.8', '130.1'],
  ['stdio: server start-up to listTools', 'stdio: server start-up to listTools', 199, '5', '776.8', '787.7', null],
];
const lslug = (t) => t.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

export default [
  {
    id: 'e-mcp-consistency',
    title: 'check_diff vs the saved full evaluation on the 71 reference variants, three modes',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'npx tsx scripts/v1.3/mcp-consistency.ts --check --out <scratch>  (in a HEAD export; reads results/v1.3-reference/after-member-facts)',
    numbers: [
      n('e-mcp-c-variants', 13, 'reference variants of the five styles', '71'),
      n('e-mcp-c-styles', 13, 'styles', 'five'),
      n('e-mcp-c-root', 13, 'agreement with a project root (answer and rules)', '71/71'),
      n('e-mcp-c-speconly', 13, 'spec-only agreement', '64/71'),
      n('e-mcp-c-disagree', 13, 'spec-only disagreements', '7'),
      n('e-mcp-c-l1', 13, 'disagreements from cycles (L1)', '5'),
      n('e-mcp-c-l2', 13, 'disagreements from DDD value-object mutability (L2)', '2'),
      n('e-mcp-c-projects', 63, 'reference projects', 'five'),
      n('e-mcp-c-n-clean', 63, 'clean-architecture variants', '14'),
      n('e-mcp-c-n-layered', 63, 'layered variants', '13'),
      n('e-mcp-c-n-nestjs', 63, 'nestjs variants', '14'),
      n('e-mcp-c-n-hex', 63, 'hexagonal variants', '15'),
      n('e-mcp-c-n-ddd', 63, 'DDD variants', '15'),
      n('e-mcp-c-refprob', 68, 'raw/evidence consistency problems in the reference', '0'),
      n('e-mcp-c-nonclean', 70, 'non-clean variants the unit test checks', '66'),
      n('e-mcp-c-modes', 70, 'tool configurations (modes)', 'three'),
      n('e-mcp-c-modes-m', 64, 'check_diff configurations', 'three'),
      n('e-mcp-c-bases', 142, 'check_diff bases seen over the run (whole-file, delta, added-lines)', 'three'),
      ...table42,
      n('e-mcp-c-ddd-note', 83, 'spec-only DDD agreement', '13/15'),
      n('e-mcp-c-ddd-dt03', 83, 'spec-only DDD disagreements, all FF-DT03', 'two'),
      n('e-mcp-c-unexpl', 83, 'unexplained disagreements in every mode', '0'),
      ...table43,
      n('e-mcp-c-fo-s02-clean', 97, 'spec-only full-only FF-S02, clean-architecture', '1'),
      n('e-mcp-c-fo-s02-layered', 97, 'spec-only full-only FF-S02, layered', '2'),
      n('e-mcp-c-fo-s02-nestjs', 97, 'spec-only full-only FF-S02, nestjs', '1'),
      n('e-mcp-c-fo-s02-hex', 97, 'spec-only full-only FF-S02, hexagonal', '1'),
      n('e-mcp-c-fo-dt03-ddd', 97, 'spec-only full-only FF-DT03, ddd', '2'),
      n('e-mcp-c-hints', 160, 'violation variants where hints fired', '8'),
      n('e-mcp-c-hints-clean', 160, 'clean or near-miss variants where hints fired', 'no'),
      n('e-mcp-c-p06', 103, 'FF-P06 plants in the reference set', 'three'),
    ],
    async run(ctx) {
      const out = ctx.out('e-mcp-consistency');
      const log = ctx.sh(`npx tsx scripts/v1.3/mcp-consistency.ts --check --out ${out}`, { cwd: ctx.tree() });
      const c = JSON.parse(readFileSync(join(out, 'consistency.json'), 'utf8'));
      const by = (st, m) => c.byStyle.find((x) => x.style === st && x.mode === m);
      const styles = [...new Set(c.byStyle.map((x) => x.style))];
      const sumM = (m, k) => c.byStyle.filter((x) => x.mode === m).reduce((t, x) => t + x[k], 0);
      const silent = (m) => { const p = c.byStyle.filter((x) => x.mode === m).map((x) => x.cleanAndNearMissSilent.split('/').map(Number)); return `${p.reduce((t, x) => t + x[0], 0)}/${p.reduce((t, x) => t + x[1], 0)}`; };
      const total = sumM('after-write', 'variants');
      const r = {};
      for (const [st] of STYLES) {
        const g = (m, k) => (st === 'all' ? sumM(m, k) : by(st, m)[k]);
        r[`e-mcp-c-${st}-variants`] = String(st === 'all' ? total : by(st, 'after-write').variants);
        r[`e-mcp-c-${st}-after`] = `${g('after-write', 'answerAgree')} / ${g('after-write', 'rulesAgree')} / ${g('after-write', 'locationsAgree')}`;
        r[`e-mcp-c-${st}-before`] = `${g('before-write', 'answerAgree')} / ${g('before-write', 'rulesAgree')} / ${g('before-write', 'locationsAgree')}`;
        r[`e-mcp-c-${st}-speconly`] = `${g('spec-only', 'answerAgree')} / ${g('spec-only', 'rulesAgree')}`;
        r[`e-mcp-c-${st}-silent`] = st === 'all' ? silent('after-write') : by(st, 'after-write').cleanAndNearMissSilent;
      }
      for (const [st] of Object.entries(DOC43)) {
        for (const x of c.byRule.filter((y) => y.style === st && y.mode === 'after-write' && y.both > 0)) r[`e-mcp-r-${st}-${x.ruleId.toLowerCase()}`] = String(x.both);
      }
      const fo = (st, rule) => String(c.byRule.find((y) => y.style === st && y.mode === 'spec-only' && y.ruleId === rule)?.fullOnly ?? 0);
      const rows = c.rows;
      const disagree = rows.filter((x) => x.mode === 'spec-only' && !(x.answerAgrees && x.rulesAgree));
      const lim = (id) => disagree.filter((x) => x.explainedBy.some((e) => String(e).startsWith(id))).length;
      const nonClean = new Set(rows.filter((x) => x.kind !== 'clean').map((x) => `${x.style}/${x.variant}`)).size;
      const hints = (kinds) => new Set(rows.filter((x) => kinds.includes(x.kind) && x.tool.hints.length > 0).map((x) => `${x.style}/${x.variant}`)).size;
      const refProb = /reference problems: (\d+)/.exec(log);
      const unexpl = c.byStyle.reduce((t, x) => t + x.unexplained, 0);
      const ddd = by('ddd', 'spec-only');
      const dddDis = disagree.filter((x) => x.style === 'ddd');
      const p06 = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'].flatMap((st) => ctx.ls(`tests/fixtures/v1.3-reference/${st}/variants`)
        .filter((v) => ctx.exists(`tests/fixtures/v1.3-reference/${st}/variants/${v}/expected-findings.json`) && ctx.read(`tests/fixtures/v1.3-reference/${st}/variants/${v}/expected-findings.json`).includes('"FF-P06"'))).length;
      return {
        ...r,
        'e-mcp-c-variants': String(total), 'e-mcp-c-styles': WORDS[styles.length], 'e-mcp-c-projects': WORDS[styles.length],
        'e-mcp-c-root': `${Math.min(sumM('after-write', 'answerAgree'), sumM('after-write', 'rulesAgree'), sumM('before-write', 'answerAgree'), sumM('before-write', 'rulesAgree'))}/${total}`,
        'e-mcp-c-speconly': `${Math.min(sumM('spec-only', 'answerAgree'), sumM('spec-only', 'rulesAgree'))}/${total}`,
        'e-mcp-c-disagree': String(disagree.length), 'e-mcp-c-l1': String(lim('L1')), 'e-mcp-c-l2': String(lim('L2')),
        'e-mcp-c-n-clean': String(by('clean-architecture', 'after-write').variants), 'e-mcp-c-n-layered': String(by('layered', 'after-write').variants),
        'e-mcp-c-n-nestjs': String(by('nestjs', 'after-write').variants), 'e-mcp-c-n-hex': String(by('hexagonal', 'after-write').variants),
        'e-mcp-c-n-ddd': String(by('ddd', 'after-write').variants),
        'e-mcp-c-refprob': refProb ? refProb[1] : 'not printed', 'e-mcp-c-nonclean': String(nonClean),
        'e-mcp-c-modes': WORDS[(c.modes.length ?? Object.keys(c.modes).length)] ?? String(c.modes.length),
        'e-mcp-c-modes-m': WORDS[new Set(rows.map((x) => x.mode)).size],
        'e-mcp-c-bases': WORDS[new Set(rows.flatMap((x) => x.tool.basis)).size],
        'e-mcp-c-ddd-note': `${ddd.answerAgree}/${ddd.variants}`,
        'e-mcp-c-ddd-dt03': dddDis.every((x) => [...x.fullOnlyRules, ...x.toolOnlyRules].every((q) => q === 'FF-DT03')) ? WORDS[dddDis.length] : `${dddDis.length} (not all FF-DT03)`,
        'e-mcp-c-unexpl': String(unexpl),
        'e-mcp-c-fo-s02-clean': fo('clean-architecture', 'FF-S02'), 'e-mcp-c-fo-s02-layered': fo('layered', 'FF-S02'), 'e-mcp-c-fo-s02-nestjs': fo('nestjs', 'FF-S02'),
        'e-mcp-c-fo-s02-hex': fo('hexagonal', 'FF-S02'), 'e-mcp-c-fo-dt03-ddd': fo('ddd', 'FF-DT03'),
        'e-mcp-c-hints': String(hints(['violation'])), 'e-mcp-c-hints-clean': WORDS[hints(['clean', 'near-miss'])],
        'e-mcp-c-p06': WORDS[p06],
      };
    },
  },
  {
    id: 'e-mcp-latency',
    title: 'MCP v2 latency: calls per tool (deterministic), regenerated with the built server over stdio',
    needs: 'offline', basis: 'regenerated', slow: true,
    how: 'npm run build && npx tsx scripts/v1.3/mcp-latency.ts --runs 5 --infer-runs 3 --stdio --check --out <scratch>  (in a HEAD export)',
    numbers: [
      ...LAT.map(([label, , line, calls]) => n(`e-mcp-l-${lslug(label)}-calls`, line, `latency: ${label}, warm calls`, calls)),
      n('e-mcp-l-projects', 185, 'reference projects measured', 'five'),
    ],
    async run(ctx) {
      const tree = ctx.tree();
      if (!existsSync(join(tree, 'dist/mcp-server/main.js'))) ctx.sh('npm run build', { cwd: tree });
      const out = ctx.out('e-mcp-latency');
      ctx.sh(`npx tsx scripts/v1.3/mcp-latency.ts --runs 5 --infer-runs 3 --stdio --check --out ${out}`, { cwd: tree });
      const l = JSON.parse(readFileSync(join(out, 'latency.json'), 'utf8'));
      const r = {};
      for (const [label, tool] of LAT) r[`e-mcp-l-${lslug(label)}-calls`] = String(l.table.find((x) => x.tool === tool).n);
      r['e-mcp-l-projects'] = WORDS[new Set(l.perStyle.map((x) => x.style)).size];
      return r;
    },
  },
  {
    id: 'e-mcp-latency-rec',
    title: 'MCP v2 latency timings re-derived from the committed latency.json (machine-dependent; a re-run gives other times)',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'results/v1.3-reference/mcp-v2/latency.json (written by scripts/v1.3/mcp-latency.ts --runs 5 --infer-runs 3 --stdio)',
    numbers: [
      ...LAT.flatMap(([label, , line, , p50, p95, cold]) => [
        n(`e-mcp-l-${lslug(label)}-p50`, line, `latency: ${label}, p50 ms`, p50),
        n(`e-mcp-l-${lslug(label)}-p95`, line, `latency: ${label}, p95 ms`, p95),
        ...(cold === null ? [] : [n(`e-mcp-l-${lslug(label)}-cold`, line, `latency: ${label}, cold max ms`, cold)]),
      ]),
      n('e-mcp-l-sum-file', 14, 'summary: check_file in process', 'check_file p50 6 ms / p95 16 ms'),
      n('e-mcp-l-sum-diff', 14, 'summary: check_diff in process', 'check_diff p50 14 ms / p95 40 ms'),
      n('e-mcp-l-sum-stdio', 14, 'summary: p95 over stdio, check_file and check_diff', 'p95 13 ms and 36 ms'),
      n('e-mcp-l-machine', 185, 'machine of the committed run', '4 vCPU Xeon 2.1 GHz'),
      n('e-mcp-l-orders', 201, 'check_file / check_diff margin under the 1 s target, cold calls included (round(log10(1000 ms / worst cold call)); worst p95, worst cold call)', 'about one order of magnitude under the 1 s target, cold calls included (worst p95 45.2 ms, worst cold call 130.1 ms'),
      n('e-mcp-l-orders-p50', 201, 'check_file / check_diff p50 range and its margin under 1 s (round(log10(1000 ms / worst p50)))', 'the p50s, 6 to 19 ms, are about two orders under it'),
    ],
    async run(ctx) {
      const l = ctx.json('results/v1.3-reference/mcp-v2/latency.json');
      const row = (t) => l.table.find((x) => x.tool === t);
      const r = {};
      for (const [label, tool, , , , , cold] of LAT) {
        const x = row(tool);
        r[`e-mcp-l-${lslug(label)}-p50`] = x.p50.toFixed(1);
        r[`e-mcp-l-${lslug(label)}-p95`] = x.p95.toFixed(1);
        if (cold !== null) r[`e-mcp-l-${lslug(label)}-cold`] = x.coldMax.toFixed(1);
      }
      const f0 = (x) => x.toFixed(0);
      r['e-mcp-l-sum-file'] = `check_file p50 ${f0(row('check_file').p50)} ms / p95 ${f0(row('check_file').p95)} ms`;
      r['e-mcp-l-sum-diff'] = `check_diff p50 ${f0(row('check_diff').p50)} ms / p95 ${f0(row('check_diff').p95)} ms`;
      r['e-mcp-l-sum-stdio'] = `p95 ${f0(row('stdio: check_file').p95)} ms and ${f0(row('stdio: check_diff').p95)} ms`;
      const cpu = /Xeon/.test(l.env.cpu) ? 'Xeon' : l.env.cpu;
      const ghz = /@ ([\d.]+)0GHz/.exec(l.env.cpu)?.[1] ?? '?';
      r['e-mcp-l-machine'] = `${l.env.cpus} vCPU ${cpu} ${ghz} GHz`;
      const fd = l.table.filter((x) => /check_file|check_diff/.test(x.tool));
      const worstCold = Math.max(...fd.map((x) => x.coldMax ?? 0)); const worstP95 = Math.max(...fd.map((x) => x.p95));
      const ORD = ['zero orders', 'one order', 'two orders', 'three orders'];
      r['e-mcp-l-orders'] = `about ${ORD[Math.round(Math.log10(1000 / worstCold))]} of magnitude under the 1 s target, cold calls included (worst p95 ${worstP95.toFixed(1)} ms, worst cold call ${worstCold.toFixed(1)} ms`;
      const p50s = fd.map((x) => x.p50);
      r['e-mcp-l-orders-p50'] = `the p50s, ${f0(Math.min(...p50s))} to ${f0(Math.max(...p50s))} ms, are about ${ORD[Math.round(Math.log10(1000 / Math.max(...p50s)))]} under it`;
      return r;
    },
  },
  {
    id: 'e-mcp-code',
    title: 'MCP v2 tool, hint and rule counts from src/mcp-server, and infer_spec on the five reference projects',
    needs: 'offline', basis: 're-derived', slow: false,
    how: 'TOOL_NAMES / SPEC_TOOL_NAMES (server.ts), APG2_HINT_NAMES / CHEAP_HINT_NAMES (fast-hints.ts), IMPORT_RULE_NAMES; inferSpecTool on each materialised clean reference project',
    numbers: [
      n('e-mcp-k-hints-apg2', 11, 'APG v2 templates with a fast hint', 'five'),
      n('e-mcp-k-hints-cheap', 11, 'cheap proxies with a hint', 'two'),
      n('e-mcp-k-new', 12, 'new tools', 'Two'),
      n('e-mcp-k-tools', 19, 'tools', 'Ten'),
      n('e-mcp-k-v1', 19, 'v1 tools', 'eight'),
      n('e-mcp-k-new-s2', 19, 'new tools (section 2)', 'Two'),
      n('e-mcp-k-import-rules', 25, 'import rules of check_import', 'four'),
      n('e-mcp-k-import-rules-s2', 34, 'import rules kept by the v1 fields', 'four'),
      n('e-mcp-k-v1-spec', 216, 'v1 spec-only tools in DAEDALUS_ARM_TOOLS', 'seven'),
      n('e-mcp-k-infer-n', 177, 'reference projects whose style infer_spec classifies correctly', 'five'),
      n('e-mcp-k-infer-conf', 177, 'infer_spec confidence range on the reference projects', '0.75 to 1.00'),
      n('e-mcp-k-src-files', 201, 'source files of the reference projects (clean variant, src/**/*.ts)', '27 to 31'),
      n('e-mcp-k-tests-pin', 34, 'existing tests that pin the v1 meaning', 'two', { needs: 'not-checkable', note: 'which tests pin the v1 meaning is a reading of the test suite, not a recorded count' }),
      n('e-mcp-k-tests-edited', 34, 'existing tests edited by the unit', 'two', { needs: 'not-checkable', note: 'a fact about the v1.3-mcp2 branch diff (git history), not about a committed output' }),
    ],
    async run(ctx) {
      const r = tsx(ctx, 'e-mcp-code', `
import * as fs from 'node:fs';
import * as path from 'node:path';
const R = process.cwd();
const { TOOL_NAMES, SPEC_TOOL_NAMES } = await import(R + '/src/mcp-server/server.ts');
const { APG2_HINT_NAMES, CHEAP_HINT_NAMES } = await import(R + '/src/mcp-server/fast-hints.ts');
const { IMPORT_RULE_NAMES } = await import(R + '/src/mcp-server/spec-rules.ts');
const { inferSpecTool, createSpecLoader } = await import(R + '/src/mcp-server/tools.ts');
const { loadAllReferences } = await import(R + '/scripts/v1.3/lib/reference-model.ts');
const { makeTempRoot, materialiseVariant } = await import(R + '/scripts/v1.3/lib/materialise.ts');
const tmp = makeTempRoot('rep2-e-infer-');
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : /\\.ts$/.test(e.name) ? 1 : 0), 0);
const infer = [];
try {
  for (const ref of loadAllReferences(R)) {
    const clean = materialiseVariant(ref, ref.variants.find((v) => v.manifest.variant === 'clean'), tmp);
    const ctx = { defaultSpecPath: ref.specPath, defaultProjectPath: clean.projectDir, env: {}, loadSpec: createSpecLoader(), presetsDir: path.join(R, 'presets'), evaluateDeps: {} };
    const x = await inferSpecTool(ctx, {});
    if (!x.ok) throw new Error(x.message);
    infer.push({ style: ref.style, inferred: x.data.style, confidence: x.data.confidence, valid: x.data.validation.valid, src: count(path.join(clean.projectDir, 'src')) });
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
const NEW = ['infer_spec', 'explain_finding'];
// Tools added after the doc (d44b13b2): propose_spec (#150, Docs/v1.3/init-infer.md). The doc counts the MCP v2 set.
const LATER = ['propose_spec'];
const TOOLS = TOOL_NAMES.filter((t) => !LATER.includes(t));
console.log(JSON.stringify({ tools: TOOLS.length, v1: TOOLS.filter((t) => !NEW.includes(t)).length, newT: TOOLS.filter((t) => NEW.includes(t)).length,
  v1spec: SPEC_TOOL_NAMES.filter((t) => !NEW.includes(t) && !LATER.includes(t)).length, apg2: APG2_HINT_NAMES.length, cheap: CHEAP_HINT_NAMES.length, imp: IMPORT_RULE_NAMES.length, infer }));
`);
      const ok = r.infer.filter((x) => x.inferred === x.style && x.valid).length;
      const conf = r.infer.map((x) => x.confidence); const src = r.infer.map((x) => x.src);
      return {
        'e-mcp-k-hints-apg2': WORDS[r.apg2], 'e-mcp-k-hints-cheap': WORDS[r.cheap], 'e-mcp-k-new': cap(WORDS[r.newT]), 'e-mcp-k-tools': cap(WORDS[r.tools]),
        'e-mcp-k-v1': WORDS[r.v1], 'e-mcp-k-new-s2': cap(WORDS[r.newT]), 'e-mcp-k-import-rules': WORDS[r.imp], 'e-mcp-k-import-rules-s2': WORDS[r.imp],
        'e-mcp-k-v1-spec': WORDS[r.v1spec], 'e-mcp-k-infer-n': WORDS[ok],
        'e-mcp-k-infer-conf': `${Math.min(...conf).toFixed(2)} to ${Math.max(...conf).toFixed(2)}`,
        'e-mcp-k-src-files': `${Math.min(...src)} to ${Math.max(...src)}`,
      };
    },
  },
  {
    id: 'e-mcp-smoke',
    title: 'MCP live smoke harness, dry-run mode (stub agent, real check_file handler); the live run needs a model',
    needs: 'offline', basis: 'regenerated', slow: false,
    how: 'npx tsx scripts/v1.3/mcp-smoke.ts --dry-run --behaviour fixes|ignores-block|never-checks --out <scratch>  (in a HEAD export)',
    numbers: [
      s('e-sm-files', 17, 'demo project files (DEMO_FILES)', 'Six'),
      s('e-sm-tools', 19, 'spec-only MCP v2 tools allowed by exact name in the argv', 'nine'),
      s('e-sm-dev', 19, 'deviations recorded in the report', 'Two'),
      s('e-sm-exit0', 37, 'exit code when the agent called check_diff/check_file (dry run, fixes)', '0'),
      s('e-sm-exit1', 37, 'exit code when it never did (dry run, never-checks)', '1'),
      s('e-sm-exit2', 37, 'exit code on a setup error (no --claude / --model)', '2'),
      s('e-sm-exit1-table', 54, 'never-checks verdict exit code', '1'),
      s('e-sm-unit', 56, 'behaviours covered by unit tests', 'three'),
      s('e-sm-live', 7, 'live smoke run with Claude Code', 'once', { needs: 'needs-LLM', note: 'the live run spawns claude with a model; not run (the doc also says it was not run where written)' }),
    ],
    async run(ctx) {
      const tree = ctx.tree();
      const run = (args) => { try { ctx.sh(`npx tsx scripts/v1.3/mcp-smoke.ts ${args}`, { cwd: tree }); return 0; } catch (e) { return e.status; } };
      const res = {};
      for (const b of ['fixes', 'ignores-block', 'never-checks']) {
        const out = ctx.out(`e-sm-${b}`);
        res[b] = { exit: run(`--dry-run --behaviour ${b} --out ${out}`), rep: JSON.parse(readFileSync(join(out, 'mcp-smoke-dry-run.json'), 'utf8')) };
      }
      const setup = run(`--out ${ctx.out('e-sm-setup')}`);
      const rep = res.fixes.rep;
      const allowed = rep.argv.filter((a) => a.startsWith('mcp__daedalus-arch__')).filter((a, i, all) => !rep.argv.includes('--disallowedTools') || rep.argv.indexOf(a) < rep.argv.indexOf('--disallowedTools')).length;
      const files = tsx(ctx, 'e-sm-files', `const m = await import(process.cwd() + '/scripts/v1.3/lib/mcp-smoke.ts'); console.log(JSON.stringify(Object.keys(m.DEMO_FILES).length));`);
      const test = ctx.read('tests/unit/scripts/v1.3/mcp-smoke.test.ts');
      const unit = ['fixes', 'ignores-block', 'never-checks'].filter((b) => test.includes(`'${b}'`)).length;
      return {
        'e-sm-files': cap(WORDS[files]), 'e-sm-tools': WORDS[allowed], 'e-sm-dev': cap(WORDS[rep.deviations.length]),
        'e-sm-exit0': String(res.fixes.exit), 'e-sm-exit1': String(res['never-checks'].exit), 'e-sm-exit2': String(setup),
        'e-sm-exit1-table': String(res['never-checks'].exit), 'e-sm-unit': WORDS[unit],
      };
    },
  },
];
