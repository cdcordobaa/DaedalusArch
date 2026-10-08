/**
 * Prompt instantiation, template hashes and the protocol draft (U5a plan Step 23; BR-U5a-42, 52; D-U5a-10).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { typecheckCommand } from '../../../../scripts/lib/generators/argv.js';
import { buildHarnessTsconfig } from '../../../../scripts/lib/generators/harness-tsconfig.js';
import { runGenerationGrid } from '../../../../scripts/lib/generators/grid.js';
import {
  PROMPT_PLACEHOLDER,
  filePromptProvider,
  instantiateForRun,
  instantiatePrompt,
  loadPromptTemplate,
  parsePromptTemplateFile,
  sha256Text,
} from '../../../../scripts/lib/generators/prompt.js';
import { TASK_IDS, isPilotOutRoot, pilotPlan, requestForCell, scheduleGrid } from '../../../../scripts/lib/generators/schedule.js';
import { SPEC_LEVELS } from '../../../../scripts/lib/generators/types.js';
import type { GenerationOutcome, GeneratorAdapter, GridPlan } from '../../../../scripts/lib/generators/types.js';
import { makeGenerationOutcome } from '../../../../scripts/lib/generators/outcome.js';
import { makeHarness } from './fake-generator-runner.js';

const REPO = process.cwd();
const PROTOCOL = fs.readFileSync(path.join(REPO, 'Docs/generator-protocol.md'), 'utf8');

describe('instantiatePrompt (BR-U5a-52)', () => {
  it('a template with zero or two placeholders is refused', () => {
    for (const t of ['no placeholder\n', `${PROMPT_PLACEHOLDER} and ${PROMPT_PLACEHOLDER}\n`]) {
      const r = instantiatePrompt(t, '/h/bin/tsc --noEmit');
      expect(r.success).toBe(false);
      if (!r.success) expect(r.errors[0]?.code).toBe('GEN_PROMPT_TEMPLATE_INVALID');
    }
    expect(instantiatePrompt(`run:\n${PROMPT_PLACEHOLDER}\n`, '/h/bin/tsc $&')).toEqual({ success: true, data: 'run:\n/h/bin/tsc $&\n' });
    expect(parsePromptTemplateFile('<!-- task: task-management -->\nno placeholder\n<!-- task: order-fulfilment -->\nx {{TYPECHECK_COMMAND}}\n').success).toBe(false);
    expect(parsePromptTemplateFile('<!-- task: task-management -->\n{{TYPECHECK_COMMAND}}\n').success).toBe(false);
  });

  it('re-instantiating the template with the recorded runId and harnessRoot reproduces promptSha256', () => {
    const provider = filePromptProvider(REPO);
    const plan: GridPlan = {
      adapters: [{ adapterId: 'claude-code-cli', modelId: 'model-x' }],
      tasks: ['order-fulfilment'],
      style: 'clean-architecture',
      levels: ['minimal-prose'],
      runs: 2,
      outRoot: '/tmp/u5a-out',
      orderSeed: 3,
    };
    const cell = scheduleGrid(plan)[1];
    if (cell === undefined) throw new Error('cell');
    const req = requestForCell(plan, cell);
    const harness = '/var/u5a/h';
    const inst = provider(req, typecheckCommand(harness, req.runId));
    if (!inst.success) throw new Error('provider');
    expect(inst.data.prompt).toContain(`/var/u5a/h/bin/tsc --noEmit --incremental false -p /var/u5a/h/runs/model-x/order-fulfilment/minimal-prose/run-${String(req.runIndex)}/tsconfig.json`);
    expect(inst.data.prompt).not.toContain(PROMPT_PLACEHOLDER);
    const t = loadPromptTemplate(REPO, 'minimal-prose', 'order-fulfilment');
    if (!t.success) throw new Error('template');
    const again = instantiateForRun(t.data, harness, req.runId);
    expect(again.success && again.data.promptSha256).toBe(inst.data.promptSha256);
    expect(inst.data.promptSha256).toBe(sha256Text(inst.data.prompt));
    expect(inst.data.promptTemplateSha256).toBe(t.data.promptTemplateSha256);
    const other = instantiateForRun(t.data, harness, req.runId.replace(/run-\d+$/, 'run-9'));
    expect(other.success && other.data.promptSha256).not.toBe(inst.data.promptSha256);
  });
});

describe('Docs/generator-protocol.md (DRAFT)', () => {
  it('template hashes equal the committed templates (six templates, three files)', () => {
    for (const level of SPEC_LEVELS) {
      for (const task of TASK_IDS) {
        const t = loadPromptTemplate(REPO, level, task);
        if (!t.success) throw new Error('template');
        expect(PROTOCOL).toContain(`| ${level} | ${task} | \`${t.data.promptTemplateSha256}\` |`);
      }
      const file = sha256Text(fs.readFileSync(path.join(REPO, 'scripts/generator/prompts', `${level}.md`), 'utf8'));
      expect(PROTOCOL).toContain(`| \`scripts/generator/prompts/${level}.md\` | \`${file}\` |`);
    }
    expect(PROTOCOL).toMatch(/^# Generator protocol \(DRAFT\)/);
  });

  it('the pinned tsconfig block equals buildHarnessTsconfig with <cwd> substituted (BR-U5a-42)', () => {
    const m = /<!-- harness-tsconfig -->\n```json\n([\s\S]*?)\n```/.exec(PROTOCOL);
    expect(m).not.toBeNull();
    const block = JSON.parse(m?.[1] ?? '{}') as unknown;
    const built = JSON.parse(JSON.stringify(buildHarnessTsconfig('/__CWD__')).split('/__CWD__').join('<cwd>')) as unknown;
    expect(block).toEqual(built);
  });

  it('names the skeleton lock hash and the pinned versions', () => {
    const lock = sha256Text(fs.readFileSync(path.join(REPO, 'scripts/generator/skeleton/package-lock.json'), 'utf8'));
    expect(PROTOCOL).toContain(lock);
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/generator/skeleton/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const [name, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) expect(PROTOCOL).toContain(`| \`${name}\` | ${v} |`);
  });
});

describe('pilot flag from outRoot (BR-U5a-52)', () => {
  it('an outRoot ending in pilot sets pilot: true on every outcome; pilotPlan runs one generation per level', async () => {
    const h = makeHarness({ outRootName: 'pilot' });
    try {
      expect(isPilotOutRoot(h.outRoot)).toBe(true);
      expect(isPilotOutRoot(path.join(h.tmp, 'e1'))).toBe(false);
      const adapter: GeneratorAdapter = {
        id: 'claude-code-cli',
        modelId: 'model-x',
        isAvailable: () => Promise.resolve(true),
        generate: (req) => {
          fs.mkdirSync(req.outputDir, { recursive: true });
          return Promise.resolve(
            makeGenerationOutcome({
              status: 'ok',
              adapterId: 'claude-code-cli',
              taskId: req.taskId,
              specLevel: req.specLevel,
              runIndex: req.runIndex,
              orderSeed: req.orderSeed,
              requestedModelId: req.modelId,
              auxiliaryModels: [],
              promptTemplateId: req.promptTemplateId,
              promptTemplateSha256: '1'.repeat(64),
              promptSha256: '2'.repeat(64),
              prompt: 'p',
              skeletonIntact: true,
              fileCount: 20,
              permissionDenials: 0,
              typecheck: { tscVersion: '5.9.3', errors: 0 },
              attempts: [],
              interruptions: [],
              treeSha: null,
              durationMs: 1,
              pilot: req.pilot,
              envelopePath: 'envelope.json',
            }),
          );
        },
      };
      const base: GridPlan = {
        adapters: [
          { adapterId: 'claude-code-cli', modelId: 'model-x' },
          { adapterId: 'claude-code-cli', modelId: 'model-y' },
        ],
        tasks: ['task-management', 'order-fulfilment'],
        style: 'clean-architecture',
        levels: ['none', 'minimal-prose', 'full-aac'],
        runs: 3,
        outRoot: path.dirname(h.outRoot),
        orderSeed: 11,
      };
      const pilot = pilotPlan(base);
      expect(pilot.outRoot).toBe(h.outRoot);
      const r = await runGenerationGrid(pilot, [adapter]);
      if (!r.success) throw new Error(r.errors.map((e) => e.code).join(','));
      expect(r.data).toHaveLength(3);
      expect(r.data.every((o: GenerationOutcome) => o.pilot)).toBe(true);
      expect(new Set(r.data.map((o) => o.specLevel))).toEqual(new Set(SPEC_LEVELS));
    } finally {
      h.cleanup();
    }
  });
});
