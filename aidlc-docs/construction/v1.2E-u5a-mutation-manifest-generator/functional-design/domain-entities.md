# U5a Mutation, Manifest and Generator — Domain Entities (v1.2E)

> **Unit**: U5a · **Date**: 2026-10-08 · **Base**: `v1.2e` @ `8c3d6df`
> **Revision R2 (2026-10-08)**: `PreparedBase.judgeSelection` per probed function and naming note (§2.1); `ExpectedKey.lineRule` (§2.3); `SiteCollateral` causes and keys (§2.3); `ImportGraph` (§2.4); `siteSelection` and `ApplyOptions` (§2.2, §3); `PreconditionReason` adds `cycle-cap`; `GenerationOutcome.promptTemplateSha256`, `HarnessTsconfig` (§5); codes (§6). Causes: `business-rules.md` §12.
> Shapes are TypeScript-style for precision; they replace the C15.1, C15.2 and C15.5 sketches in `v1.2E-component-methods.md:1554-1739` where they differ (design amendments, plan §7.3). All are immutable (`readonly`); construction goes through factory functions that validate and return `DomainResult`. Rules are `business-rules.md` (BR-U5a-nn).

---

## 1. Seeds and RNG

```typescript
// scripts/lib/mutation/rng.ts — no dependency (SECURITY-10)
export interface SeededRng {
  readonly seed: number;                       // uint32
  next(): number;                              // [0, 1), mulberry32
  pickDistinct<T>(items: readonly T[], n: number): readonly T[];   // partial Fisher–Yates, order = draw order
  pick<T>(items: readonly T[]): T;             // pickDistinct(items, 1)[0]
}
export function mulberry32(seed: number): SeededRng;

export interface SeedDerivation {
  readonly projectId: string;                  // no '|'
  readonly operatorId: string;                 // no '|'
  readonly k: number | 'select' | 'subsample';
}
// uint32BE(sha256(utf8(`${masterSeed}|${projectId}|${operatorId}|${k}`))[0..3])
export function deriveSeed(masterSeed: number, d: SeedDerivation): number;
```

| Entity | Invariants | Rules |
|---|---|---|
| `SeededRng` | Same seed → same sequence; `pickDistinct` never repeats an index; `n > items.length` returns all items | 15, 16 |
| `SeedDerivation` | Ids non-empty, no `\|`; `k` a non-negative integer or one of the two labels | 15, 37 |

## 2. Mutation

### 2.1 Inputs

```typescript
export interface PreparedBase {                // values produced by U5b corpus preparation (BR-U5b-76), or by U5a for fixtures and generated bases
  readonly projectId: string;
  readonly baseKind: 'fixture' | 'corpus' | 'generated';
  readonly dir: string;                        // prepared, read-only source of copies (BR-U5b-76 name)
  readonly baseCommit?: string;                // 40 hex; fixture | corpus
  readonly baseGenerationTreeSha?: string;     // 40 hex; generated
  readonly tsconfigPath: string;               // relative to dir
  readonly tscPath: string;                    // absolute, pinned
  readonly tscVersion: string;                 // measured
  readonly installLockSha256?: string;         // absent when nothing is installed
  readonly overlays: readonly { readonly path: string; readonly sha256: string }[];
  readonly specPath: string;                   // spec used to resolve `expected`
  readonly capped: boolean;                    // = judgeSelection.some(s => s.capped); false when judgeSelection is absent
  readonly judgeSelection?: readonly JudgeSelection[];   // one entry per neural function, from U4's BaselineSelection (BR-U5a-27)
}

export interface JudgeSelection {              // label-free projection of U4 BaselineSelection (U4 domain-entities §2.4)
  readonly template: 'intent-alignment' | 'architectural-integrity';
  readonly functionId: string;                 // spec id (FF-N02 / FF-N01 on clean-arch)
  readonly capped: boolean;                    // selectedUnitIds.length < candidateUnitIds.length
  readonly selectedFiles: readonly string[];   // POSIX paths of the files of selectedUnitIds, sorted, unique
}
```

