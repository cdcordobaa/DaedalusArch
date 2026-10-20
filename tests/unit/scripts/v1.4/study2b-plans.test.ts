/**
 * Study 2b plan filling (scripts/v1.4/lib/study2b-plans.ts) on the committed templates and a practice tasks file, and
 * the MCP telemetry summary (scripts/v1.4/lib/mcp-telemetry.ts). No sealed file is read.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { acceptanceCoverage, acceptanceStartBlocks, fillTemplate, parseTasks, redactTaskIds, study2bCalls, STUDY2B_TEMPLATES } from '../../../../scripts/v1.4/lib/study2b-plans';
import { summariseTelemetry, telemetryStep } from '../../../../scripts/v1.4/lib/mcp-telemetry';
import type { LoopTasksFile } from '../../../../scripts/lib/loop/types';

const REPO = path.resolve(__dirname, '../../../..');
const template = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/study2b', `${name}.template.json`), 'utf8'));
const practice = (): LoopTasksFile => {
  const p = parseTasks(fs.readFileSync(path.join(REPO, 'experiments/exploratory-study/stage-a/tasks.json')));
  if (p.tasks === null) throw new Error(p.problems.join('; '));
  return p.tasks;
};
const opts = (replicates: number) => ({ tasksPath: '/practice/tasks.json', replicates, acceptanceRoot: '/practice/acceptance', daedalusBuild: '/practice/build' });

describe('study2b templates', () => {
  it('every template fills into a plan the harness accepts, with the budget it implies', () => {
    const tasks = practice(); // 3 Layered tasks x 5 steps
    const want = { 'plan-none-L2': 15, 'plan-none-L3': 12, 'plan-mcp-L2': 12 };
    for (const name of STUDY2B_TEMPLATES) {
      for (const r of [1, 2]) {
        const f = fillTemplate(template(name), tasks, opts(r));
        expect(f.problems).toEqual([]);
        expect(f.budget.maxCalls).toBe(want[name] * r);
        expect(f.budget.maxRepairTurns).toBe(0);
        expect(f.plan.runs).toBe(r);
        expect(f.plan.tasksFile).toBe('/practice/tasks.json');
        expect(Object.keys(f.plan.taskProfiles as object).sort()).toEqual(['hive-health', 'ice-rink', 'youth-league']);
        if (name !== 'plan-none-L2') expect((f.plan.sharedStart as { fromOutRoot: string[] }).fromOutRoot).toEqual(Array(r).fill('<local>'));
        else expect(f.plan.sharedStart).toBeUndefined();
        expect(f.plan.acceptance).toEqual({ enabled: true, testsRoot: '/practice/acceptance' });
      }
    }
  });

  it('the cells differ only in arm, rung, sharedStart, daedalus and the description', () => {
    const strip = (o: Record<string, unknown>): Record<string, unknown> => {
      const { description: _d, arms: _a, frame, sharedStart: _s, daedalus: _m, callBudget: _b, ...rest } = o;
      return { ...rest, attention: (frame as { attention: boolean }).attention };
    };
    const [l2, l3, mcp] = STUDY2B_TEMPLATES.map((n) => strip(template(n) as Record<string, unknown>));
    expect(l3).toEqual(l2);
    expect(mcp).toEqual(l2);
    expect((template('plan-mcp-L2') as { arms: string[] }).arms).toEqual(['daedalus-mcp']);
    expect((template('plan-none-L3') as { frame: { specRung: string } }).frame.specRung).toBe('L3');
  });

  it('fills the MCP build paths and needs them for the mcp template', () => {
    const f = fillTemplate(template('plan-mcp-L2'), practice(), opts(2));
    expect(f.plan.daedalus).toEqual({ nodeBinary: '/practice/build/node', serverEntry: '/practice/build/dist/mcp-server/main.js', specPath: '/practice/build/presets/layered.yaml' });
    const g = fillTemplate(template('plan-mcp-L2'), practice(), { ...opts(2), daedalusBuild: null });
    expect(g.problems.join(' ')).toMatch(/MCP build directory/);
  });

  it('drops the acceptance block on request', () => {
    expect(fillTemplate(template('plan-none-L2'), practice(), { ...opts(1), acceptanceRoot: null }).plan.acceptance).toBeUndefined();
  });

  it('redacts task ids from every message', () => {
    expect(redactTaskIds('taskProfiles.ice-rink: no such task (ice-rink-2)', ['ice-rink', 'ice-rink-2'])).toBe('taskProfiles.<task-1>: no such task (<task-2>)');
    const p = parseTasks(Buffer.from(JSON.stringify({ description: 'x', tasks: [{ id: 'secret-domain', title: 't', steps: [] }] })));
    expect(p.tasks).toBeNull();
    expect(p.problems.join(' ')).not.toMatch(/secret-domain/);
  });

  it('counts acceptance files without reading them', () => {
    const c = acceptanceCoverage(path.join(REPO, 'experiments/study2b/rehearsal-acceptance'), practice());
    expect(c).toEqual({ expected: 15, present: 1, tasksComplete: 0, tasks: 3 });
    expect(acceptanceStartBlocks(practice())).toEqual({ tasks: 3, startCommand: 0, buildCommand: 0 });
  });

  it('the 2b call count: step 1 is 4R, each cell 4R x 4', () => {
    expect(study2bCalls(2)).toEqual({ step1: 8, noneL2Steps2toK: 32, perBranchCell: 32, total: 104 });
    expect(study2bCalls(1, 1)).toEqual({ step1: 1, noneL2Steps2toK: 4, perBranchCell: 4, total: 13 });
  });
});

describe('mcp telemetry summary', () => {
  it('tabulates calls, tools, check verdicts and log gaps', () => {
    const proc = (calls: number, byTool: Record<string, number>) => ({ calls, errors: 0, callsByTool: byTool, firstCallBeforeFirstWrite: calls > 0 ? true : null, latencyMs: { p50: 1, p95: 2 } });
    const s1 = telemetryStep({ task: 't', rep: 1, step: 2 }, proc(2, { get_architecture_spec: 1, check_import: 1 }), [
      { tool: 'get_architecture_spec' },
      { tool: 'check_import', verdict: 'pass', filesTouched: ['src/a.ts'], blockingCount: null },
    ]);
    const s2 = telemetryStep({ task: 't', rep: 1, step: 3 }, proc(1, { check_file: 1 }), []);
    const sum = summariseTelemetry([s1, s2]);
    expect(sum.calls).toBe(3);
    expect(sum.byTool).toEqual({ check_file: { calls: 1, turns: 1 }, check_import: { calls: 1, turns: 1 }, get_architecture_spec: { calls: 1, turns: 1 } });
    expect(sum.checkVerdicts).toEqual({ check_import: { pass: 1 } });
    expect(sum.logMismatches).toBe(1);
    expect(sum.turnsWithFirstCallBeforeFirstWrite).toBe(2);
  });
});
