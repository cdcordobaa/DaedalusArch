# BF-01: brownfield norm derivation by an LLM, a design that can fail

**Status:** design v1, 2026-10-18. Thinking note, written before any model call. Track: C2 derived norms (role N2), exploratory, running in parallel (`ops/decisions.md` "Clarified" line and M2; `ops/03-build-list.md` row C2). No confirmatory claim comes from this note: M2 keeps those in greenfield. Comment inline with `> AUTHOR:`.

---

## 1. The question

An LLM reads an existing repo through the instrument's graph query layer (C1c), plus the code, the declared style claim and the docs (README, ADRs, CONTRIBUTING). **Can it propose the norm set that a written spec declares?**

**What "the norm set" means here.** Every external spec copies its preset's `fitness_functions:` verbatim and authors only the `architecture:` block (`Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md` §2). So "recall of the declared rules" is mostly recall of six things:
- **U1** the style;
- **U2** the layer set and the file-to-layer map;
- **U3** the allowed layer edges or the layer order;
- **U4** the enabled functions and their parameters (`forbidden_imports`, suffixes);
- **U5** the DDD declarations (contexts, aggregates, value objects);
- **U6** the excludes.

## 2. Inputs and output

**Inputs:**
- a clone at the pin from `results/v1.3-external/selection.json`;
- the matching `presets/<style>.yaml`. The style is given, because every repo states its style claim in its README;
- the arm's tools (§5).

**Output:** two files, extracted by the driver from the final message. The model has no Write tool.
1. `derived.yaml`: a spec in the existing format, the preset with the `architecture:` block authored, as in the B protocol (`results/v1.3-spec-author-b/spec-rationale.md`).
2. `evidence.json`: one entry per rule unit, with `origin: proposed` and at least one citation.

The A3 contract says the per-rule origin tags are new (`ops/01-instrument-map.md` §3). **Unverified:** whether the spec parser tolerates extra keys. The sidecar file avoids the question.

**Citation types.** Each is checked mechanically, with zero calls:

| Type | Form | Check |
|---|---|---|
| doc | `{file, line, quote}` | the quote appears verbatim at that line, at the pin |
| stat | `{query, numerator, denominator}` | the driver re-runs it on the parser graph A1 (cypher-interp) and gets the same counts |
| pattern | `{glob, count}` | picomatch over the tracked files gives the same count |

A unit with no verified citation is **unsupported**. It is dropped from the scored spec, and the drop rate is reported.

## 3. The truth

**Reference A:** the 15 specs in `results/v1.3-external/specs/`, written before any tool run (commit `57ee885d`). Three repos per style:
- clean: pvarentsov, luizomf, dannielhugo;
- layered: bulletproof, w3tec, talento90;
- nestjs: zeldaplay, neoteric, vivify;
- hexagonal: conduit, ddialar, nest-products;
- ddd: ddd-forum, finance-project-ddd, event-sourcing-ddd.

**Reference B:** the blind second author's specs (`results/v1.3-spec-author-b/specs/`, N01/N02).

**A caveat that must travel with every number.** A and B were both written by Claude sessions (`v1.3-spec-author-reliability.md`, "Same vendor"). So "the truth" here is a Claude-written reading, not a human one.

**Metrics.** All are scored with zero calls.

| Metric | How | Tool |
|---|---|---|
| Style | exact match, U1 (near-trivial, reported but not credited) | — |
| File-to-layer agreement | per-repo κ against A and against B; label basis is the layer kind | `scripts/v1.3/spec-author-agreement.ts` |
| Rule recall and precision | over the units U3–U6 as sets: edges, enabled functions with their parameters, DDD file sets (Jaccard). Pooled and per style | rule-mining §1.4 (A) edge P/R |
| Verdict | pass/fail and blocking count under `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3`; agreement with A over 15, Bland–Altman on the blocking difference | existing CLI |
| Absorption | the share of A's blocking findings that the derived spec allows (§6) | new, about 40 lines |
| Stability | verdict flips across the 3 runs of one arm on one repo | — |

**The benchmark is the second human-style author.** B against A gives:
- per-repo κ: 0.46–0.96;
- pooled κ: 0.77;
- verdicts: 10/15 the same, verdict κ 0.21.

The operational success reading is **non-inferiority**: a derived spec agrees with A at least as well as B does, repo by repo.

## 4. Baselines

