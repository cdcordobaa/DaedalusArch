#!/usr/bin/env node
/**
 * Hint audit for Study 2 task prompts (Docs/v1.3/study2-task-design.md §4). INFORMAL DESIGN AID.
 *
 * Greps agent-visible prompt text for the architecture vocabulary of a style: the layer names and folder globs of the
 * style's preset, the context names of a DDD spec, generic architecture words, and design-intent phrases that point at
 * a structure without naming it. Plain Node, no dependencies, no network.
 *
 * Usage (repository root):
 *   node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/hexagonal.yaml <file>...
 *   node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/ddd.yaml --term crews --term cellar tasks.json
 *   echo "some prompt" | node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/layered.yaml -
 *
 * Input: a LoopTasksFile JSON ({ tasks: [{ id, steps: [{ id, request }] }] }; only `request` fields are audited, never
 * commentary keys), a JSON array of strings, or any other file as plain text. `--frame <file>` audits a prompt frame
 * as the arm's frame: folder paths and layer names are then allowed in it only with `--frame-may-name-layout`
 * (arms that carry the layout sentence); without that flag (a no-hint arm) they FAIL like anywhere else.
 * Options: --task <id> audits only that task of a tasks file (repeatable); --context <name>
 * lists a DDD task's own context (WARN; repeatable); --term <word> adds a FAIL term (repeatable); --allow <word> waives a term, recorded in the output
 * (repeatable); --json prints the machine-readable report.
 * Exit: 0 no FAIL hit (WARN hits still need a written verdict on the audit sheet), 1 at least one FAIL hit, 2 usage error.
 */
import * as fs from 'node:fs';

const argv = process.argv.slice(2);
const files = [];
const frames = [];
const extraTerms = [];
const allowed = [];
let preset = '';
let json = false;
let frameMayNameLayout = false;
const onlyTasks = [];
const extraContexts = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--preset') preset = argv[++i] ?? '';
  else if (a === '--term') extraTerms.push(argv[++i] ?? '');
  else if (a === '--allow') allowed.push((argv[++i] ?? '').toLowerCase());
  else if (a === '--frame') frames.push(argv[++i] ?? '');
  else if (a === '--frame-may-name-layout') frameMayNameLayout = true;
  else if (a === '--context') extraContexts.push(argv[++i] ?? '');
  else if (a === '--task') onlyTasks.push(argv[++i] ?? '');
  else if (a === '--json') json = true;
  else files.push(a);
}
if (files.length === 0 && frames.length === 0) {
  process.stderr.write('usage: hint-audit.mjs [--preset <yaml>] [--task id]... [--context c]... [--term w]... [--allow w]... [--frame f [--frame-may-name-layout]] [--json] <file|->...\n');
  process.exit(2);
}

// ── Vocabulary ────────────────────────────────────────────────────────────────────────────────────────────────────
// FAIL: words that name a structure. They have no ordinary product meaning in a task request.
const GENERIC_FAIL = [
  'architecture', 'architectural', 'layer', 'layers', 'layered', 'n-tier',
  'hexagonal', 'hexagon', 'ports and adapters', 'port', 'ports', 'adapter', 'adapters', 'onion', 'clean architecture',
  'domain-driven', 'ddd', 'bounded context', 'bounded contexts', 'aggregate root', 'value object',
  'value objects', 'entity', 'entities', 'shared kernel', 'anti-corruption', 'acl', 'context map',
  'repository', 'repositories', 'dao', 'use case', 'use cases', 'usecase', 'interactor',
  'controller', 'controllers', 'presenter', 'view model', 'dto', 'dtos',
  'dependency injection', 'composition root', 'ioc',
  'dependency inversion', 'inversion of control', 'interface', 'interfaces', 'abstraction', 'abstract class',
  'facade', 'strategy pattern', 'observer pattern',
  'cqrs', 'event sourcing', 'event bus', 'message bus', 'mediator', 'unit of work', 'middleware',
  'infrastructure', 'persistence', 'data access', 'business logic', 'business layer', 'business rules layer',
  'presentation layer', 'pluggable',
  'decouple', 'decoupled', 'decoupling', 'loosely coupled', 'coupling', 'cohesion', 'solid',
  'mock', 'mocks', 'testable', 'unit test', 'unit tests',
];
// WARN: ordinary English that can also hint at a structure. Each hit needs a one-line human verdict.
const GENERIC_WARN = [
  // ambiguous architecture words (an ordinary product sense exists: a membership tier, a driving licence, an injection)
  'tier', 'tiers', 'driving', 'driven', 'core', 'container', 'factory', 'decorator', 'gateway', 'pattern', 'inject', 'injected', 'injection', 'aggregate', 'plugin', 'mapper', 'stub', 'singleton', 'solid', 'inbound', 'outbound',
  'service', 'services', 'module', 'modules', 'component', 'components', 'separate', 'separately', 'independent',
  'independently', 'swap', 'replace', 'reuse', 'shared', 'common', 'central', 'centrally', 'one place', 'wrapper',
  'client', 'handler', 'endpoint', 'api', 'model', 'models', 'schema', 'config', 'configuration', 'setting', 'settings',
  'logic', 'rules', 'boundary', 'boundaries', 'contract', 'contracts', 'public', 'internal', 'translate', 'translation',
  'clean', 'structure', 'organise', 'organize', 'folder', 'directory', 'file', 'files', 'src',
];

