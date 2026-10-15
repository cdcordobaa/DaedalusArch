# v1.3 fix round after the U-E baseline (unit U-E2): reasons, written before re-measuring

Branch `v1.3-fixes`, cut from `origin/v1.3` @ `9542356b` (the barrel fix #85 and the U-E baseline #86). This is **development tuning on the 71-case reference set**. Each behaviour change below has its construct reason. Every reason here was written and committed **before** the after-fix validation run. The only exceptions are the lock (fix 1) and the barrels-only intermediate run (§7): they change no tool behaviour, and the intermediate run measured the code as merged.

The manifests, the sealed files (`Docs/v1.3/rule-tiers.md`, `style-rule-sources.md`, `sealed-hashes.md`), the presets and the frozen template text are not edited.

## 1. Neo4j isolation (validity)

- **Problem.** Neo4j community has one user database, and every ingestion wipes it. The baseline's first live run picked up another worktree's DDD rows, and the runner raised no error.
- **Search.** No lock helper existed in the repo. The only `'wx'` use is a one-shot manifest write.
- **Change.** `src/shared/process/neo4j-lock.ts`:
  - **Lock file.** One file per `host:port`, in `~/.daedalus/locks/`, outside every worktree (override: `DAEDALUS_NEO4J_LOCK_DIR`). Created with `'wx'`; it holds the pid, host, label and a random token.
  - **Stale detection.** A lock is stale when its pid is dead. The directory is per machine, so the pid is checked whatever host name the file records (a macOS host name follows the network). It is broken under a short-lived breaker file, and only if the file still holds the token that was seen dead.
  - **Re-entrancy.** The lock counts as held for the holder and for its descendants. A run that holds the lock spawns `firewall evaluate` children, and they do not wait for it.
  - **Release.** Only by token, and also from an exit handler.
  - **Off switch.** `DAEDALUS_NEO4J_LOCK=off`.
- **Who acquires it:**
  - **Every ingestion + evaluation.** The pipeline's `Neo4jRepository` (`lock: true` in `createPipeline`) holds the lock from its first query (the graph wipe) to `cleanup()`. This covers `evaluate`, batch, drift and the MCP `evaluate_project`. The MCP reachability probe (`RETURN 1`) does not lock.
  - **The validation runner.** `validate-reference` live mode (and `ue-baseline-live.ts`, which calls it) holds the lock for the whole run, so nothing can interleave between two variants either.
  - **Every Neo4j-using test.** `tests/setup/neo4j-lock.setup.ts`, a `setupFilesAfterEnv` of every jest config. A suite holds the lock from `beforeAll` to `afterAll` when `NEO4J_PASSWORD` is set and its source names `resolveGoldenEnv`, `NEO4J_PASSWORD` or `neo4j-driver`. Two jest workers are two processes, so their Neo4j suites serialise too.
- **Not chosen.** A database or namespace per run: community has no multi-database support, and a container per run is not cheap.
- **Tests:**
  - `tests/unit/shared/process/neo4j-lock.test.ts`: two concurrent processes never overlap; another database does not wait; timeout; a descendant is re-entrant; a stale lock is broken; release only by the owner.
  - `tests/unit/neo4j-ingestion/neo4j-repository-lock.test.ts`: the repository holds the lock from the first query to `close()`; a lock it cannot get is a failed query, never a query on a shared database.

## 2. Cycle matching in validate-reference (scoring code)

- **Problem.** The tool's FF-S02 row puts the cycle path in `file` (`"a.ts,b.ts,a.ts"`) and the second file in `target`. The manifest names the smallest file and the next one.
- **Construct.** A cycle is a **set of files** (ADP: the component dependency graph has no cycle). It is not a path and not a key file.
- **Change.** `scripts/v1.3/lib/compare.ts` matches FF-S02 on the sorted, deduplicated set of the files in `file` and `target`. The clean-variant key (`alsoOnClean`) uses the same set.
- **Unchanged.** The tool's row and the manifests.
- **Effect on the views.** `ue-score.ts` already reported this reading as its `author-cycle-normalised` view, so after the change the runner's `report.md` equals that view. The `author-literal` view of `ue-score.ts` keeps the old literal key, for comparison with the baseline.
- **Expected.** The 5 FF-S02 misses and the 5 FF-S02 false positives become 5 matches. Nothing else changes.

## 3. FF-P06 domain-state-purity in `layered`

- **Reason.** Full text in `Docs/v1.3/adr-v13-02-draft.md`. In closed layering the business layer uses the layer below (Fowler 2002, ch. 1; POSA 1996 Layers), so "a business class holds a persistence gateway" is the style's intended dependency, not a breach. FF-P06's construct, an isolated domain, exists only in styles that require one: clean, hexagonal, ddd and nestjs.
- **Change.** `src/fitness-compiler/v13-applicability.ts`, read when `CompileOptions.styleApplicability` is set (in `V13_COMPILE_OPTIONS`). FF-P06 is disabled in `layered` with a `COMPILER_004` reason.
- **Unchanged.** The tiers and the v1.2E compile.
- **Expected.**
  - The 53 FF-P06 rows in `layered` go to 0, and the layered clean variant passes.
  - Layered blocking precision rises from 9/64 toward 9/11 (literal) and 11/11 (with fix 2).
  - Recall is unchanged, because no layered manifest expects FF-P06.

## 4. Role detection by class name

- **Problem.**
  - FF-P03 selects repositories with `c.name CONTAINS 'Repository' OR … 'Repo'`, so it fired on `CsvReportWriter` ("Repo" in "Report", clean n02).
  - The hexagonal `port-adapter-pattern` selects adapters with `ANY(role IN $adapterRoles WHERE c.name CONTAINS role)`, so it fired on `GatewayRetryPolicy` (hexagonal n03).
- **Construct.** A TypeScript class states its role in its **last** camel-case token(s): `OrderRepository`, `PaymentGateway`, `PlaceOrderUseCase`, `OrderEntity`. A role word elsewhere in the name either is not a role (`Report`) or qualifies a different role. `GatewayRetryPolicy` is a policy about a gateway, and `RepositoryFactory` is a factory. A trailing `Impl` marks the implementation of the role (`OrderRepositoryImpl`) and keeps it.
- **Change.** `src/fitness-compiler/v13-role-names.ts`, applied when `CompileOptions.roleTokens` is set (in `V13_COMPILE_OPTIONS`):
  - A role matches when the name ends with the role word, optionally followed by `Impl`.
  - Every role word starts with an upper-case letter, so a match starts at a token boundary.
  - It applies to the four templates that select a class by role:
    - FF-P03 `repository-pattern` and `port-adapter-pattern`;
    - FF-P04 `use-case-isolation` (`UseCase|Service|Handler`);
    - FF-P05 `controller-no-entity` (`Entity|Aggregate|ValueObject`).
  - It is the same construct in each.
- **Not changed:**
  - **The naming conventions** (FF-CV02 `naming-services`, FF-CV03 `naming-repos`). Their construct is the name itself: they select a class that mentions the role word and check the suffix convention, so a suffix selection would make them vacuous.
  - **"A declared role".** The spec's `roles:` are layer annotations, not class facts; no class-level role declaration exists to read.
- **Unchanged.** The v1.2E compile: the frozen text is rewritten only with the option.
- **Expected.**
  - The clean n02 `CsvReportWriter` row and the hexagonal n03 `GatewayRetryPolicy` row disappear.
  - No true positive is lost: on the reference set every class those templates should select ends with its role word. The fixtures were searched for class names with a role word not at the end, and the only ones are `CsvReportWriter` and `GatewayRetryPolicy`.
  - FF-P04 and FF-P05 rows on the reference set are unchanged.

### FF-P02 sibling-service injection (nestjs n03): checked, not changed

FF-P02 fired on `registrations.service.ts` in n03, where `RegistrationsService` injects the concrete `WorkshopsService`. The reference notes call this RDQ-3.

1. **Not a name heuristic.** FF-P02 does not select by name. It is the share of injected interfaces among all of an application class's constructor dependencies, against 0.85. The construct of fix 4 does not apply to it.
2. **A correct reading of the rule.** The row reads the rule's own condition correctly (3 of 4 dependencies are interfaces, 0.75 < 0.85). The sealed tier table calls FF-P02 "a ratio with a threshold, so a proxy" for DIP.
3. **An open author decision.** Whether DIP excludes a same-layer concrete dependency (Martin's "high-level modules should not depend on low-level modules", where a sibling is neither) is a reading of the rule's construct. RDQ-3 in `Docs/v1.3-reference-notes.md` leaves it to the author. Deciding it here, from a false positive on this development set, would be tuning to the set.
4. **Advisory.** FF-P02 never changes the v1.3 verdict.

**Not changed.** Recorded as an open item for the author.

## 5. Edge views for the IMPORTS readers outside the templates

The choices and their reasons are in `Docs/v1.3/edge-views.md`, "Addendum 2026-10-15". All four readers take the literal view:

- the scoring engine's universal metrics (in the v1.3 scoring mode);
- the drift detector;
- the judge's graph view;
- the report graph.

The literal view is the module graph the import statements state, and structural metrics and cycles are defined over it. On a v1.2E graph each reader is unchanged.

**Expected.** No finding changes, because these readers feed metrics, drift, the judge context and the report, not the templates.

## 6. DDD g03 / FF-DS02 (M2)

- **Problem (M2).** `context-isolation` carried the M1 workaround: a file that a public-API barrel re-exports counts as published. Without it, the resolved edge of every import through the barrel looked like a deep import (M1). With it, a real deep import of such a file was missed: g03, `billing/api/InvoiceController.ts -> ordering/application/GetOrderSummary.ts`.
- **What the literal view adds.** The literal view (ADR-V13-01; its table already assigns it to `context-isolation`) keeps the import through the barrel as an edge to the barrel file, which is public, and drops the resolved edge.
- **Change.** With the edge views on, the template is compiled without the M1 clause (`DDD_LITERAL_VIEW_TEMPLATES`, `ddd-compiler.ts`). A deep import is then a literal edge to an internal file and is reported; the import through the barrel (g02) is not.
- **Unchanged.** The compile without the option keeps the frozen text, because a v1.2E graph has no literal barrel edge.
- **Expected.** g03 is found (DDD blocking recall from 7/9 toward 8/9). g02 and the clean variant stay silent. FF-DT03's g01 miss (M3, no accessor facts) remains.
- **Checked on Neo4j.** `tests/unit/ddd/ddd-neo4j.test.ts` runs every DDD case under the v1.3 compile, with only g01 as the known mismatch.

## 7. Barrels-only intermediate run (attribution)

Before any of fixes 2 to 6 existed, the merged `v1.3` code (barrel fix on) was run live once, with the lock in place. The output is in `results/v1.3-reference/after-fixes/barrels-only/`. It separates the effect of the barrel fix from this round's fixes:

- **Findings.** The raw rows are identical to the baseline (`baseline-pre-barrel/raw`) for all 71 variants. With the frozen M1 clause still in `context-isolation`, the barrel fix alone changes no finding. The baseline report predicted this ("the extractor change alone does not change the query").
- **Graph.**
  - Blind literal edge recall: layered 0.998 → 1.000, ddd 0.984 → 1.000.
  - The DDD author key edges: 15/16 → 16/16.
  - The barrel-import edges: 0/18 → 18/18 literal.
  - viaReExport agreement stays 18/18.

## 8. What to expect from the after-fix run (written before it)

- **Blocking recall:**
  - clean, layered, nestjs and hexagonal reach the author-normalised baseline values (1.00 against the author-manifests), through fix 2;
  - ddd rises to 8/9.
  - Recall against the blind manifests changes only through fix 2 (already normalised in `ue-score.ts`) and fix 6.
- **Blocking precision:** layered rises sharply (fix 3); clean and hexagonal lose their n02/n03 rows (fix 4).
- **Negative control:** the layered clean variant passes, so 5/5 clean variants pass.
- **Near-misses:** the near-miss false positives in clean n02 and hexagonal n03 and the four layered FF-P06 ones go away. nestjs n03 (FF-P02, advisory) stays. Layered n02's `SalesReportService -> Database` goes away.
- **Graph:** as in the barrels-only run.
- **Any other change is a regression to explain.**