- **M, deterministic mining.** `daedalus mine-rules --project <clone> --out` (`src/cli/cli.ts:706`; `Docs/v1.3/rule-mining.md`). It is ISE plus the miner, offline, with zero calls. On the reference variants, mined specs caught 24/52 planted violations against 50/52 under the hand-written specs, and DDD only 1/12 (N07, `rule-mining.md:280`).
  - Its run on the 15 external specs is the zero-call baseline already in progress (`ops/03-build-list.md`). This design reuses it and does not duplicate it.
- **B, the second blind author.** Not re-run. It gives the ceiling-style comparison in §3.

## 5. Arms

All arms use the same pinned model, `claude-sonnet-5-5`, the same frame, the same caps and the same scoring.

| Arm | Tools | cwd |
|---|---|---|
| **G** graph + files | `Read, Grep, Glob`, plus a **read-only fact server** | the clone root |
| **R** raw files | `Read, Grep, Glob` only | the clone root |
| **M** mining | none, deterministic | — |

The contrast between G and R is *adding graph tools*. Unlike EFF-01, G also keeps file access, because the docs are evidence.

**The fact server is a build item and a decision.** Today's MCP surface is a verdict API, and it needs a spec (`--spec`, `src/mcp-server/main.ts:5`). It also exposes `infer_spec`, `propose_spec` and, opt-in, `propose_rules` (`src/mcp-server/server.ts:36-51`). Those would hand G the M baseline. So G gets a new spec-free, read-only surface over A1, through cypher-interp, with a row cap:
- `folder_dependency_matrix`;
- `fan_in`;
- `class_suffix_stats`;
- `implements_by_folder`;
- `query_graph`, read-only Cypher.

It carries no N1/A2 facts. **Unverified:** whether cypher-interp accepts arbitrary read-only Cypher beyond the sealed template shapes (REV-01 §6 says count-and-threshold shapes are missing). If it does not, `query_graph` is dropped, and the four fixed tools remain. **Estimate:** about one agent-day, zero calls.

> AUTHOR: approve this fact surface, or choose "G = today's tools started on the ISE spec". The second option is a "model refines mining" arm, a different treatment.

## 6. The circularity guard and its leaks

**The guard:** every proposed unit cites evidence the model did not produce (§2), and a human accepts the set at t0. Five known leaks, each with its mitigation:

1. **Instrument-made statistics (REV-01 §4a).** A majority statistic is produced by the instrument, and it is produced by the model if N1 facts feed the graph. *Mitigation:* no A2 in the fact server; stat citations are re-run on the parser graph only.
2. **A majority norm freezes drift (REV-01 §4b).** Mining at 75 % proposes no rule once erosion passes 25 % (`rule-mining.md:230`). An LLM reading "what most files do" has the same failure without a declared threshold. A fails 11/15 repos, so the external set is eroded by A's reading.
   - *Mitigation:* absorption (§3) measures this leak directly.
   - *Falsifier:* derived specs that pass repos A fails, with most of A's blocking edges absorbed, mean the derivation is describing the drift, not the norm.
3. **Selection is the model's.** A verbatim doc line is real, but the model chose it and can cherry-pick. *Mitigation:* none at this scale. It is stated.
4. **Stale docs.** A README rule the code abandoned is still evidence. *Mitigation:* report the doc-only units separately.
5. **Same-vendor truth.** A Claude-derived spec against Claude-written references inflates agreement through a shared prior (V10). *Mitigation:* the optional cross-vendor arm in §7. Otherwise this is a stated limit.

## 7. The 2-repo pilot, then 15

**Pilot repos.** Both are outside EFF-01, of different styles, and one is easy, one contested.

| Repo | Style | Files | A–B κ | A–B verdict | Doc evidence |
|---|---|---:|---:|---|---|
| **luizomf-clean-api** | clean | 177 | 0.81 | fail/fail | its README places `main` outermost (external-set report §3) |
| **zeldaplay-api** | nestjs | 101 | 0.63 | pass/fail | the "is `models/` domain?" call flipped the verdict |

**Unverified:** whether either repo has ADRs or a CONTRIBUTING file. A zero-call `ls` at the pins comes first.

**What the harness reuses** (as EFF-01 §11):
- `scripts/lib/generators/argv.ts`;
- `checkArmArgs` and `withMcpServer` from `arms.ts`;
- `parseEnvelope`;
- `turnUsage`, `judgeModelUsage` and `runWithRetries`;
- the stub runner in `scripts/v1.3/lib/mcp-smoke.ts`, for a zero-call `--dry-run`;
- the MCP `--call-log`.

