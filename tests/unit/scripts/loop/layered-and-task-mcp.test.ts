/**
 * BUILD-L (U10, REV-04 P16/P17): the `layered` loop style and its L2/L3 frames, the DDD L3 frame of the rehearsal spec,
 * the rehearsal frame files and hashes, and the per-task MCP spec of a `daedalus-mcp` plan with `taskProfiles` (gate
 * D11c). Made-up demo tasks and the committed rehearsal fixtures only; no model, no Neo4j.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { DaedalusServerInput } from '../../../../scripts/lib/generators/arms.js';
import { ClaudeStepAgent, CodexStepAgent, daedalusFor } from '../../../../scripts/lib/loop/agents.js';
import { buildFrameExtras, buildProfiles, stubLayoutFor } from '../../../../scripts/lib/loop/main.js';
import { checkSpecEquality, loadLoopPlan, mcpSpecCheck, mcpSpecFor, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import type { LoopPlanFile } from '../../../../scripts/lib/loop/plan.js';
import { FIX_CLAUSE, RULE_PLAIN, RULE_PLAIN_BY_STYLE, ruleStatement, stepPrompt } from '../../../../scripts/lib/loop/prompts.js';
import { ruleSentences, specBlockingRules } from '../../../../scripts/lib/loop/rungs.js';
import { iseDddFreezer } from '../../../../scripts/lib/loop/specs.js';
import { stubEvaluator } from '../../../../scripts/lib/loop/stub.js';
import { LOOP_STYLES, STYLE_PRESETS, styleFrame } from '../../../../scripts/lib/loop/style.js';
import { DDD_SPEC, REHEARSAL_DIR, rehearsalFiles } from '../../../../scripts/v1.4/lib/rehearsal-frames.js';
import { createCodexCliConfig } from '../../../../scripts/lib/generators/codex-cli.js';
import { parseSpec } from '../../../../src/spec-parser/index.js';
import { FakeGeneratorRunner, MODEL, makeHarness } from '../generators/fake-generator-runner.js';
import type { Harness } from '../generators/fake-generator-runner.js';
import { DEMO_TASK, tmpRoot } from './helpers.js';

const REPO = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');
const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const AUDIT = 'Docs/v1.3/study2-task-design/hint-audit.mjs';

describe('layered loop style', () => {
  it('is a loop style with the layered preset', () => {
    expect(LOOP_STYLES).toContain('layered');
    expect(STYLE_PRESETS.layered).toBe('presets/layered.yaml');
  });

  it('frames Layered exactly as the floor probe did (results/v1.3-floor-probe/tasks.json frames.layered)', () => {
    const probe = (JSON.parse(read('results/v1.3-floor-probe/tasks.json')) as { frames: Record<string, Record<string, string>> }).frames.layered ?? {};
    const f = styleFrame(REPO, 'layered');
    expect(f.styleSentence).toBe(probe.styleSentence);
    expect(f.styleName).toBe(probe.styleName);
    expect(f.layoutSentence).toBe(probe.layoutSentence);
  });

  it('a layered step prompt carries the style and layout sentences at step 1 and the style name later', () => {
    const f = styleFrame(REPO, 'layered');
    expect(stepPrompt(DEMO_TASK, 0, 'TSC', f)).toContain(`Put the source under src/. ${f.styleSentence}\n${f.layoutSentence}\n`);
    expect(stepPrompt(DEMO_TASK, 1, 'TSC', f)).toContain('follow the architecture the project already uses (Layered Architecture).');
  });

  it('a plan accepts a layered profile and the dry-run stub writes into the preset folders', () => {
    const r = validatePlan({ description: 'd', tasksFile: 't', outRoot: '/o', binary: '/b', harnessRoot: '/h', allowBash: true, runs: 1, orderSeed: 1, arms: ['none'],
      adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }], taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml' } } });
    expect(r.success).toBe(true);
    const layout = stubLayoutFor('layered', [], 2);
    for (const dir of [layout.domain, layout.application, layout.infrastructure]) expect(/^src\/(business|presentation|persistence)(\/|$)/.test(dir)).toBe(true);
  });
});

describe('L3 rule sentences', () => {
  it('Layered: one sentence per blocking rule, in Layered words, never a fix clause, no Clean folder word', () => {
    const text = read('presets/layered.yaml');
    const rules = specBlockingRules(text);
    const sentences = ruleSentences(text);
    expect(sentences).toHaveLength(rules.length);
    expect(rules.map((r) => r.id)).toEqual(['FF-S01', 'FF-S02', 'FF-S03', 'FF-S04', 'FF-P01', 'FF-P03', 'FF-P06']);
    for (const s of sentences) {
      expect(s).toMatch(/^It is a violation when .+\.$/);
      expect(s).not.toMatch(/\b(inner|outer|domain|infrastructure|inward)\b/);
      for (const clause of s.slice('It is a violation when '.length).split(/;\s*/).slice(1)) expect(FIX_CLAUSE.test(clause.trim())).toBe(false);
    }
  });

  it('a style without its own wording, or no style, reads RULE_PLAIN as before', () => {
    expect(ruleStatement('dependency-direction')).toBe(`It is a violation when ${RULE_PLAIN['dependency-direction'] ?? ''}.`);
    expect(ruleStatement('dependency-direction', 'clean')).toBe(ruleStatement('dependency-direction'));
    expect(ruleStatement('dependency-direction', 'layered')).toContain('lower layer');
    // Every Layered override names a rule RULE_PLAIN already knows (no new rule is invented).
    for (const name of Object.keys(RULE_PLAIN_BY_STYLE.layered ?? {})) expect(RULE_PLAIN[name]).toBeDefined();
  });

  it('DDD: the static rehearsal spec parses with exactly the two declared contexts and gives one sentence per blocking rule', async () => {
    const parsed = await parseSpec({ specFilePath: path.join(REPO, DDD_SPEC) });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.layerModel.ddd?.contexts.map((c) => c.root)).toEqual(['src/picking/', 'src/cellar/']);
    const text = read(DDD_SPEC);
    expect(ruleSentences(text)).toHaveLength(specBlockingRules(text).length);
  });
});

