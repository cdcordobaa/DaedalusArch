# Study 2 task design: tasks that produce variance on the primary outcome

> **Informal design guide, not a pre-registration.** Written on 2026-10-16. Nothing here is binding, hashed or listed in
> `corpus/prereg.json`. The sealed Study 2 directory was **not** read; this guide does not name, paraphrase or derive the
> sealed tasks. It says how a task should be built and audited; the author applies it to the sealed list (readiness
> gate D2) without disclosing that list.

Related: `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` (the probe, "probe" below), `Docs/v1.3/pilot-tasks.md`,
`Docs/v1.3/pilot-outcome-memo.md`, `Docs/v1.3/study2-outline.md`, `Docs/v1.3/study2-power-notes.md` (PR #119),
`Docs/v1.3/study2-readiness-gate.md` and `study2-dress-rehearsal.md` (branch `v1.3-study2-readiness`), the analysis
rehearsal (branch `v1.3-study2-analysis-rehearsal`). Tools and outputs of this guide: `Docs/v1.3/study2-task-design/`
(hint-audit script, base-rate sweep). Rehearsal tasks written with it: `fixtures/v1.3-rehearsal-tasks/`.

## 0. In one screen

| Question | Answer |
|---|---|
| Why this guide | Study 2 runs once. Its primary outcome (blocking, i.e. style-defining, violations per step and their slope) was at zero in E1 and in every hexagonal step of the probe. Tasks that leave the `none` arm at zero make every arm contrast empty. |
| What produced real violations in the probe | Only **step-1 layout habits** in Layered (entity types in `business/` imported by `persistence/`; the composition root in `presentation/`), then **replication** of those habits by later integrations. Rules: FF-S01 and FF-S03 only (§1). |
| What did **not** | Every pressure the probe's tasks were designed around: reporting shortcuts, hotfixes under time pressure, cross-feature reuse, across-every-layer audit trails. 0 blocking findings in 14 hexagonal steps (§1). |
| What to aim at instead | Steps whose cheapest path crosses an edge that is **blocking in the task's style**: a core rule that needs request data, a new feature reusing a concrete sender, a fix that needs a runtime switch held by the composition root, new infrastructure started from inside the logic, cross-context data in DDD, entry code reaching the stores in Layered (§2). |
| What must never be in a request | Layer, ring, port, adapter, pattern or context words, folder names or paths, role-suffixed code names, and "design-intent" phrases (swap, decouple, testable, behind a …). A no-hint arm gets none of these in its frame either (§3). |
| How to audit | The checklist in §4 and `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset <style preset> <tasks.json>`; exit 1 on any FAIL hit; every WARN hit gets a one-line verdict. |
| Base rate needed for power 0.80 (PR #119 model, `gate` halves the slope, block-level test, Holm) | At the working grid (option B, k = 5) and the PR #119 dispersion θ = 2: **≈ 3 new blocking findings per later step** with a step-1 level of 1.5, or **≈ 1.5–2** with a step-1 level ≤ 0.5. With k = 6 (option E): **≈ 1.5** (level 1.5) or **≈ 1** (level 0.5). A high step-1 level costs power: Layered as the probe saw it (level ≈ 4, slope ≈ 1) gives ≈ 0.24. `mcp` at a quarter reduction never reaches 0.80 at θ ≤ 5 in B or E (§5). |
| Rehearsal tasks | 4 new tasks (Hexagonal, Clean, DDD, Layered spare), 5 steps each, 0 FAIL hits in the audit, under the task's own preset and under each other preset (§6). |

## 1. What the floor probe says about task features

Source: probe §3 and `results/v1.3-floor-probe/` (6 tasks, 2 styles, 28 `none` steps, one Claude session as the agent;
counts, not rates).

### 1.1 Features that induced real (correct) blocking violations

| Feature | Style | Rule and edge | Evidence |
|---|---|---|---|
| **Entity or record types written in the middle layer and imported by the store** at step 1 | Layered | FF-S01 persistence → business (31 instances), each scored again by FF-S03 | All three layered tasks; all 96 findings `correct` (`check-correct.ts`) |
| **The composition root written in the entry layer** (the HTTP server file builds stores and clients) | Layered | FF-S03 presentation → persistence (34 instances) | youth-league, hive-health; market-vendors used module singletons and has none |
| **A new integration or a new feature that adds a file of the same kind** (a second client, a new store) after step 1 | Layered | the same two edges, replicated | 4 of 22 later steps add a new finding (market 4, league 2, hive 2 and 3): every one copies the step-1 habit |

So the only real source was **a style whose defining rule conflicts with an ordinary default layout**, made visible
at step 1 and grown by later steps that add files of the same kind. Feature growth mattered only as "more files that
copy the habit".

### 1.2 Features that did not

| Feature (as written in the probe) | Why it produced nothing |
|---|---|
| **Reporting endpoint "fast, in one go"** (garden dashboard, food-bank CSV, league tables, hive report) | Written as one more service over the stores in all four cases. And in hexagonal the shortcut it invites (inbound → outbound) is **FF-S03 layer-skip-graph, advisory** (probe §3.6 a): it cannot lift the blocking floor there even when taken. |
| **Hotfix under time pressure** (failed payments, allergens, result correction, false swarms) | 7–29 LOC inside an existing service. The information the fix needed already sat where the fix went, so no edge was crossed. |
| **Cross-feature reuse** ("must use the same e-mail layout", referees reusing fixtures) | Reuse of logic that already lived in the right place; the agent imported it inward. |
| **Across-every-layer change** (shelter audit trail, market audit log) | The actor was threaded as a parameter and a unit-of-work contract was added: the competent default. |
| **A second adapter of an existing kind** (in hexagonal) | Added behind the existing contract. |

### 1.3 What this implies for task design

1. **Pressure works only where the cheapest path crosses a blocking edge of this style.** The probe's tempting steps
   were tempting in general, but in hexagonal their cheapest path was either already inward or crossed an advisory
   edge. A pressure kind is not style-neutral; it must be aimed per style (§2.2).
2. **The fix's information must live on the wrong side.** A hotfix that only edits a rule inside a service never
   erodes. A hotfix whose needed value is only available in a request header, a provider payload or a runtime switch
   held by the composition root does invite an outward edge.
3. **Reuse must be reuse of something concrete.** "Send it the same way as X" erodes only if X is a concrete sender;
   reuse of logic does not.
4. **Do not let step 1 carry the effect.** A step-1 level effect (Layered in the probe) is removed by one repair and
   then never returns in the `gate` arm (probe §3.4); it also lowers power (§5.3). Later steps must each bring their
   **own** new pressure, not only replicate step 1.
5. **Expect a strong agent to write clean code by default.** The probe's agent had read the tiers and was biased toward
   the floor (probe §6), but nothing suggests a weaker one erodes in a different place. Design for the edges, not for
   the agent's carelessness.

## 2. Features that create genuine architectural temptation

"Genuine" means: the step is a plausible backlog item for that product, it reads as a feature request, and **a
competent developer under time pressure** would take the shortcut, because the shortcut is shorter and works. A step
is contrived if it only makes sense as a trap (an arbitrary requirement that a value from a header be stored in the
domain object, a feature nobody would ask for).

### 2.1 The four pressure families

| Family | What makes it genuine | Where the temptation actually comes from | Probe verdict |
|---|---|---|---|
| **Cross-cutting reporting** | Funders, councils, committees and inspectors ask for periodic figures across features. | The report needs data from several features at once; the cheapest path reads every store directly or puts shared identifiers in a common folder. | **Only works where reading across is blocking**: DDD (cross-context, FF-DS02) and Layered (entry → store, FF-S03). Advisory in Hexagonal and Clean: never use it as the floor-lifter there. |
| **Time-pressure fixes** | Real incidents: a provider outage, duplicated deliveries, clock skew, a race. Phrased "urgent", "keep the change small". | Only when the fix needs something that lives outside the logic: a **runtime switch** (turn a channel off without a restart → a mutable global in the composition root), the **provider's raw payload** (a status field only the client sees), a **retry timer** (started inside the logic with the concrete client), or a **lock** around a store. | Did nothing when the fix stayed inside a rule. Aim the fix at a switch, a payload, a timer or a store. |
| **Reuse across features** | New features naturally say "the same way as …". | Reuse of a **concrete sender or client** that an earlier step built (a text-message account, a mail provider, a payment client): the new feature imports what is there. | Did nothing when the reuse was of logic or of a layout. Reuse a sender, not a rule. |
| **New infrastructure** | A scheduler, a polling loop, a file upload, a webhook, a lock, a sensor feed, a second site. | Someone has to start the timer and hold the connection; the cheapest place is inside the logic that needs it. A second inbound kind (polling vs webhook) invites a provider switch inside the core. | Second adapter of the *same* kind did nothing in hexagonal. Aim at a **new kind** (first scheduler, first upload, first polling feed) and at what starts it. |

Two further families that the probe did not test but that follow from §1.3:

| Family | Genuine form | Blocking edge it aims at |
|---|---|---|
| **A core rule that needs request data** | "Fixers may only record outcomes at the venue they are signed in at", "who made the change, from the staff id header". | domain or application → framework (FF-P01, FF-S04), application → inbound (FF-S01). The probe's audit steps threaded the actor as a parameter: make the **rule** depend on the header value, not only the record. |
| **Two parts run by different teams** (DDD) | "It has two parts, run by different teams" from step 1, with data that one part needs from the other at every later step. | Cross-context import (FF-DS02) from step 1 onward, and a shared folder at the reporting step. |

### 2.2 Aim per style (blocking set from `Docs/v1.3/rule-tiers.md`)

| Style | Blocking edges worth aiming at | Pressures that reach them | Pressures that do not (do not count on them) |
|---|---|---|---|
| **Hexagonal** | application → outbound adapter (FF-S01, probe §3.6 b); domain → framework (FF-P01); inbound or application → `config` (FF-S01, §3.6 e); outbound client with no contract (port-adapter-pattern); cycles (FF-S02) | reuse of a concrete sender; rule needing a header; runtime switch; timer started by the logic | reporting (inbound → outbound is advisory); second adapter of the same kind |
| **Clean** | application → infrastructure (FF-S01); domain → anything outward (FF-S04); framework in domain (FF-P01); store without a contract (FF-P03); concrete constructor injection into inner classes (FF-P06, constructor half); cycles | same as hexagonal, plus two features that call each other (cancel → alert → trip) | reporting (layer skip is advisory) |
| **DDD** | cross-context import outside the public API or ACL (FF-DS02); aggregate boundary (FF-DT01); repository only for roots (FF-DT02); value-object immutability (FF-DT03); framework-free domain (FF-DT04) | two parts that need each other's data; a fix that edits an aggregate's insides; a cross-context report with shared identifiers | — (DDD is the style where reporting does work) |
| **Layered** | upward edges (FF-S01, double-counted by FF-S03); entry → store skip (FF-S03, blocking only here) | **new** entry → store edges at each later step (a webhook route that decides and stores, a race fix in the route, a fast report route) | relying on step 1 alone (a level, removed by one repair) |

**Style choice is itself a design lever** (probe §5.1): a style whose defining rules conflict with an agent's default
layout gives variance; Hexagonal and Clean with the folder sentence given do not, unless the steps are aimed as above.

### 2.3 Guardrails against contrivance

- Every step is something a real product owner of that domain would write; read it aloud to someone who has never
  heard of architecture styles, and it must still make sense as a feature.
- The pressure comes from **where the information or the effect lives**, never from a required implementation.
- One pressure family per later step, at most two; k ≥ 5 steps (power, §5).
- No step forces a violation: each has a clean solution of similar size. If the only sane solution is the violation,
  the step measures the task, not the arm.
- Use fictional providers with short, made-up names (no real company or product), as the pilot does, and check that
  no name ends in a role word (`…Gateway`, `…Store`, `…Client`): the audit flags those.
- Each task needs **acceptance checks** per step if Study 2 adopts them (gate D12), so that a clean structure is not
  bought by dropping the feature.

## 3. Forbidden hints

A hint is anything in agent-visible text, other than the arm's declared sentences, that tells the agent where code
goes. Addendum A1 (`study1-addenda.md`) is the precedent: one shared folder sentence gave every Study 1 arm the same
structure.

### 3.1 Never in a step request (any arm)

| Category | Examples | Audit level |
|---|---|---|
| Style and structure words | architecture, layer, layered, hexagonal, ports and adapters, port, adapter, onion, clean architecture, domain-driven, bounded context, shared kernel, anti-corruption | FAIL |
| Role and pattern words | entity, value object, aggregate root, repository, use case, interactor, controller, presenter, DTO, gateway*, factory*, facade, strategy pattern, unit of work, middleware, event bus, CQRS | FAIL (* WARN: ordinary sense exists) |
| Wiring words | dependency injection, inject*, composition root, container*, interface, abstraction, inversion of control | FAIL (* WARN) |
| The style's own layer names | from the preset: `domain`, `application`, `adapters`, `inbound`, `outbound`, `infrastructure`, `persistence`, `presentation`, `business`, `config`, `api`, context names | FAIL, or WARN when the word is ordinary English (business, application, presentation, config, api, a DDD part's plain name) |
| Folder and file hints | `src/…`, any glob (`**`, `*.ts`), any preset folder, file names, role-suffixed code names (`SmsAdapter`, `IOrderRepository`, `PaymentGateway`, `BookingService`) | FAIL |
| Design-intent phrases | decouple, loosely coupled, pluggable, testable, mock, "so we can swap the provider later", "behind a …", "keep X separate from Y", "in one place", "reusable" | FAIL for the first five; WARN for swap, separate, shared, common, reuse, one place |

### 3.2 Per arm

| Arm | May carry | Must not carry |
|---|---|---|
| `none`, `gate`, `daedalus-mcp` with the layout frame | the style sentence and the preset-derived folder sentence, **identical across these arms** (gate D2), plus each arm's one declared sentence (the MCP tool sentence; the gate's repair text) | any of §3.1 in step requests; in the repair text, a fix (the repair lines describe the rule, never what to move where, `loop-pilot-readiness.md:31`) |
| a **no-hint** arm (if S5 adopts one) | the step requests only, with the generic frame | the style sentence, the folder sentence, any preset folder, any layer word. Its frame must pass the audit **with no `--frame-may-name-layout`**. |
| the self-review placebo (if adopted) | one generic "review your work" turn | any rule id, layer word or folder name |