**What is new:**
- `scripts/v1.3/bf-01-run.ts`, the driver;
- `bf-01-verify-evidence.ts`;
- `bf-01-score.ts`, which wraps `spec-author-agreement.ts` and `firewall evaluate`.

Each session runs under the clean judge config directory:

```text
claude -p "<frame>" --model claude-sonnet-5-5 --output-format stream-json --verbose \
  --tools Read,Grep,Glob --permission-prompts none --no-session-persistence --strict-mcp-config \
  [G only: --mcp-config bf01-<id>.json --allowedTools mcp__daedalus-facts__<each tool>]
```

**Caps per session:** 900 s, 40 turns and 600k processed tokens. The turn cap is applied after the fact if `--max-turns` is not accepted, as in EFF-01.

**Confinement.** Read can take absolute paths, so a session could open `results/v1.3-external/specs/`. **Unverified:** whether headless permissions block reads outside cwd. Any transcript path outside the clone invalidates the session.

**Call counts** (one call = one CLI session):

| Block | Arithmetic | Sessions | Turn ceiling |
|---|---|---:|---:|
| Dry run, scoring, evidence checks, arm M | stub and deterministic | 0 | 0 |
| **Pilot** | 2 repos × 2 LLM arms × 3 runs | **12** | 480 |
| Pilot retry ceiling | 1 per arm | +2 | +80 |
| **Full run** | 15 × 2 × 3 | **90** | 3,600 |
| Full, new sessions if the pilot frame is frozen unchanged | 90 − 12 | 78 | 3,120 |
| Full retry ceiling (10 %) | | +9 | +360 |
| *Optional:* cross-vendor R arm (Gemini, key accepted) | 15 × 1 × 1 | +15 | — |

The full run needs your OK after the pilot. EFF-01 is 150 sessions, for comparison.

## 8. Falsifiers, pre-mortem, related work

**Falsifiers.** They are exploratory, but stated before the run:

| Id | Falsified if |
|---|---|
| F1 | G's median per-repo κ against A is no higher than M's. The LLM adds nothing over mining |
| F2 | G is no better than R on κ and on verdict agreement. The graph tools add nothing for this task |
| F3 | fewer than 80 % of G's units carry a verified citation. The guard fails as operated |
| F4 | G's verdict agreement with A is below B's 10/15 |
| F5 | the verdict flips across runs on more than 1 repo in 5 |
| F6 | the median absorption is above 50 %. Drift is frozen as the norm |

**Pre-mortem: why this fails.**
- The derived YAML does not validate. *Rule:* an invalid spec scores as a failure; no repair turn.
- The model copies the preset and maps folders. Then the result is "an LLM is a third spec author", and that is still the measurable claim.
- With n = 15, three per style, everything is descriptive: no tests, per-style ranges only.
- The fact server is not ready, or cypher-interp rejects ad-hoc queries, so G shrinks to four fixed tools.
- A leak to the reference specs.
- Agreement inflated by the shared vendor.
- Token cost on the 246- and 270-file repos runs past the caps.

**Related work** named in `Docs/v1.3/research/research-gaps-and-evidence.md`. The DOIs were not re-checked for this note.
- Reflexion models: Murphy et al. 1995 and 2001.
- Conformance checking by dependency constraints: Knodel & Popescu 2007; Passos et al. 2010; Terra & Valente 2009 (DCL).
- Erosion: de Silva & Balasubramaniam 2012.
- LLMs in architecture are mostly simple prompting: Schmid et al. 2025 (SLR); Dhar et al. 2024, arXiv:2403.01709.
- From `external-labelled-datasets.md`: ground-truth recovered architectures, Garcia et al. ICSE 2013, and the effect of dependencies on recovery, Lutellier et al. TSE 2018. These are the closest precedent for "recovered vs certified".

**Unverified, collected:**
- spec-parser tolerance of extra keys;
- cypher-interp ad-hoc queries;
- the docs present in the pilot repos;
- read confinement in headless mode;
- `--max-turns` support.

---

## v2 after pilot (2026-10-19)

**Why.** In the v1 pilot (`Docs/DiagnosticRuns/v1.3-brownfield-llm-pilot-2026-10-19.md`) the graph tools replaced
reading: no G session opened a file; each made one `folder_dependency_matrix` call and cited no statistic. The
zero-call mechanism diff (§5a there) found 0 code-consistent departures from A and 0 plain errors; G's difference was
omission. NS-03 (`ops/notes/ns-03-graph-complements-reading.md`) gives the design rule applied here.

