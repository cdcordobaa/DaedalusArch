#!/usr/bin/env node
// v1.3 number-level replication runner (replication package, part 2; see Docs/v1.3/replication-2.md).
//
// Every number stated in Docs/DiagnosticRuns/v1.3-*.md and Docs/v1.3/*.md that asserts a fact about a result or the
// repository is registered in one of the group modules in replication/v1.3/groups/*.mjs, with its doc file:line, the
// value as the doc states it, and how it is produced. A group whose inputs are all committed has a run(ctx) that
// regenerates (or re-derives) the values offline and returns them formatted exactly as the doc writes them. Groups
// that need Neo4j, a model (LLM) or an input outside the repository are listed but never run.
//
//   node replication/v1.3/run.mjs                  # run every offline group, print the pass/fail table
//   node replication/v1.3/run.mjs --group <id>[,<id>]   # only these groups
//   node replication/v1.3/run.mjs --number <id>    # only the group holding this number, print that row
//   node replication/v1.3/run.mjs --list           # list the groups and their commands, run nothing
//   node replication/v1.3/run.mjs --fast           # skip groups marked slow (jest, tsc, full regenerations)
//   node replication/v1.3/run.mjs --md <file>      # also write the full table (all numbers, every status) as markdown
//   node replication/v1.3/run.mjs --json <file>    # also write the rows as JSON
//
// Statuses: PASS (reproduced, equal to the stated value), FAIL (reproduced, differs), KNOWN (FAIL already explained in
// Docs/v1.3/replication-2.md; the reproduced value must still equal the recorded `actual`, otherwise it is FAIL),
// ERROR (the group threw), and, for numbers that are not run: needs-LLM, needs-Neo4j, needs-external, not-checkable.
// Exit 0 when there is no FAIL and no ERROR.
//
// No credentials: every API key and NEO4J_* variable is removed from the environment of every child process. No group
// may call a model. Groups that run scripts which write into the repository run them in a scratch export of HEAD
// (ctx.tree()), never in the working tree.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const flag = (n) => args.includes(n);

const SCRUB = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'CODEX_API_KEY',
  'NEO4J_URI', 'NEO4J_USER', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
const env = { ...process.env };
for (const k of SCRUB) delete env[k];
env.NEO4J_URI = '';

// ---- shared helpers handed to every group -------------------------------------------------------------------------
const WORK = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'daedalus-rep2-'));
let treeDir;
const ctx = {
  repo: REPO,
  env,
  /** Absolute path of a repo-relative path. */
  p: (rel) => (isAbsolute(rel) ? rel : join(REPO, rel)),
  read: (rel) => readFileSync(ctx.p(rel), 'utf8'),
  json: (rel) => JSON.parse(readFileSync(ctx.p(rel), 'utf8')),
  exists: (rel) => existsSync(ctx.p(rel)),
  ls: (rel) => readdirSync(ctx.p(rel)).sort(),
  /** CSV (no quoted newlines) -> array of objects keyed by the header. */
  csv: (rel) => parseCsv(ctx.read(rel)),
  /** Run a shell command (default cwd: the repo; pass {cwd: ctx.tree()} for scripts that write into the tree). */
  sh: (cmd, o = {}) => execSync(cmd, { cwd: o.cwd ?? REPO, env, encoding: 'utf8', stdio: ['ignore', 'pipe', o.quiet === false ? 'inherit' : 'pipe'], maxBuffer: 1 << 28, timeout: o.timeout ?? 30 * 60_000 }),
  /** A fresh scratch output directory for a group. */
  out: (name) => { const d = join(WORK, 'out', name); rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); return d; },
  /** A scratch export of the committed HEAD tree with node_modules linked (created once per run). */
  tree: () => {
    if (treeDir) return treeDir;
    treeDir = join(WORK, 'tree');
    mkdirSync(treeDir, { recursive: true });
    execSync(`git -C "${REPO}" archive HEAD | tar -x -C "${treeDir}"`, { env, stdio: 'pipe' });
    symlinkSync(join(REPO, 'node_modules'), join(treeDir, 'node_modules'));
    const dc = 'experiments/tool-comparison/depcruise/node_modules';
    if (existsSync(join(REPO, dc)) && existsSync(join(treeDir, dirname(dc)))) symlinkSync(join(REPO, dc), join(treeDir, dc));
    return treeDir;
  },
  wilson,
  /** k/n = 0.xx [lo, hi] as ue-score.ts / ffp06-na-recount.mjs print it. */
  cell: (k, n) => (n === 0 ? 'n/a' : `${k}/${n} = ${f2(k / n)} [${f2(wilson(k, n)[0])}, ${f2(wilson(k, n)[1])}]`),
  f2,
  f: (x, d) => x.toFixed(d),
  pct: (x, d = 0) => `${(100 * x).toFixed(d)}%`,
};

function wilson(k, n) {
  if (n === 0) return null;
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
function f2(x) { return x.toFixed(2); }
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === '') continue;
    const cells = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur); rows.push(cells);
  }
  const [h, ...body] = rows;
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

// ---- load groups ---------------------------------------------------------------------------------------------------
const gdir = join(REPO, 'replication/v1.3/groups');
const groups = [];
for (const f of readdirSync(gdir).filter((x) => x.endsWith('.mjs')).sort()) {
  const g = (await import(pathToFileURL(join(gdir, f)).href)).default;
  const list = Array.isArray(g) ? g : [g];
  for (const x of list) { x.file = `replication/v1.3/groups/${f}`; groups.push(x); }
}
const seen = new Set();
for (const g of groups) {
  if (seen.has(g.id)) throw new Error(`duplicate group id ${g.id}`);
  seen.add(g.id);
  for (const n of g.numbers) {
    if (seen.has(n.id)) throw new Error(`duplicate number id ${n.id}`);
    seen.add(n.id);
  }
}

