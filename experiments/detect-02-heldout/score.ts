/**
 * DETECT-02 held-out scorer (SO4 hold-out of the v1.5 final study; zero model calls). Scored once; see SCORING.md.
 *
 *   npx tsx experiments/detect-02-heldout/score.ts --root <held-out detect-02 folder>
 *
 * The rules are the v1.5 study instrument (`src/v15-instrument`, rule hash of experiments/hcal-05/RULES-FROZEN.sha256),
 * called exactly as the study scorer calls them (`runTree(tree, rules, { spec, scratch })`). The scoring logic is the
 * DETECT-02 development scorer (`experiments/detect-02/evaluate.ts`, `score()` and the case match of `runAll()`):
 * family level, tree level; a positive is located when a violation of its family names the labelled file (or the
 * labelled file is on its path). Only findings with status `violation` count. Absolute paths never reach the output.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';
import type { Finding } from '../../src/v15-instrument/index.js';

const SEAL = 'afacdd86003b74a7b3e03557ca948db7aedfc75f4801cd2b3f1a40418a66f7ab';
const RULES_FROZEN = 'experiments/hcal-05/RULES-FROZEN.sha256';
const RULES_FROZEN_SHA = '761f37d9e5586371a12f3c1f17756bb19d24cd2224c0fa6df114d4f9e3cd6494';
const OUT = 'results/detect-02-heldout';

/** KEY family label -> DETECT-02 family (rule `// family:` header) and the rule the family was built for. */
export const FAMILY_MAP: Record<string, { family: string; expectedRule: string }> = {
  D4: { family: 'D4', expectedRule: 'R-D4' },
  'cross-context-write': { family: 'D4', expectedRule: 'R-XCTX' },
  'D5/D3': { family: 'D5', expectedRule: 'R-D5' },
  D9: { family: 'D9', expectedRule: 'R-D9' },
  H5: { family: 'H5', expectedRule: 'R-H5' },
  'concrete-injection': { family: 'H4', expectedRule: 'R-INJ' },
  'vendor-call-in-transaction': { family: 'RTX', expectedRule: 'R-RTX' },
};

interface KeyEntry {
  kind: 'positive' | 'twin' | 'negative'; family: string; rationale: string; files: number; compiles: boolean;
  violation: string | null; twin_of?: string; clean_twin?: string; near_family?: string; author_label: string;
}