**Arms (driver `scripts/v1.3/bf-01-run.ts`, default `--design v2`; v1 stays reproducible with `--design v1`).**

| Arm | Model | Tools | Reading |
|---|---|---|---|
| **R-v2** | claude-sonnet-5-5 | Read, Grep, Glob | docs + file list supplied in the prompt; steps 1–2 |
| **G-v2** | claude-sonnet-5-5 | R-v2's tools + `daedalus-facts` (5 read-only tools) | the same steps 1–2, then step 3: check and quantify every layer, the order and any rule change with graph counts, and cite them as stat citations |
| **X** (cross-vendor) | Gemini 4 Argon (High), `gemini-4-argon-high` | **none** | the same docs + file list, one shot |

- **Same reading procedure.** Every arm's frame carries the repository docs in full, line-numbered: tracked and present
  README, CONTRIBUTING, ADR, `docs/` and architecture markdown (60k-character cap). It also carries the tracked file
  list under the analysis root. Step 1: read the docs and cite them. Step 2: inspect the structure and cite membership
  with pattern citations. G adds step 3. The graph checks steps 1–2 and does not replace them. Where code and docs
  disagree, G keeps the declared intent and states the number of disagreeing edges.
- **X runs on the repo's agy labeller route, unchanged** (`AgyCliProvider`: record-mode pre-flight with the version
  pin, the home check, an empty neutral cwd, `--sandbox`, tools inert). That route denies `read_file`, `mcp` and
  `command` in the labeller home and treats any completed tool step as an isolation stop. So **X cannot have MCP tools
  or file reads.** It gets the files-only content in the prompt (the docs and the file list) and answers in one call
  (`X_SCHEMA`: `spec_yaml`, `evidence`). It is weaker than R-v2, which can open files. The labeller home is not changed.
- **Run-time evidence gate.** As soon as a session ends, the driver checks every citation, with the mechanical checks
  of `bf-01-verify-evidence.ts`. The session **fails** when:
  - no citation verifies;
  - docs were supplied but no doc citation verifies;
  - for G, no stat citation verifies.
  A failed gate is an outcome: the session scores as an invalid spec, it is not retried, and the pilot goes on.
  Infrastructure, auth or MCP-configuration failures still stop the pilot.
- **Two references.**
  - **A** is the declared spec (intent).
  - **C** is code reality: the deterministic, zero-call reading of the parser graph by ISE + the rule miner
    (`daedalus mine-rules`, default emission), i.e. the baseline's mined spec. On both pilot repos ISE picks the
    declared style. For the 15-repo run, C must be mined with `--style <declared>`, because ISE's style is wrong on 5/15.
  Each arm is scored against A, against C and against B with the baseline's own metric functions
  (`bf-01-score.py`). The A–C gap per repo is the drift measure. A spec closer to C than to A describes the code; one
  closer to A describes the intent.
- **Unchanged from v1:** the fact server, the preset composition, the scored-spec drop rule, the caps per session
  (900 s, 40 turns and 600k tokens, after the fact) and confinement:
  - sessions run from copies of the clones outside the repository, with no ancestor `CLAUDE.md`;
  - `--restricted --disable-slash-commands --strict-mcp-config`, without `--safe-mode`, which disables every `--mcp-config` server;
  - the judge config dir with the real `HOME`;
  - the zero-call `claude auth status` preflight;
  - fail fast unless the init event lists exactly the fact server for G and nothing for R or X.

**Re-pilot count.** N = 2 repos x 3 arms (G-v2, R-v2, X) x 3 runs = **18 sessions** (Claude 12, Gemini 6). Hard cap
= N + 2 = **20 spawns**, retries and probes included. Within that, Claude ≤ 14 and Gemini ≤ 7. The order is run-major,
then repo, then arm.

**Known blocker (dry run, zero calls).** The agy pre-flight refuses: `LLM_CLI_VERSION_DRIFT: agy 1.3.6 differs from
the pinned 1.3.2` (`AGY_PINNED_VERSION`, ADR-019 item 4). Re-pinning needs a fresh isolation probe and the author's
decision. Until then, X cannot run, and the Claude arms run with `--arms G,R`.

**Falsifiers for v2:** NS-03's. G-v2 with forced reading still scores below R-v2 against A, on the scored variant.
