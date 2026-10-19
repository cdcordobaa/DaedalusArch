#!/usr/bin/env node
/**
 * EFF-01 answer key derivation (ops/notes/eff-01-efficiency-design.md §4).
 *
 * Deterministic, zero model calls, no database. It derives every answer from the TypeScript compiler
 * (typescript 5.9, `ts.resolveModuleName` with the repo's own tsconfig) and the spec's layer globs
 * (picomatch, `dot: true`, first matching layer in spec order: the same glob semantics as
 * src/mcp-server/layer-resolver.ts). It does NOT import the instrument's extractor, graph or rules, so
 * the key is independent of the thing under test. Q10 is the one exception, and is labelled so: its
 * truth is the instrument's own verdict, read from the committed report.
 *
 * Usage (from the repo root):
 *   node experiments/eff-01/derive-answers.mjs <clones-dir> [--facts <out.json>]
 * where <clones-dir> holds `ddd-forum/` and `event-sourcing-ddd/` checked out at the pins in
 * experiments/eff-01/repos.json. Writes experiments/eff-01/answers.json (and a facts dump if asked).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const picomatch = require('picomatch');
const yaml = require('js-yaml');

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const clonesDir = path.resolve(args[0] ?? '');
const factsOut = args.includes('--facts') ? args[args.indexOf('--facts') + 1] : undefined;
const repos = JSON.parse(fs.readFileSync(path.join(HERE, 'repos.json'), 'utf8'));
const questions = JSON.parse(fs.readFileSync(path.join(HERE, 'questions.json'), 'utf8'));

/** Test files are left out: every question is about the production architecture. */
const TEST_FILE = /\.(spec|test)\.ts$/;
const posix = (p) => p.split(path.sep).join('/');
const sortStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function listTs(dir, root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') listTs(p, root, out);
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') && !TEST_FILE.test(e.name)) out.push(posix(path.relative(root, p)));
  }
  return out;
}

function layerOf(layers, rel) {
  for (const l of layers) if (l.match(rel)) return l.name;
  return null;
}

/** Every module reference of one file: import/export-from declarations, import-equals, require() and import(). */
function moduleRefs(sf) {
  const refs = [];
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const typeOnly = ts.isImportDeclaration(n) ? Boolean(n.importClause?.isTypeOnly) : Boolean(n.isTypeOnly);
      refs.push({ spec: n.moduleSpecifier.text, line: line(n), typeOnly, kind: ts.isImportDeclaration(n) ? 'import' : 'export-from' });
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference) && ts.isStringLiteral(n.moduleReference.expression)) {
      refs.push({ spec: n.moduleReference.expression.text, line: line(n), typeOnly: false, kind: 'import-equals' });
    } else if (ts.isCallExpression(n) && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])
      && ((ts.isIdentifier(n.expression) && n.expression.text === 'require') || n.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      refs.push({ spec: n.arguments[0].text, line: line(n), typeOnly: false, kind: 'dynamic' });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return refs;
}

/** Classes and the interfaces they implement (heritage clauses, by simple name). */
function classFacts(sf) {
  const out = [];
  const visit = (n) => {
    if (ts.isClassDeclaration(n) && n.name) {
      const impl = [];
      const ext = [];
      for (const h of n.heritageClauses ?? []) {
        for (const t of h.types) {
          const name = t.expression.getText(sf);
          (h.token === ts.SyntaxKind.ImplementsKeyword ? impl : ext).push(name);
        }
      }
      out.push({ name: n.name.text, implements: impl, extends: ext });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Tarjan SCC over the internal file graph. */
function sccs(nodes, adj) {
  let index = 0;
  const idx = new Map(), low = new Map(), on = new Set(), stack = [], out = [];
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const c = [];
      let w;
      do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v);
      out.push(c.sort(sortStr));
    }
  };
  for (const v of nodes) if (!idx.has(v)) strong(v);
  return out;
}

