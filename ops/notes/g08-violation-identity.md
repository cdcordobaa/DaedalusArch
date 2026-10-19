# G08: the identity of a violation across commits

**Status:** proposal for review, 2026-10-18 (map part C1e). Zero calls. It reads the fix-mining report and code, the loop harness and the Study 2 drafts. Nothing was re-run. The aim is one definition that answers "is the violation at commit t+1 the same violation as at t?". Fix mining, drift (C5) and the Study 2 count D would all use it.

---

## 1. Why a formal rule is needed: four identities are in use now

| Where | Key | Cycle | Rename | Source |
|---|---|---|---|---|
| Fix mining (v1.3, APG v1) | `functionId # filePath # target # discriminator` (without `IMPORTS`); lines ignored | node list rotated to its smallest node, so direction is kept | a **disappearance cause** (RENAMED): the lineage ends and a new one starts | `scripts/v1.3/lib/fixes-mined.ts:108-113`, `:116-122`, `:164`; lineages `scripts/v1.3/fixes-mined-run.ts:385-421` |
| Fix mining, APG v2 | rule + the files, member, type, channel or component the item names | — | as above | `Docs/DiagnosticRuns/v1.3-apg2-fixes-mined-2026-10-16.md:61` |
| Loop repairs | `ruleId, template, filePath, target` | none | not handled | `scripts/lib/loop/loop.ts:260-262` |
| Loop pilot outcomes | `ruleId, template, filePath, target`; for a cycle, `ruleId, template` and the **sorted set of `filePath` and `target`** | two files, not the cycle's member set | not handled | `scripts/lib/loop/pilot-metrics.ts:23-29`; "check pending" at `Docs/v1.3/study2-outline-v2.md:239` (A7) |
| Study 2 drift draft (D) | one distinct blocking **edge** source → target; FF-S01 and FF-S03 on the same edge count once; a cycle is its sorted file set; a rename keeps the identity | sorted file set | **keeps** the identity (git, similarity ≥ 50 %) | `ops/notes/s2d-01-study2-drift-design.md:9` (untracked draft) |

The C5 drift script, also an untracked draft, takes the fix-mining key as it stands (`scripts/v1.3/drift-descriptive.py:9-11`).

These keys disagree on three points: whether the template is part of the key, what a cycle is, and whether a rename ends a violation. The last point carries most weight. Among blocking edge-shaped findings that disappeared in fix mining, the causes were:

- FIXED-BY-DEV 74;
- FILE-DELETED 88;
- RENAMED 45;
- MASS-OR-BOT 19;
- OTHER 7.

(`results/v1.3-fixes-mined/summary.json`, `groups:all repositories`, group `blocking, edge-shaped`, field `causes`.) So 45 of 233 disappearances (19 %) were renames, and the grid lineages count each as a death. On the grid, only 44.62 % of the ended blocking lineages ended with their files in place (`Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md:226`). The rest ended because a file moved or went away.

---

## 2. The definition

Fix an **instrument state** Θ = (rule catalogue and tiers at a freeze hash, extractor options, engine) and a **spec** σ. An identity is defined only **within one (Θ, σ)**. Two snapshots compared under different Θ or σ must both be re-evaluated under one of them, as fix mining did: one pipeline and the spec at the pin for every snapshot (`v1.3-validity-fixes-mined-2026-10-16.md:32-33`, `:286`).

Paths are repo-relative to the analysis root, in POSIX form, exactly as the snapshot reports them.

### 2.1 The identity key, at two grains

**Fine key** K(v). This is the fix-mining key. It is the unit for survival, fix credit and repair outcomes.

