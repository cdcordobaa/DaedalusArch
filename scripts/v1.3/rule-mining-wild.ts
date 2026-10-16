/**
 * Rule mining on the external ("wild") projects of `results/v1.3-wild/selection.json` (Docs/v1.3/rule-mining.md §5):
 * descriptive only, there is no ground truth. Each clone (at the pinned sha, made by the caller) is read through a
 * snapshot that holds its `src/` and the harness tsconfig flattened as `scripts/v1.3/wild-run.ts` does (the
 * repositories' dependencies are not installed). The clones are never written. Entry file: no exports.
 *
 * Usage (repository root): npx tsx scripts/v1.3/rule-mining-wild.ts --repos <dir with one clone per entry id>
 *   [--out results/v1.3-rule-mining/2026-10-16] [--id a,b]
 * Writes <out>/wild/<id>.json (the proposal summary, at most 10 exceptions per rule), <out>/wild/<id>.mined.yaml and
 * <out>/wild.md.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ts from 'typescript';
import { analyseSnapshot, proposeFromAnalysis, summariseProposal } from '../../src/rule-mining/index.js';
import type { ProposalSummary } from '../../src/rule-mining/index.js';
import { flattenTsconfig } from './lib/wild.js';

interface Entry { id: string; url: string; sha: string; root: string; tsconfig: string; include?: string[]; styleGroup?: string }

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const REPOS = path.resolve(arg('--repos') ?? '');
const OUT = path.resolve(arg('--out') ?? 'results/v1.3-rule-mining/2026-10-16');
const ONLY = arg('--id')?.split(',');

function workspacePackageFile(clone: string, spec: string): string | undefined {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] ?? '';
  const rest = parts.slice(spec.startsWith('@') ? 2 : 1).join('/');
  for (const f of spawnSync('git', ['ls-files', '*package.json'], { cwd: clone, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)) {
    const abs = path.join(clone, f);
    if (!fs.existsSync(abs)) continue;
    try {
      if ((JSON.parse(fs.readFileSync(abs, 'utf8')) as { name?: string }).name === name) {
        const target = path.join(path.dirname(abs), rest === '' ? 'tsconfig.json' : rest);
        return fs.existsSync(target) ? target : undefined;
      }
    } catch { /* not JSON */ }
  }
  return undefined;
}

interface WildRow { id: string; styleGroup: string; head: string; shaOk: boolean; ms: number; error?: string; summary?: Omit<ProposalSummary, 'rules'> & { byKind: Record<string, { rules: number; high: number; exceptions: number }> }; files?: number }

async function analyse(e: Entry): Promise<WildRow> {
  const clone = path.join(REPOS, e.id);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).stdout.trim();
  const base = { id: e.id, styleGroup: e.styleGroup ?? '', head, shaOk: head === e.sha };
  const root = path.join(clone, e.root);
  if (!fs.existsSync(path.join(root, 'src'))) return { ...base, ms: 0, error: 'no src/ under the analysis root (clone missing?)' };
  const reader = {
    read: (p: string): Record<string, unknown> | undefined => {
      if (!fs.existsSync(p)) return undefined;
      const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
      return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
    },
    resolvePackage: (spec: string): string | undefined => workspacePackageFile(clone, spec),
  };
  const flat = flattenTsconfig(path.join(root, e.tsconfig), root, reader, e.include);
  const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-wild-'));
  const dir = path.join(holder, 'project');
  fs.mkdirSync(dir);
  fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true, filter: (p) => !p.includes(`${path.sep}node_modules`) });
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(flat.tsconfig, null, 2) + '\n');
  const t0 = Date.now();
  try {
    const analysis = await analyseSnapshot(fs.realpathSync(dir), { presetsDir: path.resolve('presets') });
    const p = await proposeFromAnalysis(analysis, { presetsDir: path.resolve('presets') });
    const s = summariseProposal(p, { maxExceptions: 10 });
    fs.writeFileSync(path.join(OUT, 'wild', `${e.id}.json`), JSON.stringify({ id: e.id, sha: e.sha, ...s }, null, 1) + '\n');
    fs.writeFileSync(path.join(OUT, 'wild', `${e.id}.mined.yaml`), p.specYaml);
    const byKind: Record<string, { rules: number; high: number; exceptions: number }> = {};
    for (const r of p.mining.rules) {
      const k = byKind[r.kind] ?? { rules: 0, high: 0, exceptions: 0 };
      k.rules++; if (r.level === 'high') k.high++; k.exceptions += r.exceptions.length;
      byKind[r.kind] = k;
    }
    const { rules: _rules, ...rest } = s;
    void _rules;
    return { ...base, ms: Date.now() - t0, files: analysis.graph.files.length, summary: { ...rest, byKind } };
  } catch (err: unknown) {
    return { ...base, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    fs.rmSync(holder, { recursive: true, force: true });
  }
}

function render(rows: readonly WildRow[]): string {
  const out = ['# Rule mining on the external projects (descriptive)', '', 'Generated by scripts/v1.3/rule-mining-wild.ts. No ground truth: counts only.', ''];
  out.push('| Project | Selection group | Files | ISE style (conf.) | Layers with files | Rules (high / medium / low) | Exceptions | Allowed layer edges | Spec valid | Seconds |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    if (r.summary === undefined) { out.push(`| ${r.id} | ${r.styleGroup} | - | ERROR: ${r.error ?? ''} | | | | | | ${(r.ms / 1000).toFixed(0)} |`); continue; }
    const s = r.summary;
    out.push(`| ${r.id} | ${r.styleGroup} | ${String(r.files ?? 0)} | ${s.style} (${s.styleConfidence.toFixed(2)}) | ${String(Object.keys(s.layers).length)} | ${String(s.counts.rules)} (${String(s.counts.high)} / ${String(s.counts.medium)} / ${String(s.counts.low)}) | ${String(s.counts.exceptions)} | ${String(s.allowedDependencies.length)} | ${s.spec.valid ? 'yes' : `no: ${s.spec.errors.slice(0, 2).join('; ')}`} | ${(r.ms / 1000).toFixed(0)} |`);
  }
  const kinds = [...new Set(rows.flatMap((r) => Object.keys(r.summary?.byKind ?? {})))].sort();
  out.push('', '## Rules by kind (rules / of them high / exceptions)', '', `| Project | ${kinds.join(' | ')} |`, `|---|${kinds.map(() => '---').join('|')}|`);
  for (const r of rows.filter((x) => x.summary !== undefined)) {
    out.push(`| ${r.id} | ${kinds.map((k) => { const v = r.summary?.byKind[k]; return v === undefined ? '-' : `${String(v.rules)} / ${String(v.high)} / ${String(v.exceptions)}`; }).join(' | ')} |`);
  }
  return out.join('\n') + '\n';
}

async function main(): Promise<void> {
  if (arg('--repos') === undefined) throw new Error('--repos <dir> is required');
  const sel = (JSON.parse(fs.readFileSync('results/v1.3-wild/selection.json', 'utf8')) as { entries: Entry[] }).entries.filter((e) => ONLY === undefined || ONLY.includes(e.id));
  fs.mkdirSync(path.join(OUT, 'wild'), { recursive: true });
  const rows: WildRow[] = [];
  for (const e of sel) {
    const r = await analyse(e);
    rows.push(r);
    process.stderr.write(`${e.id}: ${r.error ?? `${String(r.summary?.counts.rules)} rules`} (${String(r.ms)} ms)\n`);
  }
  fs.writeFileSync(path.join(OUT, 'wild.json'), JSON.stringify(rows, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'wild.md'), render(rows));
}

main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
