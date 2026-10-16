# DaedalusArch v1.3: replication package

This package lets an examiner or reviewer regenerate the v1.3 development results (write-ups in
`Docs/DiagnosticRuns/*2026-10-1[456]*.md`) from the committed inputs. It separates:

- **deterministic** results, which are expected to come out **byte-identical** to the committed files;
- **model-dependent** results, which are replayed from the committed **cassettes**. A live re-run needs the reader's
  own credentials. No credential is included anywhere in this repository.

The independent audit of every headline number is in
[`Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md`](../Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16.md).

## 1. Environment

| Component | Version / pin | Role | Needed for |
|---|---|---|---|
| Node.js | **v22.22.0** (`engines: >=22`; the live APG v2 runs used v24.5.0) | runtime | everything |
| npm | 10.9.4 | `npm ci` from `package-lock.json` | setup |
| tsx | 4.21.0 (lockfile) | runs the TypeScript scripts | everything |
| TypeScript | 5.9.3 (lockfile) | the type-checker, the second graph extractor, and the type-check of seeded copies | graph fidelity, seeding |
| ts-morph | 25.0.1 (lockfile) | the APG extractor | everything |
| dependency-cruiser | **18.4.0**, own lockfile in `experiments/tool-comparison/depcruise` | the reference extractor (graph fidelity) and the baseline tool (APG v2 ablation arm c) | graph fidelity, APG v2 ablation |
| Neo4j | **5.26-community + APOC**, image pinned by digest in `docker-compose.yml` | the graph store for `firewall evaluate` | live tool runs only (see §3) |
| neo4j-driver | 5.28.3 (lockfile) | client | live tool runs only |
| Claude Code CLI | **2.1.294** (`PINNED_CLI_VERSION`, `src/llm-critic/frozen.ts`), installed under its own prefix (`~/.firewall/judge-cli`) | the **judge** (model `claude-opus-5-5`, effort high, 3 runs per unit). Record mode fails closed on any other version (`LLM_CLI_VERSION_DRIFT`). | live judge re-runs only |
| Codex CLI | **0.162.1** (`Docs/generator-protocol.md`), model `gpt-5.6-terra` | the E1 **generator** (Study 1 projects), and the "meaningful" **labeller** of the labelling study (reasoning effort medium, read-only sandbox) | live generation / labelling only |
| agy CLI | 1.3.2 (`AGY_PINNED_VERSION`) | labeller route of v1.2e (`Docs/labeller-route.md`); not used by the v1.3 results | none here |
| Gemini API | `@google/generative-ai` 0.24.1 | alternative labeller provider (`--provider gemini`); not used for the committed v1.3 labels | none here |

Inputs **outside** this repository that some regenerations need. They are sibling checkouts on the author's machine,
not in git:

| Input | Used by | Status for a reviewer |
|---|---|---|
| `../daedalus-e1-outcomes` (the 72 generated E1 projects) | graph fidelity `e1`, ISE E1 inference, round-2 / DUP-RULE v2 seeding, labelling E1 correctness, Study 1 E1 reports | not distributed with the repo; the derived per-project outputs are committed |
| `../daedalus-so4`, `../daedalus-corpus` | graph fidelity `so4`, Study 1 SO4 reports | same |
| `daedalus-sealed/v1.3-blind` (the blind reference manifests) | `ue-score.ts`: the blind-primary scores of the reference runs | sealed by design; the scores are committed |

## 2. Setup and smoke test

```bash
replication/setup.sh            # npm ci (root) + npm ci (pinned dependency-cruiser); checks versions
replication/smoke.sh            # regenerates the offline deterministic results and compares them byte for byte
replication/setup.sh --neo4j    # optional: starts Neo4j 5.26 + APOC (needs NEO4J_PASSWORD in .env, see .env.example)
```

`smoke.sh` exports `git archive HEAD` into a scratch directory and runs every step there, so the working tree is
never written. It unsets every API key and the `NEO4J_*` variables first. It needs no Neo4j, no model and no network,
and takes about 4–5 minutes. Each file it checks is reported as one of:

- `IDENTICAL`: byte-identical to the committed file (sha256 prefix shown).
- `KNOWN`: a divergence listed in [`known-divergences.json`](known-divergences.json). Each one is explained in the
  audit doc and is checked in a narrower form, so it is never just waved through (see below).
- `DIFF` / `MISSING` / `EXTRA`: unexpected; the script exits 1.