**Naming (one shared contract).** U5b imports this type and fills it (BR-U5b-76, U5b domain-entities §8, reconciliation R-14); neither unit restates it with other names. `PreparedBase` carries **no tree hash**: the fetch tree hash is U5b's `FetchRecord.treeHash`; `baseTreeSha` is a manifest-row field computed by U5a over the prepared copy (sources + overlays + stubs, BR-U5a-33). The two hashes are never compared. The R2 change to U5b's restatement is `judgeSelection` per function and `capped` derived from it (`business-rules.md` §7).

### 2.2 Operator, site, application

```typescript
export type SiteKind =
  | 'import-edge' | 'package-import' | 'created-file' | 'class-members' | 'interface-members'
  | 'class-rename' | 'field-new' | 'field-assignment' | 'dynamic-import' | 'guard-move' | 'invariant-split';

export interface MutationSite {
  readonly filePath: string;                   // POSIX, relative to copy root
  readonly line: number;                       // 1-based, base coordinates
  readonly kind: SiteKind;
  readonly detail: Readonly<Record<string, string>>;   // e.g. { targetFile, symbol } ; keys sorted when serialised
}

export interface LocationRule {
  readonly template: string;                   // template name
  readonly filePath: 'site' | 'created' | 'site-target';
  readonly target?: 'site-target' | 'package';
  readonly discriminator?: readonly ('class' | 'interface' | 'controller' | 'entity' | 'field' | 'relType' | 'cycle')[];
  readonly line: 'site-line' | 'first-edge-line' | 'none';
}

export interface MutationOperator {
  readonly id: string;                         // 'MO-S01', twins 'MO-S01n', probes 'SP-…'
  readonly role: 'positive' | 'twin' | 'probe';
  readonly core: boolean;
  readonly twinOf?: string;
  readonly expectedTemplates: readonly LocationRule[];   // [] for twins and judge probes
  readonly operatorCollateral: readonly LocationRule[];  // keyed like expectedTemplates (BR-U5a-14)
  readonly coveredByTemplates: readonly string[];        // [] for outside-coverage
  readonly coverage: 'in' | 'outside';
  readonly judgeProbe?: 'semantic' | 'integrity';
  readonly expectedEdges?: readonly { readonly type: 'FLOWS_TO'; readonly via: 'new' | 'field-assignment' }[];
  readonly source: string;                     // published source citation
  findSites(project: ProjectHandle, spec: ParsedSpec): readonly MutationSite[];
  checkPreconditions(project: ProjectHandle, spec: ParsedSpec, site: MutationSite, ctx: PreconditionContext): PreconditionResult;
  apply(project: ProjectHandle, site: MutationSite, rng: SeededRng): DomainResult<MutationEdit>;
}

export type PreconditionReason =
  | 'style-disabled' | 'edge-exists' | 'metric-already-violating' | 'threshold-arithmetic'
  | 'controller-or-entity' | 'entity-import' | 'not-removable-guard' | 'implementer-over-threshold'
  | 'judge-unit-not-selected' | 'type-shape' | 'already-imported' | 'cycle-cap';
export type PreconditionResult = { readonly ok: true } | { readonly ok: false; readonly reason: PreconditionReason };

export interface MutationEdit {
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly lineShifts: readonly LineShift[];
  readonly newEdges: readonly { readonly source: string; readonly target: string }[];  // planned File→File edges; used by the cycle-cap precondition; must equal edges(G') − edges(G) (test)
}
export interface LineShift { readonly filePath: string; readonly afterLine: number; readonly delta: number }

export interface ApplyOptions {
  readonly siteOverride?: { readonly filePath: string; readonly line?: number; readonly detail: Readonly<Record<string, string>> };  // BR-U5a-55, fixtures and dev only
  readonly k?: number;                         // application index for a forced site (default 0)
}

export interface MutationApplication {
  readonly operatorId: string;
  readonly site: MutationSite;
  readonly siteSelection: 'sampled' | 'forced';   // BR-U5a-55
  readonly siteIndex: number;                  // position in the stable site list
  readonly edit: MutationEdit;
  readonly expected: ExpectedBlock;
  readonly provisionedStubs: readonly ProvisionedStub[];
  readonly typecheck: TypecheckEvidence;
}
export function applyMutation(base: PreparedBase, operatorId: string, manifestPath: string, scratchRoot: string, opts?: ApplyOptions): Promise<DomainResult<{ readonly rows: number; readonly rejections: number }>>;
export interface ProvisionedStub { readonly specifier: string; readonly path: string }
export interface TypecheckEvidence {
  readonly tscPath: string; readonly tscVersion: string; readonly baseErrors: 0; readonly mutantErrors: 0;
}
```

