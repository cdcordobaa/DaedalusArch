# ISE prototype: inferring the spec from the graph, accuracy on the v1.3 reference set (exploratory), 2026-10-15

Branch `v1.3-ise`, cut from `origin/v1.3`. **Exploratory.** Nothing here was pre-registered (author decision). The AI-DLC workflow was not run. This is ISE (Implicit Specification Extraction, Product Vision §"ISE: The Zero-Config Killer Feature"; thesis §16): infer a project's architecture spec from its own graph. The rule is "take the majority pattern as the rule, then find every deviation from it".

Outputs are in `results/v1.3-ise/2026-10-15/`:

| File | Content |
|---|---|
| `measure.md`, `measure.json` | (a) to (c), and Options 1 and 3 on every variant. This part runs offline in about 30 s. |
| `downstream.md`, `downstream.json` | (d): firewall findings under the inferred spec against findings under the true spec. |
| `specs/<target>.yaml` | The inferred spec (Option 2, preset-first). `<target>.infer-only.yaml` is the ablation. `<target>.true.yaml` is the true spec that (d) used (renamed for the probes). |
| `raw/<target>/<variant>.json` | The `firewall evaluate --symbolic-only` rows under both specs. `ise-downstream.ts --from-raw` replays them. |

**Neo4j was available.** The container had a Docker daemon, so `neo4j:5.26-community` with APOC ran locally. (d) was therefore measured in this session, not deferred. `ise-downstream.ts` still refuses to run without `NEO4J_URI` and `NEO4J_PASSWORD` (it prints the same message as `validate-reference.ts`), and `--from-raw` recomputes everything from the saved rows.

Provenance: the Neo4j rows were produced against the inferred specs of a scratch run made before the lint-only edits of commit `177a7bef`. The final `ise-measure.ts` run from that commit produced byte-identical `measure.json` and byte-identical inferred specs. The rows were then replayed with `--from-raw` into the results directory, and the result is identical to the scratch `downstream.md`.

## 1. Method

### 1.1 What the inferrer may read (anti-leakage)

The inferrer (`src/ise/`) only ever receives `snapshotSource(<project>)`. This copies `src/**` and `tsconfig.json`, and nothing else, into a fresh directory with a neutral name (`<tmp>/ise-snap-XXXX/project`). From that directory it builds the APG in memory (`extractAPG`, no Neo4j) and reads the tool's own canonical presets (`presets/<style>.yaml`). It never reads `spec.yaml`, a preset copy shipped with the project, `expected-*.json`, `reference.json`, a variant's patch or `variant.json`, or a folder name that names the style or the variant.

`tests/unit/ise/anti-leakage.test.ts` enforces this. It builds a bait project in a directory named `clean-architecture/v05-use-case-injects-concrete-repository/`, with every forbidden file next to `src/`. It wraps every `fs` entry point (`readFileSync`, `readdirSync`, `existsSync`, `statSync`, `lstatSync`, `openSync`, `realpathSync`, the async forms and others), runs the full `inferSpec`, and then asserts the following:

- No path was opened outside the snapshot, the repository's `node_modules/` and `presets/`, and the emitter's own temporary output.
- The only exceptions are TypeScript's upward module-resolution probes: `<ancestor>/node_modules/@typescript/lib-*` and `/package.json`.
- Nothing under the bait directory or `fixtures/` was opened.
- No forbidden file name was opened anywhere.

A negative control checks that the same filter flags a read of the bait `spec.yaml`. A liveness check confirms the wrappers did see the reads of the snapshot's sources.

The measurement scripts (`scripts/v1.3/ise-*.ts`) read the ground truth. They are the evaluator, and `src/ise` imports none of them.

### 1.2 The three options (thesis §16)

**Option 2, style classifier first (the main pipeline, `inferSpec`):**

1. **Style classifier** (`style-classifier.ts`). Each style collects points from evidence:
   - top-level layer-like directory tokens;
   - the NestJS decorators (`@Module`, `@Controller`, `@Injectable`, …) and dot suffixes;
   - the ports/adapters vocabulary (`adapters`, `inbound/outbound`, `driving/driven`, ports split by direction, a composition directory);
   - bounded-context-like top-level folders, each with its own `domain/` and at least one other DDD layer directory;
   - edge-direction statistics between directory units. Dependency inversion is measured as the share of cross-unit `IMPLEMENTS` whose interface sits in a lower-level unit. The other statistics are the depth of the unit chain, independent sibling outer units, and a composition root.

   Confidence is a style's share of all points, and the output is ranked with its evidence. The vocabularies and point values were written before any reference run and were not tuned afterwards (`vocabulary.ts`).
