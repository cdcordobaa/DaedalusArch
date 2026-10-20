# SEM-01: semantic validity plan for C4 and C1d (feasibility, bars, threats)

**2026-10-20. Design note. Read-only investigation, zero model calls, no Neo4j.** The only thing executed was `c4-run.ts --cases --provider mock --estimate`, which calls nothing. Not opened: `../daedalus-sealed/`, `results/v1.3-meaning/mean-01-sample.*`. The 2b pre-registration was read on its own branch (`origin/docs/study2b-prereg`, commit `eaaf3949`) and not edited.

**The plan under review (author, agreed in principle 2026-10-20).** (1) A label-free validity battery for C4 (interpretation) and C1d (semantic facts), argued from evidence in the Messick/Kane sense: (a) seeded cases with clean twins, (b) metamorphic tests, (c) known groups, (d) reliability, (e) predicted convergence and divergence with the symbolic path, (f) consequences. The semantic configuration (model, prompt, thresholds) is a declared, swappable parameter. (2) 2b keeps D primary, with D_sem as a key secondary. (3) The complementarity hypothesis: each path covers the other's weaknesses. (4) A semantic-primary study and the rule-inference study come later.

## 0. Verdict

**Feasible in stages, but not as one block before Friday.** For (a) and (d), most of what is needed is built: C4's runner, the 6 + 6 cases and the estimator exist, and C1d has its cases and a two-vendor pilot. Item (e) is free once (a) has run. Items (b), (c) and the complementarity test each need a small build (b and the test) or a design (c). Item (f) is MEAN-02, which is a later study. Two things in the current 2b registration need fixing **before the 2b run**, or D_sem cannot be read (§5, T1 and T2).

**One correction to the plan's wording.** The plan says "D_sem = D over the findings C4 judges to be real violations". C4 has **no such class**: by N1 it gives no verdict (`src/apg-enrich/ontology/interpretation.ts:40`, schema `c4-v0.2`). The registered D_sem (2b prereg §4, "Semantic layer", DELEG11) is **D minus the findings that carry a stable, grounded exception claim**. This note uses the registered definition.

## 1. What exists, per battery item