### 2.3 Expected block and collateral

```typescript
export interface ExpectedKey {                 // U5b scorer key (functionId, filePath, target, discriminator); U3 encoding (U3 domain-entities §1)
  readonly functionId: string;
  readonly filePath: string;                   // file path; '<project>' for project-level rows; String(cycle) for Cypher cycle rows
  readonly target: string;                     // '' when absent; cycle rows: cycle[1]
  readonly discriminator: readonly string[];   // T-MAP disc values as strings; cycle rows: [JSON.stringify(cycle)]; SCC rows: ['scc']
  readonly lineRule: 'site-line' | 'first-edge-line' | 'none';   // required; read by U5b BR-U5b-04 for lineConfirmed
  readonly line?: number;                      // mutant coordinates; present ⇔ lineRule ≠ 'none'; confirmatory only (U5bP Q2)
}

export interface SiteCollateral {
  readonly kind: 'operator' | 'site';
  readonly template: string;
  readonly functionId: string;                 // resolved from the spec; templates the spec does not declare give no entry
  readonly cause: 'declared' | 'cycle' | 'metric-crossing' | 'created-without-test' | 'project-metric';
  readonly key?: ExpectedKey;                  // required except cause = 'project-metric' (keyless, '<project>' row only, BR-U5b-08)
  readonly metric?: { readonly base: number | null; readonly mutant: number; readonly threshold: number };   // metric-crossing only; null = file absent or excluded in G
}

export type ExpectedBlock = PositiveExpected | NegativeExpected;

export interface PositiveExpected {
  readonly negative?: undefined;
  readonly functionIds: readonly string[];     // [] for judge probes
  readonly disabledFunctionIds: readonly { readonly functionId: string; readonly reason: string }[];
  readonly absentTemplates: readonly string[];
  readonly dimension: Dimension;               // symbolic member; judge probes: 'semantic' | 'integrity'
  readonly keys: readonly ExpectedKey[];
  readonly collateral: readonly SiteCollateral[];
  readonly coverage: 'in' | 'outside';
  readonly judgeProbe?: 'semantic' | 'integrity';
  readonly expectedEdges?: readonly { readonly type: 'FLOWS_TO'; readonly source: string; readonly target: string; readonly via: 'new' | 'field-assignment' }[];
}

export interface NegativeExpected {
  readonly negative: true;
  readonly twinOf: string;
  readonly functionIds: readonly [];
  readonly keys: readonly [];
  readonly collateral: readonly SiteCollateral[];
  readonly coverage: 'in' | 'outside';
  readonly expectedEdges?: PositiveExpected['expectedEdges'];   // MO-DF01n
}
```

