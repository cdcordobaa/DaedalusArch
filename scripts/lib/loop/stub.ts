/**
 * Dry-run stand-ins of the loop: a stub generator that writes canned files, a stub firewall and a stub type-check.
 * With them the whole loop (snapshots, measures, the gate's repair turn, resume) runs without a model call, without
 * Neo4j and without the skeleton install. They are test and demo devices: nothing they report is a measurement.
 *
 * Default stub generator (`demoStubScript`), per step `<id>` of the task:
 * - step turn: writes `src/domain/<id>.ts` and `src/application/<id>-service.ts`; from step 2 on, every second step
 *   also writes `src/infrastructure/<id>-store.ts` and makes the domain file import it (one planted dependency
 *   violation per such step, so erosion is visible in the dry run);
 * - repair turn: rewrites every domain file without its infrastructure import.
 * `layoutStubScript` does the same in other folders (one layout per task and step), so a styled plan's dry run writes
 * Hexagonal or per-context DDD trees; `demoStubScript` is it with the Clean folders.
 * Stub firewall (`stubEvaluator`): rule `STUB-DEP` (blocking) = a file in a `domain` folder importing from an
 * `infrastructure` or `adapters` folder; rule `STUB-TODO` (advisory) = a `TODO` comment. AHS = max(0, 1 − 0.1·blocking − 0.02·advisory).
 * Stub type-check: one error per file holding the marker `@stub-type-error`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { sourceFilePaths } from '../generators/outcome.js';
import { CLAUDE_CODE_ADAPTER_ID } from '../generators/types.js';
import type { GeneratorAdapterId } from '../generators/types.js';
import type { BlockingFinding, LoopTask, StepAgent, StepEvaluator, StepTypechecker, TurnInput, TurnResult } from './types.js';

/** Files a stub turn writes (`null` deletes the file), relative to the cwd. */
export type StubScript = (input: TurnInput, task: LoopTask) => Readonly<Record<string, string | null>>;

