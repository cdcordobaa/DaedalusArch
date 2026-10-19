/**
 * v1.4 Tier A, gate line V9 (REV-04 P19): the MCP `check_diff` answer against the full evaluation on stored agent-code
 * snapshots, per style. Entry file: no exports. Report: `Docs/DiagnosticRuns/v1.4-ddd-b2-t1-and-parity-2026-10-19.md` §4.
 *
 * Usage (repository root), after `ddd-b2-t1-rescore.ts --engine cypher-interp` has written the full evaluations:
 *   npx tsx scripts/v1.4/mcp-fast-vs-full-loop.ts --work <scratch dir> --node-modules <skeleton node_modules> [--dest results/v1.4-ddd-b2-t1]
 *
 * Zero model calls, no Neo4j. For every step s of every run (Layered: probe 1's 14 `none` snapshots; DDD: the loop
 * pilot's 8 snapshots under the D-c specs `dc` and `dc-acl0`; Clean and Hexagonal: the 16 loop snapshots), the diff
 * from the step s-1 tree (step 1: the run's base, the skeleton) to the step s tree is given to `check_diff` with the
 * project root on the step s tree (`after-write`, the mode the agent uses after writing), once on the default fast path
 * and once with `--fast-rules-engine cypher-interp` (`Docs/v1.3/mcp-interp-parity.md`). The full evaluation's answer
 * is the blocking findings of step s minus those of step s-1 (multiset on rule, file, target), read from
 * `<dest>/cypher-interp/cli/...`; the comparison is `compareVariant` of `scripts/v1.3/lib/mcp-consistency.ts`.
 *
 * Two configurations: `post-seal-on` (the tools' production default: the spec loader adds the post-seal rules)
 * against the full evaluation with `--post-seal on`; `sealed` (the loader with `postSeal: false`, fast path only,
 * because the interpreter option's pipeline always compiles the post-seal rules under v1.3) against `--post-seal off`.
 * Writes <dest>/v9/mcp-vs-full.json and <dest>/v9/mcp-vs-full.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkDiffTool, createSpecLoader } from '../../src/mcp-server/tools.js';
import type { ServerContext } from '../../src/mcp-server/tools.js';
import { InterpEvaluator } from '../../src/mcp-server/interp-check.js';
import type { FastRulesEngine } from '../../src/mcp-server/interp-check.js';
import { compareVariant, projectDiff } from '../v1.3/lib/mcp-consistency.js';
import type { FullFinding, VariantComparison } from '../v1.3/lib/mcp-consistency.js';

const REPO = process.cwd();
const PILOT = 'experiments/loop-pilot/run-2026-10-16/outputs/runs/claude-code-cli/claude-sonnet-5-5';
const PROBE = 'results/v1.3-floor-probe';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}

interface Run { subject: string; style: string; run: string; variants: { id: string; spec: string }[]; steps: { label: string; write: (dir: string) => void }[]; base: (dir: string) => void }

function gitWriter(runDir: string, commit: string): (dir: string) => void {
  return (dir) => {
    const tar = execFileSync('git', ['--git-dir', path.join(runDir, 'snapshots.git'), 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  };
}

function runs(dest: string): Run[] {
  const out: Run[] = [];
  for (const task of ['market-vendors', 'youth-league', 'hive-health']) {
    const base = path.join(REPO, PROBE, task, 'none', 'snapshots');
    const pkg = (dir: string): void => fs.copyFileSync(path.join(REPO, 'scripts', 'generator', 'skeleton', 'package.json'), path.join(dir, 'package.json'));
    out.push({
      subject: 'layered', style: 'layered', run: `${task}/none`, variants: [{ id: 'preset', spec: path.join(REPO, 'presets', 'layered.yaml') }],
      base: pkg,
      steps: fs.readdirSync(base).filter((d) => /^step-\d\d$/.test(d)).sort().map((d) => ({ label: d, write: (dir: string) => { pkg(dir); fs.cpSync(path.join(base, d, 'src'), path.join(dir, 'src'), { recursive: true }); } })),
    });
  }
  for (const task of ['relief-volunteers', 'market-vendors', 'shelter-adoptions']) {
    for (const arm of ['none', 'gate']) {
      const runDir = path.join(REPO, PILOT, task, arm, 'run-0');
      const log = execFileSync('git', ['--git-dir', path.join(runDir, 'snapshots.git'), 'log', '--format=%H %s', '--reverse', '--all']).toString('utf8').trim().split('\n');
      const baseCommit = log.find((l) => l.includes('base: skeleton'))?.split(' ')[0] ?? '';
      const recs = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(runDir, 'steps', f), 'utf8')) as { stepIndex: number; finalCommit: string; evaluatorSpec: { kind: string; path: string } });
      const ddd = recs[0]?.evaluatorSpec.kind === 'frozen-after-step-1';
      out.push({
        subject: ddd ? 'ddd' : 'loop-static',
        style: ddd ? 'ddd' : task === 'market-vendors' ? 'clean-architecture' : 'hexagonal',
        run: `${task}/${arm}`,
        variants: ddd
          ? ['dc', 'dc-acl0'].map((id) => ({ id, spec: path.join(dest, 'specs', task, arm, `${id}.yaml`) }))
          : [{ id: 'static', spec: path.resolve(REPO, recs[0]?.evaluatorSpec.path ?? '') }],
        base: gitWriter(runDir, baseCommit),
        steps: recs.map((r) => ({ label: `step-${String(r.stepIndex + 1).padStart(2, '0')}`, write: gitWriter(runDir, r.finalCommit) })),
      });
    }
  }
  return out;
}

interface CliReport { violations: { functionId: string; filePath: string; target?: string; discriminator?: string[] }[]; tiers: { blocking: { rules: { functionId: string }[] } } }

const fkey = (f: { ruleId: string; file: string; target?: string | undefined }): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;

/** The full evaluation's blocking findings of one stored report (FF-P06 FLOWS_TO rows N/A). */
function fullBlocking(file: string): FullFinding[] {
  const r = JSON.parse(fs.readFileSync(file, 'utf8')) as CliReport;
  const ids = new Set(r.tiers.blocking.rules.map((x) => String(x.functionId)));
  return r.violations
    .filter((v) => ids.has(String(v.functionId)) && !(String(v.functionId) === 'FF-P06' && (v.discriminator ?? []).includes('FLOWS_TO')))
    .map((v) => ({ ruleId: String(v.functionId), file: v.filePath, ...(v.target !== undefined && { target: v.target }) }));
}