2. **Layer-mapping inferrer** (`layer-mapper.ts`).
   - *Units* are top-level directories under the source root, the children of container directories (`adapters`, `common`, …) and of detected bounded contexts, and root files.
   - *Preset-first* mode keeps each preset glob that matches at least one file. A glob with an inner `*` is expanded to the concrete directories it matches. The mode then infers a layer for every unit those globs leave uncovered.
   - *Infer-only* mode (ablation) drops every preset directory glob and infers all units.
   - A unit's layer comes from its token (synonym lists) and, independently, from structure. Structure means the unit's longest-path level over majority-direction unit edges, scaled onto the preset's layer ranks. A composition root goes to the composition layer, or to no layer if it is a single entry file. Sibling outer units are split by whether they implement inner interfaces.
   - Agreement between token and structure gives confidence 0.9, token only 0.6, structure only 0.5 and a file pattern 0.7. The output is the inferred globs plus a per-file assignment with confidence. The assignment uses the firewall's own `annotateNodes`.
3. **Spec emitter** (`spec-emitter.ts`). It emits the canonical preset unchanged (functions, thresholds, scoring, `allowed_dependencies`) except for the layer `directories` and `file_patterns`. For DDD it also writes an `architecture.ddd` block, inferred by `ddd-inferrer.ts` and never copied from the preset, because the preset's block describes the reference project itself. The inferred block holds the contexts, their public API and ACL, what lies outside them, aggregates (root and inner entities), value-object, repository and application-service globs, and the domain-event base type by majority vote. Every emitted spec is checked with the repository validator: `parseSpec` (schema and business rules), then `validateSpecAgainstProject(..., { rules: 'v1.3' })`.

**Option 1, majority vote** (`majority-vote.ts`). No style and no preset. Over directory units it mines every pattern that at least 60% of its instances follow, and reports each as a rule candidate with its support and the firewall rule it corresponds to:

| Kind | Rule it encodes | Maps to |
|---|---|---|
| direction | the majority direction between two units | FF-S01/S04 |
| closed-world | a unit imports only the units it imported when mined | FF-S01/S03 |
| framework-free | the unit's files import no framework package | FF-P01/DT04 |
| decorator-free | the unit's classes carry no decorator | |
| acyclic | no file lies on an import cycle | FF-S02 |
| inject-interfaces | cross-unit constructor injections target an interface | FF-P02 |
| implements-port | `*Repository` classes outside the core implement a port | FF-P03 |

The closed-world rule has support 1 by construction: it is the "frozen allowlist" baseline. The rules are mined on the clean variant and applied to every variant. A deviation counts only when it is new, meaning the clean variant does not already have it.

**Option 3, deviation clustering without a spec** (`outliers.ts`). On the judged graph alone, it classifies the style, maps the layers, and flags two kinds of outlier edge. An *against-order* edge goes outward, or sideways between same-rank layers. A *minority* edge goes in the minority direction (under 40%) of a unit pair. Nothing is carried over from the clean version.

### 1.3 Targets and measures

- **Targets.** The five dev reference projects (71 variants) and one rename probe per style. The task asked for one probe; **P1 is the primary probe** and P2 to P5 were added because they are cheap. Each probe renames the layer directories of a temporary copy to names that are **not in any vocabulary**. The relative imports are rewritten and the project still resolves. The ground truth is mapped through the same renaming. The probes:

  | Probe | Renaming |
  |---|---|
  | P1 clean-architecture | `domain→kernel`, `application→orchestration`, `infrastructure→platform` |
  | P2 layered | `presentation→frontend`, `business→kernel`, `persistence→platform` |
  | P3 nestjs | `domain→kernel`, `common→platform` |
  | P4 hexagonal | core and application as P1; `adapters/inbound→plugins/entry`, `adapters/outbound→plugins/exit`, `config→setup` |
  | P5 ddd | `domain`, `application` and `infrastructure` inside each context, as P1 |
- **Inference input.** Inference always runs on the **clean** variant. Every variant is then evaluated with the inferred spec. Style classification (a) also runs on every variant on its own.
- **(a) Style.** Classified style against the reference's style, for the clean variant and for each variant.
- **(b) Layers.** Per-file layer against `expected-graph.json` (`null` = no layer), for both mapping modes, with accuracy by confidence bucket.
- **(c) Spec equivalence.** Two comparisons against the true spec:
  - the glob text, per layer;
  - for every clean file, the layer the inferred spec gives against the layer the true spec gives (both through `annotateNodes`), plus the DDD block field by field.