| Entity | Invariants | Rules |
|---|---|---|
| `PreparedBase` | `capped = judgeSelection?.some(s => s.capped) ?? false`; `judgeSelection` templates unique; `baseKind = 'generated'` ⇔ `baseGenerationTreeSha` present ∧ `baseCommit` absent | 02, 27, 32 |
| `MutationSite` | Path relative POSIX, inside a layer of the spec (or a created path inside one); `line ≥ 1` | 11, 12 |
| `MutationEdit` | `editedFiles ∩ createdFiles = ∅`; every `lineShifts[].filePath ∈ editedFiles`; `delta ≠ 0` | 18 |
| `PositiveExpected` | `judgeProbe` ⇒ `functionIds = []` ∧ `coverage = 'outside'`; no `judgeProbe` ∧ `coverage = 'outside'` ⇒ `functionIds ≠ []`; `dimension ≠ 'data-flow'` (not an enum member) | 19–21, 26 |
| `NegativeExpected` | `twinOf` names a registered positive | 22 |
| `SiteCollateral` | `cause ≠ 'project-metric'` ⇒ `key` present; `kind = 'operator'` ⇔ `cause = 'declared'`; `cause = 'metric-crossing'` ⇒ `metric` present ∧ `key.discriminator = []` ∧ `key.lineRule = 'none'`; `cause = 'cycle'` ⇒ `key.lineRule = 'first-edge-line'` | 14 |
| `ExpectedKey` | `line` present ⇔ `lineRule ≠ 'none'`; cycle keys: `filePath = String(JSON.parse(discriminator[0]))`, `target = JSON.parse(discriminator[0])[1]` | 14, 20 |

### 2.4 Import graph (BR-U5a-56)

```typescript
export interface ImportGraphFile { readonly filePath: string; readonly layer: string | null; readonly isBarrel: boolean }
export interface ImportGraphEdge { readonly source: string; readonly target: string; readonly type: 'IMPORTS' | 'RE_EXPORTS' }
export interface ImportGraph {
  readonly files: ReadonlyMap<string, ImportGraphFile>;
  readonly edges: readonly ImportGraphEdge[];  // unique per (source, target, type), sorted
}
export function buildImportGraph(project: ProjectHandle, spec: ParsedSpec): ImportGraph;
export function newSimpleCycles(base: ImportGraph, mutant: ImportGraph, maxLength: 10): readonly (readonly string[])[];  // canonical, closed
export function metricViolations(g: ImportGraph, template: MetricTemplate, threshold: number | undefined, domainLayer: string | null): ReadonlyMap<string, number>;  // file → value
export type MetricTemplate = 'domain-stability' | 'module-fan-out' | 'component-instability' | 'no-orphan-files' | 'max-fan-in';
```

## 3. Manifest

```typescript
export interface Manifest {
  readonly schemaVersion: '1';
  readonly catalogueVersion: string;           // sha256 hex of Docs/operator-catalogue.md
  readonly masterSeed: number;
  readonly rows: readonly ManifestRow[];
  readonly rejections: readonly ManifestRejection[];
}

export interface ManifestRow {
  readonly seedId: string;                     // `${projectId}:${operatorId}:${k}`
  readonly projectId: string;
  readonly baseKind: 'fixture' | 'corpus' | 'generated';
  readonly baseCommit?: string;                // required for fixture | corpus
  readonly baseGenerationTreeSha?: string;     // required for generated
  readonly baseTreeSha: string;                // 40 hex
  readonly installLockSha256?: string;         // 64 hex
  readonly specPath: string;
  readonly specSha256: string;                 // 64 hex
  readonly split: 'dev' | 'held-out' | 'probe';
  readonly operatorId: string;
  readonly catalogueVersion: string;
  readonly rngSeed: number;                    // uint32
  readonly seedDerivation: { readonly projectId: string; readonly operatorId: string; readonly k: number };
  readonly siteIndex: number;
  readonly siteSelection: 'sampled' | 'forced';   // forced ⇒ split ≠ 'held-out' (schema)
  readonly site: MutationSite;
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly lineShifts: readonly LineShift[];
  readonly expected: ExpectedBlock;
  readonly provisionedStubs: readonly ProvisionedStub[];
  readonly typecheck: TypecheckEvidence;
  readonly appliedAt: string;                  // ISO 8601 date-time
}

export interface ManifestRejection {
  readonly operatorId: string;
  readonly projectId: string;
  readonly reason: 'no-site' | 'precondition' | 'typecheck' | 'apply-error';
  readonly detail: string;                     // scrubbed
  readonly rngSeed?: number;
  readonly seedDerivation?: { readonly projectId: string; readonly operatorId: string; readonly k: number };
  readonly appliedAt: string;
}

export function validateManifest(json: unknown): { valid: boolean; errors: readonly { path: string; message: string }[] };
export function appendManifestRow(manifestPath: string, row: ManifestRow): DomainResult<void>;
export function appendRejection(manifestPath: string, rej: ManifestRejection): DomainResult<void>;
export function acquireManifestLock(manifestPath: string): DomainResult<{ release(): void }>;
export function countGoldenInstances(m: Manifest): number;   // BR-U5a-01
```

