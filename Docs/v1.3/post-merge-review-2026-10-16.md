# Post-merge review of v1.3 at b08ec387 (2026-10-16)

A multi-agent read-only review (workflow v13-post-merge-review) used six lenses: interpreter, MCP and loop, construct switches, judge, extraction, and measurement.
Each finding was challenged by an independent skeptic told to refute it. 36 findings, 31 confirmed. The severity shown is the verifier's.

Counts: blocking 1, major 9, minor 21.

## R01 [blocking] (mcp) Loop evaluator runs evaluate_project without the pinned tsconfig: the work tree has none, so every snapshot fails TSCONFIG_NOT_FOUND (or is scored on a file set the agent chose), and the gate arm never repairs

- **Location:** `scripts/lib/loop/evaluator.ts:69`
- **Scenario:** Live loop run, any arm. prepareCellDir copies only package.json and the node_modules symlink into work/. The harness tsconfig is written outside cwd, at <H>/runs/<runId>/tsconfig.json. firewallEvaluator calls evaluateProject({projectPath: workDir, specPath, scoringMode}), and that call never sets PipelineConfig.tsconfigPath. The extractor then looks for <work>/tsconfig.json. Case 1, the agent writes no tsconfig: extraction fails with TSCONFIG_NOT_FOUND, measure() records evaluation=null with an evaluationError, and in the gate arm `ev === null` means repair {attempted:false}. The gate arm silently turns into the none arm, and no blocking count or AHS is recorded. Case 2, the agent writes a tsconfig whose include/exclude leaves out src/domain/**: the evaluation runs on a reduced graph and reports fewer blocking violations. That count is what the gate shows the agent and what the study records. The ISE freezer, by contrast, uses its own src/**/*.ts tsconfig, so the spec and the graph come from different file sets.
- **Evidence:** evaluator.ts:69 `evaluateProject({ projectPath: projectDir, specPath, scoringMode: 'v1.3' }, env, deps)`; evaluate-project.ts:142-155 builds a PipelineConfig with no tsconfigPath (pipeline-factory.ts:150 passes config.tsconfigPath to ExtractCommand, and apg-extractor.ts:38 falls back to join(projectPath,'tsconfig.json')); skeleton.ts:209-216 prepareCellDir copies only package.json and the symlink; specs.ts:185 says 'the loop work tree has none; the harness keeps its tsconfig outside the cwd'; E1 passes --tsconfig (run-experiment.ts:451, ADR-032), but the loop does not; loop.ts:356 skips repair when evaluation is null.
- **Suggested fix:** Add an optional tsconfigPath to EvaluateInput and pass it through to PipelineConfig. In firewallEvaluator, write the pinned harness tsconfig (or ISE_SNAPSHOT_TSCONFIG) and pass its path, so a work-tree tsconfig is ignored. Treat an evaluation failure in the gate arm as a harness failure, not as 'no blocking findings'.
- **Verifier:** I tried to refute this and could not. Every link in the chain is in the code at b08ec387.

1. evaluator.ts:69 calls `evaluateProject({ projectPath: projectDir, specPath, scoringMode: 'v1.3' }, env, deps)`. It passes no tsconfig.
2. evaluate-project.ts:142-155 builds the PipelineConfig with no `tsconfigPath`. pipeline-factory.ts:150 hands `config.tsconfigPath` (undefined) to ExtractCommand. apg-extractor.ts:36-38 then falls back to `join(projectPath,'tsconfig.json')` and returns TSCONFIG_NOT_FOUND if that file is missing.
3. The default wiring adds no tsconfig either. main.ts:92-94 uses `buildContext({}, process.env).evaluateDeps`, and context.ts:61 sets `makePipeline: createPipeline` with no wrapper.
4. The work tree has no tsconfig.json. loop.ts:295 evaluates `this.workDir`. prepareCellDir (skeleton.ts:209-216) puts only package.json and the node_modules symlink there. writeHarnessTsconfig writes to `<H>/runs/<runId>/tsconfig.json`, outside the cwd. specs.ts:185 says the same thing in a comment: "the loop work tree has none".
5. The agent has no reason to write one. Every step prompt (prompts.ts:33-91) tells it to type-check with `tsc -p <H>/runs/.../tsconfig.json`, and the loop.test.ts:81 expectation confirms that command.

Result: on a live run, extraction fails on every snapshot, evaluateProject returns PIPELINE_FAILED, and measure() records `evaluation: null` with an evaluationError (loop.ts:296-307). In the gate arm, loop.ts:356 (`ev === null || ...`) skips repair, so t

## R02 [major] (extract) `--scoring v1.2e` (CLI and MCP) computes the frozen universal metrics on a v1.3 'both' graph, so fan-out, fan-in and instability are inflated

- **Location:** `src/scoring-engine/scoring-engine.ts:66`
- **Scenario:** Run `firewall evaluate --scoring v1.2e` (or evaluate_project with scoring 'v1.2e') on a project where `src/app/a.ts` has `import { X, Y } from '../domain'` and `domain/index.ts` re-exports `x.ts` and `y.ts`. ExtractCommand always extracts with the v1.3 defaults (reExportEdges: 'both'), so a.ts gets three IMPORTS edges: a->index (reExportHop), a->x (viaReExport) and a->y (viaReExport). For any scoringMode other than 'v1.3', computeUniversalMetrics runs the 'frozen' query set. Its `MATCH (f:File)-[:IMPORTS]->(dep:File) ... count(dep)` counts all three, giving fan-out 3 where the registered v1.2E (resolved-only) graph gave 2. maxFanIn and averageInstability shift the same way, and the cycle query runs over the merged views. The mode documented as 'the registered Study 1 scoring' therefore reports universal metrics that the frozen instrument never produced. The comment that the edge views are 'a no-op on a v1.2E graph' does not apply, because evaluate never builds a v1.2E graph.
- **Evidence:** scoring-engine.ts:65-67 `computeUniversalMetrics(..., input.scoringMode === 'v1.3' ? 'literal' : 'frozen')`; pipeline-factory.ts:304 passes scoringMode only when it is 'v1.3'; universal-metrics.ts:53-60 frozen queries have no viaReExport/reExportHop predicate; extract-command.ts:22-25 extractAPG(projectPath, { excludePatterns, graphMode? }), so the defaults are V13 (types.ts:222); cli.ts:190 and mcp-server/server.ts:108 describe v1.2e as 'the registered Study 1 scoring'.
- **Suggested fix:** In v1.2e mode, either run the resolved view (exclude `reExportHop` edges) instead of the raw frozen queries, or extract with V12E_DEFAULT_OPTIONS when scoringMode is 'v1.2e'. Make the option docs say which graph each mode measures.
- **Verifier:** I tried to refute this and could not. The defect is confirmed by reading the code.

1. The graph is always v1.3. `ExtractCommand.execute` (src/pipeline/commands/extract-command.ts:22-25) calls `extractAPG` with only `excludePatterns` and `graphMode`, so `reExportEdges` takes `DEFAULT_OPTIONS`, which is `V13_DEFAULT_OPTIONS` with `'both'` (src/apg-extractor/types.ts:198 and the last line of the options block). Outside tests, `V12E_DEFAULT_OPTIONS` is only defined and re-exported. No evaluate path uses it, and the scoring mode never reaches extraction (pipeline-factory.ts:150).

2. Edges in 'both' mode. In src/apg-extractor/import-resolver.ts:523-537, `import {X,Y} from '../domain'` through a barrel produces two kinds of edge. One is a literal occurrence to index.ts, marked `reExportHop` when every name hops. The other is one resolved occurrence per target, marked `viaReExport: true`. So a.ts ends up with IMPORTS edges to index.ts, x.ts and y.ts.

3. The frozen queries count both views. scoring-engine.ts:65-67 chooses 'frozen' whenever `scoringMode !== 'v1.3'`. pipeline-factory.ts:304 forwards `scoringMode` only when it is 'v1.3', so `--scoring v1.2e` (CLI) or `scoring: 'v1.2e'` (MCP) runs the frozen set. Those queries have no `viaReExport` or `reExportHop` predicate (universal-metrics.ts:53-66): `maxFanOut` counts every IMPORTS edge (3 in the example, versus 2 on the resolved-only v1.2E graph), and `maxFanIn` and `averageInstability` shift the same way.

4. The project's own d

## R03 [major] (extract) MCP check_file/check_diff treat require()/import() as advisory and leave them out of the cycle graph, but the v1.3 evaluate graph scores them as IMPORTS edges

- **Location:** `src/mcp-server/file-check.ts:360`
- **Scenario:** Take a domain file containing `const db = await import('../infrastructure/db')`, or `require('../infrastructure/db')`. MCP check_file puts the dependency-direction hit in `advisories`, does not count it toward the verdict, and adds the note 'not scored by the firewall'. `firewall evaluate` and MCP evaluate_project extract with DEFAULT_OPTIONS = V13_DEFAULT_OPTIONS (dynamicImports: true). That turns the call into an IMPORTS edge. The literal-view templates do not filter it out (no template reads the `dynamic` property), so FF-S01 dependency-direction fires. The same mismatch applies to cycles: `importGraph()` skips require/dynamic, so a cycle closed by an `import()` passes check_file/check_diff but fails no-cyclic-deps in evaluate. An agent told 'pass' by the MCP fast path then gets a blocking finding from evaluate.
- **Evidence:** file-check.ts:360 `(imp.kind === 'require' || imp.kind === 'dynamic' ? baseAdvisories : base).push(row)`; file-check.ts:395 note 'advisories are require()/import() calls: not scored by the firewall'; mcp-server/types.ts:254-255 'The frozen firewall counts these calls but does not model them as edges (BR-U2-25), so they never lower the score'; project-files.ts:161-167 importGraph `if (imp.kind === 'require' || imp.kind === 'dynamic') continue;` with the comment 'the extractor does not model them'. Against: apg-extractor/types.ts:194-196 V13_DEFAULT_OPTIONS dynamicImports: true, types.ts:222 DEFAULT_OPTIONS = V13_DEFAULT_OPTIONS, edge-extractor.ts:105-108 adds the dynamic occurrences to the merger, extract-command.ts:22 passes no dynamicImports flag. A grep for 'dynamic' in src/fitness-compiler finds no filter. (The option itself is unit-tested: tests/unit/apg-extractor/v13-dynamic-imports.test.ts:36-58 checks that the default gives the edge.)
- **Suggested fix:** Make the MCP fast path match the v1.3 extractor: treat require/dynamic string-literal imports as scored imports in check_file/check_diff and include them in importGraph(). Alternatively, gate this on the same dynamicImports flag the pipeline uses. Update the stale comments in types.ts:254 and project-files.ts:161.
- **Verifier:** I could not refute the claim. The code paths below were read at b08ec387.

**What MCP does with require()/import()**
- file-check.ts:360 moves rule hits from require() and import() calls into `baseAdvisories`. These never reach `base` or `violations`, so they cannot affect the verdict.
- file-check.ts:395 adds the note that these calls are "not scored by the firewall".
- types.ts:254-255 says the firewall does not model these calls as edges (BR-U2-25).
- project-files.ts:170 `importGraph()` skips require and dynamic imports. So does fast-rules.ts:74, 83 and 131.