| Finding shape | K(v) |
|---|---|
| Edge-shaped (a `target` that is a source file) | (rule id, source file, target file, discriminator without `IMPORTS`) |
| Cycle (FF-S02, or a comma-list `filePath`) | (rule id, the cycle's node list without its closing repeat, rotated to start at its smallest path) |
| File-level (metric, proxy, convention, package import) | (rule id, file, target or package specifier if any, discriminator) |
| APG v2 item | (template, the files, member, type, channel or component it names), as in `v1.3-apg2-fixes-mined-2026-10-16.md:61` |

Not part of the key:

- line and column numbers;
- the message text;
- the tier (a property of (rule id, style) under Θ, `src/scoring-engine/rule-tiers.ts:164-169`);
- the layer names (a property of σ).

The **template** is not in the fine key. Under one σ the rule id fixes the template. The hexagonal library reuses ids for its graph templates (`src/scoring-engine/rule-tiers.ts:50-52`, `:96-102`), but the style is fixed within σ. The loop's keys include the template, and that is harmless under one σ.

**Edge key** E(v). This is the Study 2 unit (the D count).

- An edge-shaped finding maps to (source file, target file). FF-S01 and FF-S03 findings on the same edge share one E. This removes the double count that floor probe 1 found (31 of 65 FF-S03 instances duplicate FF-S01, `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md:101`, `:177-179`).
- A cycle maps to the **set of its directed edges**.

The draft's "sorted file set" is coarser: two different cycles over the same files would merge. The directed-edge set keeps them apart and is just as cheap. Recommend it for A7.

E is a function of K, so every fine-key lineage projects onto one edge-key lineage.

### 2.2 Same violation at t and t+1

Let ρ be the **rename map** from t to t+1. It is read from `git diff --name-status -M50% -l5000 <t> <t+1> -- <path>`, exactly the command the walkers use (`scripts/v1.3/fixes-mined-run.ts:233`). Every `R` row maps old → new, and every other path maps to itself. For grid points more than one commit apart, take one diff between the two grid points; do not compose per-commit diffs. That keeps the 50 % similarity measured against the state actually compared.

Then **v at t and w at t+1 are the same violation iff K(w) = ρ(K(v))**, where ρ is applied to every path in the key. For a cycle, re-canonicalise after mapping, because a rename can change which node is smallest.

Consequences:

- **A rename continues the violation.** This changes current fix-mining behaviour (`fixes-mined.ts:164`; lineage close at `fixes-mined-run.ts:406`). RENAMED stays a reported event, but it moves the violation without ending it.
- **A rename under 50 % similarity** is a delete plus an add. The violation ends as FILE-DELETED, and any matching finding on the new file is a new violation. This is the conservative direction the fix-mining threats already state (`v1.3-validity-fixes-mined-2026-10-16.md:287`).
- **Ending causes keep the existing first-match order** (`fixes-mined.ts:163-170`), applied *after* ρ. The order is FILE-DELETED, MASS-OR-BOT, RESOLVED-IN-PLACE, FIXED-BY-DEV, OTHER. MASS-OR-BOT and bots change only **credit**, never identity. In a mass rename, ρ still applies, within git's rename limit (`-l5000`).
- **A failed snapshot is neither a birth nor a death.** The violation is compared across it to the next good snapshot, as the walker does now (`fixes-mined-run.ts:402`).

### 2.3 Splits (one predecessor, several candidates at t+1)

**Rule: at most one successor, namely the candidate whose key equals ρ(K(v)). Every other candidate is new (introduced).**

| Case | t | t+1 | Outcome |
|---|---|---|---|
| S1. Source file split | `A → T` | `A` keeps part of its code and still imports `T`; new file `A2` also imports `T` | `A → T` continues; `A2 → T` is new |
| S2. Source renamed and split | `A → T` | git reports `A` renamed to `A1` (≥ 50 %); new `A2 → T` | `A1 → T` continues (it equals ρ); `A2 → T` is new |
| S3. Target split (re-pointing) | `A → T` | `T` stays; the code moves to new `T2`; `A` imports only `T2` | `A → T` **ends**, and under the current classifier as FIXED-BY-DEV, because files stay and the edge is gone. `A → T2` is new. Record a **derived-from** link (same rule, same source, a new target born in the same step). Proposed class `RE-POINTED`, checked before FIXED-BY-DEV, so that a moved dependency is not credited as a fix. The fix-mining threats already name this bias (`v1.3-validity-fixes-mined-2026-10-16.md:289`) |
| S4. Cycle split | cycle (a, b, c, d) | cycles (a, b) and (c, d) | The original ends; its cause is FIXED-BY-DEV if one of its edges is gone with the files in place. Two new cycles start, each with a derived-from link |

### 2.4 Merges (several predecessors, one candidate at t+1)

**Rule: the candidate continues the predecessor with the earliest birth (ties go to the lexicographically smallest original key). The others end with the cause `MERGED`, which is never credited as a fix.**

| Case | t | t+1 | Outcome |
|---|---|---|---|
| M1. Source files merged | `A → T` and `B → T` | `B` folded into `A`; git reports `B` renamed to `A`, so ρ maps both keys to `A → T` | `A → T` continues the older lineage; the other ends as MERGED. The count drops by one, and it is not a fix |
| M2. Merge without rename detection (under 50 %) | as M1 | `B` deleted, `A → T` remains | `A → T` continues; `B → T` ends as FILE-DELETED (the current behaviour) |
| M3. Cycles merged | (a, b) and (b, c) | one cycle (a, b, c) | Both end, as OTHER unless an edge went. The new cycle has derived-from links to both. Mind the 100-cycle cap: grid points at the cap are excluded for FF-S02 (`v1.3-validity-fixes-mined-2026-10-16.md:48`, `:290`) |
| M4. Two rules on one edge | FF-S01 and FF-S03 on `P → B` | the same | Two fine keys and one edge key. The edge key ends only when **both** fine keys end |

### 2.5 Worked examples

1. **A fix.** `Sairyss/domain-driven-hexagon` at `92515cfa73`: FF-S01 on `src/modules/user/queries/find-users/find-users.query-handler.ts` → `src/modules/user/database/user.repository.port.ts` (`v1.3-validity-fixes-mined-2026-10-16.md:260`, row 3). At the child both files exist, there is no rename row, and the edge is gone. The key K = `FF-S01#…/find-users.query-handler.ts#…/user.repository.port.ts#<disc>` has no successor, so the cause is FIXED-BY-DEV.
2. **A rename (illustration, not a corpus case).** At t, FF-S01 holds on `src/persistence/user.repo.ts` → `src/business/user.ts`. At t+1, git reports `R087 src/business/user.ts src/business/user.entity.ts`. ρ(K) = `FF-S01#src/persistence/user.repo.ts#src/business/user.entity.ts#…`. If that finding is present, it is the same violation with a moved target: the violation survives and is not introduced. Today's code would end it as RENAMED and open a new lineage.
3. **A cycle reported from another start node.** At t, `[b, c, a, b]`; at t+1, `[a, b, c, a]`. Both canonicalise to `FF-S02#cycle#a>b>c`, so this is the same violation (`fixes-mined.ts:116-122`). The loop pilot's key would compare only `{filePath, target}`, and that pair changes with the start node, so a cycle that did not change would count as one ended and one new. This is the "check pending" of A7.

---

## 3. What this would change, and where

None of these changes is made here.

| File:line | Now | Proposed |
|---|---|---|
| `Docs/v1.3/study2-outline-v2.md:239` (A7) | "Identity = rule + template + file + target; for a cycle, the sorted file set ... **Pending**" | "Identity: the edge key of `ops/notes/g08-violation-identity.md` §2.1 (a cycle is its set of directed edges), continued across steps through the git rename map at 50 % similarity (§2.2), with the split and merge rules of §2.3 and §2.4. Defined." |
| `ops/notes/s2d-01-study2-drift-design.md:9` | "a cycle is its sorted file set" | "a cycle is its set of directed edges (G08 §2.1)". Keep the rename sentence |
| `scripts/lib/loop/pilot-metrics.ts:23-29` | cycle = sorted {filePath, target} | key the cycle by its full member list from the report (the comma-list or JSON discriminator, as `fixes-mined.ts:91-102` reads it). Code change, with tests, before the freeze |
| `scripts/lib/loop/loop.ts:260-262` | no cycle case | use the same function as `pilot-metrics.ts` |
| `scripts/v1.3/lib/fixes-mined.ts:163-170`, `scripts/v1.3/fixes-mined-run.ts:385-421` | RENAMED ends a lineage | apply ρ before matching. Add `RE-POINTED` and `MERGED`. The grid lineages need a rename map between grid points, which the walk did not store. That is a git-only re-walk of the 36 clones: no Neo4j and no model |
| `Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md:289` (threat "Edge identity") | describes the current rule | add: "Renames end a grid lineage in §5a; under the G08 identity they would not. The survival figures are therefore biased toward shorter survival for every group, findings and baseline alike." |

**Effect on reported numbers.** The pair-level fix rates (§3 of the fix-mining report) do not change: RENAMED was never credited. The survival figures (§5a, N-rows built on them) would change, because the rename deaths become continuations. A re-run is optional for the thesis; declaring the bias is the minimum.