The DDD frame names the contexts as parts ("src/picking/ for picking"); the requests may then use the part's plain
name ("the cellar"), as the pilot does, never its folder path.

## 4. Auditing a task prompt for hidden structure hints

### 4.1 Checklist (one row per step, kept with the audit sheet; for sealed tasks the sheet stays outside the repo and only its sha256 is committed, gate D2)

1. **Script.** `hint-audit.mjs` on the step text under the task's style preset (and the DDD contexts with `--context`):
   0 FAIL. Then once under every preset at once (repeat `--preset` runs), so a request does not hint at a *different*
   style.
2. **WARN verdicts.** Every WARN hit has a one-line verdict ("the provider's HTTP API, not a folder of ours").
3. **Read-aloud test.** Read the step to a non-developer: every noun is a product noun (people, things, money, time,
   places, providers).
4. **Information placement.** List where each piece of information the step needs comes from (request header, provider
   payload, store, switch, clock). The step must not say where it should be handled.
5. **No implementation verbs.** No "store X in", "call Y from", "wrap", "inject", "expose Z to the …"; "expose the
   operations over HTTP" and "keep the data in memory" are the only implementation sentences, and only in step 1.
6. **No implied decomposition.** No "first …, then …" sequence that mirrors the layers (parse → validate → store →
   notify), no lists of components.