### 3.1 Schema delta against the U0 draft (`schemas/manifest.schema.json`)

| Field | U0 draft | Frozen (U5a) |
|---|---|---|
| `$comment` | `DRAFT (U0). U5a completes…` | `FROZEN (U5a). …` |
| top level | `schemaVersion`, `rows` | + `catalogueVersion`, `masterSeed`, `rejections` (all required) |
| `baseCommit` | required | conditional on `baseKind` (`if`/`then`), forbidden for `generated` |
| `baseKind`, `baseGenerationTreeSha`, `baseTreeSha`, `installLockSha256`, `specPath`, `specSha256`, `split`, `seedDerivation`, `siteIndex`, `editedFiles`, `createdFiles`, `provisionedStubs`, `typecheck` | — | added (required except `installLockSha256`, `baseGenerationTreeSha`) |
| `site` | open object | closed: `filePath`, `line`, `kind` (enum), `detail` (string map) |
| `expected` | open object | `oneOf` positive / negative, closed, invariants of §2.3 via `if`/`then` |
| `lineShifts[]` | open items | closed, all three fields required, `delta` ≠ 0 (`not: { const: 0 }`) |
| `split`/`baseKind` pairing | — | `allOf` of BR-U5a-02 combinations |
| `siteSelection` | — | required enum; `forced` with `split: 'held-out'` fails (BR-U5a-55) |
| `expected.keys[]`, `collateral[].key` | — | closed `ExpectedKey`; `lineRule` required; `line` iff `lineRule ≠ 'none'` |
| `expected.collateral[]` | — | closed; `cause` enum; `key` required unless `cause: 'project-metric'`; `metric` iff `cause: 'metric-crossing'` |

## 4. Catalogue

```typescript
export interface OperatorCatalogueEntry {
  readonly id: string;
  readonly core: boolean;
  readonly dimension: Dimension;
  readonly tags: readonly string[];            // e.g. 'checks: data-flow (FR-21)', 'layered only'
  readonly defect: string;
  readonly expectedTemplates: readonly string[];
  readonly coverage: 'in' | 'outside';
  readonly siteKinds: readonly SiteKind[];
  readonly preconditions: readonly PreconditionReason[];
  readonly operatorCollateral: readonly string[];
  readonly twin: string;                       // twin id
  readonly source: string;
}

export interface ProbeEntry {                  // SP-* section, own hash
  readonly id: string;                         // 'SP-<functionId>' or 'SP-DF01-ci'
  readonly targetFunctionId: string;
  readonly fixture: string;                    // fixture base
  readonly edit: string;                       // described edit, implemented as a probe operator
  readonly passCriterion: string;              // "returns a new row with key <…>"
}

export interface SiteFeasibilityRow {
  readonly projectId: string;
  readonly split: 'dev' | 'held-out';
  readonly operatorId: string;
  readonly candidates: number;
  readonly rejectedByReason: Readonly<Partial<Record<PreconditionReason, number>>>;
  readonly eligible: number;
  readonly takenAtK2: number;                  // min(2, eligible)
  readonly takenAtK3: number;                  // min(3, eligible)
}

export class OperatorRegistry {
  constructor(catalogueVersion: string);
  register(op: MutationOperator): DomainResult<void>;   // CAT_FROZEN after freeze()
  get(id: string): MutationOperator | undefined;
  list(): readonly MutationOperator[];          // by id
  freeze(): void;
  readonly catalogueVersion: string;
}
```

## 5. Generator