| Step (`--only`) | What it regenerates | Compared against | Result on 2026-10-15 |
|---|---|---|---|
| `gf` | graph fidelity harness, `project` mode, on the 5 reference fixtures (`tests/fixtures/v1.3-reference`) | `replication/expected/graph-fidelity/` | 25/25 IDENTICAL |
| `gfagg` | graph fidelity corpus aggregates, re-derived from the committed per-project JSON (`lib/fidelity-reaggregate.mjs`) | `results/v1.3-fidelity/{e1,so4}/aggregate.json` | 2/2 IDENTICAL |
| `ise` | ISE prototype offline measure (`ise-measure.ts`); downstream (d) replayed from the committed live rows (`ise-downstream.ts --from-raw`); ISE E1 tables (`ise-e1-report.ts`) | `results/v1.3-ise/2026-10-15/{measure.*,specs/*.yaml,downstream.*,specs/*.true.yaml}`, `results/v1.3-ise-e1/summary.*` | 22/22 + 12/12 + 2/2 IDENTICAL |
| `apg2` | APG v2 in-memory ablation + dependency-cruiser arm (`scripts/apg2-ablation.ts`), at HEAD **and** at its producing commit `72fa9203` | `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/` | at `72fa9203`: 19/19 IDENTICAL. At HEAD: 17 IDENTICAL + `ablation.json`, `table.md` KNOWN (finding C-1) |
| `cheap` | seeding (`judge-catch-seed.ts`) + cheap semantic proxies (`cheap-semantics-eval.ts`) | `results/v1.3-cheap-semantics/{rows.csv,flags/*.json,scores.json}` | 54/54 IDENTICAL. `scores.json` is compared with `generatedAt` and the `*Ms` wall-clock fields removed, and is identical. |
| `judge` | judge catch scores, rounds 1, 2 and DUP-RULE v2, **replayed from the committed cassettes** | `results/v1.3-judge-catch/{,round2/,duprule-v2/}{scores.json,rows.csv}` | 4/6 IDENTICAL. Round 1 and round 2 `scores.json` are KNOWN (finding D-5) and IDENTICAL once the empty `AP-DUP-RULE2` blocks are removed. |

About `replication/expected/graph-fidelity/`: before this package, no output of `project` mode on the fixtures was
committed. These files were generated at commit `723b3c8f`, and two fresh exports at different paths reproduced them.
The harness records the absolute project root, so the only normalisation applied anywhere is that path being
replaced by `<REPO>` (`compare.mjs --root`).

## 3. Per result: how to regenerate

All commands run from the repository root, after `setup.sh`. **D** marks a deterministic result (byte-identical
expected), **D\*** one that is deterministic apart from wall-clock fields, and **M** a model-dependent one. "Neo4j"
means Neo4j 5.26 + APOC with `NEO4J_URI`, `NEO4J_USER` and `NEO4J_PASSWORD` exported. Never commit or paste these
values.

If `npx tsx` fails with `EADDRINUSE` on its IPC pipe (a long `TMPDIR`), use `node --import tsx <script>` instead.

### 3.1 Graph fidelity (`v1.3-graph-fidelity-2026-10-14.md`)

| Result | Command | Needs | Kind | Verified here |
|---|---|---|---|---|
| `results/v1.3-fidelity/e1/**` | `npx tsx scripts/v1.3/graph-fidelity.ts e1 --outcomes ../daedalus-e1-outcomes --out <dir> [--views]` | `../daedalus-e1-outcomes`, dependency-cruiser 18.4.0. No Neo4j, no model. | D | not regenerable here (outcomes missing); see the audit for the re-aggregation |
| `results/v1.3-fidelity/so4/**` | `npx tsx scripts/v1.3/graph-fidelity.ts so4 --bases ../daedalus-so4/bases --out <dir>` | `../daedalus-so4` | D | same |
| fixtures (new) | `replication/smoke.sh --only gf` | none | D | IDENTICAL |

| `results/v1.3-fidelity/{e1,so4}/aggregate.json` | `replication/smoke.sh --only gfagg` (`node replication/lib/fidelity-reaggregate.mjs . <dir>`): an independent re-implementation of the harness's unexported `aggregate()` run on the committed `projects/*.json` | none | D | both IDENTICAL; a recount from the edge-level CSVs equals the per-project JSON in all 79 projects |

The doc's claim that "a full E1 rerun gave byte-identical outputs" has no committed second-run evidence (audit, missing
raw file).

### 3.2 Reference validation (`v1.3-reference-{baseline,after-fixes,after-member-facts}-2026-10-15.md`)