/** Layer names and folder globs of a preset, by a line scan of its YAML (no YAML dependency). */
function presetVocabulary(file) {
  const text = fs.readFileSync(file, 'utf8');
  const names = new Set();
  const dirs = new Set();
  const contexts = new Set();
  let inLayers = false;
  let inContexts = false;
  for (const line of text.split('\n')) {
    if (/^\s{2}layers:\s*$/.test(line)) { inLayers = true; continue; }
    if (/^\s{4}contexts:\s*$/.test(line)) { inContexts = true; continue; }
    if (inLayers && /^\s{0,2}\S/.test(line) && !/^\s*#/.test(line)) inLayers = false;
    if (inContexts && /^\s{0,4}[a-z_]+:/.test(line)) inContexts = false;
    const name = /^\s*- name:\s*([\w-]+)/.exec(line);
    if (inLayers && name) names.add(name[1]);
    if (inContexts && name) contexts.add(name[1]);
    const dir = /^\s*-\s*(src\/[^\s#]+)/.exec(line);
    if (dir) dirs.add(dir[1]);
    const root = /root:\s*(src\/\S+)/.exec(line);
    if (root) dirs.add(root[1]);
  }
  return { names: [...names], dirs: [...dirs], contexts: [...contexts] };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w) => new RegExp(`(?<![\\w-])${esc(w).replace(/[-\s]+/g, '[-\\s]?')}(?![\\w-])`, 'gi');

const vocab = preset !== '' ? presetVocabulary(preset) : { names: [], dirs: [], contexts: [] };
// Layer names split into their words (adapters-inbound → adapters, inbound). A layer name that is also ordinary
// English (business, application, presentation, domain, config, api, composition) is WARN; the rest are FAIL.
const ORDINARY = new Set(['business', 'application', 'presentation', 'domain', 'config', 'api', 'composition']);
const layerWords = [...new Set(vocab.names.flatMap((n) => [n, ...n.split('-')]))];
const fail = new Map();
const warn = new Map();
for (const w of GENERIC_FAIL) fail.set(w, 'architecture word');
for (const w of GENERIC_WARN) warn.set(w, 'ordinary word that can hint');
for (const w of layerWords) (ORDINARY.has(w) ? warn : fail).set(w, `layer name in ${preset}`);
warn.delete('domain');
fail.set('domain', `layer name in ${preset || 'hexagonal/clean/ddd'}`); // "domain" has no product meaning in these tasks
for (const c of vocab.contexts) warn.set(c, `context name in ${preset}`);
// A DDD task's own contexts (--context): the frame names them as parts, so the requests may use the part's plain name
// (WARN, verdict needed); their folder paths are FAIL like every src/ path.
for (const c of extraContexts) if (c !== '') warn.set(c.toLowerCase(), 'context of this task (--context)');
for (const t of extraTerms) if (t !== '') fail.set(t.toLowerCase(), 'extra term (--term)');
for (const w of fail.keys()) warn.delete(w);

// Code identifiers that carry a role (SmsAdapter, PaymentPort, IOrderRepository, CreateBookingUseCase).
const CODE_NAME = /\b[A-Z]\w*?(?:Adapter|Port|Repository|Repo|Gateway|Controller|UseCase|Interactor|Service|Dto|DTO|Entity|Presenter|Factory|Handler|Client|Provider|Store|Dao|DAO)s?\b/g;

// Folder and file hints: any path under src/, any glob, any folder name of the preset written as a path, file names.
const pathPatterns = [
  { re: /\bsrc\/[\w./*-]*/gi, why: 'source path' },
  { re: /\*\*|\/\*(?!\w)|\*\.\w+/g, why: 'glob' },
  { re: /\b[\w-]+\.(?:ts|js|mjs|json|yaml|yml)\b/gi, why: 'file name' },
  // Bare a/b pairs are WARN: "and/or", "e-mail/SMS" are ordinary; a preset folder (below) is FAIL.
  { re: /(?:^|\s)\/?[a-z][\w-]*\/[a-z][\w-]*\/?(?=[\s.,;:)]|$)/gi, why: 'folder-like a/b', level: 'WARN' },
];
for (const d of vocab.dirs) {
  const bare = d.replace(/\/\*\*$|\/$/g, '');
  pathPatterns.push({ re: new RegExp(esc(bare), 'gi'), why: `folder of ${preset}` });
}

// ── Inputs ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Returns [{ where, text, frame }]. */
function units(file, frame) {
  const raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  if (!frame && /\.json$/i.test(file)) {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.map((t, i) => ({ where: `${file}[${i}]`, text: String(t), frame }));
    if (Array.isArray(data.tasks)) {
      return data.tasks.filter((t) => onlyTasks.length === 0 || onlyTasks.includes(t.id)).flatMap((t) => (t.steps ?? []).map((s) => ({ where: `${file} ${t.id}/${s.id}`, text: String(s.request ?? ''), frame })));
    }
  }
  return [{ where: file, text: raw, frame }];
}

const all = [...files.flatMap((f) => units(f, false)), ...frames.flatMap((f) => units(f, true))];
const report = [];
for (const u of all) {
  const hits = [];
  const add = (level, term, why, index) => {
    const t = term.trim().toLowerCase();
    const waived = allowed.includes(t);
    hits.push({ level: waived ? 'WAIVED' : level, term: term.trim(), why, at: index });
  };
  const layoutOk = u.frame && frameMayNameLayout;
  // A frame of an arm that carries the style and layout sentences may name them: its hits are listed as WARN, for
  // the identity check across arms (gate D2). In a no-hint frame and in every step request they FAIL.
  for (const [w, why] of fail) for (const m of u.text.matchAll(wordRe(w))) add(layoutOk ? 'WARN' : 'FAIL', m[0], why, m.index);
  for (const m of u.text.matchAll(CODE_NAME)) add(layoutOk ? 'WARN' : 'FAIL', m[0], 'code identifier with a role suffix', m.index);
  for (const [w, why] of warn) for (const m of u.text.matchAll(wordRe(w))) add('WARN', m[0], why, m.index);
  for (const p of pathPatterns) for (const m of u.text.matchAll(p.re)) add(layoutOk || p.level === 'WARN' ? 'WARN' : 'FAIL', m[0], p.why, m.index);
  // One hit per (level, term, position): longer phrases and single words can overlap; keep both, they are cheap.
  hits.sort((a, b) => a.at - b.at);
  report.push({ where: u.where, frame: u.frame, fail: hits.filter((h) => h.level === 'FAIL').length, warn: hits.filter((h) => h.level === 'WARN').length, hits });
}

const totalFail = report.reduce((s, r) => s + r.fail, 0);
if (json) {
  process.stdout.write(JSON.stringify({ preset, extraTerms, allowed, frameMayNameLayout, totalFail, report }, null, 1) + '\n');
} else {
  process.stdout.write(`hint audit: preset=${preset || '(none)'} layers=[${vocab.names.join(', ')}] dirs=[${vocab.dirs.join(', ')}]` +
    `${vocab.contexts.length ? ` contexts=[${vocab.contexts.join(', ')}]` : ''}${extraTerms.length ? ` extra=[${extraTerms.join(', ')}]` : ''}\n`);
  for (const r of report) {
    process.stdout.write(`${r.fail > 0 ? 'FAIL' : r.warn > 0 ? 'WARN' : 'OK  '}  ${r.where}${r.frame ? ' (frame)' : ''}: ${r.fail} fail, ${r.warn} warn\n`);
    for (const h of r.hits) {
      const u = all.find((x) => x.where === r.where);
      const ctx = u.text.slice(Math.max(0, h.at - 30), h.at + h.term.length + 30).replace(/\s+/g, ' ');
      process.stdout.write(`      ${h.level.padEnd(6)} "${h.term}" (${h.why}) …${ctx}…\n`);
    }
  }
  process.stdout.write(`total: ${totalFail} FAIL hit(s) in ${report.length} unit(s)\n`);
}
process.exit(totalFail > 0 ? 1 : 0);