7. **Provider names.** Fictional, no role suffix, not a real product.
8. **Frames.** The frames of all layout arms are byte-identical apart from each arm's declared sentence (`npx jest
   tests/unit/scripts/loop/pilot.test.ts`); the no-hint frame passes the script without `--frame-may-name-layout`.
9. **Repair and tool text.** The gate's repair lines and the MCP tool sentence: no fix, no folder (script on each).
10. **Acceptance checks** (if adopted): never shown to the agent; if a check's text is ever shown, it passes steps 1–6.
11. **Re-hash** after any change, and re-run 1–10.

### 4.2 The script

`Docs/v1.3/study2-task-design/hint-audit.mjs`, plain Node, no dependencies, no network.

```bash
# a tasks file (only the `request` fields are read, never commentary keys), under one style
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/hexagonal.yaml <tasks.json>
# one task, DDD with its own contexts
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/ddd.yaml --task <id> --context <part> <tasks.json>
# a frame of a layout arm (layout words become WARN) vs a no-hint arm (they FAIL)
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/hexagonal.yaml --frame <frame.txt> --frame-may-name-layout
node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/hexagonal.yaml --frame <frame.txt>
# any text, from stdin; machine-readable output
echo "<prompt>" | node Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/layered.yaml --json -
```

What it greps: the generic FAIL and WARN lists of §3.1; the layer names of the preset's `architecture.layers` (split
on `-`, ordinary words as WARN); every `src/…` directory and context root in the preset as a folder pattern; any
`src/` path, glob or file name; role-suffixed identifiers; `--term` extra FAIL terms; `--allow` waivers (printed as
WAIVED, so a waiver is visible on the sheet). Exit 0 = no FAIL hit, 1 = at least one, 2 = usage error.

Calibration (2026-10-16): the pilot tasks block (12 steps) and the probe's 6 tasks (28 steps) give **0 FAIL** under
each of the four presets (hexagonal, clean, DDD, layered); the probe's hexagonal frame gives 0 FAIL as a layout frame and 21 FAIL as a no-hint
frame; a planted sentence ("Add a SmsAdapter behind a port in src/adapters/outbound and wire it in the composition
root; keep the business logic in the use case") gives 10 FAIL. A grep cannot catch a hint made of ordinary words
(checklist items 3–6 exist for that), and it does not judge whether a step is contrived (§2.3).

## 5. The base rate the power simulation needs

### 5.1 Method

`Docs/v1.3/study2-task-design/base-rate-sweep.ts` re-runs the PR #119 model (`scripts/v1.3/lib/study2-power.ts`,
unchanged) with its default assumptions and effects (`gate` halves the erosion slope, `mcp` reduces it by a quarter,
arm × task SD 0.15, run/task/model SDs 0.4/0.5/0.3), block-level sign-flip test, Holm over the two contrasts, α = 0.05,
400 simulated studies per cell (MC SE ≤ 0.025), seed 20261016. It varies only the `none` arm's **erosion rate**
(`slopePerStep`: expected new blocking findings per later step), the **step-1 level** (`baseCount`) and the count
**dispersion** θ. Output: `Docs/v1.3/study2-task-design/base-rate-sweep.json`.

```bash
npx tsx Docs/v1.3/study2-task-design/base-rate-sweep.ts --sims 400 --seed 20261016 \
  --out Docs/v1.3/study2-task-design/base-rate-sweep.json