describe('rehearsal frames and hashes (fixtures/v1.3-rehearsal-tasks)', () => {
  const { files, hashes } = rehearsalFiles(REPO);

  it('the committed frames, DDD spec and hashes.json are what the harness code writes now', () => {
    for (const [rel, text] of files) expect(read(rel)).toBe(text);
    expect(JSON.parse(read(`${REHEARSAL_DIR}/hashes.json`))).toEqual(hashes);
  });

  it('the hashes follow the README: tasks.json bytes and each task as compact JSON.stringify', () => {
    const text = read(`${REHEARSAL_DIR}/tasks.json`);
    expect(hashes['tasks.json']).toBe(sha(text));
    for (const t of (JSON.parse(text) as { tasks: { id: string }[] }).tasks) expect(hashes[`task/${t.id}`]).toBe(sha(JSON.stringify(t)));
  });

  it('every L2 and L3 frame passes the hint audit at its rung (0 FAIL)', () => {
    const styles = (JSON.parse(read(`${REHEARSAL_DIR}/styles.json`)) as { tasks: Record<string, { style: keyof typeof STYLE_PRESETS }> }).tasks;
    for (const [task, s] of Object.entries(styles)) {
      const ctx = task === 'vineyard-harvest' ? ['--context', 'picking', '--context', 'cellar'] : [];
      for (const [rung, file] of [['L2', `frame-${task}.txt`], ['L3', `frame-${task}.L3.txt`]] as const) {
        // exit 0 = no FAIL hit; execFileSync throws on exit 1.
        const out = execFileSync('node', [AUDIT, '--preset', STYLE_PRESETS[s.style], ...ctx, '--frame', `${REHEARSAL_DIR}/hint-audit/${file}`, '--frame-rung', rung], { cwd: REPO, encoding: 'utf8' });
        expect(out).toContain('total: 0 FAIL');
      }
    }
  });
});