**What evaluate does with them**
- apg-extractor.ts:29 and edge-extractor.ts:55 merge in `DEFAULT_OPTIONS`.
- types.ts:222 sets `DEFAULT_OPTIONS = V13_DEFAULT_OPTIONS`, which has `dynamicImports: true`.
- ExtractCommand (pipeline-factory.ts:150, extract-command.ts:22) passes no `dynamicImports` override.
- edge-extractor.ts:105-108 adds `resolveDynamicImportTargets` occurrences as IMPORTS edges.
- findDynamicImportCalls (import-resolver.ts:677-678) matches both `ImportKeyword` and `require`.
- The dependency-direction template (cypher-templates.ts:75) and no-cyclic-deps (cypher-templates.ts:99) match `IMPORTS|RE_EXPORTS` and never look at `i.dynamic`. A grep for "dynamic" across src/fitness-compiler finds no filter.
- The unit test v13-dynamic-imports.test.ts:36-46 confirms the default gives a domain-to-infrastructure IMPORTS edge with `dynamic=true`.

**Failure scenario**
A domain file contains `await import('../inf

## R04 [major] (judge) Every judge v2 report is rejected by the frozen report schema, so a v2 evaluate writes no report

- **Location:** `src/llm-critic/judge-stage.ts:182`
- **Scenario:** `firewall evaluate --judge-version v2` in full or neuronal-only mode. finishJudgeStage sets holder.judge = {...provenance, judgeVersion: 'v2', judgeRevision: 'v2.1'}. AssembleReportCommand copies this into report.judge, and validateReport (Ajv strict) checks it against definitions/judgeProvenance, which has additionalProperties:false and does not list judgeVersion or judgeRevision. The result is REPORT_SCHEMA_INVALID ('/judge: must NOT have additional properties (judgeVersion)'), so no report is written. The obvious local fix (dropping the field so the report validates) would make a v2 report look exactly like a v1 report.
- **Evidence:** judge-stage.ts:182 adds the fields. src/scoring-engine/report-schema.ts:250-251 has "judge": {$ref judgeProvenance}, and lines 1297-1299 have judgeProvenance with additionalProperties:false. Its properties (1305-1362) are provider, model, effort, cliVersion, cassetteMode, runsPerUnit, resolvedModel, repetition, isolationProbeSha256, configListingSha256, provenanceMixed and seededList, with no judgeVersion or judgeRevision. assemble-report-command.ts:83 validates fail-closed. No test covers a v2 report: only tests/unit/llm-critic/judge-v2.test.ts mentions judgeVersion, and it never assembles a report.
- **Suggested fix:** Add optional judgeVersion (enum ['v2']) and judgeRevision (string) to judgeProvenance as a dated schema amendment, and add a pipeline test that assembles and validates a v2 report. Do not strip the fields.
- **Verifier:** I tried to refute this and could not. Every link in the chain holds with the code as written.

1. **v2 adds the fields.** src/llm-critic/judge-stage.ts:182 sets holder.judge to {...provenance, judgeVersion: 'v2', judgeRevision: JUDGE_V2_REVISION} whenever run.judgeVersion === 'v2'. That value is reachable from the CLI: src/cli/llm-options.ts:166-188 parses --judge-version and passes judgeVersion through when it is not v1.

2. **The fields reach the report unchanged.**
   - src/pipeline/pipeline-factory.ts:227 exposes `get judge() { return judgeHolder.judge ?? NO_JUDGE }`.
   - src/pipeline/commands/assemble-report-command.ts:72 passes it as judge.
   - src/scoring-engine/report-builder.ts:306 copies facts.judge straight into report.judge.
   - The only change before validation is scrubDeepWithPolicy, a secret scrubber that does not remove keys.

3. **Validation is fail-closed and nothing strips the extra keys.** assemble-report-command.ts:83-84 calls validateReport and returns a failure if it does not pass. src/scoring-engine/report-schema-validator.ts:32 builds Ajv with { strict: true, allErrors: true, allowUnionTypes: true, strictRequired: false }. There is no removeAdditional option, so extra properties are rejected, not dropped.

4. **The schema has no slot for them.** src/scoring-engine/report-schema.ts:250-251 points report.judge at #/definitions/judgeProvenance. That definition (around lines 1297-1362) sets additionalProperties: false and lists only provider, model, ef

## R05 [major] (mcp) Absolute paths outside the literal project root (macOS /tmp -> /private/tmp, or no --project) are silently remapped to a no-layer path, so check_file/check_import/which_layer report PASS

- **Location:** `src/mcp-server/tools.ts:97`
- **Scenario:** Server started with --project /tmp/out/runs/r1/work, where /tmp is a symlink to /private/tmp on macOS. The agent calls check_file with path='/private/tmp/out/runs/r1/work/src/domain/Order.ts' (its realpath cwd) and content importing 'typeorm'. path.relative gives '../../../../../private/tmp/out/runs/r1/work/src/domain/Order.ts'. normalisePath drops the leading '..' segments because parts is empty, giving 'private/tmp/.../src/domain/Order.ts'. No layer glob matches, so file-check.ts:347 skips every import rule, and blockingVerdict is 'pass' ('PASS: no blocking violation'). evaluate_project flags FF-P01 on the same file. The same happens when no --project is set: '/Users/<x>/proj/src/domain/a.ts' becomes 'Users/x/proj/src/domain/a.ts', which also has no layer, and the result is PASS. which_layer explicitly advertises absolute-path support.
- **Evidence:** tools.ts:97-103 toProjectRelative uses path.relative(path.resolve(root), filePath) with no realpath and no outside-root check, and when root is undefined it normalises the absolute path; layer-resolver.ts:21-24 `if (seg === '..') { parts.pop(); continue; }` clamps escapes silently; file-check.ts:347 `if (layer === null) continue;`, and blockingVerdictOf (file-check.ts:298) returns 'pass'; server.ts:183 says 'project-relative or absolute'.
- **Suggested fix:** Resolve both root and filePath with fs.realpathSync (falling back to the parent dir for files that do not exist yet). Reject (return fail) an absolute path that is outside the root or given when no root is configured. Make normalisePath report a leading '..' instead of dropping it. For a file with no layer, return blockingVerdict 'unknown', not 'pass'.
- **Verifier:** I tried to refute this and could not. Every step of the claimed path holds.

1. **The path conversion has no safeguards.** toProjectRelative (src/mcp-server/tools.ts:97-103) calls path.relative(path.resolve(root), filePath). Node's path.relative does not follow symlinks, and nothing checks whether the result escapes the root. When no --project is given, the absolute path goes straight to normalisePath.
2. **normalisePath silently drops escapes.** In src/mcp-server/layer-resolver.ts:21-24, a '..' segment calls parts.pop(), which does nothing when parts is empty. So '../../../../../private/tmp/out/runs/r1/work/src/domain/Order.ts' becomes 'private/tmp/out/runs/r1/work/src/domain/Order.ts'.
3. **Absolute paths become unrooted.** With no project set, '/Users/<x>/proj/src/...' becomes 'Users/x/proj/src/...'.
4. **The globs cannot match the rewritten path.** Preset layer globs are anchored at the project root (presets/ddd.yaml: 'src/*/domain/**' and similar), so resolveLayer returns undefined for these paths.
5. **The file check then passes.** In checkSource (file-check.ts), layer is null, so `if (layer === null) continue;` skips every import rule. blockingVerdictOf (file-check.ts:298) then returns 'pass' and the summary reads 'PASS: no blocking violation'.
6. **which_layer and check_import are affected too.** They go through the same toProjectRelative (tools.ts:120, 136, 139). Yet server.ts advertises which_layer as accepting 'project-relative or absolute' paths.
7. **Nothing resolv

## R06 [major] (mcp) ProjectView.read follows symlinks out of the project root; explain_finding returns arbitrary file lines, bypassing the arm's read confinement

- **Location:** `src/mcp-server/project-files.ts:65`
- **Scenario:** daedalus-mcp arm with allowBash, or any client that can create files. The agent runs `ln -s /path/to/DaedalusArch/<protected file> src/x.ts`, then calls explain_finding {rule:'FF-S01', file:'src/x.ts', line:N} for N = 1..k. ProjectView.read checks only the lexical abs.startsWith(root + sep). fs.existsSync, statSync and readFileSync follow the symlink, and explain-finding.ts:271 returns that line as location.text. The MCP server is a separate node process, so the Codex per-call read denies (codexReadDenies) and the CLI sandbox do not apply to it. The same reads feed check_file barrel resolution and the cycle graph, so files outside the project can also change the verdicts.
- **Evidence:** project-files.ts:63-65 `const abs = path.resolve(this.root, file); if (abs.startsWith(this.root + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile()) text = fs.readFileSync(abs, 'utf8');` (no realpath, no lstat); explain-finding.ts:271 `const text = ... view?.read(file)?.split(/\r?\n/)[input.line - 1]` is returned in location.text; agents.ts:301 and agents.ts:310 apply the read denies to the codex process only, while the server gets `--project cwd`.
- **Suggested fix:** In read(), compare fs.realpathSync(abs) against the realpath of the root, and refuse symlinks that resolve outside it (or lstat and refuse symlinks entirely). Consider removing the raw line text from the explain_finding output in experiment arms.
- **Verifier:** I could not refute this one. It holds for the Codex daedalus-mcp arm with the shell tool on.

1. **Containment is a text check only.** `src/mcp-server/project-files.ts:63-65` resolves the path and tests `abs.startsWith(this.root + path.sep)`. It never calls realpath or lstat, and `existsSync`, `statSync` and `readFileSync` all follow symlinks. So a symlink `src/x.ts` inside the project that points at any outside file passes the check, and the server reads the target.

2. **The line comes back to the agent.** In `src/mcp-server/explain-finding.ts:271`, `view?.read(file)?.split(/\r?\n/)[input.line - 1]` is returned as `location.text`. The only gate is that `rule` is a known fitness-function id or template name, such as FF-S01 or any spec rule. That is easy to meet, so calling it with line=1..N dumps the whole target file.

3. **Codex's read denies stop at the Codex process.** In `scripts/lib/loop/agents.ts`, `plan()` computes `codexReadDenies(...)` and passes them into `buildCodexArgs`, which configures Codex's sandbox profile. `withCodexMcpServer` then starts the server with only `--spec` and `--project cwd`; nothing confines the server.

4. **The repo itself says the server is unsandboxed.** `Docs/v1.3/study2-outline.md:152` records: "Codex runs MCP servers outside its sandbox", and says the MCP wiring is untested by a live probe.

5. **The agent can create the symlink.** The Codex arm runs with `allowBash: true` (generator-plan-codex.json), and writes inside `cwd` are allowe

## R07 [major] (mcp) check_diff drops pure renames (git emits no ---/+++ lines), so moving a file into another layer passes

- **Location:** `src/mcp-server/diff-check.ts:80`
- **Scenario:** The agent moves src/infrastructure/TypeOrmOrderRepository.ts, which imports 'typeorm', to src/domain/TypeOrmOrderRepository.ts with no content change, and edits one other file. `git diff -M` (the default) emits only `diff --git`, `similarity index 100%`, `rename from` and `rename to` for the move, with no ---/+++ lines and no hunks. parseUnifiedDiffWithHunks only opens a file on a '--- ' line, so the move is never seen. The result covers only the other file and gives blockingVerdict 'pass'. evaluate_project on the resulting tree reports FF-P01 (domain-purity) on the moved file. The code at diff-check.ts:278-284 handles a layer change on rename, but only for renames that carry ---/+++ lines.
- **Evidence:** diff-check.ts:80-88 only '--- ' and '+++ ' lines create or complete a file entry, and 'rename from'/'rename to'/'diff --git' are never parsed; diff-check.ts:216 fails only when no file at all is found, so a mixed diff silently omits the rename.
- **Suggested fix:** Parse `diff --git a/X b/Y` headers together with `rename from`/`rename to`, and create a renamed entry with no hunks. For such an entry, check the whole new file from the project view, as the delta path does.
- **Verifier:** I tried to refute this and could not. The defect is real.

Evidence in src/mcp-server/diff-check.ts (checkout b08ec387):
- In parseUnifiedDiffWithHunks (lines 59-99), a file entry is created only on a line starting with '--- ' (line 80). '+++ ' (line 85) and the @@ hunk header (lines 89-95) only fill in an entry that already exists. Nothing reads 'diff --git', 'rename from' or 'rename to'.
- Git turns rename detection on by default (diff.renames=true since git 2.9). For a 100%-similarity rename, `git diff` prints only `diff --git a/X b/Y`, `similarity index 100%`, `rename from X` and `rename to Y`, with no ---/+++ lines and no hunks. The parser produces no DiffFile for that move.
- In checkDiff (lines 190-320), files that never reach `planned` are not checked and not listed in `skipped`. blockingVerdict comes from worstBlocking over the files that were checked. With one other clean edited file, the result is 'pass'. With only the rename, files is empty and worstBlocking([]) is also 'pass', with the summary "0 source file(s) checked: clean." I found no guard that fails when nothing was found; the claim's citation of line 216 does not match this code. That makes the bug a little worse: even a diff containing only the rename passes silently.
- The layer-move note at lines 286-293 ('moved from X to Y ... run check_file on the whole file') only runs for renames the parser saw. The only rename test (tests/unit/mcp-server/diff-placement.test.ts:101-115) uses 90% similarity, which in

## R08 [major] (switches) Q22 B's rebuild of FF-P02 silently erases the FF-P02 rows Q9 B adds

- **Location:** `src/construct-switches/rows.ts:543`
- **Scenario:** Answers Q9 B and Q22 B, on a nestjs project where an infrastructure repository class has no `implements` (an FF-P03 row). q9MissingImplements runs first (run() line 214) and adds an FF-P02 row on the implementer. q22CrossLayerDip runs later (line 226) and calls rebuild(), which sets `w.violations = []` and re-adds rows only for application-layer classes whose cross-layer ratio is under the threshold. The infrastructure implementer is never re-added, so every Q9 B row is dropped and logged as a Q22 'dropped' change, while the earlier Q9 'added' change stays in the log. Q9 B therefore does nothing in nestjs (and in any other style, since q22 has no style guard) whenever Q22 B is also chosen, with no warning.
- **Evidence:** rows.ts:214 runs q9 before q22 at :226. rows.ts:338 has q9 add to `dip` (dependency-inversion / port-dependency-inversion). rows.ts:546 `w.violations = [];` in rebuild, and :565 keeps only `this.view.applicationLayers.includes(c.layer)`. rows.ts:552 logs the old rows as dropped under q (Q22).
- **Suggested fix:** Run the Q9 B additions after the Q22 B rebuild, or have the rebuild keep rows that other questions added (for example, rows with a Q9 discriminator).
- **Verifier:** I tried to refute this and could not. The code in src/construct-switches/rows.ts does what the claim says.

- **Run order.** run() calls q9MissingImplements (line 214) before q22CrossLayerDip (line 226).
- **What Q9 B adds.** For each FF-P03 row it adds a row to each rule in dipRules() (dependency-inversion and port-dependency-inversion). The row carries the FF-P03 file path and discriminator [cls], so it sits on the implementer. In nestjs and clean that implementer is normally an infrastructure repository.
- **What Q22 B does.** rebuild() saves old = w.violations (this includes the Q9 rows), sets w.violations = [], and runs build. build adds rows only for classes of kind 'Class' whose layer is in view.applicationLayers and whose cross-layer interface ratio is below the threshold.
- **Why the Q9 rows are lost.** An infrastructure implementer never passes that filter, so its row id is never in `after`. Each Q9 row is then logged as a Q22 'dropped' change, and the final violations exclude it.
- **Why the log is inconsistent.** changes.splice(mark) only removes changes logged after rebuild started. The earlier Q9 'added' entries stay, so the change log says the row was both added (Q9) and dropped (Q22).
- **No guard.** Nothing in run() or q22 skips the rebuild or keeps the Q9 rows when Q9 is B, and q22 has no style check.
- **Not covered by the docs.** docs/v1.3/construct-switches.md lines 68 and 87 describe Q9 B as adding an FF-P02 row on the implementer and Q22 B as redefining

## R09 [major] (switches) Carrier rules added by Q5 D, Q16 B and Q17 C break report identity I1, so the live pipeline run fails

- **Location:** `src/construct-switches/compile.ts:70`
- **Scenario:** Set Q5 D, then run the live development-set re-run (ue-baseline-live.ts calls `firewall evaluate --symbolic-only` with the default --scoring v1.3) on hexagonal or ddd. Q16 B or Q17 C on ddd does the same. applyConstructCompileOverlays adds FF-S05, FF-S02 or FF-DS03 to fitnessFunctions, and compileFunctionsCore compiles it as one more symbolic query, so totalCompiled goes up by 1. But CompileCommand computes the declared count from the unmodified spec: `compileFactsOf(parsedSpec.fitnessFunctions, result.data, ...)` (compile-command.ts:45). checkIdentities I1 (`declared + adrDerived = compiled + disabled + dropped.length`, report-builder.ts:327-329) is then off by one per carrier. Report assembly returns REPORT_COUNTS_INCONSISTENT (critical), the CLI prints no JSON, and ue-baseline-live throws 'no JSON from evaluate'. The offline re-score never calls the report builder, so the effects table shows these options working when the live run cannot produce a report.
- **Evidence:** compile.ts:70-81 pushes new FitnessFunction ids into `functions`. compile-command.ts:35 compiles the overlaid input (via V13_COMPILE_OPTIONS.constructSwitches), but line 45 passes `parsedSpec.fitnessFunctions` to compileFactsOf. report-builder.ts compileFactsOf sets `declared: fitnessFunctions.length` and `compiled: compiled.totalCompiled`. The hexagonal preset (hexagonal-template.ts:19-21) and the ddd preset (ddd-template.ts) do not declare FF-S05, FF-DS03 or (ddd) FF-S02. compile.test.ts:64-103 checks only the compiled ids; no test runs the report builder with a carrier.
- **Suggested fix:** Have CompileCommand compute compileFacts from the overlaid function list (applyConstructCompileOverlays(compilerInputFromSpec(spec), answers).fitnessFunctions), or count carriers separately as declared-by-switch in I1. Add a pipeline test that assembles a report with Q5 D set.
- **Verifier:** The defect is real. It is latent at HEAD because every answer is A, and it fires as soon as Q5 D, Q16 B or Q17 C is set for a hexagonal or ddd spec.

How it happens:
- `fitness-compiler.ts:98` puts `constructSwitches: CONSTRUCT_ANSWERS` into `V13_COMPILE_OPTIONS`. `compileFunctions` (line 113) runs `applyConstructCompileOverlays`, and `compile.ts:70-81` pushes FF-S05, FF-S02 (ddd) or FF-DS03 (ddd) into `fitnessFunctions`.
- The carrier is named `construct-switch-carrier`. That name is not in `HEXAGONAL_TEMPLATES`, so `hexagonal-compiler.ts:55-57` routes it to `rest`, which goes to `compileFunctionsCore`. That function uses the `CONSTRUCT_TEMPLATES` carrier template (no applicability gate) and compiles it as a symbolic query. `totalCompiled` goes up by 1 (`hexagonal-compiler.ts:75`). Its source is 'template'/'fitness-function', not 'adr', so `adrDerived` stays the same.
- `compile-command.ts:35` compiles the overlaid input, but line 45 calls `compileFactsOf(parsedSpec.fitnessFunctions, ...)` on the spec without the overlay. So `declared` (`report-builder.ts:129`) does not count the carrier, and `dropped` is computed only over spec ids.
- `report-builder.ts:253-255` sets `declared` from `compileFacts` and `compiled` from `compiled.totalCompiled`. I1 at `report-builder.ts:327-329` is then off by one per carrier, and the report builder returns REPORT_COUNTS_INCONSISTENT (critical).
- The presets do not already declare these ids. `hexagonal-template.ts:19-26` has S01, S03, S04, P0

## R10 [major] (switches) Q5 B together with Q24 B makes the 'advisory' inward-bypass rows blocking in hexagonal

- **Location:** `src/construct-switches/tiers.ts:32`
- **Scenario:** Answers Q5 B (FF-S03 blocking in hexagonal and ddd) and Q24 B (documented as 'an advisory FF-S03 row'). q24InwardBypass adds its rows to FF-S03 in hexagonal (rows.ts:608-620; the doc reports 17 rows on the development set). constructRuleTier makes all of FF-S03 blocking under Q5 B, and no row-level tier keeps the bypass rows advisory (constructRowTiers handles only Q3 C). So the 17 inbound-adapter → domain rows become blocking findings, and hexagonal blocking precision drops from 13/13 to about 15/32, against Q24 B's stated tier. Neither the docs nor the answer script flag this.
- **Evidence:** tiers.ts:32-34 `if (answers.Q5 === 'B' && ruleId === 'FF-S03' && HEX_DDD.has(s)) return override(... 'blocking' ...)`. rows.ts:608 `const fs03 = this.byId('FF-S03')` and :620 `this.add('Q24', fs03, ...)`. catalogue line 187: Q24 B 'is an advisory FF-S03 row'. construct-switches.md:193 lists Q24 B hexagonal +17 rows.
- **Suggested fix:** Give the Q24 rows a row-level advisory tier (extend RowTierResolver to cover Q24 rows by their 'bypass' discriminator), or warn in signOffLines when Q5 B and Q24 B are both chosen.
- **Verifier:** I tried to refute this and could not. The code does what the claim says.

1. **Q5 B makes the whole rule blocking.** tiers.ts:32-34 returns a rule-level 'blocking' tier for every FF-S03 row when Q5 === 'B' and the style is hexagonal or ddd. The sealed table makes FF-S03 advisory everywhere except layered (rule-tiers.ts:57).

2. **Q24 B rows are plain FF-S03 rows.** In rows.ts:604-622, q24InwardBypass() runs for hexagonal and adds each bypass row to fs03 = this.byId('FF-S03') through add() (rows.ts:146-171). add() puts no tier marker or other separate marker on the row. The row is pushed into the same FF-S03 working set.

3. **Nothing keeps those rows advisory.** constructRowTiers (tiers.ts:72-81) returns undefined unless Q3 === 'C', and it only touches FF-S02. tiered-scoring.ts:117-149 reads the rule tier from constructRuleTier and asks the row resolver only per row. No other code splits FF-S03 by row, and I found no guard against the Q5 B plus Q24 B combination in src/shared or src/construct-switches.

4. **The documents say the rows are advisory.** The catalogue (construct-switch-catalogue.ts:187) and its ruleAdr both call Q24 B 'an advisory FF-S03 row'. construct-switches.md:193 shows Q24 B alone leaving hexagonal blocking at P 13/13, which holds only because FF-S03 is advisory there by default; all rows go to P 16/33 (+17 rows). Q5 B alone gives hexagonal blocking R 15/15, P 15/15 (line 150).

**Result.** With both answers, the 17 bypass rows (none expected by the manifes

## R11 [minor] (extract) graph-fidelity 'apg-v13-dynamicImports' variant measures the full v1.3 graph with both views merged, not the dynamicImports option

- **Location:** `scripts/v1.3/graph-fidelity.ts:511`
- **Scenario:** Run `graph-fidelity.ts --dynamic-extractor src/apg-extractor/index.ts` on this branch. The variant passes `{ dynamicImports: true }`, which extractAPG merges over DEFAULT_OPTIONS = V13_DEFAULT_OPTIONS. That also turns on reExportEdges: 'both', moduleWiring, memberFacts and aliasDeclarationPackages. The variant has no edgeFilter, so the projection keeps both the reExportHop literal edges and the viaReExport resolved edges. Every file pair that a barrel routes to the declaring file is then compared with the tsc/dependency-cruiser reference as an extra edge, and aliasDeclarationPackages changes the package edges too. The difference from 'apg-v12e-default' is reported as the effect of dynamic imports, but it actually mixes barrel double-edges and alias packages into the figure. This is the same kind of confound behind the 0.926-of-tsc coverage reading for barrels and require.
- **Evidence:** graph-fidelity.ts:511 `variants.push({ name: 'apg-v13-dynamicImports', extract: mod.extractAPG, options: { dynamicImports: true }, dynamicOption: true })` with no edgeFilter. Compare graph-fidelity.ts:498 comment 'on the v1.3 branch `{}` means the v1.3 defaults', which is why the v12e variant spells out V12E_DEFAULT_OPTIONS. apg-extractor.ts:29 `const opts = { ...DEFAULT_OPTIONS, ...options }`.
- **Suggested fix:** Use `{ ...V12E_DEFAULT_OPTIONS, dynamicImports: true }` for the isolating variant. Alternatively, keep the V13 base but add the literal edgeFilter (`!viaReExport`) and rename the variant to say what it measures.
- **Verifier:** The defect is real, but only for runs made from now on. The figures already published are fine, so I rate it minor rather than major.

What the code does: scripts/v1.3/graph-fidelity.ts:511 builds the 'apg-v13-dynamicImports' variant with `options: { dynamicImports: true }` and no edgeFilter. The extractor merges this over DEFAULT_OPTIONS (apg-extractor.ts:29 `{ ...DEFAULT_OPTIONS, ...options }`). On this branch DEFAULT_OPTIONS is V13_DEFAULT_OPTIONS (types.ts:222), which also sets moduleWiring:true, reExportEdges:'both', memberFacts:true and aliasDeclarationPackages:true (types.ts:194-200). The header (line 9) tells you to pass the src/apg-extractor/index.ts of any tree that has the dynamicImports option, and this branch's own tree qualifies. Run that way, the variant keeps both reExportHop and viaReExport IMPORTS edges, because only the --views variants at lines 504-505 filter them, and alias declaration packages are on too. The gap between this variant and apg-v12e-default would then mix barrel double-edges and alias packages into what is reported as the effect of dynamic imports. Line 498 shows the author knew that `{}` means the v1.3 defaults on this branch and pinned V12E_DEFAULT_OPTIONS for the baseline, but the dynamic variant was not pinned the same way.

What I could not confirm: the published results/v1.3-fidelity figures were made with the extractor from v1.3-extractor-fixes@f44e102. Its DEFAULT_OPTIONS had moduleWiring:false and no reExportEdges or alias options,

## R12 [minor] (extract) ADR symbolic queries (and shadow-mode Cypher) get no edge-view rewrite and read the literal and resolved IMPORTS edges together

- **Location:** `src/fitness-compiler/fitness-compiler.ts:343`
- **Scenario:** An ADR declares a symbolic rule such as `MATCH (a:File)-[:IMPORTS]->(b:File) WHERE a.layer='domain' AND b.layer='application' RETURN a.filePath`, or a count of outgoing IMPORTS per file. On the v1.3 default graph, an import through a barrel yields both the literal edge to the barrel and a viaReExport edge to the declaring file. applyEdgeView keys on template names in TEMPLATE_EDGE_VIEWS, so ADR queries (name `adr:<title>`) pass through untouched. The query then counts each barrel import twice in count-style rules, and it matches file pairs that no import statement names (a->declaring file) as well as barrel hops. The ADR verdict therefore differs from the same query on the v1.2E graph and from the template-based rules.
- **Evidence:** fitness-compiler.ts:339-350 compileADRSymbolic returns `cypher: rule.query` with no applyV13Rewrites call. Only the template paths rewrite (fitness-compiler.ts:299, hexagonal-compiler.ts:39, ddd-compiler.ts:42). edge-views.ts:96-98 `applyEdgeView` returns the text unchanged for 'a template outside the table'.
- **Suggested fix:** Apply a default view to non-template queries under edgeViews, for example the literal predicate on every IMPORTS pattern, or require ADR rules to declare a view. Otherwise, warn when an ADR/custom query reads IMPORTS on a 'both' graph.
- **Verifier:** The mechanism the claim describes is real. compileADRSymbolic (src/fitness-compiler/fitness-compiler.ts:339-350) returns `cypher: rule.query` and never calls applyV13Rewrites. The only rewritten paths are template-based: fitness-compiler.ts:299 and the hexagonal and DDD compilers. applyEdgeView (edge-views.ts) also returns the text unchanged for any name that is not in TEMPLATE_EDGE_VIEWS, and `adr:<title>` names never are. The v1.3 extractor default is `reExportEdges: 'both'` (src/apg-extractor/types.ts:198). On that graph, an import through a barrel produces two IMPORTS edges: a literal one to the barrel, marked reExportHop, and a resolved one to the declaring file, marked viaReExport. So a handwritten ADR query such as `MATCH (a:File)-[:IMPORTS]->(b:File)` reads both edges. A count-style rule counts the barrel import twice, and a pair-style rule matches the barrel hop as well as the declaring-file pair. The same query on a v1.2E graph (resolved-only) would see one edge.

I could not refute it on the code. Two things lower the severity from major to minor. (1) Docs/v1.3/edge-views.md:79 records this as a deliberate choice: "ADR-derived rules (`adr:` symbolic rules written by a spec author) are not in the table and are not rewritten." It is still a real gap, because the same doc's 2026-10-15 addendum treats "read every IMPORTS edge, so saw both views at once" as a defect and fixes it in four other readers, and nothing tells ADR authors that IMPORTS now carries two edges per 

## R13 [minor] (extract) Ontology and APG v2 outputs are sorted with locale-sensitive localeCompare, so their order depends on the host locale

- **Location:** `src/apg-enrich/ontology/pipeline.ts:381`
- **Scenario:** Run the same input on two machines, one with LANG=en_US.UTF-8 and one with LANG=da_DK.UTF-8. ICU Danish collation is upper-case-first and sorts 'aa' after 'z'. findings, SemCapability classes, clustering merge order (clustering.ts:112, which also changes which pairs merge first) and APG v2 Channel node order (async-coupling.ts:244) then come out in a different order. The serialized ontology or APG v2 results lose byte identity even though the inputs are the same, while the rest of the extractor uses code-unit order (import-edge-merger.ts codeUnitCompare).
- **Evidence:** ontology/pipeline.ts:381 `findings.sort((a, b) => findingKey(a).localeCompare(findingKey(b)))`; ontology/clustering.ts:112 and 161; ontology/units.ts:153 and 180; apg-extractor/apg2/async-coupling.ts:244 `(a.filePath + a.name).localeCompare(b.filePath + b.name)`.
- **Suggested fix:** Replace localeCompare with a code-unit comparator (`a < b ? -1 : a > b ? 1 : 0`), or call localeCompare with a fixed locale ('en' with a fixed collation), in every sort whose output is serialized or hashed.
- **Verifier:** I tried to refute this and could not. Every cited call site uses `String.prototype.localeCompare` with no locale argument: ontology/pipeline.ts:340, 369 and 381, clustering.ts:112 and 161, units.ts:153 and 180, and apg2/async-coupling.ts:244. With no locale argument, Node picks its default ICU locale from LANG/LC_ALL.

I checked this on this machine without running tests. Plain `node` resolves to en-US. With `LANG=da_DK.UTF-8 LC_ALL=da_DK.UTF-8`, the collator resolves to da-DK, and sorting ["aa","z","B","b"] gives ['B','b','z','aa']. Under en-US, 'aa' sorts first and 'b' comes before 'B'. So the same input sorts differently depending on host locale.

Consequences:
(1) The `findings` order in OntologyResult changes, because pipeline.ts:381 sorts on canonicalJSON keys that contain mixed-case node IDs and paths. The serialized result therefore loses byte identity.
(2) Clustering.ts:112 sets the processing order of candidate pairs with equal scores. The loop in `cluster` skips pairs that are already unioned and stops adjudicating once `maxPairs` is reached (droppedPairs++). So the locale can change which pairs get an LLM call, which pairs get merged, and the adjudication records and itemIds. That changes behavior, not just order.
(3) The order of APG v2 Channel nodes changes (async-coupling.ts:244).

The rest of the extractor deliberately uses code-unit order (`codeUnitCompare` in import-edge-merger.ts:60, and the `byId` < > comparator right next to it at pipeline.ts:373). That m

## R14 [minor] (extract) Cheap proxies cohesion and communities assign barrel imports to the barrel's component because their literal view drops RE_EXPORTS

- **Location:** `src/apg-enrich/cheap/cohesion.ts:95`
- **Scenario:** In a class in `src/orders/order.service.ts` with `import { Invoice } from '../shared'`, where `src/shared/index.ts` re-exports `src/billing/invoice.ts`, the extraction uses the v1.3 defaults (extractAndEnrich passes `{}`). literalEdgeView keeps only orders->shared/index. cohesion then reads IMPORTS only, so componentDependencies = {shared} instead of {billing}, and responsibilityBreadth is undercounted against the v1.2E graph. communities uses GRAPH_EDGE_TYPES = IMPORTS|CONSTRUCTOR_INJECTS|CALLS without RE_EXPORTS. The barrel becomes a hub, and barrel-imported declaring files have no import link to their importers, which shifts the Louvain partition and the community-component-mismatch flags. The edge-views contract defines the literal view as 'IMPORTS without viaReExport, plus RE_EXPORTS'.
- **Evidence:** cohesion.ts:94-95 `for (const e of literalEdgeView(ctx.apg.edges)) { if (e.type !== 'IMPORTS') continue;`; communities.ts:16 `GRAPH_EDGE_TYPES = new Set(['IMPORTS', 'CONSTRUCTOR_INJECTS', 'CALLS'])`, communities.ts:23-24; edge-views.ts:6 literal = 'IMPORTS edges without viaReExport, plus RE_EXPORTS'; cheap/index.ts:97 `extractAPG(root, args.extractorOptions ?? {}, tsconfig)`.
- **Suggested fix:** Follow RE_EXPORTS transitively from barrel targets, or include RE_EXPORTS edges in the cohesion and communities graphs. Otherwise, use the resolved view (drop `reExportHop`) for these component-attribution proxies.
- **Verifier:** The communities half holds up. The cohesion half does not.

Communities (src/apg-enrich/cheap/communities.ts:16, 23-24): GRAPH_EDGE_TYPES is IMPORTS|CONSTRUCTOR_INJECTS|CALLS, so the RE_EXPORTS edges that literalEdgeView keeps are dropped. The extractor records a barrel's `export ... from` only as a RE_EXPORTS edge (import-resolver.ts:628-654, resolveReExportTargets), never as IMPORTS. The v1.3 default is reExportEdges 'both' (types.ts:198), and extractAndEnrich passes `{}` (cheap/index.ts:97). Under that default the IMPORTS edge marked viaReExport is removed, and with RE_EXPORTS also excluded, src/billing/invoice.ts loses every import-graph link to the files that import it through src/shared/index.ts. The barrel becomes a hub joined only to importers. Docs/v1.3/edge-views.md (table at line 14) and fitness-compiler/edge-views.ts:6 define the literal view as "IMPORTS not viaReExport, plus all RE_EXPORTS", which is the module graph tsc and dependency-cruiser report. So the file graph fed to Louvain is neither that view nor the v1.2E resolved graph. That shifts partitions, ARI and community-component-mismatch flags on projects with barrels. CALLS and CONSTRUCTOR_INJECTS edges still link some resolved files, which partly softens the effect. On a v1.2E graph nothing changes.

Cohesion (cohesion.ts:94-95): this is not a defect as claimed. The header says breadth counts "distinct other components its file imports (literal edge view)". The literal view is defined as the dependencies 

## R15 [minor] (interp) javaRegex treats several Java regex constructs as JS and returns wrong matches with no error; the doc (T12) says Java-only syntax is rejected

- **Location:** `src/cypher-interp/functions.ts:248`
- **Scenario:** (1) `'a\nb' =~ '(?m)b'`: Neo4j (Java Pattern.matches, which needs the whole input to match) returns false. The interpreter turns the leading (?m) into the JS `m` flag, so the wrapping `^(?:b)$` anchors match at line breaks and it returns true. (2) `'Order' =~ '\\p{Lu}.*'`: in JS without the `u` flag (u is deliberately dropped, line 250), `\p` is an identity escape that matches the literal text 'p{Lu}'. So the result is false where Java returns true. The rejection list only catches `\p{java`. The same happens with `\h`, `\R`, `\x{41}` and `[a-z&&[^e]]`, all reinterpreted silently. (3) `(?i)` is ASCII-only in Java but Unicode in JS non-u mode: `'É' =~ '(?i)é'` is false on Neo4j and true here. `\s` and `\v` cover different characters. (4) With no `u` flag, `.` matches one UTF-16 unit, not one code point. Glob `?` compiles to `.`, so `'src/😀.ts' =~ '^src/.\.ts$'` is true on Neo4j and false here. (5) Over-rejection: `/\\[QEAZz]/` (line 253) also hits an escaped backslash followed by Q, E, A, Z or z (Java `\\Q` means a literal backslash then Q) and throws Unsupported. Template impact today: none for cases 1-3 and 5. Every `=~` operand comes from globToRegex or compilePattern, which escape all metacharacters, or from fixed literals (SETTER_NAME_PATTERN, the sweep's patterns). The only reachable case is 4: an exclude, test, ACL or context glob containing `?`, matched against a path with an astral character. The parity sweep binds only glob-shaped patterns, so it cannot detect any of these.
- **Evidence:** functions.ts:248-250 maps the leading `(?[imsu]+)` to JS flags and drops `u`; :253 rejects only `(?x)` in mid-pattern, possessive quantifiers, `\p{java` and `\[QEAZz]`; :258 `new RegExp(`^(?:${body})$`, flags)`, so with flag m the anchors are line anchors. Docs/v1.3/cypher-interpreter.md T12: "Java-only constructs are rejected, not approximated". glob-to-regex.ts maps `?` to `.`.
- **Suggested fix:** Do not map (?m) to a JS flag: drop it, or keep it but anchor with a sticky full-length check (`re.exec(s)?.[0].length === s.length` with no ^/$ wrapper, or wrap with `(?<![\s\S])` / `(?![\s\S])`). Always compile with the `u` flag. Reject `\p{`, `\P{`, `\h`, `\H`, `\R`, `\X`, `\v`, `\x{`, `&&` inside classes, and `(?i)` without `(?u)` when the pattern has non-ASCII letters. Apply the `\[QEAZz]` test only after removing escaped backslashes.
- **Verifier:** I could not refute the claim: the code does what it says, and it contradicts the T12 contract. The real-world impact is small, so I rate it minor rather than major.

Evidence from src/cypher-interp/functions.ts:
- Lines 248-251 strip the leading inline flags and turn them into JS flags, dropping `u`.
- Line 253's rejection test catches only four things: an inline flag group in mid-pattern, a possessive quantifier, the literal `\p{java`, and `/\\[QEAZz]/`.
- Line 258 builds `new RegExp(`^(?:${body})$`, flags)`.

So each scenario behaves as claimed:
1. With the `m` flag, `^` and `$` become line anchors, so `'a\nb' =~ '(?m)b'` returns true here. Java's `Pattern.matches` needs the whole input to match and returns false.
2. Without the `u` flag, `\p{Lu}`, `\h` and `\R` are identity escapes, `\x{41}` is not read as a hex escape, and `&&` inside a character class is literal. All of these compile without error and give wrong matches. Nothing rejects them.
3. Case-insensitive matching and `\s`/`\v` cover different characters in Java and in JS non-u mode.
4. In JS non-u mode, `.` matches one UTF-16 code unit. Java's `.` matches one code point.
5. The `\\[QEAZz]` test runs on the raw body, so it also catches an escaped backslash followed by Q, E, A, Z or z, and throws Unsupported wrongly.

The docs at Docs/v1.3/cypher-interpreter.md:270 (T12) say "Java-only constructs are rejected, not approximated". That is a contract violation.

Why only minor: the reachable surface today is tiny. As 

## R16 [minor] (interp) sign(NaN) crashes with a JS RangeError (InternalError); float-to-integer conversion differs from Neo4j's cast

- **Location:** `src/cypher-interp/functions.ts:187`
- **Scenario:** `RETURN sign(0.0/0.0)` calls `BigInt(Math.sign(NaN))`, which is `BigInt(NaN)` and throws a RangeError. That is not a CypherRuntimeError, so the repository reports 'CypherInterp.InternalError'. Neo4j returns an integer (it casts `Math.signum` to long, giving 0). Related at line 42: `toInteger(NaN)` and `toInteger(Infinity)` return null and `toInteger(1e19)` throws a long-overflow ArithmeticError, while Neo4j's FloatingPointValue.longValue() is a Java `(long)` cast that gives 0, Long.MAX_VALUE and Long.MAX_VALUE. Template impact: none today, since no catalogue template, universal metric or judge query calls sign() or toInteger(). The sweep never feeds these values.
- **Evidence:** functions.ts:187 `if (typeof v === 'number') return BigInt(Math.sign(v));`; :42 `Number.isFinite(v) ? checkedInt(BigInt(Math.trunc(v))) : null`.
- **Suggested fix:** sign: `Number.isNaN(v) ? 0n : BigInt(Math.sign(v))`. toInteger(float): copy Java's `(long)` cast, with NaN giving 0 and values outside the int64 range clamped to INT64_MIN or INT64_MAX. Check both on 5.26.24 with cypher-interp-unit-live.ts.
- **Verifier:** I could not refute the claim; the code does what it says. eval.ts:753-759 turns operands into JS numbers and does float division as `a / b` with no zero check, so `0.0/0.0` gives NaN (only the integer branch at :749 throws '/ by zero'). In the `sign` built-in, functions.ts:187 then runs `BigInt(Math.sign(NaN))`, which is `BigInt(NaN)`, and JS throws a RangeError for that. A RangeError is not a CypherRuntimeError, CypherSyntaxError or CypherUnsupportedError, so repository.ts:76 reports it as 'CypherInterp.InternalError'. Neo4j's sign() casts Math.signum to long and returns 0 for NaN, so the outputs differ. The toInteger part is also as described: functions.ts:42 returns null for NaN and Infinity because of the `Number.isFinite` check, and checkedInt (values.ts:49-50) throws a 'long overflow' ArithmeticError for 1e19. Neo4j instead uses a Java `(long)` cast, which saturates or gives 0. I did not check Neo4j's source line by line; the Neo4j values come from the well-known Java `(long)` cast semantics. Minor is the right severity: it needs a NaN, infinite or out-of-range float passed to sign() or toInteger(), the claim says no catalogue template, universal metric or judge query calls those functions, and the result is a reported error or null rather than a silently wrong metric.

## R17 [minor] (interp) The parity gate counts an ORDER BY divergence as 'order' and passes, though every catalogue template has a total ORDER BY

- **Location:** `scripts/v1.3/lib/memory-sweep.ts:81`
- **Scenario:** Suppose the interpreter sorted differently from Neo4j on some key, for example nulls first in ascending order, a different string collation in `ORDER BY filePath`, or mixed-type ordering. If the multiset of rows is the same, classify() returns 'order'. memory-parity.ts:273 fails only on content, error or unsupported, so the run exits 0 and the headline still reads '0 content'. This is the channel where the ORDER BY null-ordering and mixed-type-ordering semantics would show up, and it is accepted wholesale. Only the per-family table, read by hand, separates T1/T2 'order' rows from a real ORDER BY bug. Templates that end in LIMIT (no-cyclic-deps) would still surface as content.
- **Evidence:** memory-sweep.ts:79-81: sorted-equal gives `{ klass: 'order' }` whatever the query text says. memory-parity.ts:273: `bad = entries.filter(e => e.klass === 'content' || e.klass === 'error' || e.klass === 'unsupported')`. All CYPHER/APG2/CHEAP2/DDD/HEX templates and JUDGE_GRAPH_QUERIES end in ORDER BY.
- **Suggested fix:** When the statement's final RETURN has an ORDER BY, compare rows position by position and classify a mismatch as 'content'. A safe heuristic is to class a reordering as 'content' unless the rows are tied on the ORDER BY key columns. Count unexplained 'order' entries in `bad`, or keep an explicit allow-list for the T1/T2 families.
- **Verifier:** I could not refute this. The mechanism is real, but it only weakens the automated gate. No current result is wrong.

**What the code does**
- `memory-sweep.ts:79-81`: `classify()` returns `{klass:'order'}` whenever the two sides have the same multiset of rows in a different order. It does this whatever the query text says: the `cypher` argument is only consulted for the avg/sum float trap at line 85, never for ORDER BY.
- `memory-parity.ts:273`: the exit gate fails only on `content`, `error` or `unsupported`. An `order` entry passes, and the run exits 0.
- `memory-parity.ts:326`: the per-family examples also leave out `order` entries.

**Why `order` should never appear for a catalogue template**
- The design doc says so itself. `Docs/v1.3/cypher-interpreter.md:244` and `:259` say every template ends in an ORDER BY whose keys fix the row order, and that `order` is meant for trap T1 (row order without ORDER BY) and trap T2 (float accumulation order).
- `grep` over `src/fitness-compiler/*-templates.ts` confirms every template ends in ORDER BY.

**Failure scenario**
Suppose the interpreter's ORDER BY breaks: null placement, the cross-type orderability in doc T15, string comparison, or a sort-key bug. On any template whose rows are not cut by LIMIT, the rows are then a permutation of Neo4j's. They would be classed `order`, the gate would exit 0, and the stdout headline would still count 0 not-equal-or-order.

Only reading the per-template table or `parity-nonequal.json` by hand wo

## R18 [minor] (interp) trim/ltrim/rtrim (and the string branches of toInteger/toFloat) use JS's Unicode whitespace set, not Java's

- **Location:** `src/cypher-interp/functions.ts:172`
- **Scenario:** `trim(' Order')`: JS String.prototype.trim strips NO-BREAK SPACE, U+FEFF, U+2007 and U+202F, giving 'Order'. Neo4j's string trim strips code points where Character.isWhitespace is true, which excludes those characters, so it returns ' Order'. The reverse also happens: `trim('\u001fX')` is unchanged in JS but becomes 'X' in Neo4j, because isWhitespace(U+001F) is true. toIntegerOf and toFloatOf (lines 45-56) call `v.trim()` before parsing, so `toInteger(' 12')` returns 12 here. Template impact: none today, since no template calls trim, ltrim, rtrim, toInteger or toFloat on strings (toFloat is only applied to integer counts).
- **Evidence:** functions.ts:172-174 call `.trim()`, `.trimStart()` and `.trimEnd()`; :45 and :54 `const t = v.trim();`.
- **Suggested fix:** Implement trim as a code-point loop over Java's Character.isWhitespace set: Unicode Zs/Zl/Zp minus U+00A0, U+2007 and U+202F, plus U+0009-U+000D and U+001C-U+001F. Use the same set, or no trimming if 5.26 does not trim, in toInteger and toFloat after checking on live Neo4j.
- **Verifier:** I couldn't refute this one. The code is as cited. In src/cypher-interp/functions.ts:172-174, trim, ltrim and rtrim call JS String.prototype.trim(), trimStart() and trimEnd(). Lines 45 and 54 call v.trim() before toInteger and toFloat parse a string.

JS trim removes ECMAScript WhiteSpace plus LineTerminator. That set includes U+00A0, U+FEFF, U+2007, U+202F and the other Zs characters, and it leaves out U+001C to U+001F. Neo4j's TextValue trim works per code point using Character.isWhitespace. That check excludes the no-break spaces U+00A0, U+2007 and U+202F, and it includes U+001C to U+001F. So trim(' Order') returns 'Order' here but ' Order' in Neo4j, and trim('\u001FX') goes the other way. The difference is real but narrow, and the interpreter doesn't flag or reject these cases.

It has no effect today. My grep found no cypher-interp template that calls trim, ltrim, rtrim, toInteger or toFloat on a string; every .trim() hit outside cypher-interp is ordinary TypeScript. Only unusual Unicode input reaches the divergence, and only through templates that don't exist yet. Severity is minor, as claimed.

## R19 [minor] (judge) Grounding counts lines of files the prompt truncated or never showed

- **Location:** `src/llm-critic/filter-explain.ts:204`
- **Scenario:** A finding whose first shown file is larger than FE_SOURCE_BUDGET_CHARS (96,000 chars). buildFilterExplainPrompt cuts the body and appends [truncated], then `break`s, so the second file is never put in the prompt. checkGrounding builds `count` from the full content of every input file. A citation of file 2 (never shown to the model), or of file 1 past the cut, therefore passes as grounded, though the persona says 'Cite code only by the file paths and line numbers shown'.
- **Evidence:** filter-explain.ts:150-159: the body is sliced to `remaining` and the loop breaks at `remaining <= 0`. Line 204 counts lines over all `files` from the full content. scripts/v1.3/filter-explain-run.ts:139-143 stores the full `shown` list with the prompt, and line 245-246 passes it to outcomeOf.
- **Suggested fix:** Have buildFilterExplainPrompt return the files and line counts it actually rendered, and pass those to checkGrounding.
- **Verifier:** I read the code and the claim holds. In src/llm-critic/filter-explain.ts, buildFilterExplainPrompt (lines 150-159) shortens the line-numbered body to `remaining` characters when the body is too long. FE_SOURCE_BUDGET_CHARS is 24000 * CHARS_PER_TOKEN, 96k characters by the claim's figure. The shortened body gets the [truncated] marker, and the loop `break`s once `remaining <= 0`, so files after that point are never put in the prompt. checkGrounding (line 204) still builds `count` from the full content of every file in `files`, and the `maxLines` check for bare 'line N' text uses the same counts. The only caller outside the tests is scripts/v1.3/filter-explain-run.ts. It stores the full `shown` list with the prompt (line 139-143) and passes it to outcomeOf in score() (line 246), so the counts are never trimmed to what the model actually saw. Concrete case: file 1 has about 3,000 lines and its numbered body is over 96k characters. The model sees only its first few thousand lines and nothing of file 2. A citation of file1:2800 or file2:10 still counts as grounded, and a grounded 'dismiss' drops the finding (findingKept). This breaks the rule the code itself sets: cite only files and lines that were shown. It is minor because it needs a file larger than about 96k characters in an FE project fixture. When that happens the effect is limited to accepting some citations that should have been rejected.

## R20 [minor] (judge) Bare 'line N' references are checked against the longest shown file, not the file they refer to

- **Location:** `src/llm-critic/filter-explain.ts:221`
- **Scenario:** Shown files: src/domain/order.ts (40 lines, the finding's file) and src/infra/repo.ts (300 lines). The explanation says 'order.ts calls the ORM at line 212'. That is not a path:line token (there is a space), so only the bare-line check applies, and it accepts any N <= maxLines = 300. The fabricated line reference counts as grounded.
- **Evidence:** filter-explain.ts:205 has `const maxLines = Math.max(0, ...count.values())`. Lines 221-225 compare only against maxLines.
- **Suggested fix:** Treat a bare line reference as ungrounded when more than one file is shown, unless it is attributable to one file. At minimum, check it against the finding's own file.
- **Verifier:** The scenario can happen with the code as written, but it is a known, documented limit of a heuristic check rather than an accidental bug.

How the code behaves: in src/llm-critic/filter-explain.ts:204-205, `count` maps each shown file to its line count and `maxLines` is the largest of those counts. The path:line regex at line 214 needs `file.ts:N` with no space, so "order.ts calls the ORM at line 212" is not matched there. The only check that applies is the bare-line loop at lines 220-224, which rejects a number only when `a < 1` or `max(a,b) > maxLines`. With order.ts at 40 lines and repo.ts at 300, line 212 passes and the answer counts as grounded.

The setup is realistic. scripts/v1.3/filter-explain-run.ts:121-139 builds the shown files from the violation's filePath (which can hold several comma-separated paths) plus `viol.target`. So a dependency finding regularly shows a source file and a target file of different lengths.

Why only minor:
1. The behavior is intended and documented. The checkGrounding docstring at filter-explain.ts:199 says "every bare `line N` / `lines N-M` lies within the longest shown file". A bare reference does not say which file it means, so this is a deliberate loose bound.
2. The structured citations, which are required when files are shown, are still checked against their own file (lines 207-211). A fabricated citation is still caught.
3. The only effect is a false negative in a guardrail: a dismiss or confirm whose prose contains a made-up bare 

## R21 [minor] (mcp) check-file CLI exit code uses the legacy verdict, which ignores the v1.3 fast-rule findings: exit 0 'clean' while blockingVerdict is 'block'

- **Location:** `src/mcp-server/check-file-cli.ts:46`
- **Scenario:** A proposed file whose only blocking finding comes from a fast rule (an import cycle with --project, core isolation, aggregate boundary, constructor-injected infrastructure in the domain). checkSource puts these in `findings` but not in `violations`. verdict = verdictOf(violations) is 'clean' and the summary reads '...: clean.', so the CLI (an npm script) exits 0, while blockingVerdict is 'block' and evaluate_project would count the violation.
- **Evidence:** check-file-cli.ts:46 `return res.data.verdict === 'clean' ? 0 : 1;`; file-check.ts:383 sets violations from base only, file-check.ts:384 sets findings including the fast rules, and file-check.ts:407 sets verdict from violations while file-check.ts:402 sets blockingVerdict from findings.
- **Suggested fix:** Exit on blockingVerdict ('pass' -> 0, else 1), or compute the legacy verdict from findings.
- **Verifier:** I could not refute this. The code does what the claim says.

- check-file-cli.ts:46 sets the exit code from the legacy field only: `return res.data.verdict === 'clean' ? 0 : 1;`.
- In file-check.ts, `base` collects only spec import violations and naming violations (around lines 340-362). The v1.3 fast-rule findings from `fastRuleFindings` go into `all`/`findings` only (lines 365-384).
- `verdict` comes from `verdictOf(violations, ...)`, built from `base` (line 407). `blockingVerdict` comes from `blockingVerdictOf(findings, ...)` (lines 299 and 402). `blockingVerdictOf` returns 'block' whenever any finding has tier 'blocking'.

Failure scenario: a file whose only blocking finding comes from a fast rule, such as core isolation, an aggregate boundary breach, or infrastructure injected through a domain constructor. Its output has blockingVerdict 'block', but verdict is 'clean' and the summary ends in 'clean.', so `npm run mcp:check-file` exits 0. The same split also misfires the other way: a base violation whose tier is advisory gives exit 1 even though blockingVerdict is 'pass'.

This contradicts the tool's own contract. server.ts:236 says "Act on blockingVerdict", and diff-check and tools.ts (line 148) both use blocking tiers. The CLI tests (file-check.test.ts:249-272) only cover a base import violation (exit 1), a clean file (exit 0) and a usage error (exit 2), so nothing catches this.

Severity is minor. This is a local try-out CLI and the JSON it prints still includes the co

## R22 [minor] (mcp) check_diff paths are git-root-relative while layer globs are project-relative: with --project in a subdirectory every file has no layer and the diff passes

- **Location:** `src/mcp-server/diff-check.ts:37`
- **Scenario:** Monorepo with the server started with --project /repo/packages/app. `git diff` emits `+++ b/packages/app/src/domain/Order.ts`. stripPrefix yields 'packages/app/src/domain/Order.ts'. resolveLayer finds no layer (the globs are src/domain/**), view.read misses, so rebuild fails and the check falls back to added lines, then layer === null skips the import rules. The result is blockingVerdict 'pass' with only a 'no layer glob matches' note, while evaluate_project on packages/app flags the same import.
- **Evidence:** diff-check.ts:34-38 stripPrefix only strips a/ and b/; diff-check.ts:194 and diff-check.ts:221 use the paths as project-relative; file-check.ts:347 skips layer rules for a null layer.
- **Suggested fix:** Strip the project root's offset from the git toplevel (or try paths relative to the root when the literal path matches no file and no layer), and return 'unknown' rather than 'pass' for source files that match no layer.
- **Verifier:** I could not refute this. The code works as the claim describes.

- **No path rewriting.** stripPrefix (diff-check.ts:34-38) only removes a leading `a/` or `b/` and normalises the rest. checkDiff (diff-check.ts:191-222) passes those paths unchanged into ProjectView.read, into the before/after overrides and into checkSource. checkDiffTool (tools.ts:209-219) passes ctx.defaultProjectPath as projectRoot and never makes diff paths relative to it. check_file does have that step (tools.ts:96-100 makes paths relative to the project), but check_diff does not use it.
- **The tool contract does not warn about this.** The check_diff description and schema (server.ts:118-120, 244-249) just ask for "git diff or diff -u output". They say nothing about project-relative paths or `git diff --relative`. Plain `git diff` run from a monorepo subdirectory still prints repo-root-relative paths, so `+++ b/packages/app/src/domain/Order.ts` is the normal input.

What happens with `--project /repo/packages/app` and a spec glob of `src/domain/**`:

1. ProjectView.read resolves `/repo/packages/app/packages/app/src/...`. That file does not exist, so rebuild returns undefined and the check falls back to added lines only.
2. checkSource gets `packages/app/src/domain/Order.ts`. resolveLayer finds no matching layer, so layer is null, and file-check.ts:347 (`if (layer === null) continue;`) skips every layer and import violation.
3. An added file has the same problem, because its path is also root-relative.

Th

## R23 [minor] (mcp) Loop plan never checks that the daedalus-mcp server's spec matches the evaluator spec, so the MCP advice and the scoring can use different rules

- **Location:** `scripts/lib/loop/plan.ts:163`
- **Scenario:** A plan with arms ['none','daedalus-mcp','gate'], evaluatorSpec 'specs/clean-arch.yaml' and daedalus.specPath '/abs/presets/clean-architecture.yaml' (or a stale copy). validatePlan accepts it. In the MCP arm the agent's check_file uses one spec (agents.ts:268, arms.ts:162 `--spec input.specPath`), while every snapshot is scored with plan.evaluatorSpec (main.ts:306). The tool says 'pass' on code that the evaluation counts as blocking, which confounds the arm comparison. The taskProfiles guard at plan.ts:134 covers only the per-task case.
- **Evidence:** plan.ts:163-165 requires only that a daedalus block exists; there is no path or sha256 comparison between daedalus.specPath and evaluatorSpec anywhere in plan.ts or main.ts:277-306.
- **Suggested fix:** In validation or liveWiring, require that the daedalus.specPath content sha256 equals the evaluatorSpec sha256, and record both hashes in run.json.
- **Verifier:** I read the code and the claim holds as written. In plan.ts:163-165, validatePlan only checks that a `daedalus` block exists when the arms include daedalus-mcp. It never checks the block's fields, and it never compares `daedalus.specPath` with `evaluatorSpec`. In main.ts:277, liveWiring passes `plan.daedalus` straight to the agents. In agents.ts:268, the MCP server is started with `--spec input.specPath`. Every snapshot, though, is scored by `firewallEvaluator(path.resolve(repoRoot, plan.evaluatorSpec))` (main.ts:303). Nothing hashes the MCP spec or checks it against the evaluator spec.

The code clearly intends the two specs to be the same. plan.ts:134 rejects taskProfiles combined with daedalus-mcp with the message 'its MCP server has one spec'. That guard only catches different specs per task. It does not catch a global mismatch.

The repo's own demo plan (experiments/loop-demo/plan.dry-run.json) uses two different path strings: an absolute `/opt/daedalus/specs/clean-arch.yaml` for the MCP server and a relative `specs/clean-arch.yaml` for the evaluator. If those files differ (a stale copy, or another preset), validatePlan accepts the plan. The MCP arm's check_file then gives advice under one rule set while the score uses another, which confounds the comparison between arms.

The severity is minor. This is a missing consistency guard on operator config, not a logic error in normal use, and it only matters when the operator points the two paths at different content.

## R24 [minor] (measure) Baseline reference doc still reports FF-P06 N/A rows as blocking TPs, with 'met' verdicts and no correction note or development-set banner

- **Location:** `Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md:24`
- **Scenario:** PR #120 added the FF-P06 correction note and the development-set banner to the after-fixes and after-member-facts docs only; its diffstat does not touch the baseline doc. The baseline 'Headline against the exit targets' tables (lines 24-45) still give author recall 13/13, 11/11 and 13/13 and pooled 55/57, plus precision 13/14 and 55/110. All of these count the 3 FLOWS_TO rows as TPs (corrected: 52/54 and 52/107). The Target column says 'met vs author' / 'met' with no 'development set (not a validity estimate)' qualifier. A reader who cites the baseline doc directly gets the uncorrected figures and validity-style wording.
- **Evidence:** grep finds no 'Correction' or 'DEVELOPMENT-SET' text in the baseline doc. Lines 30-45 have cells such as '| nestjs | 0.91 (10/11) | 1.00 (11/11) | ... | met |'. results/v1.3-reference/baseline-pre-barrel/scores.json has FF-P06 tp=1 for clean-architecture, nestjs and hexagonal in the author and blind-expanded views. ffp06-na-recount.mjs, cited in the after-member-facts correction, already computes the corrected baseline 52/54 and 52/107.
- **Suggested fix:** Add the same Correction (2026-10-16) note and DEVELOPMENT-SET banner at the top of the baseline doc, pointing to the after-member-facts correction tables, and qualify each 'met' as development-set.
- **Verifier:** The facts in the claim check out at b08ec387. The baseline doc Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md has no "Correction" text, no DEVELOPMENT-SET banner and no mention of the N/A FLOWS_TO rows. Its headline tables (lines 24-45) give author-normalised recall 13/13, 11/11 and 13/13, pooled 55/57, and precision 13/14 and 55/110. The per-rule table at line 91 scores FF-P06 as 1/0/0 (a TP) for clean, nestjs and hexagonal. Both sibling docs carry the correction. after-fixes.md:3-5 has the note and the banner. after-member-facts.md:3-43 has the full corrected baseline figures (52/54, 52/107; per style 12/12, 10/10, 12/12) and says to quote 54/54, not 57/57. So the baseline doc contradicts the project's own published correction, and a reader who cites it directly gets the stale figures.

I downgrade it from major to minor because no verdict changes. With the correction, clean is 12/12, nestjs 10/10 and hexagonal 12/12 recall. Normalised precision is 12/13 = 0.92 for clean and hexagonal and 10/10 for nestjs. Every "met" or "missed" cell stays the same, and the pooled precision is still missed (52/107). The baseline doc also already cautions that no Wilson lower bound reaches 0.90 (around line 58). What is wrong is a set of stale numbers and a missing caveat note, not a wrong conclusion. The corrected figures are already published two documents over.

## R25 [minor] (measure) Labelling doc headline correctness counts disagree with the committed correctness.json (1,484/179/2,668 vs 1,485/178/2,669)

- **Location:** `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md:6`
- **Scenario:** The summary (line 6) and the totals line (line 82) give 1,484 correct and 179 not-checkable reference findings, and 2,668 checkable in all. The committed per-rule summary sums to 1,485 correct and 178 not-checkable (1,485 + 178 = 1,663), so the true total is 2,669. The repro audit logged this as E-7 on 2026-10-16, but the doc at b08ec387 was not corrected. The audit's evidence path also names a file that does not exist (results/v1.3-labelling/reference/correctness.json; the real file is under correctness-all/).
- **Evidence:** jq '[.summary[]|.correct]|add' on results/v1.3-labelling/reference/correctness-all/correctness.json returns 1485. Summing .notCheckable over the per-rule rows gives 3+30+120+14+1+1+3+1+2+3 = 178. Doc line 82: 'Totals: 1,663 findings, 1,484 correct, 0 incorrect, 179 not-checkable.' Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md:101 cites `results/v1.3-labelling/reference/correctness.json`, which is missing.
- **Suggested fix:** Change lines 6 and 82 to 1,485 / 178 / 2,669, and correct the repro-audit evidence path to correctness-all/correctness.json.
- **Verifier:** I tried to refute the claim and could not. At b08ec387, the committed results/v1.3-labelling/reference/correctness-all/correctness.json has 1,663 rows in total, 0 incorrect, 1,485 correct (from summary[].correct, and also from counting results[] with verdict "correct") and 178 not-checkable.

The doc's own per-rule table in §2 agrees with the JSON:
- Blocking correct: 54 (1+2+1+1+2+1+7+2+2+11+6+5+5+3+5).
- Advisory correct: 2 + 1426 + 3 = 1,431.
- Total correct: 1,485.
- Not-checkable: 3+3+30+120+14+1+1+3+1+2 = 178.

But Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md line 6 says "All 2,668 checkable findings ... 1,484 of 1,663", and line 82 says "1,484 correct, 0 incorrect, 179 not-checkable". The right figures are 1,485 + 1,184 = 2,669 checkable and 178 not-checkable. The doc has had one commit (2c1098c7) and was never corrected, even though the repro audit logs this as E-7.

The audit's evidence path at line 101, results/v1.3-labelling/reference/correctness.json, is also not a tracked file. git ls-files shows only correctness-all/correctness.json.

The conclusion (0 incorrect, all checkable findings correct, 54/54 blocking) still holds, so this is an off-by-one in cited headline numbers. Severity is minor.

## R26 [minor] (measure) Filter-and-explain scores the 3 FF-P06 FLOWS_TO N/A rows as blocking true positives, after the N/A correction was made

- **Location:** `scripts/v1.3/filter-explain-run.ts:82`
- **Scenario:** SCORED_TIER maps 'FF-P06' to 'blocking', and line 130 labels any manifest-matched row 'true' whatever its discriminator half. So the 3 field-initialiser FF-P06 rows (LoanPolicy.ts, registration-policy.ts, AvailabilityChecker.ts), which rule-tiers.md and the 2026-10-16 correction call N/A, go into the FR-V8 precision and recall figures as blocking TPs. Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md:133-146 (written 2026-10-16, after PR #120) reports 66 true rows, 'all 52 blocking-tier rows (52/52)', precision 66/68 to 65/66 and recall kept 65/66. With the N/A rule applied these become 63 true, 49/49 blocking, 63/65 to 62/63, and 62/63.
- **Evidence:** results/v1.3-judge-v2/filter-explain/scores.json: 66 rows with label 'true', 52 of them tier 'blocking', and 3 with functionId FF-P06 (label true, tier blocking, decision confirm) on src/domain/services/LoanPolicy.ts, src/domain/registration-policy.ts and src/domain/services/AvailabilityChecker.ts. The summary has tp0=66, fp0=2, tp1=65.
- **Suggested fix:** Label FF-P06 rows whose discriminator[2] is FLOWS_TO (or HOLDS_STATE_OF) as 'n/a' and leave them out of the true/false counts. Re-score from answers.json (no new calls are needed) and correct §4 of the judge-v2 doc.
- **Verifier:** I could not refute this. In scripts/v1.3/filter-explain-run.ts, line 82 maps FF-P06 to 'blocking'. Line 130 labels a row 'true' whenever the reference report.json matched it, and nothing checks which half of FF-P06 produced the row. The script never mentions N/A, FLOWS_TO or discriminator[2].

The three rows in question are clean v08 #2, nestjs v10 #2 and hexagonal v10 #2. Their evidence files in results/v1.3-reference/after-member-facts/evidence say 'via FLOWS_TO' and carry discriminator [.., .., 'FLOWS_TO', ..]. That is the field half, and three documents say that half is reported N/A:
- Docs/v1.3/rule-tiers.md:30 ("that half is reported N/A ... Only the constructor-injection half is valid");
- the 2026-10-16 correction at the top of Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md, which names these same three files;
- Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md.

Other v1.3 scripts already leave these rows out: scripts/v1.3/ise-e1.ts:56 and scripts/v1.3/lib/mcp-consistency.ts:8/69. Here they were scored as blocking TPs. scores.json shows them as label true, tier blocking, decision confirm, and its summary has tp0=66, fp0=2, tp1=65. scores.md:38 lists FF-P06 true 3/3. Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md section 4 reports 66 true rows and "all 52 blocking-tier rows (52/52)" and does not mention the N/A rule anywhere.

With the N/A rule applied the figures are 63 true, 49/49 blocking, precision 63/65 before and 62/63 after, and r

## R27 [minor] (measure) Round-2 judge-catch doc says '14 informative seeds' but its own breakdown is 13 + 3 = 16 seeds

- **Location:** `Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md:167`
- **Scenario:** The line reads 'leaves 14 informative seeds: 10/13 FRAMEWORK-LEAK and 3/3 PERSIST-IN-DOMAIN. Pooled, that is 13/16'. The denominators add to 16 and the pooled fraction is over 16, so '14' is wrong. This sentence is the source of the 'defensible claim' quoted in the headline notes of both judge-catch docs.
- **Evidence:** round2/scores.json combined.catch: FRAMEWORK-LEAK 10/13 = 0.77 [0.50, 0.92] and PERSIST-IN-DOMAIN 3/3. 13 + 3 = 16 seeds.
- **Suggested fix:** Change '14 informative seeds' to '16 informative seeds'.
- **Verifier:** The defect is real. Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md:167 says "leaves 14 informative seeds: 10/13 FRAMEWORK-LEAK and 3/3 PERSIST-IN-DOMAIN. Pooled, that is 13/16 = 0.81 [0.57, 0.93]". The breakdown on that line has denominators 13 + 3 = 16, and the pooled fraction is also over 16. The headline note at line 4 of this doc, and the same note in v1.3-judge-catch-2026-10-15.md and v1.3-duprule-v2-2026-10-15.md, all give 10/13 + 3/3 = 13/16. The repro audit (group-D.md:135) also records the discounted figure as 13/16. So "14" is wrong, and it should say 16. One possible source of the 14: the operator stratum has n = 16, and taking away a 2-seed pair from that gives 14. But that arithmetic does not match the strata breakdown this sentence actually gives. The ratio and the CI (13/16, 0.81 [0.57, 0.93]) are correct, so no number or conclusion that follows from it changes. Only the seed count in the prose is wrong. Severity: minor.

## R28 [minor] (measure) Round-1 judge-catch doc keeps 'Point estimate: met' and the wrong '10 of the 11 seeds' after PR #120

- **Location:** `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:114`
- **Scenario:** §5 still opens with '**Point estimate: met.** The pooled catch rate is 9/11 = 0.82' against the 0.80 exit target. That is a development-set point estimate on 11 seeds, all on one fixture, with a Wilson lower bound of 0.52. The header note added by PR #120 says the defensible claim is 16/21 = 0.76, below the target, which contradicts the bold 'met'. Lines 9 and 117 say '10 of the 11 seeds sit on one small fixture'. The doc's own §1 site table and the repro audit (D-1, plan.json) show 11 of 11 on antipattern-nest, so the doc understates the clustering.
- **Evidence:** Line 114: '- **Point estimate: met.** The pooled catch rate is 9/11 = 0.82'. Line 117: '10 of the 11 seeds sit on one 8-file fixture'. Line 9 repeats it. In the §1 table AP-REPO-BYPASS is 0/0 on every reference project and 4/4 on antipattern-nest. Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md D-1: '11 of 11, all on antipattern-nest'.
- **Suggested fix:** Replace 'met' with 'point estimate above 0.80 on the development set; not demonstrated (lower bound 0.52)', and change '10 of the 11' to '11 of 11' on lines 9 and 117.
- **Verifier:** Partly confirmed. I checked the doc at b08ec387.

**The "10 of the 11" count is wrong.** Lines 9 and 117 of Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md say "10 of the 11 seeds sit on one ... fixture". The doc's own §1 table disagrees. Every non-twin operator has 0 eligible sites on all five reference projects. All the seeds are on antipattern-nest: REPO-BYPASS 4, FAT-CONTROLLER 1, PERSIST-IN-DOMAIN 1, DUP-RULE 1 and FRAMEWORK-LEAK 4, which is 11. The §4 seed table also sums to 11.
- The repro audit already records this as a doc typo: v1.3-repro-audit-2026-10-16.md:90 (D-1) and group-D.md:42,277 say it should be 11 of 11, with seed-manifest.json and plan.json as evidence.
- The commit that added the header note (18639f79, review M3) did not fix lines 9 or 117.
- The same wrong count was copied into cheap-semantics-2026-10-15.md:3.
- So the doc as written understates how clustered the seeds are.

**The "Point estimate: met" part is weaker.** Line 114 reports round 1 only: 9/11 = 0.82, which is at or above 0.80, so the sentence is arithmetically true. The very next bullet says "Not demonstrated" and gives a Wilson lower bound of 0.52. The header note gives a different, restricted number (16/21, two operators, both rounds) and states that the lower bounds do not reach 0.80. The two passages measure different things, so this is a framing tension, not a false statement.

Severity is minor: a documentation count error with no effect on code or verdicts. The 11-of-11 correctio

## R29 [minor] (measure) Author-audit correctness agreement counts every non-'yes' answer (uncertain, n/a, typos) as 'incorrect'

- **Location:** `scripts/v1.3/lib/labelling/audit.ts:239`
- **Scenario:** In auditAgreement, any non-empty `correct` answer that is not exactly 'yes' maps to 'incorrect': `c === 'yes' ? 'correct' : 'incorrect'`. If the author writes 'uncertain', 'n/a', 'y' or 'unsure' for an item that the checker marks correct, the pair becomes an (incorrect, correct) disagreement. That lowers the correctness κ and observed agreement, while invalid answers are silently skipped on the meaningful side. Example: 30 items, all checker-correct, author answers 'yes' on 25 and 'uncertain' on 5. Reported agreement is 25/30, when the 5 should be left out.
- **Evidence:** audit.ts:237-239: `const c = norm(a?.correct); const v = correctnessOf?.get(k.key); if (c !== '' && (v === 'correct' || v === 'incorrect')) correctness.push([c === 'yes' ? 'correct' : 'incorrect', v]);`. answersTemplate leaves the `correct` column free-text.
- **Suggested fix:** Map only 'yes' to correct and 'no' to incorrect. Report other values as unmatched or unanswered instead of counting them as 'incorrect'.
- **Verifier:** The defect is real, but its impact is limited.

What the code does:
- In scripts/v1.3/lib/labelling/audit.ts:237-239, any non-empty `correct` answer other than 'yes' becomes 'incorrect' (`c === 'yes' ? 'correct' : 'incorrect'`). That includes 'uncertain', 'n/a', 'y' and 'unsure'.
- The `meaningful` column is handled differently. agreement() (audit.ts:185-193) quietly drops any pair whose value is not in the category list, so an invalid meaningful answer is left out rather than counted as a disagreement.
- Nothing checks the answers before scoring. answersTemplate (audit.ts:142) leaves the column empty, and the only caller, mains.ts:350-353, passes the CSV rows straight into auditAgreement.

Why the scenario can happen: the blind sheet (audit.ts:126-127) asks for yes/no on `correct`, but it allows 'uncertain' on `meaningful` in the same sentence. An author could easily write 'uncertain' in both columns, or type 'y'. Each such answer is scored as an (incorrect, correct) disagreement when it should have been left out or rejected. In the claimed example (25 'yes' and 5 'uncertain', all marked correct by the checker), observed agreement drops to 25/30, and those 5 items are no longer an all-agree table.

Why it is only minor:
- The instructions do say yes/no, so the author has to break them for this to happen.
- The correctness agreement is reported only. The labeller validity gate uses the three-way meaningful κ alone (audit.ts:246), and the CLI never prints the correctness numbe

## R30 [minor] (switches) Compile-time switches still apply under --scoring v1.2e, while the row stage and tier overrides are skipped

- **Location:** `src/pipeline/commands/compile-command.ts:35`
- **Scenario:** Set Q24 B and run `evaluate --scoring v1.2e` on a clean-architecture spec. CompileCommand always compiles with V13_COMPILE_OPTIONS, which carries constructSwitches: CONSTRUCT_ANSWERS. So FF-S03 (no-layer-skip, normally disabled outside layered) is renamed to the carrier and compiled as an executed function that always passes with 0 rows. The row stage that would fill it is gated on scoringMode 'v1.3' (pipeline-factory.ts:170), so the registered v1.2E AHS gains a passing critical structural function and its structural AVR rises. Other switches leak the same way. Q13 C reorders the nestjs layers, so FF-S01 rows change (doc: P 10/68). Q16 B adds FF-S02 to ddd. Q5 D / Q17 C add empty carriers, and the adapter rows are never moved. So a v1.2E-scored run is silently half-switched, against the switch file's contract that the switches are read only under the v1.3 options and the v1.3 scoring mode.
- **Evidence:** compile-command.ts:35 `compileFunctions(compilerInputFromSpec(parsedSpec), { ...V13_COMPILE_OPTIONS, instrumentVersion })`, with no scoringMode check. fitness-compiler.ts:97-98 has V13_COMPILE_OPTIONS include `constructSwitches: CONSTRUCT_ANSWERS`. pipeline-factory.ts:170 runs the row stage only when `config.scoringMode === 'v1.3'`, and :291 does the same for the tier resolver. construct-switches.ts:5-7 says the switches are read only under the v1.3 options.
- **Suggested fix:** Pass constructSwitches to the compile only when scoringMode is 'v1.3' (give CompileCommand the scoring mode), so the compile, row and tier hooks are gated together.
- **Verifier:** The defect is real in the code, but it is latent today. I could not refute the mechanism.

- `src/pipeline/commands/compile-command.ts:35` always compiles with `{ ...V13_COMPILE_OPTIONS, instrumentVersion }`, whatever the scoring mode. `CompileCommand` is built at `pipeline-factory.ts:166` with only `instrumentVersion`, so it is never told the scoring mode.
- `fitness-compiler.ts:98` puts `constructSwitches: CONSTRUCT_ANSWERS` inside `V13_COMPILE_OPTIONS`. `fitness-compiler.ts:113` runs `applyConstructCompileOverlays`, `:130` adds the carrier template, and `:173` applies `constructApplicability`.
- The row stage (`pipeline-factory.ts:170`) and the tier resolver (`:291`) run only when `scoringMode === 'v1.3'`. Under `--scoring v1.2e` the compile overlays still apply, but nothing fills the carriers.
- Concrete case: with Q24 B on a clean-architecture spec, `compile.ts` renames FF-S03 to `construct-switch-carrier`. Its template is `WHERE false`, so it returns no rows and the function is compiled and executed as a pass. A v1.2e-scored run then gains a passing critical structural function.
- The same leak applies to Q5 D and Q17 C (empty carriers), Q16 B (FF-S02 added to ddd), Q13 C (nestjs layer reorder), Q25 B (excludes) and the Q1/Q10 applicability changes.
- This contradicts the contract in `construct-switches.ts:5-7` and `Docs/v1.3/construct-switches.md`, which say the switches are read only under the v1.3 options together with the v1.3 row stage and tiers.

Why the severity 

## R31 [minor] (switches) Answer script accepts Q13 C without Q25 B, although the docs call that combination incoherent

- **Location:** `scripts/v1.3/lib/construct-answers.ts:151`
- **Scenario:** The author answers {"Q13": "C"} and leaves Q25 unanswered (so it stays at A). parseAnswersDocument and signOffLines accept it. The only combination caveat printed is the Q16/Q25 'one development-set run' note. The switch file is written with Q13 C alone, and the nestjs re-run then turns every *.module.ts that wires a repository into an FF-S01 row (doc: blocking P 10/68). The answer sheet (line 444: 'If you choose C here, answer B in Q25') and construct-switches.md:107 state the dependency, but nothing enforces or warns about it.
- **Evidence:** construct-answers.ts:151 `const caveat = (['Q16', 'Q25'] as const).filter((q) => parsed.answers[q] === 'B');`, with no Q13/Q25 check anywhere in parseAnswersDocument or signOffLines. compile.ts:73-75 applies cleanOrder without checking Q25.
- **Suggested fix:** In parseAnswersDocument, warn (or refuse) when answers.Q13 === 'C' && answers.Q25 !== 'B', and print it among the sign-off lines.
- **Verifier:** The claim holds: the code never checks for Q13 C without Q25 B. The docs call this combination incoherent and the code never flags it.

- **Parser and sign-off:** In scripts/v1.3/lib/construct-answers.ts, parseAnswersDocument (lines 74-98) only checks each answer on its own. It rejects an option the question does not offer and warns about unknown or duplicate entries, but it never compares two answers. signOffLines prints one combination caveat (line 151), for Q16 B and Q25 B, and nothing about Q13 or Q25.
- **Catalogue:** The Q13 entry in src/shared/construct-switch-catalogue.ts:133-139 has an actionItem and ADR text, and neither mentions Q25.
- **Apply script:** scripts/v1.3/apply-construct-answers.ts only passes the parser's warnings to stderr.
- **Compile:** src/construct-switches/compile.ts:73-75 reorders the nestjs layers whenever Q13 is C. It applies the Q25 B exemption separately (line 85) and never checks Q25 when Q13 is C.

So the input {"Q13":"C"} is accepted with Q25 left at A, the switch file is written, and no warning appears. The docs state the dependency outright. Docs/v1.3/construct-decisions-answer-sheet.md:444 says "C is only coherent together with Q25 B ... If you choose C here, answer B in Q25". Docs/v1.3/construct-switches.md:107-108 says Q13 C alone gives an FF-S01 row for every *.module.ts that wires a repository, with nestjs blocking P at 10/68.

Why it matters: the development-set re-run is meant to happen once, with no second tuning loop. An unflagg