const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--root');
  if (i < 0 || !argv[i + 1]) { process.stderr.write('usage: score.ts --root <held-out folder>\n'); return 2; }
  const root = path.resolve(argv[i + 1]!);
  if (fs.existsSync(path.join(OUT, 'result.json'))) { process.stderr.write('result.json exists: the set is scored once\n'); return 3; }

  // Seal: sha256 of MANIFEST.sha256, then every manifest line.
  const manifest = fs.readFileSync(path.join(root, 'MANIFEST.sha256'));
  if (sha(manifest) !== SEAL) { process.stderr.write('seal mismatch: stop\n'); return 4; }
  const lines = manifest.toString('utf8').split('\n').filter((l) => l.trim() !== '');
  for (const l of lines) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(l);
    if (!m || sha(fs.readFileSync(path.join(root, m[2]!))) !== m[1]) { process.stderr.write(`manifest line fails: stop\n`); return 4; }
  }
  // Rule hash: the study's frozen rule tree.
  if (sha(fs.readFileSync(RULES_FROZEN)) !== RULES_FROZEN_SHA) { process.stderr.write('RULES-FROZEN changed: stop\n'); return 5; }
  execFileSync('shasum', ['-a', '256', '-c', path.resolve(RULES_FROZEN)], { cwd: 'src/v15-instrument', stdio: 'ignore' });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  const key = JSON.parse(fs.readFileSync(path.join(root, 'KEY.json'), 'utf8')) as Record<string, KeyEntry>;
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-heldout-'));
  const scrub = (s: string): string => s.split(root).join('<heldout>').split(path.resolve('.')).join('.').split(os.tmpdir()).join('<tmp>');

  const rows: Record<string, unknown>[] = [];
  const flaggedBy: Record<string, string[]> = {};
  for (const id of Object.keys(key).sort()) {
    const k = key[id]!;
    const tree = path.join(root, 'cases', id);
    let findings: Finding[] = []; let error: string | undefined; let ms = 0; let rootSource = '';
    try {
      const r = await runTree(tree, rules, { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s') });
      findings = r.findings; ms = r.ms; rootSource = r.facts.rootSource;
    } catch (e) { error = String(e instanceof Error ? e.message : e).slice(0, 300); }
    const vio = findings.filter((f) => f.status === 'violation');
    flaggedBy[id] = [...new Set(vio.map((f) => f.family))].sort();
    const mapped = k.kind === 'negative' ? undefined : FAMILY_MAP[k.family];
    const [vFile, vLine] = k.violation ? [k.violation.replace(/:\d+$/, ''), Number(/:(\d+)$/.exec(k.violation)?.[1])] : [undefined, undefined];
    const famHits = mapped ? vio.filter((f) => f.family === mapped.family) : [];
    rows.push({
      id, kind: k.kind, keyFamily: k.family, family: mapped?.family ?? null, expectedRule: mapped?.expectedRule ?? null,
      authorLabel: k.author_label, pair: k.twin_of ?? k.clean_twin ?? null, nearFamily: k.near_family ?? null,
      violation: k.violation, rationale: k.rationale, ms, rootSource, error: error ?? null,
      familyFlagged: famHits.length > 0,
      located: vFile !== undefined && famHits.some((f) => f.file === vFile || f.path.some((p) => p.startsWith(vFile))),
      locatedLine: vFile !== undefined && famHits.some((f) => f.file === vFile && f.line === vLine),
      expectedRuleFired: mapped ? vio.some((f) => f.rule === mapped.expectedRule) : null,
      violations: vio.map((f) => ({ rule: f.rule, family: f.family, file: f.file, line: f.line, subject: f.subject, path: f.path, evidence: f.evidence })),
      otherStatus: findings.filter((f) => f.status !== 'violation').map((f) => ({ rule: f.rule, status: f.status, file: f.file, line: f.line, note: f.note ?? null })),
    });
    process.stdout.write(`${id} ${k.kind} [${ms} ms]: ${vio.map((f) => `${f.rule}@${f.file}:${f.line}`).join(', ') || '-'}\n`);
  }

  // Per family (evaluate.ts score()): a tree is positive for F when its KEY family maps to F.
  const families = [...new Set([...Object.values(FAMILY_MAP).map((m) => m.family), ...rules.map((r) => r.family)])].sort();
  const perFamily: Record<string, unknown> = {};
  for (const fam of families) {
    const pos = rows.filter((r) => r.kind === 'positive' && r.family === fam);
    const tp = pos.filter((r) => r.familyFlagged).map((r) => r.id as string);
    const fn = pos.filter((r) => !r.familyFlagged).map((r) => r.id as string);
    const fpOn = (kind: string): string[] => rows.filter((r) => r.kind === kind && !(r.kind === 'positive' && r.family === fam) && flaggedBy[r.id as string]!.includes(fam)).map((r) => r.id as string);
    const pairs = pos.map((p) => {
      const twin = rows.find((r) => r.kind === 'twin' && (r.pair === p.id || p.pair === r.id));
      const twinFlagged = twin ? flaggedBy[twin.id as string]!.includes(fam) : null;
      return { positive: p.id, twin: twin?.id ?? null, positiveFlagged: p.familyFlagged, twinFlagged, discriminates: p.familyFlagged === true && twinFlagged === false };
    });
    perFamily[fam] = { positives: pos.length, tp: tp.length, fn: fn.length, located: pos.filter((r) => r.located).length, tpCases: tp, fnCases: fn,
      fpOnTwins: fpOn('twin'), fpOnNegatives: fpOn('negative'), fpOnOtherPositives: fpOn('positive'), pairs };
  }
  const perRule: Record<string, { positive: number; twin: number; negative: number }> = {};
  for (const r of rows) for (const v of r.violations as { rule: string }[]) {
    perRule[v.rule] ??= { positive: 0, twin: 0, negative: 0 };
    perRule[v.rule]![r.kind as 'positive' | 'twin' | 'negative']++;
  }
  const out = {
    schema: 'detect-02-heldout-v1', split: 'held-out', scoredOnce: true, modelCalls: 0, commit,
    ruleHash: RULES_FROZEN_SHA, manifestSeal: SEAL, manifestLines: lines.length,
    rules: rules.map((r) => ({ id: r.id, family: r.family, file: r.file })),
    familyMap: FAMILY_MAP, perFamily, perRule, rows,
    latencyMs: { max: Math.max(...rows.map((r) => Number(r.ms))) }, errors: rows.filter((r) => r.error).map((r) => r.id),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'result.json'), `${scrub(JSON.stringify(out, null, 1))}\n`);
  process.stdout.write(`${scrub(JSON.stringify({ perFamily, perRule }, null, 1))}\n`);
  return 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
