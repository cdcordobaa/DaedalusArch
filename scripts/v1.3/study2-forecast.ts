/**
 * Study 2 budget forecaster: TOOLING, NOT A PRE-REGISTRATION. Entry file: no exports.
 * Model and pass criterion: Docs/v1.3/study2-forecast.md; library: scripts/v1.3/lib/study2-forecast.ts.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-forecast.ts --plan <plan.json> [--plan <plan2.json> ...] --telemetry <dir>[,<dir>...]
 *     [--window-usd claude-code-cli=40[,codex-cli=..]] [--lanes 1,2] [--draws 2000] [--seed 20261016]
 *     [--fire-source gate|none] [--repair-scale 1] [--mcp-scale 1] [--backtest] [--robust-splits 200]
 *     [--md-out <file.md>] [--json-out <file.json>]
 * Prints Markdown tables. No model call, no network, no task file: tasks and steps are numbers in the plan.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_OPTIONS, assertNotSealed, backtest, forecast, loadTelemetry, renderBacktestMarkdown, renderForecastMarkdown,
  validateForecastPlan,
} from './lib/study2-forecast.js';
import type { ForecastOptions } from './lib/study2-forecast.js';

const argv = process.argv.slice(2);
const all = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1] as string] : []));
const opt = (name: string, def: string): string => all(name)[0] ?? def;
const num = (name: string, def: number): number => {
  const v = Number(opt(name, String(def)));
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number`);
  return v;
};

try {
  const plans = all('--plan');
  const dirs = all('--telemetry').flatMap((d) => d.split(',')).filter((d) => d !== '');
  if (plans.length === 0 || dirs.length === 0) throw new Error('--plan and --telemetry are required');
  const windowUsd: Record<string, number> = {};
  for (const kv of opt('--window-usd', '').split(',').filter((s) => s !== '')) {
    const [k, v] = kv.split('=');
    if (k === undefined || v === undefined || !(Number(v) > 0)) throw new Error('--window-usd is adapterId=usd[,...]');
    windowUsd[k] = Number(v);
  }
  const fireSource = opt('--fire-source', 'gate');
  if (fireSource !== 'gate' && fireSource !== 'none') throw new Error('--fire-source is gate or none');
  const options: ForecastOptions = {
    ...DEFAULT_OPTIONS,
    draws: num('--draws', DEFAULT_OPTIONS.draws),
    seed: num('--seed', DEFAULT_OPTIONS.seed),
    lanes: opt('--lanes', '1,2').split(',').map(Number),
    windowUsd,
    repairScale: num('--repair-scale', 1),
    mcpScale: num('--mcp-scale', 1),
    fireSource,
  };
  const tel = loadTelemetry(dirs);
  const md: string[] = [`Telemetry: ${tel.sources.join(', ')}.`, ''];
  const json: Record<string, unknown> = { options, sources: tel.sources, forecasts: [] };
  for (const p of plans) {
    assertNotSealed(p);
    const plan = validateForecastPlan(JSON.parse(fs.readFileSync(p, 'utf8')));
    const fc = forecast(plan, tel, options);
    md.push(renderForecastMarkdown(fc, path.basename(p)));
    (json.forecasts as unknown[]).push({ planFile: p, ...fc });
  }
  md.push('Assumptions:', '', ...forecast(validateForecastPlan(JSON.parse(fs.readFileSync(plans[0] as string, 'utf8'))), tel, { ...options, draws: 1 }).assumptions.map((a) => `- ${a}`), '');
  if (tel.agentProofWallS.length > 0) {
    const w = tel.agentProofWallS;
    md.push(`Cross-check: agent-proof extension turns (MCP attached, ${w.length}): wall ${Math.min(...w)}–${Math.max(...w)} s, mean ${(w.reduce((a, b) => a + b, 0) / w.length).toFixed(0)} s.`, '');
  }
  if (argv.includes('--backtest')) {
    const bt = backtest(tel.turns, options.seed, options.draws, num('--robust-splits', 200));
    md.push('### Back-test on E1 (held-out half)', '', renderBacktestMarkdown(bt), '');
    json.backtest = bt;
  }
  const text = md.join('\n');
  process.stdout.write(`${text}\n`);
  const write = (file: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, body);
  };
  const mdOut = opt('--md-out', '');
  if (mdOut !== '') write(mdOut, `${text}\n`);
  const jsonOut = opt('--json-out', '');
  if (jsonOut !== '') write(jsonOut, `${JSON.stringify(json, null, 2)}\n`);
} catch (e) {
  process.stderr.write(`study2-forecast: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
}