```

### 5.2 Results: power of `gate` vs `none` (step-1 level 1.5)

Each cell: power of `gate` / power of `mcp`, bold where `gate` ≥ 0.80. Columns: expected new blocking findings per later step in `none`.

| Design | θ | 0.25 | 0.5 | 1 | 1.5 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|---|
| B (6×3×3, k = 5) | 0.8 | 0.06 / 0.02 | 0.14 / 0.04 | 0.31 / 0.11 | 0.35 / 0.12 | 0.42 / 0.13 | 0.53 / 0.19 | 0.55 / 0.16 |
| B (6×3×3, k = 5) | 2 | 0.13 / 0.06 | 0.28 / 0.11 | 0.58 / 0.19 | 0.73 / 0.25 | 0.77 / 0.29 | **0.82** / 0.34 | **0.84** / 0.36 |
| B (6×3×3, k = 5) | 5 | 0.16 / 0.06 | 0.46 / 0.14 | 0.74 / 0.34 | **0.88** / 0.35 | **0.92** / 0.41 | **0.95** / 0.47 | **0.96** / 0.49 |
| B (6×3×3, k = 5) | Poisson | 0.30 / 0.10 | 0.69 / 0.25 | **0.96** / 0.43 | **0.98** / 0.60 | **0.99** / 0.66 | **0.99** / 0.71 | **0.99** / 0.73 |
| E (6×3×3, k = 6) | 0.8 | 0.12 / 0.05 | 0.20 / 0.11 | 0.44 / 0.16 | 0.45 / 0.15 | 0.59 / 0.22 | 0.64 / 0.23 | 0.65 / 0.19 |
| E (6×3×3, k = 6) | 2 | 0.17 / 0.06 | 0.42 / 0.15 | 0.68 / 0.25 | **0.82** / 0.30 | **0.84** / 0.29 | **0.89** / 0.39 | **0.88** / 0.37 |
| E (6×3×3, k = 6) | 5 | 0.27 / 0.10 | 0.62 / 0.24 | **0.90** / 0.37 | **0.94** / 0.39 | **0.94** / 0.48 | **0.98** / 0.54 | **0.97** / 0.54 |
| E (6×3×3, k = 6) | Poisson | 0.43 / 0.15 | **0.81** / 0.34 | **0.98** / 0.56 | **0.98** / 0.62 | **0.99** / 0.68 | **1.00** / 0.73 | **0.99** / 0.72 |
| C (6×3×5, k = 5) | 0.8 | 0.09 / 0.05 | 0.24 / 0.09 | 0.48 / 0.13 | 0.56 / 0.20 | 0.70 / 0.26 | 0.75 / 0.28 | 0.74 / 0.26 |
| C (6×3×5, k = 5) | 2 | 0.21 / 0.09 | 0.42 / 0.16 | 0.77 / 0.28 | **0.88** / 0.40 | **0.93** / 0.38 | **0.96** / 0.44 | **0.96** / 0.46 |
| C (6×3×5, k = 5) | 5 | 0.34 / 0.12 | 0.68 / 0.27 | **0.91** / 0.47 | **0.97** / 0.54 | **0.98** / 0.64 | **0.99** / 0.66 | **0.98** / 0.68 |
| C (6×3×5, k = 5) | Poisson | 0.48 / 0.14 | **0.89** / 0.41 | **0.98** / 0.65 | **1.00** / 0.76 | **1.00** / 0.78 | **1.00** / 0.85 | **1.00** / 0.82 |

### 5.3 The step-1 level costs power (θ = 2)

Power of `gate` / `mcp`; rows are the expected blocking count at step 1 in `none`.

| Design | Step-1 level | slope 0.5 | slope 1 | slope 2 |
|---|---|---|---|---|
| B (6×3×3, k = 5) | 0.5 | 0.57 / 0.16 | 0.76 / 0.26 | **0.89** / 0.34 |
| B (6×3×3, k = 5) | 1.5 | 0.28 / 0.11 | 0.58 / 0.19 | 0.77 / 0.29 |
| B (6×3×3, k = 5) | 4 | 0.10 / 0.05 | 0.24 / 0.10 | 0.51 / 0.18 |
| E (6×3×3, k = 6) | 0.5 | 0.70 / 0.21 | **0.84** / 0.31 | **0.86** / 0.37 |
| E (6×3×3, k = 6) | 1.5 | 0.42 / 0.15 | 0.68 / 0.25 | **0.84** / 0.29 |
| E (6×3×3, k = 6) | 4 | 0.15 / 0.07 | 0.41 / 0.15 | 0.66 / 0.20 |
| C (6×3×5, k = 5) | 0.5 | 0.78 / 0.31 | **0.93** / 0.41 | **0.96** / 0.50 |
| C (6×3×5, k = 5) | 1.5 | 0.42 / 0.16 | 0.77 / 0.28 | **0.93** / 0.38 |
| C (6×3×5, k = 5) | 4 | 0.15 / 0.08 | 0.42 / 0.12 | 0.73 / 0.29 |

### 5.4 Reading

1. **The erosion rate must be about 1.5 to 3 new blocking findings per later step**, not "some". At the working grid
   (B) and θ = 2, `gate` reaches 0.80 only at a slope of about 3 (0.82); at 1 per step it is 0.58, at 0.5 it is 0.28.
   One more step (E, k = 6) brings the threshold down to about 1.5 (0.82); two more replicates (C) to about 1.5 (0.88).
2. **Power saturates.** Past about 2 per step, more erosion buys little (B, θ = 2: 0.77 at 2, 0.84 at 4), because the
   negative-binomial noise grows with the mean. What then limits power is θ: at θ = 0.8 no cell of B or E reaches 0.80;
   at θ = 5 B needs only about 1.5; under Poisson about 1. **The pilot's θ decides more than any task tweak can**
   (power notes §5.6), but the tasks decide whether there is a slope at all.
3. **A high step-1 level costs power** at the same slope (B, θ = 2, slope 1: 0.76 at level 0.5, 0.58 at 1.5, 0.24 at
   4). The step-1 count adds variance to every later step without adding slope. Tasks should keep step 1 close to
   clean and put the pressure into the later steps, which is also what makes the outcome an erosion measure rather
   than a level (probe §4).
4. **`mcp` at a quarter reduction is not reachable** with any task design in B, C or E at θ ≤ 5 (best 0.74, C at θ = 5,
   slope 4). Better tasks do not fix that contrast; only a larger `mcp` effect, a larger grid or a single primary
   contrast does (power notes §5.5).

### 5.5 Where the probe sits

| Probe set | Step-1 level (mean) | Slope (mean OLS per run) | Later steps with a new finding | Power at that rate (B, θ = 2) |
|---|---|---|---|---|
| Hexagonal (3 tasks, 11 later steps) | 0 | 0 | 0 / 11 | = the null rate (≈ 0.04) |
| Layered (3 tasks, 11 later steps) | 4.3 (4, 3, 6) | 0.9 (0.6, 0.4, 1.7) | 4 / 11 | ≈ 0.24 (level 4, slope 1) |
| All six (as a Study 2 mix would be) | 2.2 | 0.45 | 4 / 22 | < 0.28 (level 1.5, slope 0.5); lower with the arm × task spread a 0-erosion half adds |

The probe's agent is not a Study 2 model and n is tiny, so these are positions on the grid, not estimates. They say
the probe's tasks would leave Study 2 under-powered by a wide margin.

### 5.6 What the tasks must deliver (targets for the pilot to check)

The loop pilot (memo §3) and then the dress rehearsal are where these targets are checked against real agents; the
pilot's θ and slope SD replace the PR #119 guesses (gate D1, D3).

| Target, in the `none` arm | Value for design E (k = 6), θ ≈ 2 | Value for design B (k = 5), θ ≈ 2 |
|---|---|---|
| Mean **new distinct violating edges** per later step (FF-S01/FF-S03 deduplicated, probe §5.4) | **≥ 1.5** | **≥ 3**, or ≥ 2 with a low step-1 level |
| Step-1 level | **≤ 1.5**, ideally ≤ 0.5 | **≤ 0.5** |
| Share of later steps with ≥ 1 new finding (memo §3 identity rule) | ≥ about 2/3 (NB θ = 2, mean 1.5 → 67 %) | ≥ about 3/4 (mean 2 → 75 %; mean 3 → 84 %) |
| Tasks with zero erosion | **none**: every task must erode, or it adds arm × task noise and no signal | same |
| Dispersion | θ ≥ 2; if the pilot shows θ ≈ 0.8, no design here reaches 0.80 and the grid must grow (C or more) | same |

If the pilot falls short, the remedies in order of cost: (1) re-aim the steps (§2.2), (2) k = 6 (option E), (3) more
replicates (option C), (4) more tasks (option F, needs tasks beyond the sealed list).

### 5.7 Limits of this section

- The PR #119 model draws each step's count independently around a linear mean. Real counts are cumulative (a
  violation persists until removed), so real step counts are autocorrelated and often front-loaded or saturating
  (probe hive: 6, 10, 13, 13, 13). The sweep says what slope is needed; it does not model how a slope arises.
- Arms change only the slope; an arm that also lowers the step-1 level (as the probe's tool arm did) is not modelled.
- Feature dropping, tool adoption and the repair turn are not modelled (power notes §6).
- These are synthetic counts; no sealed task and no model call is used.

## 6. Rehearsal tasks written with this guide

`fixtures/v1.3-rehearsal-tasks/` (README, `tasks.json`, `styles.json`, author-only `design-notes.md`, `hint-audit/`).

| Task | Style | Steps (pressure family) |
|---|---|---|
| `repair-cafe` | Hexagonal | intake + text messages (first sender) · spare parts, "sent the same way" (reuse of a concrete sender; second outbound) · signed-in fixers (rule needs headers) · text-outage fix (time pressure; runtime switch; retry timer) · council upload (new infrastructure; report) |
| `school-bus` | Clean | routes + GPS webhook · delay and cancellation e-mails (sender; two features that call each other) · boarding taps + push channel choice (second sender; time-based check) · clock-skew fix + per-route mute (time pressure; runtime switch) · audit + punctuality report (header actor; atomic change) |
| `vineyard-harvest` | DDD (`src/picking/`, `src/cellar/`) | picking + cellar intake (two parts from step 1) · picker pay (data from the other part) · second weighbridge, polled (new inbound kind) · double-weighing fix (aggregate insides; time pressure) · harvest dashboard with shared identifiers (cross-context report) |
| `ice-rink` (spare) | Layered | sessions + skate hire + payments · club ice time (reuse of the capacity rule) · ice sensors + text messages + refunds (new inbound, new sender) · oversell race fix (time pressure; lock at the store) · weekly report "quickly for a whole season" |

Hint audit: **0 FAIL** in all 20 requests, under each task's own preset and under each of the other three presets;
WARN verdicts in the fixture README. Layout frames: 0 FAIL; the same frames audited as no-hint frames FAIL, as they
must. `ice-rink` needs a layered style in the harness (`scripts/lib/loop/style.ts` has clean, hexagonal, ddd) and is a
spare. The authoring session never read the sealed directory, so **the sealed-list domain check is still the author's
to do** before any run (fixture README).
