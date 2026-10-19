/**
 * BF-01 scoring, step 1 (zero calls): for every pilot session, label the files and evaluate the clone under the
 * derived spec (raw, as the model wrote it) and the scored spec (unsupported units dropped, `bf-01-verify-evidence.ts`),
 * with the same tools and flags as the brownfield baseline (`results/v1.3-brownfield/run-provenance.json`):
 *   labels   scripts/v1.3/spec-author-agreement.ts labels (one-entry selection, the spec copied to <id>.yaml)
 *   evaluate bin/firewall.ts evaluate --symbolic-only --engine cypher-interp --scoring v1.3 --format json
 * One run at a time. An invalid spec is recorded as a failure (no repair). Then step 2, the baseline's own metric
 * functions: python3 -I scripts/v1.3/bf-01-score.py.
 *
 *   npx tsx scripts/v1.3/bf-01-score.ts [--pilot results/v1.3-brownfield/llm-pilot]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const PILOT = path.resolve(arg('--pilot') ?? 'results/v1.3-brownfield/llm-pilot');
const REPO_ROOT = path.resolve('.');
const REPO_REAL = fs.realpathSync(REPO_ROOT);
const SEL = JSON.parse(fs.readFileSync('results/v1.3-external/selection.json', 'utf8')) as { entries: { id: string; root: string }[] };

function scrub(s: string): string {
  return s.split(REPO_REAL).join('<repo>').split(REPO_ROOT).join('<repo>').split(os.homedir()).join('~').split(os.tmpdir()).join('<tmp>');
}

const runs: string[] = [];
for (const sid of fs.readdirSync(path.join(PILOT, 'sessions')).filter((x) => !x.includes('.failed-attempt')).sort()) {
  const dir = path.join(PILOT, 'sessions', sid);
  if (!fs.existsSync(path.join(dir, 'meta.json'))) continue;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { repo: string };
  const e = SEL.entries.find((x) => x.id === meta.repo);
  if (e === undefined) continue;
  for (const variant of ['derived', 'scored'] as const) {
    const spec = path.join(dir, `${variant}.yaml`);
    const res: Record<string, unknown> = { sid, variant };
    if (!fs.existsSync(spec)) { res.error = 'no spec'; fs.writeFileSync(path.join(dir, `score-input.${variant}.json`), `${JSON.stringify(res)}\n`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bf01-score-'));
    fs.mkdirSync(path.join(tmp, 'specs'));
    fs.copyFileSync(spec, path.join(tmp, 'specs', `${e.id}.yaml`));
    fs.writeFileSync(path.join(tmp, 'selection.json'), JSON.stringify({ entries: [e] }));
    const lab = spawnSync('npx', ['tsx', 'scripts/v1.3/spec-author-agreement.ts', 'labels', '--selection', path.join(tmp, 'selection.json'), '--repos', 'tmp/brownfield-clones', '--specs', path.join(tmp, 'specs'), '--out', path.join(dir, `labels.${variant}.json`)], { encoding: 'utf8' });
    res.labelsExit = lab.status;
    if (lab.status !== 0) res.labelsError = scrub(lab.stderr).slice(-600);
    const t0 = Date.now();
    const ev = spawnSync('npx', ['tsx', 'bin/firewall.ts', 'evaluate', '--project', path.join('tmp/brownfield-clones', e.id, e.root), '--spec', spec, '--symbolic-only', '--engine', 'cypher-interp', '--scoring', 'v1.3', '--format', 'json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    res.evaluateExit = ev.status;
    res.evaluateMs = Date.now() - t0;
    try {
      const report = JSON.parse(ev.stdout) as unknown;
      fs.writeFileSync(path.join(dir, `evaluate.${variant}.json`), `${scrub(JSON.stringify(report, null, 1))}\n`);
    } catch {
      res.evaluateError = scrub(`${ev.stdout.slice(-300)} ${ev.stderr.slice(-600)}`);
    }
    fs.writeFileSync(path.join(dir, `score-input.${variant}.json`), `${JSON.stringify(res, null, 1)}\n`);
    runs.push(`${sid}\t${variant}\t${String(ev.status)}\t${String(res.evaluateMs)}\t${String(lab.status)}`);
    process.stdout.write(`${sid} ${variant}: labels ${String(lab.status)} evaluate ${String(ev.status)} ${String(res.evaluateMs)} ms\n`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
fs.writeFileSync(path.join(PILOT, 'evaluate-runs.tsv'), `sid\tvariant\tevaluateExit\tms\tlabelsExit\n${runs.join('\n')}\n`);