const cmdOf = (g) => `node replication/v1.3/run.mjs --group ${g.id}`;
if (flag('--list')) {
  for (const g of groups) console.log(`${g.id.padEnd(28)} ${String(g.numbers.length).padStart(4)} numbers  ${(g.run ? (g.slow ? 'offline (slow)' : 'offline') : g.needs).padEnd(15)} ${g.run ? cmdOf(g) : `(not run) ${g.how ?? ''}`}`);
  process.exit(0);
}

let want = groups;
if (opt('--group')) { const ids = opt('--group').split(','); want = groups.filter((g) => ids.includes(g.id)); if (want.length !== ids.length) throw new Error(`unknown group in ${ids}`); }
if (opt('--number')) { want = groups.filter((g) => g.numbers.some((n) => n.id === opt('--number'))); if (!want.length) throw new Error(`unknown number ${opt('--number')}`); }
if (flag('--fast')) want = want.filter((g) => !g.slow);

// ---- run ------------------------------------------------------------------------------------------------------------
const rows = [];
const t0 = Date.now();
console.log(`commit ${execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' }).trim()}, node ${process.version}, scratch ${WORK}`);
for (const g of groups) {
  const runIt = want.includes(g) && typeof g.run === 'function';
  let actual = {}; let err;
  if (runIt) {
    const t = Date.now();
    process.stderr.write(`== ${g.id} ... `);
    try { actual = (await g.run(ctx)) ?? {}; } catch (e) { err = e; }
    process.stderr.write(`${err ? 'ERROR' : 'done'} (${((Date.now() - t) / 1000).toFixed(1)}s)\n`);
    if (err) process.stderr.write(`   ${String(err.stack ?? err).split('\n').slice(0, 6).join('\n   ')}\n`);
  }
  for (const n of g.numbers) {
    const needs = n.needs ?? (g.run ? 'offline' : g.needs);
    let status; let act = '';
    if (!(g.run && needs === 'offline')) status = needs;
    else if (!runIt) status = 'skipped';
    else if (err) status = 'ERROR';
    else if (!(n.id in actual)) { status = 'ERROR'; act = '(not returned)'; }
    else {
      act = String(actual[n.id]);
      if (act === String(n.stated)) status = 'PASS';
      else if (n.known && act === String(n.known.actual)) status = 'KNOWN';
      else status = 'FAIL';
    }
    rows.push({ id: n.id, group: g.id, doc: n.doc, line: n.line, what: n.what, stated: String(n.stated), actual: act, status,
      command: g.run && needs === 'offline' ? cmdOf(g) : (n.how ?? g.how ?? ''), basis: n.basis ?? g.basis ?? '',
      note: n.known?.note ?? n.note ?? '' });
  }
}

// ---- report ---------------------------------------------------------------------------------------------------------
const shown = rows.filter((r) => r.status !== 'skipped' && (!opt('--number') || r.id === opt('--number')));
const w = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
console.log(`\n${w('number', 22)} ${w('doc:line', 52)} ${w('stated', 26)} ${w('reproduced', 26)} status`);
for (const r of shown.filter((x) => !['needs-LLM', 'needs-Neo4j', 'needs-external', 'not-checkable'].includes(x.status) || opt('--number'))) {
  console.log(`${w(r.id, 22)} ${w(`${r.doc.replace(/^Docs\//, '')}:${r.line}`, 52)} ${w(r.stated, 26)} ${w(r.actual, 26)} ${r.status}`);
}
const count = (s) => rows.filter((r) => r.status === s).length;
console.log(`\n${rows.length} numbers registered in ${groups.length} groups. PASS ${count('PASS')}, FAIL ${count('FAIL')}, KNOWN ${count('KNOWN')}, ERROR ${count('ERROR')}; not run: needs-LLM ${count('needs-LLM')}, needs-Neo4j ${count('needs-Neo4j')}, needs-external ${count('needs-external')}, not-checkable ${count('not-checkable')}, skipped ${count('skipped')}. ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const md = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
if (opt('--md')) {
  const lines = ['| id | number (as stated) | doc file:line | command | reproduced | difference |', '|---|---|---|---|---|---|'];
  for (const r of rows) {
    const rep = { PASS: 'yes', FAIL: 'no', KNOWN: 'no', ERROR: 'error' }[r.status] ?? r.status;
    const diff = r.status === 'PASS' ? '—' : (r.status === 'FAIL' || r.status === 'KNOWN') ? `reproduced ${md(r.actual)}${r.note ? `; ${md(r.note)}` : ''}` : md(r.note || '');
    lines.push(`| ${r.id} | ${md(r.what)}: **${md(r.stated)}** | \`${r.doc}:${r.line}\` | ${r.command ? `\`${md(r.command)}\`` : ''} | ${rep} | ${diff} |`);
  }
  writeFileSync(opt('--md'), `${lines.join('\n')}\n`);
}
if (opt('--json')) writeFileSync(opt('--json'), `${JSON.stringify(rows, null, 2)}\n`);
if (!flag('--keep')) rmSync(WORK, { recursive: true, force: true });
process.exit(count('FAIL') + count('ERROR') === 0 ? 0 : 1);
