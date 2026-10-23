# U1 groundwork — GRAPH-SCALE: graph facts complete and precise at scale (code-generation plan)

**Cycle:** v1.5, unit U1 (FR-1: "the extractor emits the DETECT-02 facts … port calls resolved to their adapters"),
groundwork only. **Status:** exploratory, **v1.5-exp**, development material. **Zero model calls.**
**Approval:** gate-level calls under the author's standing delegation, recorded in `aidlc-docs/audit.md`.
**Inputs:** `Docs/DiagnosticRuns/repo-scout-comprehend-02-2026-10-23.md` (§6, §7, §8), `experiments/repo-scout/`,
`experiments/detect-02/` (`lib/facts.ts`, `lib/graph.ts`, `mcp/comprehend/`), `ops/notes/detect-02-design.md`,
`ops/notes/detect-02-precision-note.md`, `aidlc-docs/inception/v1.5/` (U1, FR-1), the code-generation rule.

## Unit context

- **Problem (the scout's measurement).** `who_writes` is empty on Backstage, Novu and Medusa; no tool lists the
  callers of a port; Medusa's factory callbacks are not units (index site recall 0–3%); Novu's inherited repository
  writes are receiver-blind (9% precision); Backstage's 26 coverage misses are inline `import('./X').X` types.
- **Truth.** The ts-morph language service as the scout used it: `experiments/repo-scout/truth.ts`, imported
  read-only and **not changed**, so the truth is the same before and after.
- **Placement (NFR-1, Q2 = A).** Code stays in `experiments/` (`experiments/detect-02/` for the fixes,
  `experiments/graph-scale/` for the measurement) until each part passes its own test. `src/`, `presets/`,
  `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` and every registered Study 2b artefact are
  untouched; the extractor and the fidelity library are imported read-only.
- **No regression.** The DETECT-02 rules read `lib/facts.ts`. The fixes go into the comprehension index and new
  modules beside it, so the rule path is unchanged; the dev set, the precision fixtures and the tool tests are re-run
  and must give the same hits and the same 0 false positives.
- **Clones.** Backstage, Novu and Medusa at the scout's pins, in a scratch directory outside the repository; only URL
  plus commit are recorded.

## Steps

- [x] **Step 1. Baseline before any change.** Rebuild the HEXDDD-01 step trees in scratch, run
  `evaluate.ts --dev`, `precision.ts` and `tools.test.ts` on the unchanged code: dev identical to the committed
  `results/dev.json` apart from timings; precision 20 legit runs with 0 false-positive runs, 12/12 positives; tools
  15/15.
- [x] **Step 2. Pre-register the new questions.** Three per repository (callers of a port; writers of an entity) in
  `experiments/graph-scale/questions/`, committed with this plan before any fix is written or measured.
- [ ] **Step 3. (a) Factory and callback units.** A module-level declaration whose initializer is a call taking a
  function literal (`const x = createStep(name, async () => …)`, a registry or DI-provider factory) becomes the unit
  `x`; calls to `x(…)` resolve to it. Unit tests on a small committed fixture.
- [ ] **Step 4. (b) Receiver-aware call edges.** Every call to an in-tree member records the receiver's static class
  (by the type checker) when the member is declared on a base class; calls to overloaded methods resolve to the
  implementation. Unit tests (inherited base-repository writes, overloads).
- [ ] **Step 5. (c) `callers(port_or_method)` fact and tool.** Every call site of a port's members, through its
  implementations and subclasses (inherited members only when the receiver is the type), grouped by unit; in the MCP
  comprehension server. Unit tests, plus the server's tool list.
- [ ] **Step 6. (d) Inferred entities and a populated `who_writes`.** Without declared aggregates: entity-like types
  from ORM decorators (`@Entity`), schema definitions (`model.define("X", …)`, `new Schema<X>`), generic base
  repositories (`extends BaseRepository<_, XEntity>`) and stores that load a type by identity; writes are the write
  members of their stores. Every inferred root is labelled `inferred`, with its evidence. Unit tests.
- [ ] **Step 7. (e) Inline `import('./X').X` types.** Import-type edges in the index's import graph and an
  extraction add-on for coverage (`experiments/detect-02/lib/import-types.ts`); coverage against tsc measured with
  the frozen fidelity library. Unit tests.
- [ ] **Step 8. Regression.** Dev set, precision fixtures, tool tests: same hits, same 0 false positives.
- [ ] **Step 9. Measure.** On the three trees at the scout's pins: the scout's 3 questions plus the 3 new ones each,
  every tool and fact against compiler truth (recall and precision at sites, units and files), before (the unchanged
  code, from a worktree of the base commit) and after, and extraction / index time. No tuning after the first
  after-measurement; any later change is a dated revision with re-measurement.
- [ ] **Step 10. Records.** `Docs/DiagnosticRuns/graph-scale-2026-10-23.md`, a research-log entry, the v1.5 state in
  `aidlc-docs/aidlc-state.md`, the audit entry; PR, merged normally once Build & Test is green.

## NFR check (NFR-1 to NFR-5)

NFR-1 protection: no frozen path changes (checked with `git diff --stat` before the PR). Zero model calls. No personal
absolute paths in any record. No third-party source committed.