- **(d) Downstream.** Per variant, the blocking findings under each spec. The v1.3 tiers apply under each spec's own style; FF-S02 cycles are compared as file sets. The measures:
  - verdict agreement: some blocking finding against none;
  - identical blocking sets, and the mean blocking Jaccard;
  - recall of the planted violation. *Rule-exact* means `compareVariant` matched the planted rule's expected finding. *Touched* means a finding absent from the clean variant names a file of an expected finding.

## 2. Results

### (a) Style classification

| Target | Classified (clean) | Confidence | Runner-up | Variants correct |
|---|---|---|---|---|
| clean-architecture | clean-architecture | 1.00 | — | 14/14 |
| layered | layered | 1.00 | — | 13/13 |
| nestjs | nestjs | 0.86 | clean 0.14 | 14/14 |
| hexagonal | hexagonal | 0.82 | clean 0.18 | 15/15 |
| ddd | ddd | 0.75 | clean 0.25 | 15/15 |
| P1 clean renamed | clean-architecture | 1.00 | — | 14/14 |
| P2 layered renamed | layered | 1.00 | — | 13/13 |
| P3 nestjs renamed | nestjs | 1.00 | — | 14/14 |
| **P4 hexagonal renamed** | **clean-architecture** | 0.67 | hexagonal 0.33 | **0/15** |
| **P5 ddd renamed** | **clean-architecture** | 1.00 | — | **0/15** |

On the five projects, all 5 are correct, and 71/71 variants keep their style: no planted violation flips the classification. With unknown names the classifier falls back to edge structure. That works for clean and layered (P1, P2), and for NestJS, where decorators carry it (P3). It fails for hexagonal and DDD (P4, P5); see §3.

### (b) Per-file layer accuracy (clean variant against `expected-graph.json`)

| Target | Preset-first | Infer-only |
|---|---|---|
| the 5 reference projects | 146/146 (100%) | 146/146 (100%) |
| P1 clean renamed | 29/29 | 29/29 |
| P2 layered renamed | 27/27 | 27/27 |
| P3 nestjs renamed | 28/29 | 28/29 |
| P4 hexagonal renamed | 20/30 (67%) | 20/30 |
| P5 ddd renamed | 6/31 (19%) | 6/31 |

The confidence is informative. Pooled over all ten targets (preset-first), the high bucket (≥ 0.85) is 123/123 correct, the medium bucket is 42/42, and the low bucket (structure only, < 0.55) is 91/127 (72%). Every wrong file is a low-confidence file.

### (c) Spec equivalence

| Target | Spec valid (repo validator) | Glob-text differences | Clean files whose layer differs | DDD block |
|---|---|---|---|---|
| clean-architecture, layered, hexagonal | yes | 0 | 0 | — |
| nestjs | yes | 22 | 0/29 | — |
| ddd | yes | 14 | 0/31 | identical, all 8 fields |
| P1, P2 | yes | 0 | 0 | — |
| P3 nestjs renamed | yes | 24 | 1/29 | — |
| P4 hexagonal renamed | yes | 5 | 10/30 | — |
| P5 ddd renamed | yes | 8 | 25/31 | 8/8 fields differ (no contexts found) |

The glob-text differences on nestjs and ddd are not errors.

- **nestjs.** The inferred spec drops the preset directories that do not exist in the project (`src/core/**`, `src/prisma/**`, …) and the file patterns that match no file.
- **ddd.** It expands `src/*/domain/**` to `src/ordering/domain/**` and `src/billing/domain/**`.

On these projects the file-level assignment is identical to the true spec's. A side result follows: **the true nestjs spec and `presets/ddd.yaml` fail the repository's own validator against their reference projects** (`LAYER_DIR_NOT_FOUND` for `src/core`, `src/gateways`, …, and `src/*/acl`, because the validator does not expand `*`). Every emitted ISE spec passes.

The inferred DDD block equals the hand-written one in the preset: contexts, public API (`index.ts` + `contracts/**`), ACL, the three aggregates with roots and inner entities (`OrderLine`, `InvoiceLine`, none for `Customer`), value-object, repository and application-service globs, and `DomainEvent` (3/3 event classes implement it).

### (d) Downstream: findings under the inferred spec against the true spec (Neo4j, 142 evaluations)

