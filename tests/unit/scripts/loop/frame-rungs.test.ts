/**
 * Spec rungs and the attention sentence of the loop frames (`Docs/v1.3/floor-escape-design-2026-10-16.md` §3.2,
 * §3.3, §3.6): off by default (today's frames byte for byte), L3 rule sentences without fix clauses, L4 spec placement
 * and file-read log, plan validation, and the hint audit of the rung frames. No model, no Neo4j.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { armPrompt } from '../../../../scripts/lib/generators/arms.js';
import { RUN_JSON, SPEC_READS_LOG, runDirFor, runLoop } from '../../../../scripts/lib/loop/loop.js';
import { buildFrameExtras } from '../../../../scripts/lib/loop/main.js';
import { loopRunId, planFrame, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import type { LoadedPlan, LoopPlanFile } from '../../../../scripts/lib/loop/plan.js';
import {
  ATTENTION_SENTENCE,
  FIRST_STEP_TEMPLATE,
  L3_LEAD,
  L4_SENTENCE,
  L4_SPEC_FILE,
  NEXT_STEP_TEMPLATE,
  RULE_PLAIN,
  STYLED_FIRST_STEP_TEMPLATE,
  STYLED_NEXT_STEP_TEMPLATE,
  ruleStatement,
  stepPrompt,
  stepTemplate,
} from '../../../../scripts/lib/loop/prompts.js';
import type { FrameExtras } from '../../../../scripts/lib/loop/prompts.js';
import { readLogMethod, ruleSentences, specBlockingRules, taskFrameExtras } from '../../../../scripts/lib/loop/rungs.js';
import { styleFrame } from '../../../../scripts/lib/loop/style.js';
import type { LoopStyle } from '../../../../scripts/lib/loop/style.js';
import type { LoopTask, RunRecord, StepRecord } from '../../../../scripts/lib/loop/types.js';
import { DEMO_TASK, context, spec, stubAgent, tmpRoot } from './helpers.js';

const REPO = path.resolve(__dirname, '../../../..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');
const AUDIT = path.join(REPO, 'Docs/v1.3/study2-task-design/hint-audit.mjs');
const STATIC_STYLES: readonly LoopStyle[] = ['clean', 'hexagonal'];
const SPEC_OF: Readonly<Record<string, string>> = { clean: 'specs/clean-arch.yaml', hexagonal: 'presets/hexagonal.yaml' };
const FIX_WORDS = /\b(?:move|moving|relocate|restructure|refactor|break the cycle|go through a port|keep the domain free)\b/i;

function extras(rung: FrameExtras['rung'], attention: boolean, specRel = 'presets/hexagonal.yaml'): FrameExtras {
  return rung === 'L2' ? { rung, ruleSentences: [], attention } : { rung, ruleSentences: ruleSentences(read(specRel)), attention };
}

describe('frame extras are off by default', () => {
  it('no extras, or L2 without attention: every template and prompt is today’s, byte for byte', () => {
    const l2: FrameExtras = { rung: 'L2', ruleSentences: [], attention: false };
    expect(stepTemplate(0, undefined, l2)).toBe(FIRST_STEP_TEMPLATE);
    expect(stepTemplate(1, undefined, l2)).toBe(NEXT_STEP_TEMPLATE);
    for (const style of [...STATIC_STYLES, 'ddd'] as const) {
      const frame = styleFrame(REPO, style, style === 'ddd' ? [{ root: 'src/a/', part: 'a' }] : []);
      expect(stepTemplate(0, frame, l2)).toBe(STYLED_FIRST_STEP_TEMPLATE);
      expect(stepTemplate(1, frame, l2)).toBe(STYLED_NEXT_STEP_TEMPLATE);
      expect(stepPrompt(DEMO_TASK, 1, 'TSC', frame, l2)).toBe(stepPrompt(DEMO_TASK, 1, 'TSC', frame));
    }
  });

  it('a plan without frame, or with { specRung: L2 }, builds no extras', () => {
    const loaded = (frame?: LoopPlanFile['frame']): LoadedPlan =>
      ({ plan: { evaluatorSpec: 'specs/clean-arch.yaml', ...(frame !== undefined ? { frame } : {}) } as LoopPlanFile, tasks: { description: 'd', tasks: [DEMO_TASK] }, tasksPath: 'x' });
    for (const f of [undefined, {}, { specRung: 'L2' as const }, { specRung: 'L2' as const, attention: false }]) {
      const r = buildFrameExtras(loaded(f), REPO);
      expect(r.success && r.data === undefined).toBe(true);
    }
    expect(planFrame({})).toEqual({ specRung: 'L2', attention: false });
    const l4 = buildFrameExtras(loaded({ specRung: 'L4' }), REPO);
    expect(l4.success).toBe(true);
    if (!l4.success) return;
    const t = l4.data?.get(DEMO_TASK.id);
    expect(t?.extras.rung).toBe('L4');
    expect(t?.placedSpec?.text).toBe(read('specs/clean-arch.yaml'));
  });
});

describe('attention sentence', () => {
  it('is one line before the type-check sentence, the same for every arm and rung', () => {
    const frame = styleFrame(REPO, 'hexagonal');
    for (const rung of ['L2', 'L3', 'L4'] as const) {
      for (const i of [0, 1]) {
        const p = stepPrompt(DEMO_TASK, i, 'TSC', frame, extras(rung, true));
        expect(p).toContain(`${ATTENTION_SENTENCE}\nBefore you finish, type-check`);
        expect(p.split(ATTENTION_SENTENCE)).toHaveLength(2);
        // The arms differ only by their own tool sentence, appended after the frame.
        const none = armPrompt(p, 'none');
        const mcp = armPrompt(p, 'daedalus-mcp');
        expect(mcp.startsWith(none.replace(/\s+$/, ''))).toBe(true);
        expect(mcp.split(ATTENTION_SENTENCE)).toHaveLength(2);
      }
    }
    // L2 + attention = today's frame plus exactly that line.
    const p = stepPrompt(DEMO_TASK, 0, 'TSC', frame, extras('L2', true));
    expect(p.replace(`${ATTENTION_SENTENCE}\n`, '')).toBe(stepPrompt(DEMO_TASK, 0, 'TSC', frame));
    expect(ATTENTION_SENTENCE).toBe('Check your work against the architecture described here as you go.');
  });
});

describe('L3 and L4 rule sentences', () => {
  it('the blocking rules come from the spec and the v1.3 tiers (enabled symbolic rules only)', () => {
    expect(specBlockingRules(read('presets/hexagonal.yaml')).map((r) => r.id)).toEqual(['FF-S01', 'FF-S02', 'FF-S04', 'FF-P01', 'FF-P03', 'FF-P06']);
    expect(specBlockingRules(read('specs/clean-arch.yaml')).map((r) => r.id)).toEqual(['FF-S01', 'FF-S02', 'FF-S04', 'FF-P01', 'FF-P03', 'FF-P06']);
    // FF-S03 is blocking only for layered (rule-tiers.md).
    expect(specBlockingRules(read('presets/layered.yaml')).map((r) => r.id)).toContain('FF-S03');
    const text = 'architecture: { style: hexagonal }\nfitness_functions:\n  - { id: FF-S02, name: no-cyclic-deps, route: symbolic, enabled: false }\n  - { id: FF-P02, name: port-dependency-inversion, route: symbolic }\n  - { id: FF-S01, name: dependency-direction-graph, route: symbolic }\n';
    expect(specBlockingRules(text)).toEqual([{ id: 'FF-S01', name: 'dependency-direction-graph' }]);
    expect(() => ruleSentences('fitness_functions: []\n')).toThrow('no blocking rule');
  });

  it('one sentence per rule, from RULE_PLAIN, with no fix clause', () => {
    for (const name of Object.keys(RULE_PLAIN)) {
      const s = ruleStatement(name) ?? '';
      expect(s.startsWith(`It is a violation when ${(RULE_PLAIN[name] ?? '').split(';')[0] ?? ''}`)).toBe(true);
      expect(s).not.toMatch(FIX_WORDS);
      expect(s.split('. ')).toHaveLength(1);
    }
    expect(ruleStatement('no-cyclic-deps')).toBe('It is a violation when some files import each other in a circle.');
    // A clause that states the rule is kept.
    expect(ruleStatement('dependency-direction')).toBe('It is a violation when code in an inner layer imports code from an outer layer; dependencies must point inward, towards the domain.');
    expect(ruleStatement('custom')).toBeUndefined();
  });

  it('L3 adds the lead and the sentences; L4 adds the spec-file sentence; both only before the type-check line', () => {
    const frame = styleFrame(REPO, 'hexagonal');
    const base = stepPrompt(DEMO_TASK, 0, 'TSC', frame);
    const l3 = stepPrompt(DEMO_TASK, 0, 'TSC', frame, extras('L3', false));
    const l4 = stepPrompt(DEMO_TASK, 0, 'TSC', frame, extras('L4', false));
    const block3 = [L3_LEAD, ...ruleSentences(read('presets/hexagonal.yaml')).map((s) => `- ${s}`)].join('\n');
    expect(l3).toBe(base.replace('Before you finish', `${block3}\nBefore you finish`));
    expect(l4).toBe(base.replace('Before you finish', `${block3}\n${L4_SENTENCE}\nBefore you finish`));
    expect(L4_SENTENCE).toContain(L4_SPEC_FILE);
    expect(() => stepTemplate(0, frame, { rung: 'L3', ruleSentences: [], attention: false })).toThrow('rule sentence');
  });
});

describe('plan option', () => {
  const base = JSON.parse(read('experiments/loop-pilot/plan.json')) as Record<string, unknown>;
  const errorsOf = (p: unknown): string => {
    const r = validatePlan(p);
    return r.success ? '' : r.errors.map((e) => e.message).join('; ');
  };

  it('accepts the rungs and attention, rejects anything else', () => {
    expect(errorsOf(base)).toBe('');
    expect(errorsOf({ ...base, frame: { specRung: 'L2', attention: true } })).toBe('');
    expect(errorsOf({ ...base, frame: { specRung: 'L1' } })).toContain('frame.specRung');
    expect(errorsOf({ ...base, frame: { attention: 'yes' } })).toContain('frame.attention');
    expect(errorsOf({ ...base, frame: { specRung: 'L3', extra: 1 } })).toContain('frame must be');
  });

  it('L3/L4 need a static spec: an ise-step1 (DDD) profile is refused', () => {
    expect(errorsOf({ ...base, frame: { specRung: 'L3' } })).toContain('relief-volunteers: an L3 frame needs a static spec');
    const profiles = { ...(base.taskProfiles as Record<string, unknown>) };
    delete profiles['relief-volunteers'];
    expect(errorsOf({ ...base, taskProfiles: profiles, frame: { specRung: 'L4', attention: true } })).toBe('');
  });
});

describe('L4 in the loop: spec in the cwd and the file-read log', () => {
  const placed = taskFrameExtras('L4', true, { source: 'presets/hexagonal.yaml', text: read('presets/hexagonal.yaml') });

  it('the spec is in the base commit, run.json records the rung, every turn records whether the file was read', async () => {
    const out = tmpRoot();
    try {
      // The stub reads the spec on step 2 only.
      const agent = stubAgent({
        onTurn: (input) => {
          if (input.stepIndex === 1) fs.readFileSync(path.join(input.cwd, L4_SPEC_FILE));
        },
      });
      const r = await runLoop(context(out, agent, { frameExtras: new Map([[DEMO_TASK.id, placed]]) }), spec('none'));
      expect(r.success).toBe(true);
      const runDir = runDirFor(out, loopRunId(spec('none')));
      const run = JSON.parse(fs.readFileSync(path.join(runDir, RUN_JSON), 'utf8')) as RunRecord;
      const method = readLogMethod(out);
      expect(run.frame).toEqual({ specRung: 'L4', attention: true, placedSpec: { file: L4_SPEC_FILE, source: 'presets/hexagonal.yaml', sha256: placed.placedSpec?.sha256, readLogMethod: method } });
      expect(fs.readFileSync(path.join(runDir, 'work', L4_SPEC_FILE), 'utf8')).toBe(read('presets/hexagonal.yaml'));
      const steps = [0, 1, 2].map((i) => JSON.parse(fs.readFileSync(path.join(runDir, 'steps', `step-0${String(i + 1)}.json`), 'utf8')) as StepRecord);
      // The spec never shows in a step diff (it is part of the base commit).
      for (const s of steps) expect(JSON.stringify(s.turns[0]?.snapshot.diff)).not.toContain(L4_SPEC_FILE);
      const reads = steps.map((s) => s.turns[0]?.specRead);
      for (const x of reads) expect(x).toMatchObject({ file: L4_SPEC_FILE, method, present: true, intact: true });
      expect(reads.map((x) => x?.read)).toEqual(method === 'atime' ? [false, true, false] : [null, null, null]);
      const log = fs.readFileSync(path.join(runDir, SPEC_READS_LOG), 'utf8').trim().split('\n');
      expect(log).toHaveLength(3);
      // Every prompt of the run carries the L4 block and the attention sentence.
      for (const t of agent.turns) expect(t.prompt).toContain(`${L4_SENTENCE}\n${ATTENTION_SENTENCE}\n`);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('without extras a run has no spec file, no frame record and no read log', async () => {
    const out = tmpRoot();
    try {
      expect((await runLoop(context(out), spec('gate'))).success).toBe(true);
      const runDir = runDirFor(out, loopRunId(spec('gate')));
      const run = JSON.parse(fs.readFileSync(path.join(runDir, RUN_JSON), 'utf8')) as RunRecord;
      expect('frame' in run).toBe(false);
      expect(fs.existsSync(path.join(runDir, 'work', L4_SPEC_FILE))).toBe(false);
      expect(fs.existsSync(path.join(runDir, SPEC_READS_LOG))).toBe(false);
      const step = JSON.parse(fs.readFileSync(path.join(runDir, 'steps', 'step-01.json'), 'utf8')) as StepRecord;
      expect(step.turns.every((t) => !('specRead' in t))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('hint audit of the rung frames (hint-audit.mjs --frame-rung)', () => {
  const tasks = (JSON.parse(read('fixtures/v1.3-rehearsal-tasks/tasks.json')) as { tasks: LoopTask[] }).tasks;
  const PRESET: Readonly<Record<string, string>> = { clean: 'presets/clean-architecture.yaml', hexagonal: 'presets/hexagonal.yaml' };
  const audit = (args: readonly string[], input?: string): { status: number | null; json: { totalFail: number; report: { hits: { level: string; term: string; why: string }[] }[] } } => {
    const r = spawnSync(process.execPath, [AUDIT, '--json', ...args], { cwd: REPO, encoding: 'utf8', ...(input !== undefined ? { input } : {}) });
    return { status: r.status, json: JSON.parse(r.stdout) as never };
  };
  const writeFrame = (dir: string, name: string, text: string): string => {
    const f = path.join(dir, name);
    fs.writeFileSync(f, text);
    return f;
  };

  it('the L3 and L4 frames (with attention) of the rehearsal Clean and Hexagonal tasks pass: 0 FAIL, every step', () => {
    const dir = tmpRoot('rung-audit-');
    try {
      for (const [id, style] of [['school-bus', 'clean'], ['repair-cafe', 'hexagonal']] as const) {
        const task = tasks.find((t) => t.id === id);
        expect(task).toBeDefined();
        if (task === undefined) return;
        for (const rung of ['L3', 'L4'] as const) {
          for (const i of task.steps.map((_, k) => k)) {
            // The frame alone (the request is audited separately, as the fixture README does).
            const p = stepPrompt({ ...task, steps: task.steps.map((s) => ({ ...s, request: 'REQUEST' })) }, i, 'TSC', styleFrame(REPO, style), extras(rung, true, SPEC_OF[style]));
            const f = writeFrame(dir, `${id}-${rung}-${String(i)}.txt`, p);
            const r = audit(['--preset', PRESET[style] ?? '', '--frame', f, '--frame-rung', rung]);
            expect(r.json.totalFail).toBe(0);
            expect(r.status).toBe(0);
            // The same frame audited as a no-hint frame fails, as it must (it names the style and the rules).
            expect(audit(['--preset', PRESET[style] ?? '', '--frame', f]).json.totalFail).toBeGreaterThan(0);
          }
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a fix instruction FAILs in an L3/L4 frame, not in an L2 frame', () => {
    const dir = tmpRoot('rung-audit-');
    try {
      const f = writeFrame(dir, 'fix.txt', `${L3_LEAD}\n- It is a violation when some files import each other in a circle; break the cycle and move the shared code to src/domain.\n`);
      const l3 = audit(['--preset', 'presets/hexagonal.yaml', '--frame', f, '--frame-rung', 'L3']);
      expect(l3.status).toBe(1);
      expect(l3.json.report[0]?.hits.filter((h) => h.level === 'FAIL').map((h) => h.term.toLowerCase()).sort()).toEqual(['break the cycle', 'move']);
      expect(audit(['--preset', 'presets/hexagonal.yaml', '--frame', f, '--frame-rung', 'L2']).json.totalFail).toBe(0);
      expect(spawnSync(process.execPath, [AUDIT, '--frame', f, '--frame-rung', 'L1'], { cwd: REPO }).status).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persistence vocabulary: orm and typeorm FAIL, database, table and column WARN', () => {
    const r = audit(['--preset', 'presets/hexagonal.yaml', '-'], 'Keep the bookings in a database table with a status column, through TypeORM (an ORM).');
    const hits = r.json.report[0]?.hits ?? [];
    const level = (term: string): string[] => hits.filter((h) => h.term.toLowerCase() === term).map((h) => h.level);
    expect(level('typeorm')).toEqual(['FAIL']);
    expect(level('orm')).toEqual(['FAIL']);
    for (const w of ['database', 'table', 'column']) expect(level(w)).toEqual(['WARN']);
    expect(r.status).toBe(1);
  });
});