/** `next` minus `prev`, as multisets on (rule, file, target). */
function delta(next: readonly FullFinding[], prev: readonly FullFinding[]): FullFinding[] {
  const left = new Map<string, number>();
  for (const f of prev) left.set(fkey(f), (left.get(fkey(f)) ?? 0) + 1);
  return next.filter((f) => {
    const n = left.get(fkey(f)) ?? 0;
    if (n > 0) {
      left.set(fkey(f), n - 1);
      return false;
    }
    return true;
  });
}

function ctx(specPath: string, root: string, engine: FastRulesEngine, postSeal: boolean, interp: InterpEvaluator): ServerContext {
  return {
    ...(engine === 'cypher-interp' && { fastRulesEngine: engine, interp }),
    defaultSpecPath: specPath,
    defaultProjectPath: root,
    env: {},
    loadSpec: createSpecLoader({ postSeal }),
    evaluateDeps: {
      makeGraph: () => {
        throw new Error('evaluate_project is not used here');
      },
      makePipeline: () => {
        throw new Error('evaluate_project is not used here');
      },
    },
  };
}

async function main(): Promise<void> {
  const work = path.resolve(arg('work'));
  const nodeModules = path.resolve(arg('node-modules'));
  const dest = path.resolve(arg('dest', 'results/v1.4-ddd-b2-t1'));
  const cliRoot = path.join(dest, 'cypher-interp', 'cli');
  const configs = [
    { id: 'post-seal-on', postSeal: true, full: 'on', engines: ['fast', 'cypher-interp'] as FastRulesEngine[] },
    { id: 'sealed', postSeal: false, full: 'off', engines: ['fast'] as FastRulesEngine[] },
  ];
  const rows: (VariantComparison & { config: string; engine: FastRulesEngine; run: string; specVariant: string; step: string; error?: string })[] = [];
  const interp = new InterpEvaluator({ tmpDir: path.join(work, 'interp-tmp') });
  fs.mkdirSync(path.join(work, 'interp-tmp'), { recursive: true });
  for (const r of runs(dest)) {
    const dir = path.join(work, 'v9', r.run.replace('/', '__'));
    let prevLabel: string | undefined;
    for (const st of r.steps) {
      const prev = path.join(dir, 'prev');
      const cur = path.join(dir, 'cur');
      for (const d of [prev, cur]) {
        fs.rmSync(d, { recursive: true, force: true });
        fs.mkdirSync(d, { recursive: true });
      }
      if (prevLabel === undefined) r.base(prev);
      else r.steps.find((x) => x.label === prevLabel)?.write(prev);
      st.write(cur);
      fs.symlinkSync(nodeModules, path.join(cur, 'node_modules'));
      fs.symlinkSync(nodeModules, path.join(prev, 'node_modules'));
      const diff = projectDiff(prev, cur);
      for (const v of r.variants) {
        for (const c of configs) {
          const report = (label: string): string => path.join(cliRoot, r.subject, r.run, v.id, c.full, `${label}.json`);
          const full = delta(fullBlocking(report(st.label)), prevLabel === undefined ? [] : fullBlocking(report(prevLabel)));
          for (const engine of c.engines) {
            const meta = { style: r.style, variant: `${r.run}/${st.label}`, kind: 'agent-step', plants: null, mode: 'after-write' as const };
            const t0 = performance.now();
            const res = await checkDiffTool(ctx(v.spec, cur, engine, c.postSeal, interp), { diff });
            const ms = performance.now() - t0;
            const tag = { config: c.id, engine, run: r.run, specVariant: v.id, step: st.label };
            if (!res.ok) {
              rows.push({ ...compareVariant(meta, full, { verdict: 'clean', summary: '', files: [], skipped: [], blockingVerdict: 'pass', blockingCount: 0, advisoryCount: 0, blockingSummary: '' }, ms), ...tag, error: res.message });
              process.stdout.write(`${c.id} ${engine} ${r.run} ${v.id} ${st.label}: check_diff failed: ${res.message}\n`);
              continue;
            }
            const row = { ...compareVariant(meta, full, res.data, ms), ...tag };
            rows.push(row);
            process.stdout.write(`${c.id} ${engine.padEnd(13)} ${r.run} ${v.id} ${st.label}: full ${row.full.rules.join(',') || '-'} tool ${row.tool.rules.join(',') || '-'} ${row.rulesAgree ? 'agree' : 'DISAGREE'}\n`);
          }
        }
      }
      prevLabel = st.label;
    }
  }
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = [r.config, r.engine, r.style, r.specVariant].join('\t');
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const summary = [...groups].map(([k, rs]) => {
    const [config, engine, style, specVariant] = k.split('\t');
    return {
      config, engine, style, specVariant, steps: rs.length,
      fullBlocks: rs.filter((r) => r.full.blocks).length,
      answerAgree: rs.filter((r) => r.answerAgrees).length,
      rulesAgree: rs.filter((r) => r.rulesAgree).length,
      locationsAgree: rs.filter((r) => r.locationsAgree).length,
      fullOnly: rs.filter((r) => r.fullOnlyRules.length > 0).length,
      toolOnly: rs.filter((r) => r.toolOnlyRules.length > 0).length,
      errors: rs.filter((r) => r.error !== undefined).length,
      msP50: [...rs.map((r) => r.tool.ms)].sort((a, b) => a - b)[Math.floor(rs.length / 2)] ?? 0,
    };
  });
  const outDir = path.join(dest, 'v9');
  fs.mkdirSync(outDir, { recursive: true });
  const scrub = (v: unknown): unknown => JSON.parse(JSON.stringify(v).split(work).join('<work>').split(REPO).join('.'));
  fs.writeFileSync(path.join(outDir, 'mcp-vs-full.json'), `${JSON.stringify(scrub({ summary, rows: rows.map((r) => ({ ...r, tool: { ...r.tool, ms: Math.round(r.tool.ms) } })) }), null, 1)}\n`);
  const md = [
    '# V9: MCP check_diff vs the full evaluation on stored agent-code snapshots', '',
    'Generated by `scripts/v1.4/mcp-fast-vs-full-loop.ts`. One row per step diff (step s-1 → s, step 1 from the base), mode after-write.', '',
    '| Config | Engine | Style | Spec | Steps | Full blocks | Answer agrees | Rules agree | Locations agree | Full only | Tool only | Errors | p50 ms |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...summary.map((s) => `| ${String(s.config)} | ${String(s.engine)} | ${String(s.style)} | ${String(s.specVariant)} | ${String(s.steps)} | ${String(s.fullBlocks)} | ${String(s.answerAgree)}/${String(s.steps)} | ${String(s.rulesAgree)}/${String(s.steps)} | ${String(s.locationsAgree)}/${String(s.steps)} | ${String(s.fullOnly)} | ${String(s.toolOnly)} | ${String(s.errors)} | ${s.msP50.toFixed(0)} |`),
    '', '## Disagreements', '',
    '| Config | Engine | Run | Spec | Step | Full blocking (delta) | Tool blocking |', '|---|---|---|---|---|---|---|',
    ...rows.filter((r) => !r.rulesAgree || !r.answerAgrees).map((r) => `| ${r.config} | ${r.engine} | ${r.run} | ${r.specVariant} | ${r.step} | ${r.full.findings.map((f) => `${f.ruleId} ${f.file}${f.target !== undefined ? ` → ${f.target}` : ''}`).join('; ') || '-'} | ${r.tool.findings.map((f) => `${f.ruleId} ${f.file}${f.target !== undefined ? ` → ${f.target}` : ''}`).join('; ') || '-'}${r.error !== undefined ? ` (error: ${r.error})` : ''} |`),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'mcp-vs-full.md'), `${String(scrub(md.join('\n')))}\n`);
  for (const s of summary) process.stdout.write(`${JSON.stringify(s)}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