describe('per-task MCP spec (D11c)', () => {
  const DAEDALUS: DaedalusServerInput = { nodeBinary: '/usr/bin/node', serverEntry: '/opt/daedalus/dist/mcp-server/main.js', specPath: '/opt/daedalus/specs/clean-arch.yaml' };
  const base = {
    description: 'd', tasksFile: 'experiments/loop-demo/demo-tasks.json', adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }], arms: ['none', 'daedalus-mcp'],
    runs: 1, orderSeed: 7, outRoot: '/o', binary: '/b', harnessRoot: '/h', allowBash: true, daedalus: DAEDALUS,
  } as const;
  const plan = (over: Partial<Record<keyof LoopPlanFile, unknown>>): LoopPlanFile => ({ ...base, ...over }) as unknown as LoopPlanFile;

  it('a daedalus-mcp plan may carry static taskProfiles; ise-step1 or a bad pin is refused', () => {
    expect(validatePlan(plan({ taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml' } } })).success).toBe(true);
    const ise = validatePlan(plan({ taskProfiles: { 'todo-list': { style: 'ddd', specMode: 'ise-step1', contexts: [{ root: 'src/a/', part: 'a' }] } } }));
    expect(ise.success ? [] : ise.errors.map((e) => e.message)).toEqual(['taskProfiles.todo-list: the daedalus-mcp arm needs a static spec (its MCP server reads the spec before step 1)']);
    expect(validatePlan(plan({ taskProfiles: { 'todo-list': { style: 'clean', evaluatorSpec: 's', specSha256: 'x' } } })).success).toBe(false);
  });

  it('mcpSpecFor: the profile spec for a profiled task, daedalus.specPath for any other', () => {
    const p = plan({ evaluatorSpec: 'specs/clean-arch.yaml', taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml' } } });
    expect(mcpSpecFor(p, 'todo-list', REPO)).toBe(path.join(REPO, 'presets/layered.yaml'));
    expect(mcpSpecFor(p, 'other', REPO)).toBe(DAEDALUS.specPath);
    expect(mcpSpecFor({ taskProfiles: p.taskProfiles ?? {} }, 'todo-list', REPO)).toBeUndefined();
  });

  it('R23: no default pair to compare when every task has a profile; the default pair still compared otherwise', () => {
    expect(mcpSpecCheck(plan({ taskProfiles: { 'todo-list': { style: 'clean', evaluatorSpec: 'specs/clean-arch.yaml' } } }), REPO)).toMatchObject({ success: true, data: undefined });
    const withDefault = mcpSpecCheck(plan({ evaluatorSpec: 'specs/clean-arch.yaml', taskProfiles: { 'todo-list': { style: 'clean', evaluatorSpec: 'specs/clean-arch.yaml' } } }), REPO);
    expect(withDefault.success).toBe(false); // /opt/daedalus/... does not exist here
  });

  it('spec pins: a profile pin covers its own spec; profile pins meet requireSpecSha256 only without a default spec', () => {
    const layeredSha = sha(read('presets/layered.yaml'));
    const profiled = plan({ taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml', specSha256: layeredSha } } });
    expect(checkSpecEquality(profiled, REPO, { requireSpecSha256: true })).toEqual([]);
    const wrong = plan({ taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml', specSha256: '0'.repeat(64) } } });
    expect(checkSpecEquality(wrong, REPO).map((e) => e.code)).toEqual(['LOOP_PLAN_SPEC_MISMATCH']);
    const fallback = plan({ evaluatorSpec: 'specs/clean-arch.yaml', taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml', specSha256: layeredSha } } });
    expect(checkSpecEquality(fallback, REPO, { requireSpecSha256: true }).map((e) => e.code)).toEqual(['LOOP_PLAN_INVALID']);
    expect(checkSpecEquality(plan({ taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml' } } }), REPO, { requireSpecSha256: true }).map((e) => e.code)).toEqual(['LOOP_PLAN_INVALID']);
  });

  it('loads a demo daedalus-mcp plan with a profile and builds its layered frames (L3)', () => {
    const tmp = tmpRoot('task-mcp-');
    const planFile = path.join(tmp, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify({ ...base, outRoot: path.join(tmp, 'out'), frame: { specRung: 'L3' }, taskProfiles: { 'todo-list': { style: 'layered', evaluatorSpec: 'presets/layered.yaml' } } }));
    const loaded = loadLoopPlan(planFile, REPO);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    const profiles = buildProfiles(loaded.data, REPO, () => stubEvaluator(), iseDddFreezer(REPO));
    expect(profiles.success && profiles.data?.get('todo-list')?.frame.style).toBe('layered');
    const extras = buildFrameExtras(loaded.data, REPO);
    expect(extras.success && extras.data?.get('todo-list')?.extras.ruleSentences).toEqual(ruleSentences(read('presets/layered.yaml')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('agents', () => {
    let h: Harness;
    const runId = `claude-code-cli/${MODEL}/todo-list/daedalus-mcp/run-0`;
    let cwd: string;
    beforeEach(() => {
      h = makeHarness();
      cwd = path.join(h.outRoot, 'runs', ...runId.split('/'), 'work');
      fs.mkdirSync(cwd, { recursive: true });
    });
    afterEach(() => {
      h.cleanup();
    });
    const byTask = new Map([['todo-list', '/opt/daedalus/specs/layered.yaml']]);

    it('daedalusFor swaps only the spec path, only for a listed task', () => {
      expect(daedalusFor({ daedalus: DAEDALUS, daedalusSpecByTask: byTask }, 'todo-list')).toEqual({ ...DAEDALUS, specPath: '/opt/daedalus/specs/layered.yaml' });
      expect(daedalusFor({ daedalus: DAEDALUS, daedalusSpecByTask: byTask }, 'other')).toBe(DAEDALUS);
      expect(daedalusFor({ daedalus: DAEDALUS }, 'todo-list')).toBe(DAEDALUS);
      expect(daedalusFor({ daedalusSpecByTask: byTask }, 'todo-list')).toBeUndefined();
    });

    it('Claude: the MCP config of a profiled task names its spec; without taskId or a map the config is unchanged', () => {
      const agent = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary), daedalus: DAEDALUS, daedalusSpecByTask: byTask });
      const p = agent.plan({ runId, cwd, prompt: 'P', arm: 'daedalus-mcp', taskId: 'todo-list' });
      expect(p.success && JSON.stringify(p.data.mcpConfig)).toContain('/opt/daedalus/specs/layered.yaml');
      const plain = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary), daedalus: DAEDALUS }).plan({ runId, cwd, prompt: 'P', arm: 'daedalus-mcp', taskId: 'todo-list' });
      const noTask = agent.plan({ runId, cwd, prompt: 'P', arm: 'daedalus-mcp' });
      expect(plain.success && noTask.success && plain.data.mcpConfig).toEqual(noTask.success ? noTask.data.mcpConfig : null);
      expect(plain.success && JSON.stringify(plain.data.mcpConfig)).toContain(DAEDALUS.specPath);
    });

    it('Codex: the MCP override of a profiled task names its spec', () => {
      const homes = ['codex-home', 'codex-userhome', 'home'].map((d) => path.join(h.tmp, d));
      for (const d of homes) fs.mkdirSync(d, { recursive: true });
      const codex = createCodexCliConfig(
        {
          base: h.config, codexHome: homes[0] ?? '', userHome: homes[1] ?? '', realHome: homes[2] ?? '', reasoningEffort: 'medium', cliVersion: '0.162.1',
          modelCatalog: path.join(REPO, 'scripts', 'generator', 'codex', 'model-catalog.json'),
        },
        REPO,
      );
      if (!codex.success) throw new Error(JSON.stringify(codex.errors));
      const agent = new CodexStepAgent(codex.data, { runner: new FakeGeneratorRunner(h.binary), repoRoot: REPO, daedalus: DAEDALUS, daedalusSpecByTask: byTask });
      const p = agent.plan({ runId, cwd, prompt: 'P', arm: 'daedalus-mcp', taskId: 'todo-list' });
      expect(p.success && p.data.args.join(' ')).toContain('/opt/daedalus/specs/layered.yaml');
    });
  });
});