| Target | Inferred style | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted (true spec) | Planted (inferred spec) | Touched (true / inferred) |
|---|---|---|---|---|---|---|---|
| clean-architecture | clean | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 |
| layered | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 |
| nestjs | nestjs | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 |
| hexagonal | hexagonal | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 11/11 / 11/11 |
| ddd | ddd | 15/15 | 15/15 | 1.00 | 11/12 | 11/12 | 11/12 / 11/12 |
| P1 clean renamed | clean | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 |
| P2 layered renamed | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 |
| P3 nestjs renamed | nestjs | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 |
| **P4 hexagonal renamed** | clean | 11/15 | 10/15 | 0.71 | 11/11 | **5/11** | 11/11 / 7/11 |
| **P5 ddd renamed** | clean | 8/15 | 7/15 | 0.47 | 11/12 | **0/12** | 11/12 / 3/12 |

On the five reference projects, the inferred spec reproduces the true spec's blocking findings exactly on all 71 variants. Its planted recall is 49/52, which is the true spec's own: the three misses are the tool's known misses under the true spec as well (clean v07 and nestjs v09 `controller-no-entity`; ddd g01). The same holds for P1 to P3. Under P4 and P5 the misclassification propagates, and recall drops to 5/11 and 0/12.

### Comparison of the options (planted violation "touched" on violation variants; false alarms on near-miss variants)

| | Option 2 (inferred spec, firewall) | Option 1 (majority vote) | Option 3 (outliers, no spec) |
|---|---|---|---|
| 5 reference projects | **49/52**; 0 new blocking findings on the 14 near-miss variants (advisory ones only: FF-C03, FF-CV03, FF-CV05, FF-P02) | 39/52; 5 new deviations on 3 of the 14 near-miss variants | 21/52; 0 on near-misses |
| P1 to P3 (renamed) | 27/29 | 24/29 | 12/29 |
| P4, P5 (renamed) | 10/23 | 10/23 | 5/23 |

Option 1 per style: clean 9/10, layered 9/9, nestjs 6/10, hexagonal 10/11, ddd 5/12. Option 3 per style: 5/10, 2/9, 5/10, 7/11, 2/12. "Touched" is generous, because the finding need not carry the planted rule. Option 2's rule-exact recall is the same 49/52 on the reference projects.

## 3. Failure cases

1. **P4: a renamed hexagonal project is classified as clean-architecture.**
   - **What happens.** `plugins/` is not a container token, so `plugins/entry` and `plugins/exit` form one unit. Without two independent sibling outer units there is no hexagonal structural evidence. The `ports/in`, `ports/out` evidence (+1) loses to dependency inversion with "one outer ring" (+2 for clean).
   - **The effect.** Under the clean preset, `plugins/**` is mapped to *application* (level 2 of 3) and `setup/**` to *infrastructure*, because the clean preset has no composition layer. The inferred spec misses inbound→outbound adapter imports (v05), adapters without a port (v08, v09) and use cases that throw an inbound adapter's error (v04). That is 5/11 planted.
   - **The fix.** Split a directory that has no direct files into its children when those children have no edges between them. This is a structural container test, not a vocabulary one. It was seen only after the probe, so it is not applied here; applying it now would make the probe non-blind.
2. **P5: a DDD project whose layer folders are renamed loses its bounded contexts.**
   - **What happens.** `boundedContexts` requires a `domain` child, so with `kernel/` no context is found. `ordering/` and `billing/` become two plain units, mapped by structure to *application* and *infrastructure* under the clean preset. The `ddd:` block is not emitted.
   - **The effect.** Recall is 0/12, and verdicts disagree on 7/15 variants.
   - **The fix.** Detect contexts structurally: sibling top-level folders with the *same* internal sub-folder set, little cross-folder traffic, and imports concentrated on one or two entry files (the public API).
3. **P3: in NestJS, a renamed `common/` loses one file.**
   - **What happens.** `platform/` is not a container token, so `platform/filters` and `platform/guards` form one unit. Most of that unit's files are matched by file patterns (`*.guard.ts`), so the unit is treated as a feature folder and `domain-error.filter.ts` gets no layer.
   - **The effect.** There is no downstream effect on the reference variants: no finding touches that file.
4. **Option 1 false alarms come from the closed-world allowlist.**
   - **What happens.** The allowlist flags every new unit dependency, so legitimate new edges become deviations. There are 5 such deviations on 3 near-miss variants: nestjs n03, a service injecting a sibling service (1); ddd g02, an import through the published barrel (3); ddd n01, an ACL import of `OrderId`, which the DDD rules explicitly allow (1).
   - **The effect.** It also misses every DDD tactical rule (aggregate boundary, repository for inner entity, mutable value object, event placement, fat service), because no directory-level majority encodes them.