function analyse(repo) {
  const root = path.join(clonesDir, repo.id);
  const spec = yaml.load(fs.readFileSync(path.join(REPO, repo.spec), 'utf8'));
  const arch = spec.architecture;
  const layers = arch.layers.map((l) => ({ name: l.name, match: picomatch(l.directories, { dot: true }) }));
  const allowed = new Map(arch.layers.map((l) => [l.name, new Set([l.name])]));
  for (const d of arch.allowed_dependencies ?? []) for (const t of d.to) allowed.get(d.from).add(t);

  const cfgPath = path.join(root, repo.tsconfig);
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
  const options = parsed.options;
  const files = listTs(path.join(root, 'src'), root).sort(sortStr);
  const fileSet = new Set(files);

  const edges = []; // one per (from, line, to): an import statement that resolves to an internal file
  const classes = {};
  const unresolvedRelative = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    const sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    classes[rel] = classFacts(sf);
    for (const r of moduleRefs(sf)) {
      const res = ts.resolveModuleName(r.spec, abs, options, ts.sys).resolvedModule;
      const target = res ? posix(path.relative(root, res.resolvedFileName)) : null;
      if (target && fileSet.has(target)) edges.push({ from: rel, to: target, line: r.line, typeOnly: r.typeOnly, kind: r.kind, spec: r.spec });
      else if (!target && (r.spec.startsWith('.') || r.spec.startsWith('src/'))) unresolvedRelative.push({ from: rel, spec: r.spec, line: r.line });
    }
  }
  const layer = Object.fromEntries(files.map((f) => [f, layerOf(layers, f)]));
  for (const e of edges) { e.fromLayer = layer[e.from]; e.toLayer = layer[e.to]; }
  const violations = edges.filter((e) => e.fromLayer && e.toLayer && !allowed.get(e.fromLayer).has(e.toLayer));

  const adj = new Map(files.map((f) => [f, new Set()]));
  for (const e of edges) if (e.from !== e.to) adj.get(e.from).add(e.to);
  const cyclic = sccs(files, adj).filter((c) => c.length > 1).sort((a, b) => b.length - a.length || sortStr(a[0], b[0]));
  const importers = new Map(files.map((f) => [f, new Set()]));
  for (const e of edges) if (e.from !== e.to) importers.get(e.to).add(e.from);
  const fanIn = files.map((f) => ({ file: f, importers: importers.get(f).size })).sort((a, b) => b.importers - a.importers || sortStr(a.file, b.file));

  const ctxOf = (f) => (arch.ddd?.contexts ?? []).find((c) => f.startsWith(c.root))?.name ?? null;
  for (const e of edges) { e.fromContext = ctxOf(e.from); e.toContext = ctxOf(e.to); }

  return { repo, root, files, layer, edges, violations, cyclic, fanIn, classes, unresolvedRelative, allowed, layers: arch.layers.map((l) => l.name) };
}

const committed = (a) => JSON.parse(fs.readFileSync(path.join(REPO, a.repo.committedReport), 'utf8'));

/**
 * Independent cross-check: the compiler-derived facts against the instrument's committed report (Neo4j run of
 * 2026-10-16; the in-process interpreter reproduces it row for row). Any disagreement is printed and recorded.
 */
function crossCheck(a) {
  const rep = committed(a);
  const key = (f, t, l) => `${f}|${t}|${l}`;
  const inst = new Set(rep.violations.filter((v) => v.functionId === 'FF-S01' || v.functionId === 'FF-S03').map((v) => key(v.filePath, v.target, v.line)));
  const mine = new Set(a.violations.map((e) => key(e.from, e.to, e.line)));
  const ds02 = rep.violations.filter((v) => v.functionId === 'FF-DS02').length;
  const cross = a.edges.filter((e) => e.fromContext && e.toContext && e.fromContext !== e.toContext).length;
  const checks = {
    'direction rows = FF-S01 u FF-S03 rows': { mine: mine.size, instrument: inst.size, equal: mine.size === inst.size && [...mine].every((k) => inst.has(k)) },
    'files = parseCoverage.total (the key drops *.spec.ts / *.test.ts, as ddd-forum\'s tsconfig does; the instrument parses 250 of the 251 .ts files, test files included; no answer-bearing count moves)': { mine: a.files.length, instrument: rep.parseCoverage.total, equal: a.files.length === rep.parseCoverage.total },
    'files on cycles = universalMetrics.cyclicDependencyCount': { mine: a.cyclic.reduce((s, c) => s + c.length, 0), instrument: rep.universalMetrics.cyclicDependencyCount },
    'max fan-in = universalMetrics.maxFanIn': { mine: a.fanIn[0].importers, instrument: rep.universalMetrics.maxFanIn },
    'cross-context imports vs FF-DS02 rows (FF-DS02 asserted only where public_api is declared narrower than the context)': { mine: cross, instrument: ds02 },
  };
  for (const c of Object.values(checks)) if (c.equal === undefined) c.equal = c.mine === c.instrument;
  return checks;
}

const pairKey = (e) => `${e.fromLayer}->${e.toLayer}`;
const countBy = (xs, k) => {
  const m = {};
  for (const x of xs) m[k(x)] = (m[k(x)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1] || sortStr(a[0], b[0])));
};