| Result | Command | Needs | Kind | Verified here |
|---|---|---|---|---|
| `raw/`, `evidence/` | `node --import tsx scripts/v1.3/ue-baseline-live.ts --out <dir>`, at the run's commit (`89e79f49` baseline, `3e8d4b48` after-fixes, `3e2c96ae` after-member-facts) | Neo4j. The CLI runs `--symbolic-only`, so no model is called. | D (`evidence/` has `elapsedMs`: D\*) | not re-run (no Neo4j) |
| `report.md`, `report.json` | `node --import tsx scripts/v1.3/validate-reference.ts --from-raw <run>/raw --out <dir>`. Use the `89e79f49` tree for baseline and barrels-only (literal cycle key) and HEAD for the others. | none | D | the body is identical. The header line reads "from saved outputs" instead of "live run". `report.json` is deep-equal. |
| `graph/tool-graphs.json` | `node --import tsx scripts/v1.3/ue-graph.ts --out <dir>` on `git archive <run commit>` | none | D | byte-identical for all 3 runs. HEAD differs on purpose, because the extractor changed later. |
| `scores.*`, `adjudication.csv`, `graph-agreement.json` | `npx tsx scripts/v1.3/ue-score.ts --base <COPY of run dir> --blind <daedalus-sealed/v1.3-blind>` (it writes into `--base`) | the sealed blind manifests | D | not runnable (sealed). The author views were recomputed independently and match. |

### 3.3 APG v2 (`apg2-{ablation,live,scope}-2026-10-15.md`)

| Result | Command | Needs | Kind | Verified here |
|---|---|---|---|---|
| `apg2-ablation-2026-10-15/{ablation.json,table.md,depcruise/*}` | `replication/smoke.sh --only apg2`. By hand: `git archive 72fa9203` into a dir, symlink `node_modules` and `experiments/tool-comparison/depcruise/node_modules`, then `npx tsx scripts/apg2-ablation.ts` there. The script writes into `./Docs/...` with no output flag. | dependency-cruiser 18.4.0 | D | IDENTICAL at `72fa9203`. HEAD gives CP4/CP5 FAIL (C-1). |
| `cost.json`, `cost.md` | `npx tsx scripts/apg2-cost.ts` (same export recipe) | none | D\* (ms, RSS) | files, nodes and edges identical. Timings differ, as expected. |
| `byte-identity.json` | two runs of `npx tsx scripts/apg-hash.ts` (without `--relative`) at `3e2c96ae` and on the APG v2 branch | the original checkout path | path-dependent | not reproducible elsewhere. Use `--relative` for a portable hash. |
| `apg2-live-*/`, `apg2-scope-*/` (`fixtures-live.json`, `reference-live.json`) | `npx tsx scripts/v1.3/apg2-live.ts fixtures --out <dir>` and `... reference --out <dir>` | Neo4j | D (doc claims a byte-identical rerun) | not re-run (no Neo4j). All numbers re-derived from the committed JSON. |

### 3.4 Judge catch (`v1.3-judge-catch-2026-10-15.md`, `...-round2-...`, `v1.3-duprule-v2-2026-10-15.md`)

| Result | Command | Needs | Kind | Verified here |
|---|---|---|---|---|
| `scores.json`, `rows.csv` (all three) | `replication/smoke.sh --only judge`. By hand: `npx tsx scripts/v1.3/judge-catch-score.ts --results <COPY>`, `judge-catch2-score.ts --results <COPY>/round2 --round1 <COPY>`, `judge-catch-v2-score.ts --results <COPY>/duprule-v2`. Cassettes default to `tests/fixtures/judge-cassettes-v13/**`. | none (cassette replay) | M, replayed: D | IDENTICAL, except D-5 |
| round-1 seeds (`seed-manifest.json`, `diffs/`) | `npx tsx scripts/v1.3/judge-catch-seed.ts --out <dir>` | none | D\* (`generatedAt`) | the 53 diffs reproduce |
| round-2 / DUP-RULE v2 seeds | `judge-catch2-seed.ts` / `judge-catch-v2-seed.ts --e1 ../daedalus-e1-outcomes ...` | `../daedalus-e1-outcomes` | D | not regenerable here |
| evaluate reports + verdicts (replay) | `npx tsx scripts/v1.3/judge-catch-run.ts replay <work> --cassettes <dir> --results <dir>` | Neo4j (replay calls no model, but runs `firewall evaluate`) | M, replayed: D | not re-run (no Neo4j). The vote and confidence of all 168 units were re-derived from the cassettes. |
| live judge | `judge-catch-run.ts record <work> ...` | Neo4j + Claude Code CLI **2.1.294** logged in to the reader's own subscription in an isolated `CLAUDE_CONFIG_DIR` (`~/.firewall/judge-claude-config`), with `ANTHROPIC_API_KEY` **unset** (the preflight requires `apiKeySource: none`) | M | never run by this package |

