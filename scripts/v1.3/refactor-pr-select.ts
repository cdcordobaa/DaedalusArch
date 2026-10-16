/**
 * Declared-refactor validity study, step 1: find the declared architecture refactors and their size-matched controls
 * in each repository's first-parent history (Docs/DiagnosticRuns/v1.3-validity-refactor-pr-plan.md §4). Git only: no
 * tool run, no LLM. Entry file: no exports.
 *
 * Usage (repository root; full clones under --repos, never committed):
 *   node --import tsx scripts/v1.3/refactor-pr-select.ts --repos <dir> [--id <id>]
 * Writes results/v1.3-validity-refactor-pr/selection/<id>.json.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isBotAuthor } from './lib/fixes-mined.js';
import {
  CALIPER, K_CONTROLS, capEvenly, classifyRefactor, isControlCandidate, isRevert, matchControls, prOf, type SizedCommit,
} from './lib/refactor-pr.js';

const OUT = path.join(process.cwd(), 'results/v1.3-validity-refactor-pr');
const CAP_PER_REPO = 10;

interface CorpusEntry { readonly id: string; readonly repo: string; readonly sha: string; readonly root: string; readonly historyPath?: string }

function git(cwd: string, args: readonly string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

interface Commit { sha: string; parent: string; index: number; time: number; author: string; email: string; message: string }

function history(clone: string, e: CorpusEntry): Commit[] {
  const hp = e.historyPath ?? e.root;
  const raw = git(clone, ['log', '--first-parent', '--reverse', '--format=%H%x00%P%x00%ct%x00%an%x00%ae%x00%B%x1e', e.sha, ...(hp === '.' ? [] : ['--', hp])]);
  const out: Commit[] = [];
  for (const rec of raw.split('\x1e')) {
    const r = rec.replace(/^\n/, '');
    if (r.trim() === '') continue;
    const [sha = '', parents = '', ct = '', author = '', email = '', message = ''] = r.split('\0');
    const parent = parents.split(' ')[0] ?? '';
    if (parent === '') continue;
    out.push({ sha, parent, index: out.length, time: Number(ct), author, email, message: message.trim() });
  }
  return out;
}

function size(clone: string, e: CorpusEntry, c: Commit): SizedCommit {
  const hp = e.historyPath ?? e.root;
  const raw = git(clone, ['diff', '--numstat', '-M50%', c.parent, c.sha, ...(hp === '.' ? [] : ['--', hp])]);
  let files = 0;
  let lines = 0;
  for (const l of raw.split('\n')) {
    if (l === '') continue;
    const [a = '', d = ''] = l.split('\t');
    files++;
    if (a !== '-') lines += Number(a) + Number(d);
  }
  return { sha: c.sha, index: c.index, time: c.time, files, lines };
}

function select(reposDir: string, e: CorpusEntry): void {
  const clone = path.join(reposDir, e.id);
  const t0 = performance.now();
  const all = history(clone, e);
  const eligible = all.filter((c) => !isBotAuthor(c.author, c.email) && !isRevert(c.message));
  const matched = eligible
    .map((c) => ({ c, m: classifyRefactor(c.message) }))
    .filter((x) => x.m.families.length > 0);
  const capped = capEvenly(matched, CAP_PER_REPO);
  const controlPool = eligible.filter((c) => isControlCandidate(c.message));
  const sizes = new Map<string, SizedCommit>();
  const sized = (c: Commit): SizedCommit => {
    let s = sizes.get(c.sha);
    if (s === undefined) { s = size(clone, e, c); sizes.set(c.sha, s); }
    return s;
  };
  const refSizes = capped.map((x) => sized(x.c));
  // A commit that touched the history path only outside the analysis root (or only by mode) has no size: never a
  // useful match for a refactor of size > 0, kept in the pool anyway (the caliper decides).
  const poolSizes = controlPool.map(sized);
  const sets = matchControls(refSizes, poolSizes, K_CONTROLS, CALIPER);
  const byShaMeta = new Map(all.map((c) => [c.sha, c]));
  const subject = (m: string): string => (m.split('\n')[0] ?? '').slice(0, 200);
  const doc = {
    id: e.id, repo: e.repo, pin: e.sha, root: e.root,
    universe: all.length, eligible: eligible.length, declaredRefactors: matched.length, controlPool: controlPool.length,
    cap: CAP_PER_REPO, caliper: CALIPER, k: K_CONTROLS,
    allMatches: matched.map((x) => ({ sha: x.c.sha, index: x.c.index, ...prOf(x.c.message), families: x.m.families, phrases: x.m.phrases, subject: subject(x.c.message) })),
    sets: sets.map((s) => {
      const r = byShaMeta.get(s.refactor) as Commit;
      const rs = sizes.get(s.refactor) as SizedCommit;
      const m = classifyRefactor(r.message);
      return {
        refactor: { sha: r.sha, parent: r.parent, index: r.index, date: new Date(r.time * 1000).toISOString(), ...prOf(r.message), families: m.families, phrases: m.phrases, files: rs.files, lines: rs.lines, subject: subject(r.message), message: r.message.slice(0, 1500) },
        controls: s.controls.map((x) => {
          const c = byShaMeta.get(x.sha) as Commit;
          const cs = sizes.get(x.sha) as SizedCommit;
          return { sha: c.sha, parent: c.parent, index: c.index, date: new Date(c.time * 1000).toISOString(), ...prOf(c.message), distance: x.distance, files: cs.files, lines: cs.lines, subject: subject(c.message) };
        }),
      };
    }),
    seconds: Math.round((performance.now() - t0) / 1000),
  };
  fs.mkdirSync(path.join(OUT, 'selection'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'selection', `${e.id}.json`), JSON.stringify(doc, null, 1) + '\n');
  const unmatched = doc.sets.filter((s) => s.controls.length === 0).length;
  process.stdout.write(`${e.id}\tuniverse ${String(all.length)}\tdeclared ${String(matched.length)}\tkept ${String(capped.length)}\tunmatched ${String(unmatched)}\tpool ${String(controlPool.length)}\t${String(doc.seconds)}s\n`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const at = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const reposDir = at('repos');
  if (reposDir === undefined) { process.stderr.write('usage: refactor-pr-select.ts --repos <dir> [--id <id>]\n'); process.exitCode = 2; return; }
  const corpus = (JSON.parse(fs.readFileSync(path.join(OUT, 'corpus.json'), 'utf8')) as { entries: CorpusEntry[] }).entries;
  const id = at('id');
  for (const e of corpus.filter((x) => id === undefined || x.id === id)) select(path.resolve(reposDir), e);
}

main();