/** Each question template's derivation; `p` are the question's parameters. */
const DERIVE = {
  'layer-of-file': (a, p) => ({ answer: a.layer[p.file] ?? 'unmapped', evidence: { file: p.file } }),
  'direction-violation-count': (a) => ({
    answer: a.violations.length,
    evidence: { rows: a.violations.map((e) => `${e.from}:${e.line} -> ${e.to} (${pairKey(e)})`) },
  }),
  'files-importing-against-direction-from-layer': (a, p) => {
    const rows = a.violations.filter((e) => e.fromLayer === p.layer);
    return { answer: [...new Set(rows.map((e) => e.from))].sort(sortStr), evidence: { rows: rows.map((e) => `${e.from}:${e.line} -> ${e.to} (${e.toLayer})`) } };
  },
  'top-violating-layer-pair': (a) => {
    const c = countBy(a.violations, pairKey);
    const [top, n] = Object.entries(c)[0] ?? ['none', 0];
    return { answer: { pair: top, count: n }, evidence: { allPairs: c } };
  },
  'files-in-import-cycles': (a) => ({
    answer: { files: a.cyclic.reduce((s, c) => s + c.length, 0), largestCycleGroup: a.cyclic[0]?.length ?? 0 },
    evidence: { stronglyConnectedComponents: a.cyclic },
  }),
  'max-fan-in-file': (a) => {
    const top = a.fanIn[0];
    const ties = a.fanIn.filter((x) => x.importers === top.importers).map((x) => x.file);
    return { answer: { files: ties, importers: top.importers }, evidence: { top5: a.fanIn.slice(0, 5) } };
  },
  'cross-context-imports': (a, p) => {
    const dir = (from, to) => a.edges.filter((e) => e.fromContext === from && e.toContext === to);
    const ab = dir(p.a, p.b);
    const ba = dir(p.b, p.a);
    return {
      answer: { [`${p.a}->${p.b}`]: ab.length, [`${p.b}->${p.a}`]: ba.length },
      evidence: { rows: [...ab, ...ba].map((e) => `${e.from}:${e.line} -> ${e.to}`) },
    };
  },
  'hypothetical-import-allowed': (a, p) => {
    const from = a.layer[p.file];
    const to = a.layer[p.target];
    return { answer: { allowed: a.allowed.get(from).has(to), fromLayer: from, toLayer: to }, evidence: { allowedFrom: [...a.allowed.get(from)].sort(sortStr) } };
  },
  'implementer-of-interface': (a, p) => {
    const hits = [];
    for (const [f, cs] of Object.entries(a.classes)) for (const c of cs) if (c.implements.some((i) => i === p.interface || i.startsWith(`${p.interface}<`))) hits.push({ file: f, class: c.name });
    hits.sort((x, y) => sortStr(x.file, y.file));
    return { answer: hits, evidence: { source: 'class heritage clauses (implements), TypeScript AST' } };
  },
  'blocking-verdict': (a) => {
    // Instrument-defined truth (labelled): the committed report of the external set, not the compiler.
    const rep = committed(a);
    const ids = rep.tiers.blocking.rules.filter((r) => r.violated).map((r) => String(r.functionId)).sort(sortStr);
    return { answer: { verdict: rep.tiers.verdict, blockingRules: ids }, evidence: { source: a.repo.committedReport, note: 'instrument-defined truth; secondary analysis only' } };
  },
};

const out = { generatedBy: 'experiments/eff-01/derive-answers.mjs', typescript: ts.version, repos: {} };
const facts = {};
for (const repo of repos.repos) {
  const a = analyse(repo);
  facts[repo.id] = {
    files: a.files.length,
    internalImportStatements: a.edges.length,
    unresolvedRelative: a.unresolvedRelative,
    layerCounts: countBy(a.files, (f) => a.layer[f] ?? 'unmapped'),
    violationPairs: countBy(a.violations, pairKey),
    cyclic: a.cyclic,
    fanInTop: a.fanIn.slice(0, 8),
    crossContext: countBy(a.edges.filter((e) => e.fromContext && e.toContext && e.fromContext !== e.toContext), (e) => `${e.fromContext}->${e.toContext}`),
    implementsIndex: Object.entries(a.classes).flatMap(([f, cs]) => cs.filter((c) => c.implements.length).map((c) => `${f} ${c.name} implements ${c.implements.join(',')}`)),
    violations: a.violations.map((e) => `${e.from}:${e.line} -> ${e.to} (${pairKey(e)})`),
  };
  out.repos[repo.id] = {
    pin: repo.sha,
    files: a.files.length,
    internalImportStatements: a.edges.length,
    crossCheckAgainstInstrument: crossCheck(a),
    answers: Object.fromEntries((questions.repos[repo.id] ?? []).map((q) => [q.id, { template: q.template, truthSource: q.truthSource, ...DERIVE[q.template](a, q.params ?? {}) }])),
  };
}
if (factsOut) fs.writeFileSync(factsOut, `${JSON.stringify(facts, null, 1)}\n`);
fs.writeFileSync(path.join(HERE, 'answers.json'), `${JSON.stringify(out, null, 1)}\n`);
process.stdout.write(`wrote ${posix(path.relative(REPO, path.join(HERE, 'answers.json')))}\n`);