```typescript
export type SpecLevel = 'none' | 'minimal-prose' | 'full-aac';

export interface GeneratorCliConfig {          // scripts/lib/generators/ (not C10's ClaudeCliConfig)
  readonly binary: string;                     // absolute path of the claude CLI
  readonly modelId: string;                    // pinned full id, from the plan file
  readonly timeoutMs: number;                  // default 1_200_000
  readonly outputRoot: string;                 // outside the repository
  readonly harnessRoot: string;                // <H>, outside every cwd
  readonly allowBash: boolean;                 // false after a failed confinement probe (BR-U5a-43)
}

export interface GenerationRequest {
  readonly runId: string;                      // `${modelId}/${taskId}/${specLevel}/run-${runIndex}`
  readonly promptTemplateId: string;
  readonly taskId: 'task-management' | 'order-fulfilment';
  readonly modelId: string;
  readonly style: string;                      // 'clean-architecture'
  readonly specLevel: SpecLevel;
  readonly runIndex: number;                   // 0..runs-1
  readonly outputDir: string;
  readonly fileRange: { readonly min: 20; readonly max: 100 };
  readonly orderSeed: number;
  readonly pilot: boolean;
}

export interface GenerationCell {
  readonly modelId: string; readonly taskId: GenerationRequest['taskId'];
  readonly specLevel: SpecLevel; readonly runIndex: number;
  readonly blockIndex: number;                 // = runIndex
  readonly positionInBlock: number;
}

export interface GridPlan {
  readonly adapters: readonly { readonly adapterId: 'claude-code-cli'; readonly modelId: string }[];
  readonly tasks: readonly GenerationRequest['taskId'][];
  readonly style: string;
  readonly levels: readonly SpecLevel[];
  readonly runs: number;
  readonly outRoot: string;
  readonly orderSeed: number;
}

export interface CliEnvelopeSummary {          // every field optional: tolerant reader
  readonly isError?: boolean; readonly subtype?: string; readonly numTurns?: number;
  readonly permissionDenials?: readonly unknown[]; readonly totalCostUsd?: number;
  readonly durationMs?: number; readonly sessionId?: string;
  readonly modelUsage?: Readonly<Record<string, { readonly outputTokens?: number }>>;
}

export type ModelUsageVerdict =
  | { readonly valid: true; readonly resolvedModelId: string; readonly auxiliaryModels: readonly { id: string; outputTokens: number }[] }
  | { readonly valid: false; readonly reason: 'pinned-absent' | 'pinned-not-dominant' | 'no-model-usage';
      readonly auxiliaryModels: readonly { id: string; outputTokens: number }[] };

export interface GenerationOutcome {
  readonly status: 'ok' | 'failed-typecheck' | 'failed-agent';
  readonly failureReason?: 'typecheck' | 'agent-error' | 'model-mismatch' | 'skeleton-tampered'
    | 'infrastructure' | 'envelope-unreadable' | 'timeout';
  readonly adapterId: string;
  readonly taskId: GenerationRequest['taskId'];
  readonly specLevel: SpecLevel;
  readonly runIndex: number;
  readonly orderSeed: number;
  readonly requestedModelId: string;
  readonly resolvedModelId?: string;
  readonly auxiliaryModels: readonly { id: string; outputTokens: number }[];
  readonly promptTemplateId: string;
  readonly promptTemplateSha256: string;       // frozen in Docs/generator-protocol.md (BR-U5a-52)
  readonly promptSha256: string;               // sha256 of the instantiated prompt (template + {{TYPECHECK_COMMAND}})
  readonly prompt: string;                     // instantiated, scrubbed
  readonly skeletonIntact: boolean;
  readonly fileCount: number;
  readonly fileCountInRange: boolean;
  readonly permissionDenials: number;
  readonly typecheck: { readonly tscVersion: string; readonly errors: number } | null;
  readonly attempts: readonly { readonly startedAt: string; readonly outcome: string }[];
  readonly interruptions: readonly { readonly at: string; readonly subtype: string; readonly movedTo: string }[];
  readonly treeSha: string | null;
  readonly durationMs: number;
  readonly pilot: boolean;
  readonly envelopePath: string;               // scrubbed full envelope beside generation.json
}

export interface GeneratorAdapter {
  readonly id: string;
  readonly modelId: string;
  isAvailable(): Promise<boolean>;
  generate(req: GenerationRequest): Promise<DomainResult<GenerationOutcome>>;
}
export function buildGeneratorArgs(config: GeneratorCliConfig, req: GenerationRequest, prompt: string): readonly string[];
export function readEnvelope(stdout: string): DomainResult<CliEnvelopeSummary>;
export function judgeModelUsage(pinned: string, env: CliEnvelopeSummary): ModelUsageVerdict;
export async function runGenerationGrid(plan: GridPlan, adapters: readonly GeneratorAdapter[]): Promise<readonly GenerationOutcome[]>;
export const GENERATOR_ENV_ALLOW: readonly string[];

export interface HarnessTsconfig {             // written to <H>/runs/<runId>/tsconfig.json; pinned content (BR-U5a-42)
  readonly compilerOptions: {
    readonly strict: true; readonly target: 'ES2022'; readonly lib: readonly ['ES2022'];
    readonly module: 'commonjs'; readonly moduleResolution: 'node'; readonly esModuleInterop: true;
    readonly skipLibCheck: true; readonly forceConsistentCasingInFileNames: true;
    readonly noEmit: true; readonly incremental: false;
    readonly typeRoots: readonly [string];     // [`${cwd}/node_modules/@types`], absolute
    readonly types: readonly ['node'];
  };
  readonly include: readonly [string];         // [`${cwd}/src/**/*.ts`], absolute
}
export function buildHarnessTsconfig(cwd: string): HarnessTsconfig;
export function instantiatePrompt(template: string, typecheckCommand: string): DomainResult<string>;   // exactly one {{TYPECHECK_COMMAND}}
```

