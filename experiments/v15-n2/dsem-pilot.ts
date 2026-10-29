/**
 * N2 pilot runner (`DSEM-PILOT.md`): D_sem on the 27 items of `audit-items.json`, 2 runs each, through the Claude CLI
 * judge route (`../v15-n1/route.ts`), hard cap 81 calls on `dsem/ledger.jsonl`. The panel reference
 * (`panel/reference.json`) is read only after every run has an answer or the cap has stopped the run; it never
 * enters a prompt.
 *
 * Usage (repository root):
 *   npx tsx experiments/v15-n2/dsem-pilot.ts --estimate              # planned calls and prompt sizes, zero calls
 *   npx tsx experiments/v15-n2/dsem-pilot.ts --record [--pin 2.1.312] [--route judge|ambient]
 *   npx tsx experiments/v15-n2/dsem-pilot.ts --replay                # from the cassettes, zero calls
 *
 * Exit codes: 0 ok; 2 refused (CLI version unreadable or not the pin); 3 cassette miss in replay; 4 stopped on the cap
 * or a CLI version change (results written, truncation reported).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARGV_FLAGS, callerOf, cliVersion, routeOf } from '../v15-n1/route.js';
import type { RouteKind } from '../v15-n1/route.js';
import {
  BAR, CAP, CassetteMiss, DSEM_MODEL, DSEM_VERSION, N2_PROMPT_VERSION, N2_SCHEMA, N2_SYSTEM, RUNS, askRun, finalAnswer,
  ledgerCount, n2Prompt, score, sha,
} from './dsem.js';
import type { Answer, AskDeps, AuditItem, Budget, ItemResult, Mode, Store } from './dsem.js';

const HERE = path.join('experiments', 'v15-n2');
const STORE: Store = { cassettes: path.join(HERE, 'dsem', 'cassettes'), ledger: path.join(HERE, 'dsem', 'ledger.jsonl') };
const OUT = path.join(HERE, 'results', 'dsem-pilot.json');
const PIN = '2.1.312';

async function main(argv: readonly string[]): Promise<number> {
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const mode: Mode = argv.includes('--record') ? 'record' : argv.includes('--replay') ? 'replay' : 'estimate';
  const items = (JSON.parse(fs.readFileSync(path.join(HERE, 'audit-items.json'), 'utf8')) as { items: AuditItem[] }).items;
  const prompts = items.map(n2Prompt);
  const promptsSha = sha(prompts.join('\n\0\n'));
  const used = ledgerCount(STORE.ledger);

  if (mode === 'estimate') {
    const b: Budget = { mode, cap: CAP, used, planned: 0, stopped: null, truncated: [] };
    const deps: AskDeps = { caller: () => Promise.reject(new Error('estimate never calls')), store: STORE };
    for (const it of items) for (let r = 0; r < RUNS; r++) await askRun(it, r, b, deps);
    const chars = prompts.reduce((a, p) => a + p.length, 0) + N2_SYSTEM.length * items.length;
    process.stdout.write(`items ${String(items.length)}, runs ${String(RUNS)}; planned calls ${String(b.planned)} (cassette misses, before retries); cap ${String(CAP)}; ledger ${String(used)}; model ${DSEM_MODEL}; prompt ${N2_PROMPT_VERSION}; prompts sha256 ${promptsSha}; ~${String(Math.round(chars / 4))} prompt tokens per run\n`);
    return 0;
  }

  const routeKind = (arg('route') ?? 'judge') as RouteKind;
  if (routeKind !== 'judge' && routeKind !== 'ambient') { process.stderr.write('--route judge|ambient\n'); return 2; }
  const route = routeOf(routeKind);
  const pin = arg('pin') ?? PIN;
  let version: string | null = null;
  if (mode === 'record') {
    version = cliVersion(route);
    if (version === null) { process.stderr.write('claude --version unreadable under the route env: refuse\n'); return 2; }
    if (version !== pin) { process.stderr.write(`CLI ${version} is not the pin ${pin}: refuse\n`); return 2; }
  }
  const routeRec = { kind: route.kind, binary: 'claude', configDir: route.configDir, argv: ARGV_FLAGS, env: route.kind === 'judge' ? 'judge allow-list + CLAUDE_CONFIG_DIR + DISABLE_AUTOUPDATER=1' : 'parent env minus ANTHROPIC_API_KEY + DISABLE_AUTOUPDATER=1', cliVersion: version, pin };
  const b: Budget = { mode, cap: CAP, used, planned: 0, stopped: null, truncated: [] };
  const deps: AskDeps = {
    caller: callerOf(route), store: STORE, route: routeRec,
    preCall: mode === 'record' ? () => { const v = cliVersion(route); return v === version ? null : `CLI version changed (${String(version)} -> ${String(v)})`; } : undefined,
  };
  const results: ItemResult[] = [];
  try {
    for (const it of items) {
      const runs = [];
      for (let r = 0; r < RUNS; r++) runs.push(await askRun(it, r, b, deps));
      const res: ItemResult = { id: it.id, row: it.row, runs, final: finalAnswer(runs) };
      results.push(res);
      process.stdout.write(`${it.id} ${it.row}: ${runs.map((x) => x.answer ?? `invalid(${x.invalid ?? ''})`).join(', ')} -> ${res.final}${runs.some((x) => x.cites.some((c) => !c.resolved)) ? ' [unresolved cite]' : ''} (ledger ${String(b.used)})\n`);
    }
  } catch (e) {
    if (e instanceof CassetteMiss) { process.stderr.write(`${e.message}\n`); return 3; }
    throw e;
  }

  // The reference is read only now, after every run.
  const panel = JSON.parse(fs.readFileSync(path.join(HERE, 'panel', 'reference.json'), 'utf8')) as {
    deviation: string; reference: Record<string, Answer>; excluded: { id: string; answers: Answer[] }[];
  };
  const s = score(results, panel.reference);
  const models = [...new Set(results.flatMap((r) => r.runs.map((x) => x.model)).filter((m): m is string => m !== null))].sort();
  const truncated = b.stopped !== null || b.truncated.length > 0;
  // The route each answer was recorded under (from the cassettes; a replay makes no call and reads no CLI version).
  const recordedRoutes = fs.existsSync(STORE.cassettes)
    ? [...new Set(fs.readdirSync(STORE.cassettes).filter((f) => f.endsWith('.json')).map((f) => JSON.stringify((JSON.parse(fs.readFileSync(path.join(STORE.cassettes, f), 'utf8')) as { route: unknown }).route)))].map((r) => JSON.parse(r) as unknown)
    : [];
  const out = {
    schema: 'v15-n2-dsem-pilot-v1', dsemVersion: DSEM_VERSION, deviation: panel.deviation, mode, at: new Date().toISOString(),
    promptVersion: N2_PROMPT_VERSION, promptsSha256: promptsSha, systemSha256: sha(N2_SYSTEM), schemaSha256: sha(JSON.stringify(N2_SCHEMA)),
    requestedModel: DSEM_MODEL, answeredModels: models, route: routeRec, recordedRoutes, runsPerItem: RUNS,
    finalRule: 'the grounded answer given in both runs, otherwise unsure; a yes or no with no resolved cite is unsure',
    cap: CAP, callsOnLedger: b.used, truncated, stopped: b.stopped, truncatedRuns: b.truncated,
    bar: { agreement: BAR.agreement, hallucinatedCitations: BAR.hallucinatedCitations, unsureCountsAs: 'disagreement' },
    score: s,
    items: results.map((r) => ({
      id: r.id, row: r.row, reference: panel.reference[r.id] ?? 'excluded', final: r.final,
      runs: r.runs.map((x) => ({ run: x.run, rawAnswer: x.raw, answer: x.answer, severityClass: x.severityClass, cites: x.cites, model: x.model, invalid: x.invalid, explanation: x.explanation })),
    })),
    excluded: panel.excluded.map((e) => ({ id: e.id, row: results.find((r) => r.id === e.id)?.row ?? null, panelAnswers: e.answers, dsem: results.find((r) => r.id === e.id)?.final ?? null })),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  process.stdout.write(`agreement ${String(s.agree)}/${String(s.labelled)} = ${s.agreement?.toFixed(3) ?? 'n/a'} (Wilson 95% ${s.wilson95 !== null ? `${s.wilson95.low.toFixed(3)}-${s.wilson95.high.toFixed(3)}` : 'n/a'}); hallucinated citations ${String(s.hallucinatedCitations)} of ${String(s.citations)}; bar ${s.pass ? 'met' : 'not met'}; calls on ledger ${String(b.used)} of ${String(CAP)}${truncated ? `; TRUNCATED: ${b.stopped ?? ''} (${String(b.truncated.length)} runs)` : ''}\n`);
  return truncated ? 4 : 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]).endsWith(path.join('v15-n2', 'dsem-pilot.ts'))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