5. **Option 3 cannot see strict layering or non-edge rules.**
   - **What happens.** Layer skips (layered v03, v04, v09), cycles, framework imports, decorators and missing ports are not outlier edges against the order. One violating edge in a project of 60 to 80 edges never moves the majority, so it is caught only when it points outward.

## 4. Which option works best

**Option 2 (style classifier first), clearly.** When the style is classified correctly, it gives the full firewall rule set, with tiers and DDD tactics, and it matches the true spec exactly downstream. This holds on all five styles and on three of the five rename probes.

Its accuracy is bounded by classification. When classification is wrong (P4, P5), its recall falls to the level of Option 1. Option 1 is a useful *report* next to Option 2: the support numbers make "X% of the code does Y" explicit for the PR that proposes the spec. As a rule source it is noisy (the closed-world allowlist) and blind to style semantics. Option 3 is the weakest detector, but it has zero false alarms here and needs no spec. It suits a "no spec yet" warning mode, not a gate.

The classifier's confidence should gate how the spec is used. The low-confidence bucket held every wrong file, and both misclassified probes had a runner-up or a structure-only basis.

## 5. Threats to validity

- **Circularity (brownfield).** ISE infers the spec from the very code it then judges. Whatever the code already does becomes the rule: pre-existing violations are baselined, not caught. Option 1 says so explicitly (it reports only *new* deviations), and Option 2 inherits it through the layer globs. This prototype sidesteps the problem by inferring from the *clean* variant. A real brownfield repository has no clean variant.
- **Consistent-but-wrong styles are not caught** (thesis §16.8). A codebase that is uniformly wrong produces an inferred spec that is uniformly wrong. Examples are a domain that imports the ORM everywhere, or "layers" that are really feature folders. The majority pattern is the anti-pattern, so ISE encodes it as the rule. In Option 1, `framework-free` is simply not mined for a unit where most files import a framework. In Option 2, the preset's rules still apply, but the classifier may choose another style.
- **The reference projects use the presets' own directory names.** For four styles, the true spec is a verbatim preset copy. So preset-first inference on the unrenamed projects is close to a lookup, and (b) to (d) at 100% there is expected rather than impressive. The rename probes are the real test, and two of five fail.
- **Small n, one author.** There are 5 projects of about 30 files each, all written by the author of the presets and of the vocabulary. The vocabulary was fixed before the runs, but by the same person who designed the fixtures. There are no confidence intervals: with n = 5 they would be uninformative.
- **The probes were chosen after the classifier was written.** They were not tuned against, but their names were picked knowing what is not in the vocabulary.
- **"Touched" is generous** for Options 1 and 3, which have no rule ids. The rule-exact measure exists only for Option 2.

## 6. Next steps

1. **E1 cells, locally.** The cells are outside the repository. Run `inferSpec` on each generated project (the agent-generated code). Compare the inferred spec with the spec the generator was given, and measure (d) against the cell's own declared spec. This is the realistic "is the inferred spec the intended one" test.
2. **Brownfield ground truth that does not come from this author.** Use open-source projects that already declare architectural rules: dependency-cruiser `forbidden` rules or Nx `enforce-module-boundaries` tags. Translate the declared rules (`scripts/depcruise-translate` exists) and score ISE's inferred layer order and forbidden edges against them. This also gives the first brownfield measurement of the circularity threat: count the declared-rule violations that the inferred spec baselines away.
3. Make the structural container split and structural bounded-context detection (§3, cases 1 and 2) blind. Specify them, then re-run on *new* rename probes (new names, new projects) rather than P4 and P5.
4. Gate on confidence. Emit the spec only when the top style's share is at least about 0.6 and no unit is structure-only. Otherwise emit a draft with the Option 1 report and ask.
5. Report the Option 1 candidates in the generated PR body ("17/17 edges go application → domain, so the domain must not import application"), so that reviewers can correct the majority before it becomes the rule.

## 7. Reproduce

```bash
npx tsx scripts/v1.3/ise-measure.ts --out results/v1.3-ise/2026-10-15            # (a)-(c), Options 1 and 3; no Neo4j
NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... \
  npx tsx scripts/v1.3/ise-downstream.ts --out results/v1.3-ise/2026-10-15       # (d); writes raw/
npx tsx scripts/v1.3/ise-downstream.ts --from-raw --out results/v1.3-ise/2026-10-15  # (d) from saved rows
npx jest tests/unit/ise tests/unit/scripts/v1.3/ise-                             # 43 unit tests
```
