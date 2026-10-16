/**
 * v1.3 SO5 spec ladder: how blocking verdicts move with the evaluator spec level L1..L5
 * (plan: Docs/DiagnosticRuns/v1.3-spec-ladder-plan.md; specs: results/v1.3-spec-ladder/specs/).
 *
 * Reads `firewall evaluate --format json --scoring v1.3` reports laid out as <eval>/<level>/<id>.json and writes
 * ladder.json and ladder.md: per-level fail counts, blocking totals and per-rule totals; verdict and per-rule
 * "fires" agreement with L5 (Cohen's kappa); per-project monotonicity; rule switch-on levels; and, with
 * --reference, the check that L5 reproduces the committed full-spec blocking counts.
 *
 * Usage: npx tsx scripts/v1.3/spec-ladder.ts --manifest <specs/manifest.json> --eval <dir> --out <dir>
 *          [--reference <summary.json>]...
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cohenKappa, summariseEvaluation, type EvalSummary } from './lib/spec-author-agreement.js';
import { monotonicity, traceRule, type Monotonicity } from './lib/spec-ladder.js';

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;
type Level = (typeof LEVELS)[number];

interface ManifestRow { readonly id: string; readonly style: string; readonly sameAsPrevious: Record<string, boolean> }
interface ProjectLevel extends EvalSummary { readonly mapped: number; readonly unmapped: number }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1] !== undefined) out.push(process.argv[i + 1]!); });
  return out;
}
function need(name: string): string {
  const v = arg(name);
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}
const f2 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(2));

function readLevel(dir: string, level: Level, id: string): ProjectLevel | null {
  const p = path.join(dir, level, `${id}.json`);
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) return null;
  let json: unknown;
  try { json = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
  const s = summariseEvaluation(json);
  const la = (json as { layerAnnotation?: { mapped?: number; unmapped?: number } }).layerAnnotation ?? {};
  return { ...s, mapped: la.mapped ?? 0, unmapped: la.unmapped ?? 0 };
}

function main(): void {
  const manifest = JSON.parse(fs.readFileSync(need('manifest'), 'utf-8')) as ManifestRow[];
  const evalDir = need('eval');
  const outDir = need('out');
  const reference = new Map<string, number>();
  for (const r of args('reference')) {
    const j = JSON.parse(fs.readFileSync(r, 'utf-8')) as { perProject: { id: string; blocking: number }[] };
    for (const p of j.perProject) reference.set(p.id, p.blocking);
  }

  const rows = manifest.map((m) => {
    const levels: Record<string, ProjectLevel | null> = {};
    for (const l of LEVELS) levels[l] = readLevel(evalDir, l, m.id);
    return { id: m.id, style: m.style, sameAsPrevious: m.sameAsPrevious, levels };
  });
  const complete = rows.filter((r) => LEVELS.every((l) => r.levels[l] !== null));
  const missing = rows.filter((r) => !LEVELS.every((l) => r.levels[l] !== null))
    .map((r) => ({ id: r.id, missingLevels: LEVELS.filter((l) => r.levels[l] === null) }));

  // Reproduction of the committed full-spec blocking counts at L5.
  const repro = rows.filter((r) => reference.has(r.id) && r.levels['L5'] !== null)
    .map((r) => ({ id: r.id, committed: reference.get(r.id)!, l5: r.levels['L5']!.blocking }));
  const reproMismatch = repro.filter((x) => x.committed !== x.l5);

  const rules = [...new Set(complete.flatMap((r) => LEVELS.flatMap((l) => Object.keys(r.levels[l]!.perRule))))].sort();
  const perLevel = LEVELS.map((l) => {
    const v = complete.map((r) => r.levels[l]!);
    const l5 = complete.map((r) => r.levels['L5']!);
    const k = cohenKappa(v.map((x) => x.verdict), l5.map((x) => x.verdict));
    const perRule: Record<string, number> = {};
    const firesKappa: Record<string, { kappa: number | null; po: number; firesAt: number; firesAtL5: number }> = {};
    for (const rule of rules) {
      perRule[rule] = v.reduce((s, x) => s + (x.perRule[rule] ?? 0), 0);
      const a = v.map((x) => ((x.perRule[rule] ?? 0) > 0 ? 'on' : 'off'));
      const b = l5.map((x) => ((x.perRule[rule] ?? 0) > 0 ? 'on' : 'off'));
      const kk = cohenKappa(a, b);
      firesKappa[rule] = { kappa: kk.kappa, po: kk.po, firesAt: a.filter((x) => x === 'on').length, firesAtL5: b.filter((x) => x === 'on').length };
    }
    return {
      level: l,
      fail: v.filter((x) => x.verdict === 'fail').length,
      blocking: v.reduce((s, x) => s + x.blocking, 0),
      mappedShare: v.reduce((s, x) => s + x.mapped, 0) / Math.max(1, v.reduce((s, x) => s + x.mapped + x.unmapped, 0)),
      verdictKappaVsL5: k.kappa, verdictAgreementVsL5: k.po,
      passToFailVsL5: complete.filter((r) => r.levels[l]!.verdict === 'pass' && r.levels['L5']!.verdict === 'fail').length,
      failToPassVsL5: complete.filter((r) => r.levels[l]!.verdict === 'fail' && r.levels['L5']!.verdict === 'pass').length,
      perRule, firesKappa,
    };
  });

  const perProject = complete.map((r) => {
    const b = LEVELS.map((l) => r.levels[l]!.blocking);
    const fails = LEVELS.map((l) => (r.levels[l]!.verdict === 'fail' ? 1 : 0));
    const trace: Record<string, ReturnType<typeof traceRule>> = {};
    for (const rule of rules) {
      const c = LEVELS.map((l) => r.levels[l]!.perRule[rule] ?? 0);
      if (c.some((x) => x > 0)) trace[rule] = traceRule(LEVELS, c);
    }
    return {
      id: r.id, style: r.style, blocking: b, verdicts: LEVELS.map((l) => r.levels[l]!.verdict),
      mapped: LEVELS.map((l) => r.levels[l]!.mapped), unmapped: LEVELS.map((l) => r.levels[l]!.unmapped),
      blockingMonotonicity: monotonicity(b), verdictMonotonicity: monotonicity(fails), sameAsPrevious: r.sameAsPrevious,
      perRule: Object.fromEntries(LEVELS.map((l) => [l, r.levels[l]!.perRule])), trace,
    };
  });
  const monoCount = (key: 'blockingMonotonicity' | 'verdictMonotonicity'): Record<Monotonicity, number> => {
    const c: Record<Monotonicity, number> = { constant: 0, 'non-decreasing': 0, 'non-increasing': 0, neither: 0 };
    for (const p of perProject) c[p[key]]++;
    return c;
  };
  const switchOn = rules.map((rule) => {
    const t = perProject.map((p) => p.trace[rule]).filter((x) => x !== undefined);
    const firstOn: Record<string, number> = {};
    for (const l of LEVELS) firstOn[l] = t.filter((x) => x.firstOn === l).length;
    return { rule, projectsEverOn: t.length, firstOn, onAtL5: t.filter((x) => x.onAtLast).length, switchedOff: t.filter((x) => x.switchedOff).length };
  });

  const summary = {
    levels: LEVELS, projects: rows.length, complete: complete.length, missing, reproduction: { checked: repro.length, mismatches: reproMismatch },
    perLevel, blockingMonotonicity: monoCount('blockingMonotonicity'), verdictMonotonicity: monoCount('verdictMonotonicity'), switchOn, perProject,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ladder.json'), JSON.stringify(summary, null, 1) + '\n');

  const md: string[] = [
    '# v1.3 SO5 spec ladder: generated tables', '',
    `Projects: ${rows.length}; complete at all five levels: ${complete.length}; missing: ${missing.map((m) => `${m.id} (${m.missingLevels.join(', ')})`).join('; ') || 'none'}.`,
    `L5 reproduces the committed full-spec blocking count on ${repro.length - reproMismatch.length}/${repro.length} projects${reproMismatch.length ? `; mismatches: ${reproMismatch.map((m) => `${m.id} ${m.committed}→${m.l5}`).join(', ')}` : ''}.`, '',
    '## Per level (complete projects)', '',
    '| level | fail | blocking | mapped file share | verdict κ vs L5 | agreement vs L5 | pass here, fail at L5 | fail here, pass at L5 |', '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...perLevel.map((p) => `| ${p.level} | ${p.fail}/${complete.length} | ${p.blocking} | ${f2(p.mappedShare)} | ${f2(p.verdictKappaVsL5)} | ${f2(p.verdictAgreementVsL5)} | ${p.passToFailVsL5} | ${p.failToPassVsL5} |`),
    '', '## Blocking findings by rule and level', '',
    `| rule | ${LEVELS.join(' | ')} |`, `|---|${LEVELS.map(() => '---:').join('|')}|`,
    ...rules.map((r) => `| ${r} | ${perLevel.map((p) => p.perRule[r]).join(' | ')} |`),
    '', '## Projects where each rule fires (κ of the per-project "fires" indicator vs L5)', '',
    `| rule | ${LEVELS.join(' | ')} |`, `|---|${LEVELS.map(() => '---').join('|')}|`,
    ...rules.map((r) => `| ${r} | ${perLevel.map((p) => `${p.firesKappa[r]!.firesAt} (κ ${f2(p.firesKappa[r]!.kappa)})`).join(' | ')} |`),
    '', '## Rule switch-on (first level with a blocking finding, per project)', '',
    `| rule | projects ever on | ${LEVELS.map((l) => `first on ${l}`).join(' | ')} | on at L5 | on below L5, off at L5 |`, `|---|---:|${LEVELS.map(() => '---:').join('|')}|---:|---:|`,
    ...switchOn.map((s) => `| ${s.rule} | ${s.projectsEverOn} | ${LEVELS.map((l) => s.firstOn[l]).join(' | ')} | ${s.onAtL5} | ${s.switchedOff} |`),
    '', '## Monotonicity over L1→L5', '',
    `Blocking count: ${JSON.stringify(summary.blockingMonotonicity)}. Verdict (fail = 1): ${JSON.stringify(summary.verdictMonotonicity)}.`,
    '', '## Per project', '',
    `| project | style | blocking ${LEVELS.join('/')} | verdict ${LEVELS.join('/')} | mapped ${LEVELS.join('/')} | blocking trend |`, '|---|---|---|---|---|---|',
    ...perProject.map((p) => `| ${p.id} | ${p.style} | ${p.blocking.join(' / ')} | ${p.verdicts.join(' / ')} | ${p.mapped.join(' / ')} | ${p.blockingMonotonicity} |`),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'ladder.md'), md.join('\n'));
  process.stdout.write(md.slice(0, 20).join('\n') + '\n');
}

main();