| Item | What exists (paths) | Does it reach the semantic path? |
|---|---|---|
| (a) seeded cases + twins, C4 | 6 cases + 6 twins, hashed manifests: `tests/fixtures/v1.4-c4/` (`set.json`, `README.md`). Runner `scripts/v1.4/c4-run.ts` (estimate, mock, replay, record, budget). Contract, scorer and keyword baseline: `src/apg-enrich/ontology/c4-{contract,runner,scorer,findings}.ts`. Invariance test: `tests/unit/apg-enrich/ontology/c4-invariance.test.ts`. **Never run live**: no `results/v1.4-c4/`, no cassettes | Yes, built for it. X1 to X3 (non-author row) are not filled. The manifests are unsigned, and the README says the same session wrote the runner and the cases |
| (a) seeded cases + twins, C1d | NS-02 cases: `tests/fixtures/v1.3-ontology/ns02/` plus the 4 parent cases (`ops/notes/ns-02-facts-contract-and-cases.md` §3). Pilot ran on both vendors: `results/v1.3-ontology/ns02-pilot/{claude-cli,gemini-agy}/`, note `Docs/DiagnosticRuns/v1.4-c1d-pilot-2026-10-19.md`. Gemini: defect found, 0/2 twin hits. **Claude: defect found, but 1 of 2 forbidden items hit on the clean twin** (`ShipmentNotificationService`) | Yes |
| (a) seeded operators | Structural: `scripts/lib/mutation/operators/` (MO-S01, S03, P01, C04, CV02, DF01, SO01, SO02, X01–X03), hex/DDD: `scripts/lib/mutation/hexddd/` (MO-H01–H07, MO-D01–D06), anti-patterns: `scripts/lib/mutation/antipatterns/` (AP-DUP-RULE(2), AP-FAT-CONTROLLER, AP-FRAMEWORK-LEAK, AP-PERSIST-IN-DOMAIN, AP-REPO-BYPASS). On agent code: `scripts/v1.4/seeded-recall-agent.ts`, `results/v1.4-seeded-recall-agent/summary.md` | **MO-\* operators are structural.** They test the symbolic rules. For C4 they serve only as **doc-free negative controls**: a seeded edge with no permitting prose must get no exception claim. **AP-\*** are semantic-ish. AP-DUP-RULE is close to SEM-DUP (K2m), and AP-FAT-CONTROLLER and AP-PERSIST-IN-DOMAIN are close to SEM-MISPLACED (K3). They test judge-style and C1d detection, not C4 |
| (b) metamorphic | Symbolic only: `scripts/v1.3/lib/metamorphic.ts` and `scripts/v1.3/metamorphic-run.ts`. 13 transforms on 71 reference variants, `results/v1.3-metamorphic/summary.md`. Rename, reorder, reformat, type-import and path-alias were 71/71 invariant. Merge 58/71, barrel-add 67/71, rename-opaque 61/71. Rename identity: `scripts/lib/drift/git-rename.ts`, `scripts/lib/drift/identity.ts`, `scripts/v1.4/tier-a/n123-rename-rescore.ts` (rename continues a violation) | **No semantic metamorphic driver exists.** The transforms edit code and the spec, never docs or ADRs, so a rename that leaves an ADR naming the old path changes the meaning for C4 (§4) |
| (c) known groups | `tests/fixtures/v1.3-reference/{clean-architecture,layered,hexagonal,nestjs,ddd}/` (clean, `vNN` violating, `nNN` near-miss variants, expected findings). `scripts/v1.3/known-groups.ts`, `results/v1.3-known-groups/` (external vs wild, symbolic) | The variants carry **no docs or ADRs**, so they are no known-group test for C4. They can be one for C1d (K3 variants such as `layered/v08-business-service-takes-express-request`) |
| (d) reliability | Two runs per finding (C4-01 §4.2 rule 6). Agreement stats: `scripts/v1.3/lib/meaning/agreement.ts` (κ, AC1, Wilson). Routes `claude-cli`, `gemini-agy`, `gemini-api`, `mock`: `src/apg-enrich/ontology/routes.ts`. Prior judge figures: Opus vs Sonnet κ = 0.77, AC1 = 0.93 on 100 units (`results/judge-robustness/summary.json`). Gemini vs Claude on a shared prompt, κ = 0.954 (L70) | Yes. The CLI routes set no temperature, so a rerun is not a draw at a known temperature |
| (e) convergence / divergence | Symbolic vs judge v2.2 matrix: `scripts/v1.3/complementarity.ts`, `results/v1.3-complementarity/scores.md` (rerun: `results/v1.4-u2/complementarity/`). On 35 deduplicated seeds, the symbolic path sees 9/35 = 0.26 [0.14, 0.42], and the judge catches 22/26 = 0.85 [0.66, 0.94] of the seeds the symbolic path does not see | The judge is dropped (V7 waived). C4 cannot diverge on a verdict **by construction** (C4-01 §4.4), so divergence shows only in `exceptionClaim` and `intentMatch` |
| (f) consequences | MEAN-02 part (a), designed and reviewed, not built (`ops/notes/mean-02-agentic-meaning-design.md` §2, §6: pilot 22 sessions, main 264). 2b acceptance runs after the run on stored snapshots (DELEG6, `ops/decisions.md:46`) | Yes for MEAN-02. On 2b it is descriptive only (§2, row f) |
| Rule inference | BF-01: `ops/notes/bf-01-brownfield-norm-derivation.md`, `results/v1.3-brownfield/llm-pilot*/` | Deferred by the author. Not part of this battery |
| 2a semantic scoring | Not run, 0 calls. Estimates: `results/v1.4-exploratory/stage-c/semantic/{c1d,c4}-estimate.txt`. C4: 17 identities, 34 expected calls. C1d: 112 to 154 calls per snapshot at the upper bound | All 17 of 2a's identities are FF-S03 composition-root wiring (`Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md` §5, §10) |

## 2. Per-item status, calls and pre-registrable bars

Calls are **per vendor**, as expected / upper bound with one retry. "Measured" means printed today by `c4-run.ts --cases --provider mock --estimate`. Every other figure is derived from the cited estimator outputs. Bars from C4-01 §7 and trust-01 row L3 were dated 2026-10-19, before any C4 call. **The new bars are dated by this note, before any call.**