const STUB_IMPORT = /^import .* from '[^']*(?:infrastructure|adapters)\/[^']*';\n/gm;

/** Where a stub step writes its three files (POSIX, relative to the cwd, no trailing slash). */
export interface StubLayout {
  readonly domain: string;
  readonly application: string;
  readonly infrastructure: string;
  /**
   * Writes each step's domain file in a folder of its own (`<domain>/<id>/<id>.ts`), the aggregate module the ISE
   * infers a DDD aggregate from; without one, the frozen DDD spec cannot be compiled (`specs.ts`).
   */
  readonly aggregateFolders?: boolean;
  /**
   * Further domain folders that get the step's domain module too (DDD step 1: every declared context, because the ISE
   * finds no bounded context in a step-1 tree with a single context folder).
   */
  readonly alsoDomains?: readonly string[];
}

export const CLEAN_STUB_LAYOUT: StubLayout = Object.freeze({ domain: 'src/domain', application: 'src/application', infrastructure: 'src/infrastructure' });

function pascal(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/** Every `src/**` file whose path has a `domain` folder (POSIX, cwd-relative). */
function domainFiles(cwd: string): string[] {
  return sourceFilePaths(cwd)
    .map((rel) => `src/${rel}`)
    .filter((rel) => rel.split('/').slice(0, -1).includes('domain'));
}

function relImport(fromDir: string, toFile: string): string {
  const r = path.posix.relative(fromDir, toFile).replace(/\.ts$/, '');
  return r.startsWith('.') ? r : `./${r}`;
}

/** The demo stub over a layout per task and step (module header). */
export function layoutStubScript(layoutOf: (taskId: string, stepIndex: number) => StubLayout): StubScript {
  return (input, task) => {
    const files: Record<string, string | null> = {};
    if (input.kind === 'repair') {
      for (const rel of domainFiles(input.cwd)) {
        const text = fs.readFileSync(path.join(input.cwd, ...rel.split('/')), 'utf8');
        const fixed = text.replace(STUB_IMPORT, '');
        if (fixed !== text) files[rel] = fixed;
      }
      return files;
    }
    const step = task.steps[input.stepIndex];
    if (step === undefined) return files;
    const at = layoutOf(task.id, input.stepIndex);
    const name = pascal(step.id);
    const violate = input.stepIndex > 0 && input.stepIndex % 2 === 1;
    const domainDir = at.aggregateFolders === true ? `${at.domain}/${step.id}` : at.domain;
    const domainFile = `${domainDir}/${step.id}.ts`;
    const storeFile = `${at.infrastructure}/${step.id}-store.ts`;
    files[domainFile] =
      (violate ? `import { ${name}Store } from '${relImport(domainDir, storeFile)}';\n` : '') +
      `export interface ${name} {\n  readonly id: string;\n}\n` +
      (violate ? `export const ${name.charAt(0).toLowerCase()}${name.slice(1)}Store = new ${name}Store();\n` : '');
    files[`${at.application}/${step.id}-service.ts`] =
      `import type { ${name} } from '${relImport(at.application, domainFile)}';\n\n` +
      `export class ${name}Service {\n  private readonly items: ${name}[] = [];\n\n  list(): readonly ${name}[] {\n    return this.items;\n  }\n}\n`;
    if (violate) files[storeFile] = `export class ${name}Store {\n  readonly rows: string[] = [];\n}\n`;
    for (const d of at.alsoDomains ?? []) {
      const dir = at.aggregateFolders === true ? `${d}/${step.id}` : d;
      files[`${dir}/${step.id}.ts`] = `export interface ${name} {\n  readonly id: string;\n}\n`;
    }
    return files;
  };
}

export const demoStubScript: StubScript = layoutStubScript(() => CLEAN_STUB_LAYOUT);

export interface StubAgentOptions {
  readonly adapterId?: GeneratorAdapterId;
  readonly modelId?: string;
  readonly script?: StubScript;
  /** Called before each turn (tests use it to stop a run mid-way). */
  readonly onTurn?: (input: TurnInput) => void;
}

/** The stub generator. Its usage figures are synthetic and deterministic (cost 0, tokens = bytes written). */
export class StubStepAgent implements StepAgent {
  readonly adapterId: GeneratorAdapterId;
  readonly modelId: string;
  readonly turns: TurnInput[] = [];

  constructor(
    private readonly tasks: ReadonlyMap<string, LoopTask>,
    private readonly options: StubAgentOptions = {},
  ) {
    this.adapterId = options.adapterId ?? CLAUDE_CODE_ADAPTER_ID;
    this.modelId = options.modelId ?? 'stub-model';
  }

  runTurn(input: TurnInput): Promise<DomainResult<TurnResult>> {
    this.options.onTurn?.(input);
    this.turns.push(input);
    const task = this.tasks.get(input.taskId);
    if (task === undefined) return Promise.resolve(DomainResult.fail([{ code: 'LOOP_STUB_TASK', message: `stub has no task ${input.taskId}` }]));
    const files = (this.options.script ?? demoStubScript)(input, task);
    let bytes = 0;
    for (const [rel, text] of Object.entries(files)) {
      const abs = path.join(input.cwd, ...rel.split('/'));
      if (text === null) {
        fs.rmSync(abs, { force: true });
        continue;
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text);
      bytes += Buffer.byteLength(text);
    }
    fs.mkdirSync(input.recordDir, { recursive: true });
    const envelopePath = `envelope-${input.turnId}.json`;
    fs.writeFileSync(path.join(input.recordDir, envelopePath), `${JSON.stringify({ stub: true, files: Object.keys(files).sort() }, null, 2)}\n`);
    return Promise.resolve(
      DomainResult.ok({
        status: 'completed',
        usage: { costUsd: 0, inputTokens: input.prompt.length, outputTokens: bytes, cacheReadTokens: 0, cacheCreationTokens: 0, numTurns: 1, durationMs: 0 },
        wallMs: 0,
        attempts: [{ startedAt: new Date(0).toISOString(), outcome: 'completed' }],
        interruptions: [],
        argv: ['stub', input.arm, input.turnId],
        envelopePath,
        permissionDenials: 0,
      }),
    );
  }
}

function readSources(dir: string): readonly { readonly rel: string; readonly text: string }[] {
  return sourceFilePaths(dir).map((rel) => ({ rel: `src/${rel}`, text: fs.readFileSync(path.join(dir, 'src', ...rel.split('/')), 'utf8') }));
}

export function stubEvaluator(): StepEvaluator {
  return {
    id: 'stub-evaluator',
    evaluate: (dir) => {
      const findings: BlockingFinding[] = [];
      let advisory = 0;
      for (const { rel, text } of readSources(dir)) {
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          if (rel.split('/').slice(0, -1).includes('domain') && /^import .* from '[^']*(?:infrastructure|adapters)\/[^']*'/.test(line)) {
            const target = /from '([^']*)'/.exec(line)?.[1];
            findings.push({
              ruleId: 'STUB-DEP',
              ruleName: 'domain must not depend on infrastructure (stub)',
              filePath: rel,
              line: i + 1,
              ...(target !== undefined ? { target } : {}),
              message: 'a domain file imports an infrastructure module',
            });
          }
          if (/\/\/\s*TODO/.test(line)) advisory++;
        });
      }
      const blocking = findings.length;
      const ahs = Math.max(0, Math.round((1 - 0.1 * blocking - 0.02 * advisory) * 1e6) / 1e6);
      return Promise.resolve(
        DomainResult.ok({
          scoringMode: 'v1.3',
          ahs,
          blockingAhs: Math.max(0, Math.round((1 - 0.1 * blocking) * 1e6) / 1e6),
          verdict: blocking > 0 ? 'fail' : 'pass',
          violationCount: blocking + advisory,
          blockingViolationCount: blocking,
          advisoryViolationCount: advisory,
          blockingByRule: blocking > 0 ? { 'STUB-DEP': blocking } : {},
          advisoryByRule: advisory > 0 ? { 'STUB-TODO': advisory } : {},
          blockingFindings: findings,
          durationMs: 0,
        }),
      );
    },
  };
}

export function stubTypechecker(): StepTypechecker {
  return {
    typecheck: (_runId, cwd) => {
      const codes = readSources(cwd).filter((s) => s.text.includes('@stub-type-error')).map(() => 'TS_STUB');
      return Promise.resolve(DomainResult.ok({ errors: codes.length, codes }));
    },
  };
}
