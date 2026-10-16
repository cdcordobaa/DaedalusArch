/**
 * Offline re-score of the reference set under construct answers (no Neo4j). Entry file: no exports.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts --out <dir>
 *       [--answers answers.json] [--graph-cache <file>] [--style a,b]
 *     Re-scores the saved rows of <base> under the answers (default: the switch file, src/shared/construct-switches.ts).
 *     Writes <out>/report.json, <out>/report.md (and <out>/construct-switches.json when an answer changes behaviour).
 *     At the status quo the report is byte-identical to `validate-reference.ts --from-raw <base>/raw --out <out>`.
 *   node --import tsx scripts/v1.3/construct-rescore.ts --base <dir> --effects <file.md> [--graph-cache <file>]
 *     Every code option alone (the other questions at A): its effect per style, as a Markdown table.
 * The variant graphs are re-extracted in-process (`extractAPG`, the v1.3 defaults); --graph-cache keeps them on disk.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONSTRUCT_ANSWERS, isStatusQuo, STATUS_QUO_ANSWERS, withAnswers } from '../../src/shared/construct-switches.js';
import type { ConstructAnswers } from '../../src/shared/construct-switches.js';
import { CONSTRUCT_QUESTIONS, optionsOf } from '../../src/shared/construct-switch-catalogue.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { parseAnswersDocument } from './lib/construct-answers.js';
import { cachedGraphs, extractingGraphs, rescore, writeRescore } from './lib/construct-rescore.js';
import type { GraphProvider, RescoreResult } from './lib/construct-rescore.js';
import { isReferenceStyle } from './lib/reference-model.js';
import type { ReferenceStyle } from './lib/reference-model.js';
import type { StyleMetrics } from './lib/compare.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function header(base: string): string {
  return `# v1.3 reference validation (from saved outputs in ${path.join(base, 'raw')})`;
}

const counts = (m: StyleMetrics['blocking']): string => `R ${String(m.tp)}/${String(m.tp + m.fn)}, P ${String(m.tp)}/${String(m.tp + m.fp)}`;

function effectRows(q: string, option: string, base: RescoreResult, run: RescoreResult): string[] {
  const rows: string[] = [];
  for (const after of run.run.metrics) {
    const before = base.run.metrics.find((m) => m.style === after.style);
    if (before === undefined) continue;
    const changes = Object.entries(run.extras.changes).filter(([k]) => k.startsWith(`${after.style}/`)).flatMap(([, c]) => c);
    const addedRows = changes.filter((c) => c.action === 'added' || c.action === 'moved-in').length;
    const droppedRows = changes.filter((c) => c.action === 'dropped' || c.action === 'moved-out').length;
    const na = Object.entries(run.extras.notApplicable).filter(([k]) => k.startsWith(`${after.style}/`)).reduce((s, [, v]) => s + v.tool.length, 0);
    const scope = run.extras.scope[after.style];
    const same = counts(before.blocking) === counts(after.blocking) && counts(before.all) === counts(after.all);
    if (same && addedRows === 0 && droppedRows === 0 && na === 0 && (scope?.added.length ?? 0) === 0 && (scope?.removed.length ?? 0) === 0) continue;
    const scopeNote = [
      ...(scope?.added.length ? [`+${scope.added.join(', ')}`] : []),
      ...(scope?.removed.length ? [`-${scope.removed.join(', ')}`] : []),
    ].join(' ');
    rows.push(`| ${q} | ${option} | ${after.style} | ${counts(before.blocking)} → ${counts(after.blocking)} | ${counts(before.all)} → ${counts(after.all)} | +${String(addedRows)} / -${String(droppedRows)}${na > 0 ? `, N/A ${String(na)}` : ''} | ${scopeNote} |`);
  }
  return rows;
}

async function main(): Promise<void> {
  const base = path.resolve(opt('--base') ?? 'results/v1.3-reference/after-member-facts');
  const styles = (opt('--style') ?? '').split(',').filter((s) => s !== '');
  const bad = styles.filter((s) => !isReferenceStyle(s));
  if (bad.length > 0) throw new Error(`unknown style ${bad.join(', ')}`);
  const cacheFile = opt('--graph-cache');
  const extracting = extractingGraphs();
  const graphs: GraphProvider = cacheFile !== undefined ? cachedGraphs(path.resolve(cacheFile), extracting) : extracting;
  const common = { repoRoot: process.cwd(), base, graphs, ...(styles.length > 0 ? { styles: styles as ReferenceStyle[] } : {}) };
  try {
    const effects = opt('--effects');
    if (effects !== undefined) {
      const status = await rescore({ ...common, answers: STATUS_QUO_ANSWERS });
      const lines = [
        '| Q | Option | Style | Blocking (current → option) | All rules (current → option) | Rows added / dropped | Scope |',
        '|---|---|---|---|---|---|---|',
      ];
      for (const q of CONSTRUCT_QUESTIONS) {
        for (const o of optionsOf(q.id)) {
          const spec = q.options[o];
          if (o === 'A' || spec?.kind !== 'code') continue;
          const answers = withAnswers({ [q.id]: o });
          const run = await rescore({ ...common, answers });
          const rows = effectRows(q.id, o, status, run);
          lines.push(...(rows.length > 0 ? rows : [`| ${q.id} | ${o} | (all) | no change | no change | +0 / -0 | |`]));
          process.stderr.write(`${q.id} ${o}: ${String(rows.length)} style row(s)\n`);
        }
      }
      fs.writeFileSync(path.resolve(effects), lines.join('\n') + '\n');
      process.stdout.write(`wrote ${effects}\n`);
      return;
    }
    const out = opt('--out');
    if (out === undefined) throw new Error('--out <dir> or --effects <file> is required');
    const answersFile = opt('--answers');
    const answers: ConstructAnswers = answersFile !== undefined
      ? parseAnswersDocument(JSON.parse(fs.readFileSync(path.resolve(answersFile), 'utf8')) as unknown).answers
      : CONSTRUCT_ANSWERS;
    const result = await rescore({ ...common, answers });
    writeRescore(path.resolve(out), result, header(path.relative(process.cwd(), base) || base), answers);
    process.stdout.write(`${isStatusQuo(answers) ? 'status quo' : 'answers applied'}: wrote ${out}/report.json and report.md\n`);
  } finally {
    extracting.dispose();
  }
}

void main().catch((e: unknown) => {
  process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
  process.exitCode = 2;
});
