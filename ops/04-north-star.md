# North star: each part works on its own, then the whole instrument, then the five objectives

**Two layers of evidence.**
1. **Each part on its own.** We hand the part a correct input, compare its output with a truth of its own, and get one metric for that part. If something fails, we know which part failed.
2. **The whole instrument.** **Applicability** asks whether it works on real projects and inside the agent loop. **Validity** asks whether its findings mean what we say they mean.

**How an objective is met.** An objective is met when **every part it uses passes its own test** *and* **its whole-instrument measure passes.** SO1–SO3 rest mostly on part tests. SO4 and SO5 can only be answered by the whole instrument.

---

## Layer 1: each part, measured on its own

| Part | Correct input handed in | Truth | Metric | Today |
|---|---|---|---|---|
| C1a/b Extract + fidelity | real repos | tsc | edge precision and recall | 1.000 on imports; N33/N38 being fixed |
| C1c Query | the same Cypher on both engines | Neo4j | content differences | 0 in 72,388 statements |
| C1c Efficiency | fixed questions | answers derived from the compiler and graph | accuracy and tokens, graph tools vs raw files | designed |
| C1d Enrich | six K3/K2m cases with twins | answers written first | correct facts; 0 false facts on twins | designed |
| C1e Time and identity | histories with renames and deletions | the fix-mining taxonomy, checked by hand | identity errors | spec in progress |
| C2 Declared norms | planted seeds per rule | the planted answer | seeded recall per rule; twins pass | 50/52 under hand-written specs (N07) |
| C3 Detect | the gold norm set | blind manifests, then the hold-out | blocking recall and precision per style | blind recall 0.78 (N105); hold-out not run |
| C3m Meaning | about 60 correct findings | rater and author | κ; meaningful precision | codebook in progress |
| C4 Interpret | gold findings plus intent cases | answers written first | catch rate; false fails | 16/21 (judge, F3) |
| C5 Drift | human histories | the fix-mining survival table | reproduces it exactly | **done**: reproduces it |
| C6 Control | scripted tool calls; a dry-run agent step | expected tool answers; the evasion checklist | tools correct; evasion check runs | MCP 11 tools; evasion check not built |

## Layer 2: the whole instrument

| Question | Measure | Today |
|---|---|---|
| **Applicability:** does it run on real projects of every style and size? | external and wild sets; npx mode identical to Neo4j mode; time and memory | 36/36 identical; external 15, wild 14 |
| **Applicability:** do agents actually use it? | share of MCP steps that call a tool (≥ 80 %, or "no mechanism") | to be measured in Study 2 |
| **Validity:** correct on code it never saw? | the hold-out, run once | not run |
| **Validity:** do findings matter? | the meaning labels (C3m) | not run |
| **Validity:** does it agree with other tools? | κ against three tools, per rule | 0.913–1.000 pooled; low on some rules (N130) |
| **Validity:** does it change what agents build? | Study 2 (drift outcome) | designed, in review |

## How the objectives are met

| Objective | Parts that must pass their own test | Whole-instrument measure that must pass |
|---|---|---|
| **SO1** specs and style libraries | C2 declared | applicability: each library applies to real repos of its style |
| **SO2** graph and tooling | C1a/b, C1c, C1e, C3 | applicability: external set, npx mode, engine parity |
| **SO3** neuro-symbolic gate | C1d, C4 | rules alone vs rules plus facts on the K3/K2m set |
| **SO4** validity | C3, C3m | the hold-out, meaning labels and tool agreement |
| **SO5** agents and architecture | C5, C6 | Study 2 |

**Order of work.**
1. Make each part pass its own test (the [build list](03-build-list.md)).
2. Freeze.
3. Run the whole-instrument checks: the hold-out, the meaning labels, the 2-case pilot, the efficiency test.
4. Run Study 2.

## Changelog
- 2026-10-18: first version.