| Item | Status | Calls per vendor | Pass bar (pre-registrable) |
|---|---|---|---|
| (a1) C4 pilot, pairs 1–2 | **Feasible now** (cases exist, runner exists). Needs the manifests accepted under DELEG | **8 / 16** (measured) | Case 1 and case 2 correct in both runs, both twins clean, citations grounded (C4-01 §7). One prompt fix allowed after a failure, logged |
| (a2) C4 six cases + twins | Feasible now, after (a1) | **32 / 64** (measured, about 28.6k prompt tokens). Cap 80 | ≥ 5/6 correct, **0 false exception claims on the 6 twins**, correct on both near-miss twins 3 and 4, where the keyword baseline fails. Hallucinated citations reported (C4-01 §7). Every figure printed with its Wilson 95 % interval |
| (a3) C4 doc-free negative control (new) | **Small build**: seed MO-S01/MO-S03 edges into 6 agent snapshots that have no docs, with `seeded-recall-agent.ts` sites, then run `c4-run.ts --project` on each | 12 findings × 2 = **24 / 48** | **0 stable exception claims** out of 12 (rate ≤ 0.24 at 95 %) |
| (a4) C4 non-author row X1–X3 | **Needs a build**: the zero-call selection script, plus Gemini for the blind key and the X3 pair | **8–16 / 32** (C4-01 §9) | ≥ 2/3 correct, 0 false claims on the X3 twin. Reported separately, never pooled |
| (a5) C1d six cases + twins | Feasible now | **≈ 202–214**, hard cap 360 (NS-02 §5) | trust-01 L3: ≥ 5/6 defects found, **0 twin false positives**, both vendors, hallucinated facts rejected. Heuristic baseline in the same table (C4-01 §6.2). **The Claude pilot already broke the twin bar once** (1/2 on case-04b) |
| (b) metamorphic, C4 | **Small build**: a `scripts/v1.4/` driver that reuses `scripts/v1.3/lib/metamorphic.ts` (import only), plus doc-aware transforms (§4) | 12 targets × 6 transforms × 2 runs = **144 / 288**. Pilot on pairs 1–2: **48 / 96** | **Meaning-preserving (MP):** exception label and `intentMatch.status` unchanged on ≥ 11/12 targets per MP transform, and 0 new claims on any twin. **Meaning-changing (MC):** the label moves as the manifest says on ≥ 5/6 targets per MC transform. **Paraphrase MP** must hold on the targets where the keyword baseline flips |
| (b') metamorphic, C1d | Small build (the same driver over `ontology-run.ts`) | 2 defect cases × 3 transforms × ≈ 18 = **≈ 108** | Required facts kept and 0 new forbidden hits under MP transforms on ≥ 5/6 case-transform cells |
| (c) known groups | **Needs design.** C4: there are no docs-bearing groups beyond (a) and the X row. C1d: the K3 reference variants vs their clean variant | C1d: about 20–40 per variant (estimator a + b + c, NS-02 §5 scale). About 10 variants = **≈ 300** | Direction only, stated now: SEM-fact rate on violating K3 variants > on clean, and 0 forbidden facts on clean. Exact one-sided test reported, not gated |
| (d1) within-vendor reliability | Feasible now (built into (a)) | +16 for a 3rd run on the 16 six-case findings | Exception-label disagreement between runs on ≤ 2/12 targets (C4-01 falsifier 5). Flip rate printed with Wilson |
| (d2) vendor swap | Feasible **after about Oct 25** (Gemini quota). It needs a dated model id or agy pin (D2; the 2a report §10 notes that no `gemini-api` model id is pinned) | Cases **32 / 64**. On the 2b identities **≈ 380 / 750** | Cross-vendor disagreement on the exception label on ≤ 2/12 targets (C4-01 falsifier 3). κ and AC1 reported, **never read as accuracy** |
| (d3) prompt sensitivity (new) | Small build: a paraphrased prompt as a declared second configuration, in a new file, not in `src/` | 32 / 64 | The exception label changes on ≤ 1/12 targets |
| (e) convergence / divergence | **Feasible, 0 extra calls** (computed from (a), (a5), the 2b outputs and the symbolic results) | 0 | Registered predictions, §3. Each one holds or is reported as failed |
| (f) consequences | 2b: descriptive, after the run. Real test: **MEAN-02 (a), a later study** | 2b: 0 extra (acceptance is zero-call). MEAN-02: 22 sessions (pilot), 264 (main) | 2b: no bar. A null or degenerate result is expected (§3 P4). MEAN-02 bars stand as written (S1 positive control, exact sign test on S3/S5/S6) |
| Complementarity (plan item 3) | **Small build** (§4.2) | N arm ≈ 100 new, plus (a5). The old seed set replays from the judge cassettes, if they are complete | §4.2 |
| 2b D_sem | Built, but the registration needs a fix first (T1) | **≈ 380 expected, cap ≈ 750** (prereg §4, item 4) | No bar (secondary). Reading per contrast: "survives" or "depends on the semantic layer" |

## 3. Registered predictions for item (e)

These are written before any C4 call. Each is a falsifiable statement, not a bar on accuracy.

- **P1 (divergence where meaning differs).** On the C4 case set, a stable exception claim appears **only** on cases 1–4. On case 5 and on all six twins, C4 converges with the symbolic verdict: no claim.
- **P2 (C1d sees what the rules cannot).** On the NS-02 K3/K2m defect cases, symbolic recall without A2 is 0 by construction. C3 with SEM rules over agreed-only A2 finds ≥ 5/6. On the structural MO seeds, C1d adds no SEM finding.
- **P3 (2b, greenfield).** In each cell, D_sem counted **over claims that cite non-agent text only** equals D. A greenfield project has no developer intent to discover (C4-01 §8). So any gap between D and D_sem counted over all claims is an **evasion signal**, not complementarity.
- **P4 (2b consequences).** At 2a's rates, every identity is composition-root wiring (FF-S03). With no docs present, `intentMatch` is mostly `no-declared-intent`, so C4's classes vary too little to predict acceptance. The prediction is that "predicts acceptance failure" is **not estimable on 2b**. Reporting it otherwise would be over-reading.

## 4. Design points the plan needs

### 4.1 Metamorphic tests for C4 are not the symbolic ones

- **C4 sits downstream of the symbolic finding set.** A transform that changes the finding set never reaches C4. Under Q25 = B, `server.ts` → `main.ts` makes the file exempt, so the finding disappears and C4 never sees it (2a report §8, `main-ts-probe.txt`). That transform tests **the symbolic path and the neural-alone arm**, not C4. It belongs to the complementarity test (§4.2) and the evasion measures. It does not belong to C4's battery.
- **Doc-aware MP transforms** (new): rename a class or file consistently in code **and** in docs. Reorder doc sections. Move the permitting sentence from an ADR to the README. Reformat. Reorder imports. Paraphrase the permitting sentence with no keyword from the baseline list (`allow`, `permit`, `exception`, `legacy`, `shared`).
- **MC transforms** (new): flip the ADR status to Superseded. Insert a negation. Retarget the permission's scope to another file. Change "Accepted" to "Proposed".
- **Leak and ease guards.**
  - Paraphrases come from a **fixed template list committed before any call**, not from a Claude session. A model-written paraphrase would bring back the circularity of T3.
  - A transform that leaves the old path in an ADR is labelled MC, not MP.
  - A zero-call check asserts that no fixture id, `twin`, `expected` or manifest text reaches the prompt. A check by hand of the twin README and docs found none.
  - A transform counts only if it changes the prompt bytes. A no-op is excluded, as in `metamorphic.ts` (`applied: false`).

### 4.2 The complementarity test (plan item 3)

Under N1, "combined" in this instrument does not mean a vote. It means **C3 with SEM rules over agreed-only A2 facts**. The arms are therefore these:

| Arm | What | Calls |
|---|---|---|
| S, symbolic alone | C3 at the freeze tag, no A2 | 0 |
| N, neural alone | An LLM judge reading the code, blind to the symbolic findings. Use judge v2.2 as frozen (`src/llm-critic/judge-v22.ts`), with its symbolic candidate-flag section disabled, or a code-only prompt declared as a configuration in `scripts/v1.4/` | ≈ 50 units × 2 runs ≈ 100 on the NS-02 set. The v1.3 seed set: replay if its cassettes cover it |
| S+N, the instrument | C3 + SEM rules over A2 (the C1d six-case run, item a5) | counted in (a5) |
| S ∪ N, reference only | The union, an upper bound on recall | 0 |

- **Truth set** (by construction): the NS-02 K3/K2m cases and their twins; the MO-\* and AP-\* seeds on reference and agent code, with their `n` twins; the 48 clean units of `results/v1.3-complementarity/clean-units.csv`.
- **Measures:** recall and false-positive rate per arm, each with a Wilson interval. **Error overlap:** the 2 × 2 of misses for S vs N, the Jaccard of the miss sets, and the exact McNemar count of discordant items.
- **Bar ("complementarity supported", stated now):**
  1. each single arm misses ≥ 2 truth items that the other catches;
  2. the Jaccard of the miss sets is < 0.5;
  3. S+N recall exceeds both S and N;
  4. S+N's false-positive count on twins and clean units is ≤ that of S plus 0 (the N1 design is meant to add recall without false positives).
- If (3) holds but (4) fails, the reading is "complementary in recall, at a precision cost".
- **What the old matrix already shows.** On the v1.3 seed set the miss sets barely overlap: S sees 9/35, and N catches 22/26 of what S does not see, with 2/48 false fails on clean units. But N there is the judge (dropped), it was shown candidate flags, and the seeds were designed for it. Cite it as **prior development-set evidence, exploratory**, never as the test.

## 5. Threats

**B** means it blocks the named result. **–** means it does not block.

| # | Threat | Mitigation | Residual risk | Blocks? |
|---|---|---|---|---|
| T1 | **D_sem rewards evasion.** The registered D_sem drops every finding with a stable, grounded exception claim. In greenfield 2b, every doc or comment C4 can cite was written by the agent. C4-01 §8 says such a claim is never legitimate. So an agent that writes "presentation may import persistence" into an ADR lowers D_sem, and the "depends on the semantic layer" reading would then count evasion as complementarity | **Before the 2b run** (prereg owner, as a dated note before dating): report D_sem two ways, over all claims and over claims that cite non-agent lines only (task text, spec, the unchanged skeleton), plus the count of evasion candidates per cell. The provenance classifier (C4-01 §11 item 9) is not built. It is small, zero-call and goes in `scripts/v1.4/`. **This note does not edit the prereg** | If it is fixed after any 2b output is seen, it is a deviation, and the D_sem reading turns exploratory | **B** for the D_sem reading. Not for the 2b run |
| T2 | **The C4 pilot has never run.** The six manifests are unsigned. The case author is the runner's author. The blind second keying waits for Gemini | Run (a1), then (a2), under DELEG with Claude before any C4 call on 2b, as the prereg already requires ("the C4 pilot (C4-01 §7) has never run"). The Gemini blind key is added after Oct 25 and reported, never resolved | The six cases measure "a model reads textbook cases written to be read" (REV-05). Only X1–X3 escape that | **B** for D_sem if (a1)/(a2) fail or do not run: then D_sem is "not run". This is already registered |
| T3 | **Circularity.** Claude sessions wrote the C4 and NS-02 cases and their prose. Claude Opus judges them | X1/X2 are real external findings. X3 is Gemini-written and labelled per vendor. The MO/AP seeds are produced by deterministic code. The paraphrase templates are fixed in advance (§4.1) | High on (a). Claim scope: "on author/Claude-written seeded cases" | – (limits the claim) |
| T4 | **Same-vendor bias.** Claude Opus reads code written by Claude Sonnet in 2b | The Gemini swap arm after Oct 25, on the same stored snapshots, with no agent re-run. Prereg limitation 10 already reads results "under the Claude configuration" | Gemini agreeing is consensus, not truth (L70, κ = 0.954 on a shared prompt) | – |
| T5 | **Anchoring.** C4 sees the rule id and the finding first, by design (C4-01 §4.1) | Accepted for C4: its job is to interpret a given finding. Complementarity is measured with the **blind N arm** (§4.2), never through C4. A blinded C4 variant (site only, no rule id) is a later configuration in a new file | C4 cannot show that it would have found a violation itself. Do not claim that | – |
| T6 | **Easy or leaking metamorphic tests** | §4.1 guards: doc-aware MP vs MC, fixed templates, the leak check, no-ops excluded, the paraphrase built against the keyword baseline | Small hand-built families | – |
| T7 | **Prompt sensitivity** | One logged fix after the pilot (C4-01 §7). Item (d3): a paraphrased prompt as a declared configuration | n = 12 shows large effects only | – |
| T8 | **Run-to-run nondeterminism** (no temperature on the CLI routes) | 2 runs, with a claim counted only when stable (`single-run` claims are dropped). A 3rd run on the case set for the flip rate. On 2b, 2 runs as registered | With 0/12 flips the 95 % bound is still 0.24. More runs narrow it slowly (0/36 → ≤ 0.10). That is enough for go/no-go, not for a rate | – |
| T9 | **Agreement mistaken for accuracy** | Accuracy only where truth exists by construction: (a), (b), the §4.2 truth set. On real or agent code only agreement is reported, and labelled so (prereg §4, item 3) | Readers may conflate the two. The wording is fixed in §7 | – |
| T10 | **Cap and cost** | Every run goes through `--estimate` first, with a hard `--budget`. Claude CLI runs locally on the subscription. Two lanes and one capped Neo4j (none needed here). Total before Friday: about 40 C4 calls, plus up to about 380 for 2b C4 | The 2b C4 run (≈ 380 at about 30–60 s each, one lane) takes hours. It competes with 2b scoring on Friday | – |
| T11 | **Gemini quota** (resets about Oct 25). agy 1.4.2 is unpinned (D2) | Every Gemini figure is a dated swap arm with its own addendum. The agy figures stay exploratory until a dated pin. `gemini-api` needs a pinned model id | The cross-vendor items (d2) and the blind keying slip past Friday | – (2b is registered Claude-only) |
| T12 | **D_sem depends on C4's class definitions.** It moves only through `exceptionClaim`, and `intentMatch` and `severityClass` cannot remove a finding (prereg) | State it in the D_sem row: D_sem tests "if every proposed exception were accepted", nothing about real vs false violations. Under P3, D_sem over non-agent claims is expected to equal D | A null D vs D_sem gap is predicted, so it is weak evidence of complementarity. The complementarity result comes from §4.2, not from D_sem | – (wording) |
| T13 | **Multiple comparisons.** The battery has about 15 checks | Battery bars are **go/no-go conditions on designed sets**, not hypothesis tests, so there is no Holm. The thesis reports "k of K bars passed", with every bar listed here in advance and every failure shown. Only the semantic-primary study gets a confirmatory family, with Holm | Readers may still cherry-pick | – |
| T14 | **Forking paths** | Every bar is fixed in C4-01 §7, trust-01 L3 and this note **before any call**. One logged prompt fix. A bar changed after pilot output turns that item exploratory, with what was seen stated | The (c) and (b') bars are thinner. They are marked "direction only" | – |
| T15 | **Frozen paths** | **Nothing in this plan edits `scripts/v1.3`, `src` or `presets`.** The new drivers go in `scripts/v1.4/`, and they import frozen code. The C4 and C1d configuration in `src/apg-enrich/ontology/` stays frozen. New configurations (a paraphrased prompt, a blinded C4) go in new files with new version ids, after Friday | — | – |
| T16 | **C1d under Claude failed its twin bar at the pilot** (1 false positive on case-04b) | Run (a5) on both vendors. If Claude fails "0 twin false positives" again, the C1d rates on 2b are reported as "under a configuration that failed its twin bar" | C1d's validity claim may hold for Gemini only | **B** for any C1d validity claim under Claude. Not for 2b |

**Top five:** T1 (registration fix before the run), T2 (C4 pilot before D_sem), T3 and T4 (scope of every claim), T5 (complementarity through the blind arm, never through C4), and T16.

## 6. Sequencing to the deadline

| When | What | Calls |
|---|---|---|
| **Before the 2b run (Tue 20–Thu 22)** | Merge this note, so the bars are dated before any call. T1: the prereg owner adds the two-way D_sem and the evasion count before dating. **The coordinator relays this; this note does not touch the prereg branch.** Build the provenance classifier and the D_sem writer split (zero-call, `scripts/v1.4/`). (a1) C4 pilot, then (a2), with Claude, on a free lane only (2b and 2a scoring have priority) | 8–16, then 32–64 |
| **Fri 23 (scoring)** | D at the tag (primary). If (a2) passed: C4 on the 2b identities, then D_sem two ways, plus evasion candidates. If not: "not run", as registered. C1d on the 12-snapshot sample only if its cap is fixed and dated first | ≈ 380 (cap ≈ 750), plus the C1d cap |
| **After Oct 25 (Gemini)** | Blind Gemini keying of the six manifests and of X1/X2. X3 pair. (a2), (a5) and the 2b C4 under Gemini as dated swap arms. (d2) agreement. The agy or `gemini-api` pin | 32–64, ≈ 210, ≈ 380 |
| **Week of Oct 26 (small builds)** | (a3) doc-free negative control. (b) metamorphic driver and its pilot. (d3) prompt variant. §4.2 N arm. (a5) C1d six cases, Claude half | 24–48, 48–96, 32–64, ≈ 100, ≈ 210 |
| **Semantic-primary study (later, pre-registered)** | Full (b) and (b'), (c) known groups for C1d, the complementarity test as its confirmatory family with Holm, a blinded-C4 configuration, MEAN-02 (a) for (f). This battery is its validity case | ≈ 1,000+ calls, plus 264 MEAN-02 sessions |
| **Rule-inference study** | Deferred (BF-01). Out of scope here | — |

## 7. Thesis claims each stage would support (exact wording)

- **After (a1)–(a2), Claude only:** "On six author- and Claude-written seeded cases with clean twins, C4 under the Claude configuration interpreted *k*/6 correctly [Wilson CI] and made *f* false exception claims on six twins. By construction, it changes no verdict." It is **not** "C4 is valid" and **not** "C4 detects exceptions in real code".
- **After the swap arm (d2):** add "...and under a second vendor *k′*/6; cross-vendor agreement κ = …, AC1 = … (agreement, not accuracy)."
- **2b D_sem:** "The symbolic conclusion of contrast H*i* survives (or depends on) semantic interpretation under the Claude configuration. Counted over non-agent citations, D_sem = D, as predicted for greenfield code. Agents produced *e* exception claims citing their own text (evasion candidates)." It is **not** "neural and symbolic are complementary".
- **After (b), (d), (a3) and (a4):** "C4's interpretations were invariant under *m* of *M* meaning-preserving transforms and moved under *n* of *N* meaning-changing ones, and held where a keyword baseline failed. This is evidence for the response-process and structural aspects of validity, on designed cases."
- **After §4.2:** "On items with truth by construction, symbolic and neural-alone detection fail on largely different items (miss-set Jaccard = …), and the combined instrument (symbolic rules over model facts) reaches recall … against … and …, at false positives …." This is the **complementarity result**, and it is scoped to seeded and designed items.
- **After MEAN-02 (a):** "A violation makes the change it forbids harder for a coding agent, at pilot scale." It is never "meaningful to practitioners".

## 8. Code to build (none written by this note; all zero-call, mock-tested, under `scripts/v1.4/`)

1. The provenance classifier and the D_sem writer, with the all-claims and non-agent-claims split (T1). **Before the run.**
2. The doc-aware metamorphic driver for C4 and C1d, with fixed paraphrase templates and the leak check (§4.1).
3. The doc-free negative-control generator: MO seeds on agent snapshots, then `c4-run.ts --project` (a3).
4. The X1/X2 selection script (C4-01 §6.1).
5. The N-arm driver: frozen judge v2.2 with the flags section off, or a code-only prompt, plus the §4.2 scorer (miss-set 2 × 2, Jaccard, McNemar, Wilson).
6. The prompt-variant configuration (d3), as a new file with a new version id.

## Changelog
- 2026-10-20: first version (zero model calls).
