/**
 * The exploratory study plan templates (`experiments/exploratory-study/`): they load with the `<local>` fields
 * filled, carry the Claude CLI pin and generator isolation ON (`Docs/v1.3/loop-isolation.md`), their call budget is
 * the one the plan implies, and the tasks are the rehearsal tasks unchanged.
 * Needs the `layered` loop style and `taskProfiles` with the `daedalus-mcp` arm (BUILD-L items 1 and 2).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadLoopPlan, planCallBudget, planFrame } from '../../../../scripts/lib/loop/plan.js';

const REPO = path.resolve(__dirname, '../../../..');
const DIR = 'experiments/exploratory-study';
const LOCAL = { binary: '/opt/claude/bin/claude', harnessRoot: '/tmp/explore-h', outRoot: '/tmp/explore-out', claudeConfigDir: '/opt/claude-config-explore' };

const taskHash = (t: unknown): string => createHash('sha256').update(JSON.stringify(t)).digest('hex');

describe.each([
  ['plan-L2.template.json', 'L2', ['none', 'daedalus-mcp']],
  ['plan-L3.template.json', 'L3', ['none']],
])('%s', (file, rung, arms) => {
  const loaded = loadLoopPlan(path.join(REPO, DIR, file), REPO, LOCAL);

  it('loads with the <local> fields filled', () => {
    if (!loaded.success) throw new Error(loaded.errors.map((e) => `${e.code} ${e.message}`).join('; '));
    expect(loaded.data.plan.arms).toEqual(arms);
    expect(planFrame(loaded.data.plan).specRung).toBe(rung);
  });

  it('pins the Claude CLI and isolates every Claude spawn', () => {
    if (!loaded.success) throw new Error('plan did not load');
    const { plan } = loaded.data;
    expect(plan.generatorIsolation).toEqual({ claudeConfigDir: LOCAL.claudeConfigDir });
    for (const a of plan.adapters.filter((x) => x.adapterId === 'claude-code-cli')) expect(a.cliVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('records the call budget the plan implies', () => {
    if (!loaded.success) throw new Error('plan did not load');
    expect(loaded.data.plan.callBudget).toEqual(planCallBudget(loaded.data.plan, loaded.data.tasks.tasks));
  });
});

it('the exploratory tasks are the rehearsal tasks ice-rink and vineyard-harvest, unchanged', () => {
  const read = (f: string): { tasks: { id: string }[] } => JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8')) as { tasks: { id: string }[] };
  const mine = read(`${DIR}/tasks.json`).tasks;
  const rehearsal = read('fixtures/v1.3-rehearsal-tasks/tasks.json').tasks;
  expect(mine.map((t) => t.id)).toEqual(['ice-rink', 'vineyard-harvest']);
  for (const t of mine) expect(taskHash(t)).toBe(taskHash(rehearsal.find((r) => r.id === t.id)));
});