### 3.5 Cheap semantics, Study 1 rerun, labelling

| Result | Command | Needs | Kind | Verified here |
|---|---|---|---|---|
| `results/v1.3-cheap-semantics/{scores.json,rows.csv,flags/}` | `replication/smoke.sh --only cheap`. By hand: `npx tsx scripts/v1.3/judge-catch-seed.ts --out W/seed && npx tsx scripts/v1.3/cheap-semantics-eval.ts --out <dir> --seed W/seed --work W` | none | D\* | IDENTICAL (`scores.json` after stripping timings) |
| `results/v1.3-cheap-semantics/duprule-v2/` | `npx tsx scripts/v1.3/cheap-semantics-v2-eval.ts --seed <v2 seed work>` | `../daedalus-e1-outcomes` (via the v2 seeding) | D | not regenerable here |
| Study 1 E1 aggregates (`results/v1.3-study1-rerun/e1/*.csv`, `README.md`, `disabled_changes.json`) | `npx tsx scripts/v1.3/study1-rerun.ts e1-agg --run results/v1.3-study1-rerun/e1 --out <dir>` | none | D | byte-identical |
| Study 1 SO4 score + aggregates | `npx tsx scripts/score-golden-cli.ts --case results/v1.3-study1-rerun/so4/case --out <dir>/score.json`, then `npx tsx scripts/v1.3/study1-rerun.ts so4-agg --run <dir> --out <dir>` | none | D | byte-identical |
| Study 1 reports | `study1-rerun.ts e1` / `so4 --paths-root <dir>` | Neo4j + `../daedalus-e1-outcomes`, `../daedalus-corpus`, `../daedalus-so4` | D | not re-run |
| labelling, reference: jobs, sample, correctness | `npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-member-facts/evidence --materialise <dir>/variants --out <dir>/jobs.json`, then `sample-findings.ts --jobs <dir>/jobs.json --seed 20261015 --tiers all --out <dir>/sample-all.json`, then `check-correct.ts --jobs <dir>/jobs.json --tiers all --out <dir>/correctness-all` | none | D (`jobs.json` holds absolute paths) | sample and correctness byte-identical |
| labelling, E1 sample | `sample-findings.ts` on `results/v1.3-labelling/e1/jobs.json`, after rewriting its absolute paths to `results/v1.3-labelling/e1/reports/<file>` and `specs/clean-arch.yaml` | none | D | byte-identical |
| labelling, E1 correctness | `check-correct.ts` on the E1 jobs | `../daedalus-e1-outcomes` | D | not regenerable here |
| labelling, meaningful labels | `npx tsx scripts/v1.3/label-meaningful.ts ... --provider codex --model gpt-5.6-terra --mode replay --cassette-dir results/v1.3-labelling/cassettes-codex` (live: `--mode record` with Codex CLI 0.162.1 and the reader's own `CODEX_HOME`) | M | M | only `--estimate` run. The one stored answer replays, but a label needs 2 runs. |

### 3.6 ISE (`ise-prototype-2026-10-15.md`, `ise-e1-ics-2026-10-15.md`)

| Result | Command | Needs | Kind | Verified here |
|---|---|---|---|---|
| `results/v1.3-ise/2026-10-15/{measure.json,measure.md,specs/*.yaml}` | `replication/smoke.sh --only ise` or `npx tsx scripts/v1.3/ise-measure.ts --out <dir>` | none | D | IDENTICAL |

| `downstream.json`, `downstream.md`, `specs/*.true.yaml` | live: `npx tsx scripts/v1.3/ise-downstream.ts --out <dir>` (Neo4j). Replay: copy `specs/` (without `*.true.yaml`) and `raw/` into `<dir>`, then `node --import tsx scripts/v1.3/ise-downstream.ts --from-raw --out <dir>` (`smoke.sh --only ise`) | live: Neo4j; replay: none | D | replay: 12/12 IDENTICAL |
| `results/v1.3-ise-e1/{cells.json,cells/,raw/,specs/}` | `npx tsx scripts/v1.3/ise-e1.ts ...` | Neo4j + `../daedalus-e1-outcomes` | D | not regenerable here |
| `results/v1.3-ise-e1/summary.{json,md}` | copy `cells.json` into `<dir>`, then `node --import tsx scripts/v1.3/ise-e1-report.ts --dir <dir>` (`smoke.sh --only ise`) | none | D | IDENTICAL |
| `results/v1.3-ise-e1/option1.{json,md}` | `npx tsx scripts/v1.3/ise-e1-option1.ts ...` | `../daedalus-e1-outcomes` (no Neo4j) | D | not regenerable here; numbers re-derived |

## 4. Credentials and privacy

- No API key, token or password is committed. A scan of `results/`, `Docs/DiagnosticRuns/` and every cassette
  directory found none. The only `password = '...'` strings are fixture source code in the corpus (`Password123!`).
- Live re-runs use the reader's own logins: Claude Code (judge), Codex (generator and labeller), and a Neo4j
  password in a local `.env` (git-ignored, template `.env.example`).
- Some **committed** v1.3 results record the author's absolute paths (macOS user and volume names): the labelling
  `jobs.json` files, the Study 1 SO4 ghostfolio reports, and the fidelity per-project files. They are listed in the
  audit (§4). History was not rewritten. The files of this package use only relative paths and `<REPO>`.

## 5. Files

| File | Purpose |
|---|---|
| `setup.sh` | one-command setup |
| `smoke.sh` | offline deterministic regeneration + byte comparison (steps `gf`, `gfagg`, `ise`, `apg2`, `cheap`, `judge`) |
| `lib/fidelity-reaggregate.mjs` | independent re-aggregation of the fidelity corpora (step `gfagg`) |
| `lib/compare.mjs` | byte comparison of files or trees (`--root` path normalisation, `--only` filter, `--known` list) |
| `lib/strip-timings.mjs` | removes `generatedAt` and `*Ms` fields (used for `cheap-semantics/scores.json`) |
| `lib/strip-keys.mjs` | removes the named keys and array rows (used for known divergence D-5) |
| `lib/cheap.sh`, `lib/judge.sh` | smoke steps 4 and 5 |
| `known-divergences.json` | the expected `KNOWN` lines and their finding ids |
| `expected/graph-fidelity/` | expected output of the graph-fidelity harness on the fixtures |
| `smoke-2026-10-15.txt` | the full log of the final smoke run (commit `23e0d9ea`: 160 IDENTICAL, 4 KNOWN, exit 0, 4 min) |

## 6. Part 2: number-level replication (`npm run replicate:v1.3`)

Added after the results that landed on v1.3 after this package (the 54/54 FF-P06 correction, the Cypher interpreter
and its parity claim, judge v2 CHECK and the filter, wild, MCP v2, construct switches, fieldstate/cheap-fix, model
panel, pilot readiness, and the design docs). Write-up and full table: [`Docs/v1.3/replication-2.md`](../Docs/v1.3/replication-2.md).

Every number stated in `Docs/DiagnosticRuns/v1.3-*.md` and `Docs/v1.3/*.md` that asserts a fact about a result or the
repository is registered in `replication/v1.3/groups/*.mjs` with its doc file:line, the value as stated, and how it is
produced. `replication/v1.3/run.mjs` runs every group whose inputs are committed (no Neo4j, no model, no network;
API keys and `NEO4J_*` are removed from every child process) and prints a pass/fail table.

```bash
npm run replicate:v1.3                                   # every offline group (about 1.5 h; the slow ones are ap-hosts seeding, the interpreter regeneration, the smoke run)
npm run replicate:v1.3 -- --fast                         # skip the groups marked slow
node replication/v1.3/run.mjs --list                     # groups, number counts, what each needs
node replication/v1.3/run.mjs --group a-ref-ffp06        # one group (the 54/54 correction)
node replication/v1.3/run.mjs --number <id>              # the group of one number, and that row
node replication/v1.3/run.mjs --json rows.json && node replication/v1.3/report.mjs rows.json   # the per-doc tables of replication-2.md
```

Statuses: `PASS`, `FAIL` (differs from the doc), `KNOWN` (differs, recorded in the group with the reproduced value and
a one-line cause; it turns into `FAIL` if the reproduced value changes), `ERROR`; numbers that are not run carry
`needs-LLM`, `needs-Neo4j`, `needs-external` (input outside the repository, e.g. the sealed manifests or
`../daedalus-e1-outcomes`) or `not-checkable` (no committed output or log behind the number). Exit 0 iff no FAIL and no
ERROR.

Note: at the v1.3 head `smoke.sh` (§2) no longer exits 0. The ISE measure and cheap-proxy outputs changed after this
package was built (see `Docs/v1.3/replication-2.md`, §3).