`requestedModelId` is the field U5b reads (U5b domain-entities §1); there is no `modelId` on `GenerationOutcome`.

| Entity | Invariants | Rules |
|---|---|---|
| `GeneratorCliConfig` | `harnessRoot` and `outputRoot` absolute, outside the repo; `harnessRoot` not inside `outputRoot` | 42 |
| `GridPlan` | `runs ≥ 1`; model ids unique; `outRoot` outside the repo | 51 |
| `GenerationOutcome` | `status = 'ok'` ⇔ `failureReason` absent; `failed-typecheck` ⇒ `typecheck.errors > 0`; `fileCountInRange` = `20 ≤ fileCount ≤ 100` | 48 |
| `ModelUsageVerdict` | `valid` ⇒ `resolvedModelId = pinned` | 47 |

## 6. Codes

| Code | Raised by | Meaning |
|---|---|---|
| `MUT_BASE_NOT_CLEAN` | base type-check | prepared base has errors (BR-U5a-07) |
| `MUT_COPY_ALREADY_SEEDED` | `applyMutation` | copy already holds a seed (BR-U5a-03) |
| `MUT_UNKNOWN_OPERATOR` | `applyMutation` | id not in the frozen registry |
| `MAN_INVALID` | manifest load or append | ajv errors attached (BR-U5a-35) |
| `MAN_LOCKED` | `acquireManifestLock` | another writer holds the lock (BR-U5a-35) |
| `CAT_FROZEN` | `OperatorRegistry.register` | registry already frozen (BR-U5a-39) |
| `CAT_SHORTFALL` | feasibility rule | k = 3 does not reach 80 (BR-U5a-37) |
| `GEN_CWD_INSIDE_REPO`, `GEN_HARNESS_INSIDE_CWD` | generator config | confinement precondition (BR-U5a-42) |
| `MUT_SITE_OVERRIDE_INVALID` | `applyMutation` | forced site not in the eligible list (BR-U5a-55) |
| `GEN_PROMPT_TEMPLATE_INVALID` | `instantiatePrompt` | template lacks exactly one `{{TYPECHECK_COMMAND}}` (BR-U5a-52) |

Code names follow the C10 `DomainResult` error-code style at Code Generation; the meanings are binding.
