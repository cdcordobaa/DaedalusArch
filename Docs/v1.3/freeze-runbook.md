# v1.3 freeze runbook (construct answers → freeze → the one hold-out run)

**2026-10-16. Status: prepared and dry-run; nothing frozen.** This is the exact command list that turns the author's
construct answers into the frozen tool, runs the sealed hold-out **once**, and scores it, as fixed by
`Docs/v1.3/holdout-prespec.md`. Every step is mechanical. A step that cannot be done exactly as written stops the
freeze: fix the cause, then restart from that step. Nothing here is tagged: the freeze is identified by its commit
sha only.

`scripts/v1.3/freeze-check.ts` checks every precondition (F1–F14 below), fails loudly (exit 1, `FREEZE CHECK FAILED`),
and prints the byte-identity manifest. §D records the dry run made on 2026-10-16 before any answer existed.

**Roles.** Steps marked **[author]** are done by the author in person: answering, signing ADRs, and anything that
opens `../daedalus-sealed/`. No AI session reads a sealed directory, opens the unsealed copy, or runs step 9.

Conventions: run from the repository root on a clean checkout of `v1.3`, Node 22, `npm ci` done. `$X` is the freeze
commit (tool code), `$Y` the freeze record commit (documents only). `$H` is the unsealed copy of the hold-out. Neo4j
credentials come from the author's own environment file, never printed and never committed.

## A. Preconditions checked by freeze-check.ts

| Id | Precondition | Made true by step |
|---|---|---|
| F1 | `Docs/v1.3/construct-answers.json` committed, 25 of 25 answered, no parser warning | 1 |
| F2 | `src/shared/construct-switches.ts` is byte-identical to the rendering of that file | 1 |
| F3 | `construct-decisions.md` has 25 filled `[Answer]:` lines, equal to the answers file | 1 |
| F4 | `## ADR-V13-03` in `Docs/v1.3/adr-v13.md`, **Status: Accepted**, with an entry for every answer that owes one; `## ADR-V13-02` accepted there too when Q1 is A | 2 |
| F5 | No tier override in force still has the reason text `unsigned` | 2 |
| F6 | `rule-tiers.md` and `style-rule-sources.md` at their sealed hashes | (already green) |
| F7 | Working tree equals `$X` in `src scripts presets specs`, nothing untracked there | 4, 9 |
| F8 | `results/v1.3-reference/after-construct-answers/` holds the one development re-run and re-score, with `tool-commit.txt` whose frozen paths equal `$X` | 3 |
| F9 | `results/v1.3-freeze/test-suite.json`: full jest suite green at code equal to `$X` | 4 |
| F10 | `results/v1.3-freeze/manifest.json` committed and byte-identical to the recomputed manifest | 7 |
| F11 | Prespec frozen: no `<FREEZE_SHA>`, `<HOLDOUT_PATH>`, `<N_PER_STYLE>`; status not draft; names `$X` | 6 |
| F12 | `sealed-hashes.md` rows for `$X`, the frozen prespec, the manifest and the answers file, each equal to the file | 8 |
| F13 | `results/v1.3-holdout/run-1` does not exist yet | (until step 9) |
| F14 | Neo4j reachable, version 5.26.x, APOC installed (strict mode only) | 9 |

The manifest (F10) holds: `$X` and the git tree ids of `src`, `scripts`, `presets`, `specs`; the engine choice
(§C); the Node major version; the answers (file sha256, the 25 options); the deferred rules (FF-DS01 unless Q15
is B: Q15 A reads "keep blocking, defer the decision to hold-out evidence"); per preset, the sha256 of the full v1.3 compile output (`V13_COMPILE_OPTIONS`, switches applied), its
function list and its disabled functions; per style, the effective tier of every compiled rule
(`constructRuleTier`); and the sha256 of every tracked file under `presets/`, `specs/`, `src/fitness-compiler/`
(templates), `src/construct-switches/`, `src/scoring-engine/` (tiers), `src/apg-extractor/` (defaults),
`src/cypher-interp/`, `scripts/v1.3/` (runner, scorer, `lib/compare.ts` matching rules), plus the switch file and
catalogue, `rule-tiers.md`, `style-rule-sources.md`, the prespec, `package.json` and `package-lock.json`.

Not in the manifest, by design: the hold-out itself (it is checked by its sealed tree hash at step 5 and step 9),
including the `spec.yaml` each patch-format hold-out style carries inside the sealed directory.

## B. The commands

### 1. Apply the answers  [author answers; the commands are mechanical]

```bash
git switch v1.3 && git pull --ff-only
# The author writes the 25 answers, e.g. {"Q1": "A", "Q2": {"choice": "B", "note": "..."}, ...}
$EDITOR Docs/v1.3/construct-answers.json
# The same letters go into the 25 "[Answer]:" lines of Docs/v1.3/construct-decisions.md (page order Q1..Q25).
$EDITOR Docs/v1.3/construct-decisions.md
node --import tsx scripts/v1.3/apply-construct-answers.ts Docs/v1.3/construct-answers.json | tee /tmp/construct-signoff.txt
# Offline preview of the combined answers (no Neo4j; development-set figures, not validity):
node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts \
  --answers Docs/v1.3/construct-answers.json --out "$(mktemp -d)/preview"
npx tsx scripts/v1.3/freeze-check.ts --dry-run          # F1, F2, F3 must now read OK
git add Docs/v1.3/construct-answers.json Docs/v1.3/construct-decisions.md src/shared/construct-switches.ts
git commit -m "v1.3: construct answers Q1-Q25 (author)"
```

Every question must be answered, including those whose answer is A: an all-A switch file looks exactly like the
unanswered status quo, which is why F1 reads the answers file and not the switch file.

### 2. ADR-V13-03  [author signs]

Add to `Docs/v1.3/adr-v13.md`, after ADR-V13-01, the sections below. Their content is the sign-off printed by step 1
(`/tmp/construct-signoff.txt`): the tier ADRs, the "ADR-V13-03 construct decisions" entries, the action items.

```markdown
## ADR-V13-03: Construct decisions Q1–Q25

**Date**: <date>. **Status**: Accepted (author: "<the author's words>").

Answers file: `Docs/v1.3/construct-answers.json` (sha256 <sha>). One entry per answered question that owes an
ADR (applicability, rule, preset, policy, tier), each naming its question, e.g. "Q3 C: ...".
Tier moves (rule-tiers.md, first paragraph): one entry per tier override, with its construct reason.
Action items: Q13 (ADR-V13-02 / NestJS preset contradiction), resolved as ...
```

- If Q1 is A, move ADR-V13-02 from `adr-v13-02-draft.md` into `adr-v13.md` as `## ADR-V13-02`, **Status: Accepted**.
- For every tier override in force, replace `(ADR-V13-03, unsigned)` by `(ADR-V13-03, signed <date>)` in the reason
  string of `src/construct-switches/tiers.ts` (the reason is printed in reports). This is the last code change.
- Q16 B and Q25 B: their single development-set run is step 3. Surprises go into an ADR, not code.

```bash
npx tsx scripts/v1.3/freeze-check.ts --dry-run          # F1-F6 must now read OK
npx jest --maxWorkers=2 tests/unit/construct-switches   # the tier strings are under test
git add Docs/v1.3/adr-v13.md src/construct-switches/tiers.ts && git commit -m "v1.3: ADR-V13-03 construct decisions (author)"
```

### 3. Development-set re-score with the answers (one run, Neo4j)

```bash
set -a; . ~/.daedalus-neo4j.env; set +a               # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD; never printed
D=results/v1.3-reference/after-construct-answers
mkdir -p "$D" && git rev-parse HEAD > "$D/tool-commit.txt"
node --import tsx scripts/v1.3/ue-baseline-live.ts --out "$D"
node --import tsx scripts/v1.3/ue-graph.ts --out "$D"
cp results/v1.3-reference/after-member-facts/blind-rule-mapping.json "$D/"
node --import tsx scripts/v1.3/ue-score.ts --base "$D" --blind ../daedalus-sealed/v1.3-blind   # [author]: reads sealed blind manifests
git add "$D" && git commit -m "v1.3: development-set re-run under the construct answers (development figures, not validity)"
```

`ue-score.ts` stops on a blind rule name with no row in `blind-rule-mapping.json` (possible after Q5 D or Q17 C,
which add FF-S05 or FF-DS03); add the row, commit it with the run, and say so in ADR-V13-03. This is the only
development run. If it shows a defect, record it in an ADR; do not change code. A code change here means the freeze
restarts at step 1 and the re-run is repeated and reported as a second run.

### 4. Full test suite, and X

```bash
git status --porcelain                                  # must print nothing
npx tsx scripts/v1.3/freeze-check.ts --run-tests        # jest --maxWorkers=2 --forceExit; writes results/v1.3-freeze/test-suite.json
X=$(git rev-parse HEAD); echo "$X"
git add results/v1.3-freeze/test-suite.json && git commit -m "v1.3 freeze: test suite at $X"
```

`$X` is the commit that holds the frozen tool. Every later commit up to the run changes only `Docs/` and `results/`;
F7, F8 and F9 compare the frozen paths, so they stay valid across those commits.

### 5. Unseal and verify the hold-out  [author only]

```bash
( cd ../daedalus-sealed && find v1.3-holdout -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 )
#   must print 1379b561789b18133e0ca76eb8bcbba470543dcc1455d0260e54532a40f5fa8f (sealed-hashes.md); otherwise STOP
H="$(mktemp -d)/v1.3-holdout"                           # outside the repo and any node_modules; basename v1.3-holdout
cp -R ../daedalus-sealed/v1.3-holdout "$H"
# The deferred rules follow from the answers (FF-DS01 unless Q15 is B); the same DEF is used in steps 9-11.
DEF=$(npx tsx scripts/v1.3/freeze-check.ts --dry-run --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).manifest.deferredRules;console.log(r.length?`--deferred ${r.join(",")}`:"")})')
echo "deferred: ${DEF:-none}"
npx tsx scripts/v1.3/holdout-run.ts --dry-run --holdout "$H" $DEF \
  --expect-sealed-sha256 1379b561789b18133e0ca76eb8bcbba470543dcc1455d0260e54532a40f5fa8f
```

- `--expect-sealed-sha256` checks the sealed-hashes method (files named `v1.3-holdout/<path>`), which matches
  because the copy is named `v1.3-holdout`. `--expect-sha256` keeps its old meaning (the runner's `./<path>` hash,
  which never equals the sealed value) and is not used here.
- The dry run prints, per style, `N expected blocking findings (= N_PER_STYLE)`. These are the `<N_PER_STYLE>`
  values. They depend on `$DEF` (§D3.5): a deferred rule's findings are reported separately and kept out of M1 and
  M2 (prespec §4), so steps 5, 9, 10 and 11 all pass the same `$DEF`, which equals the manifest's `deferredRules`.
- If the dry run reports `rule ids not in the frozen spec` (provisional ids), write the id map
  (`{"schemaVersion":1,"styles":{"<style>":{"<provisional>":"<FF-id>"}}}`) from the rule names only, commit it as
  `Docs/v1.3/holdout-id-map.json`, and pass `--id-map Docs/v1.3/holdout-id-map.json` here and at step 9. Any other
  structure problem stops the freeze: the hold-out is never edited.

### 6. Freeze the prespec

Edit `Docs/v1.3/holdout-prespec.md`: line 3 to `**<date>. Status: frozen at X = <$X>.**`; `<FREEZE_SHA>` → `$X`
(every occurrence); `<HOLDOUT_PATH>` → `../daedalus-sealed/v1.3-holdout`; `<N_PER_STYLE>` → the five counts from
step 5 (for example `clean-architecture 41, layered 38, ...`); in §4, list the deferred rules (`$DEF`: FF-DS01 if Q15
is A, otherwise "none").

### 7. Byte-identity manifest

```bash
npx tsx scripts/v1.3/freeze-check.ts --commit "$X" --write-manifest   # writes results/v1.3-freeze/manifest.json
```

### 8. Record the freeze in sealed-hashes.md, commit Y

```bash
sha256sum Docs/v1.3/holdout-prespec.md results/v1.3-freeze/manifest.json Docs/v1.3/construct-answers.json
```

Append to `Docs/v1.3/sealed-hashes.md` (the artefact cells must be exactly these; freeze-check reads them):

```markdown
## v1.3 freeze (<date>)

| Artefact | sha256 | Note |
|---|---|---|
| v1.3 freeze commit X (tool) | <$X, 40 hex> | The tool of the hold-out run. `git diff X Y -- src scripts presets specs` is empty. |
| Docs/v1.3/holdout-prespec.md (frozen) | <sha256> | Placeholders filled; never edited again (addenda only). |
| results/v1.3-freeze/manifest.json (byte-identity manifest) | <sha256> | Recomputed and compared by freeze-check.ts. |
| Docs/v1.3/construct-answers.json (construct answers) | <sha256> | The author's 25 answers. |
```

```bash
git add Docs/v1.3/holdout-prespec.md Docs/v1.3/sealed-hashes.md results/v1.3-freeze/manifest.json
git commit -m "v1.3 freeze record: X = $X" && Y=$(git rev-parse HEAD)
test -z "$(git diff "$X" "$Y" -- src scripts presets specs)" && echo "frozen paths unchanged"
set -a; . ~/.daedalus-neo4j.env; set +a
npx tsx scripts/v1.3/freeze-check.ts --commit "$X"      # strict: must print FREEZE PRECONDITIONS MET, exit 0
git push origin v1.3                                    # nothing else merges into v1.3 until step 10 is committed
```

### 9. The hold-out run: ONCE  [author]

```bash
npx tsx scripts/v1.3/freeze-check.ts --commit "$X"      # again, immediately before; exit 0 or STOP
npx tsx scripts/v1.3/holdout-run.ts --commit "$X" --holdout "$H" \
  --expect-sealed-sha256 1379b561789b18133e0ca76eb8bcbba470543dcc1455d0260e54532a40f5fa8f \
  --out results/v1.3-holdout/run-1 $DEF [--id-map Docs/v1.3/holdout-id-map.json]
git add results/v1.3-holdout/run-1
git commit -m "v1.3 hold-out run-1 at $X: outputs as produced"        # before anything else, before any label
git push origin v1.3
```

The runner re-checks the structure and the tree hash, refuses a working tree that differs from `$X`, holds the
cross-process Neo4j lock, runs `ue-baseline-live.ts --root`, `ue-graph.ts --root`, `check-correct` on the blocking
findings, and scores prespec §3–§5. It refuses to write into an existing `run-1/raw`. Outputs: `raw/`, `evidence/`,
`graph/`, `correctness/`, `report.{json,md}`, `holdout-scores.{md,json}`, `holdout-run-provenance.json`. They are
committed byte for byte as produced: no file is edited, renamed, reformatted or removed. If the run aborts before
`raw/` is complete, the partial directory is committed as `run-1-aborted` with the error, and the cause is fixed
only if it is environmental (Neo4j down, disk full); a tool defect ends the attempt and goes to the defect ADR.

### 10. Engine cross-check and determinism (after run-1 is committed)

```bash
npx tsx scripts/v1.3/holdout-run.ts --engine cypher-interp --commit "$X" --holdout "$H" \
  --expect-sealed-sha256 1379b561789b18133e0ca76eb8bcbba470543dcc1455d0260e54532a40f5fa8f \
  --out results/v1.3-holdout/crosscheck-cypher-interp --determinism results/v1.3-holdout/run-1 $DEF [same --id-map]
diff -r results/v1.3-holdout/run-1/raw results/v1.3-holdout/crosscheck-cypher-interp/raw && echo "raw byte-identical"
git add results/v1.3-holdout/crosscheck-cypher-interp && git commit -m "v1.3 hold-out: engine cross-check (cypher-interp)"
```

Optional, prespec §2.3: one Neo4j determinism repeat with `--out results/v1.3-holdout/repeat-neo4j --determinism
results/v1.3-holdout/run-1`. Any difference in either check is a defect for the ADR. Run-1 stands.

### 11. Scoring

- The figures of record are `results/v1.3-holdout/run-1/holdout-scores.{md,json}`, as produced by step 9:
  M1–M7 per style and pooled, x/n with 95% Wilson intervals, both checks of §5, the claim levels, every miss and
  false alarm. The literal figures are primary.
- **Graph adjudication** (M7, validation protocol §2): the author adjudicates every graph disagreement listed in
  `holdout-scores.md` into `results/v1.3-holdout/graph-adjudication.json`, then
  `npx tsx scripts/v1.3/holdout-run.ts --from-raw results/v1.3-holdout/run-1 --commit "$X" --holdout "$H"
  --graph-adjudication results/v1.3-holdout/graph-adjudication.json --out results/v1.3-holdout/scored-adjudicated
  --no-correctness $DEF` (same `--id-map`). Both the literal and the adjudicated M7 are reported.
- **Second manifest set** (prespec §4): only if the hold-out carries a blind manifest set separate from its
  author-manifests, score it with `--from-raw results/v1.3-holdout/run-1 --holdout <blind copy>` into
  `results/v1.3-holdout/scored-blind`; the pass decision uses the blind one. `ue-score.ts --blind` keys its blind
  cases to the development variants, so it is not used for the hold-out unless its key covers the hold-out ids.
- Report: `Docs/DiagnosticRuns/v1.3-holdout-<date>.md` (prespec §8), citing the hashes of §1 and of this freeze.

### 12. After the run

```bash
rm -rf "$(dirname "$H")"                                # the unsealed copy is destroyed; the sealed original stays
```

Post-run rules (prespec §6–§7, binding):

1. The hold-out is spent. It is never run again as a validity measurement; only the step 10 checks repeat it.
2. No tuning of any kind because of a hold-out result: no rule, tier, template, preset, spec, extractor option,
   matching rule or switch changes, and no hold-out case is moved, dropped or re-labelled. Manifests are not edited.
3. Results are reported as produced, at every claim level, failures included. A metric that misses its target is
   "characterised", never "validated".
4. Every miss, false alarm, graph disagreement and cross-check difference goes into one ADR
   (`ADR-V13-xx: hold-out defects`), classified by the author (rule, manifest, extractor defect, or ambiguous
   construct). The classification never changes a figure.
5. Labelling starts only after run-1 is committed: the blind union labelling (`human-labelling-protocol.md`) and
   the Gemini labeller (`labelling.md`). Their figures are a separate human reference; rater disagreements are
   reported, not adjudicated by the author.
6. A fix after the ADR is evaluated on new data (Study 2's fresh projects or a new hold-out), never re-scored on
   this hold-out as a validity figure. Any commit after run-1 that touches the frozen paths starts a new
   development round.
7. Any later note on the prespec is a separate, dated addendum with its own hash in `sealed-hashes.md`.

## C. Engine

**Decision.** Every reported hold-out figure comes from **Neo4j 5.26.x Community with APOC core 5.26** (the
reference engine: every development figure, the stand-in run and `Docs/v1.3/cypher-interpreter.md` use it), through
`holdout-run.ts` with its default `--engine neo4j`. The pin is checked by F14 (version prefix `5.26.` and
`apoc.version()`), and the manifest records the choice. The exact patch version and `apoc.version()` are copied
from the F14 line into the report.

**Cross-check.** The in-process Cypher interpreter (`--engine cypher-interp`, `src/cypher-interp/`) executes the same
compiled template text over an in-memory graph. It runs once, after run-1 is committed (step 10), on the same
unsealed copy, with `--determinism results/v1.3-holdout/run-1`, which compares every variant's raw rows
(rule, file, target); `diff -r` compares `raw/` byte for byte. Expected result: identical, as on the development
set (71/71, `cypher-interpreter.md` §0) and on this dry run (§D). A difference is a defect recorded in the
hold-out defect ADR with the variant and rows; the Neo4j figures stand and are not replaced. Its outputs are headed
`ENGINE CROSS-CHECK (cypher-interp): not the reported hold-out figures`, and its provenance records
`engine: cypher-interp`.

**Why not the interpreter for the record.** It is a spike, validated only on development data; Neo4j is the engine
the prespec, the thresholds and every earlier figure were set on.

## D. Dry run, 2026-10-16 (this branch)

Container: Node 22.22.0, OpenJDK 21, Neo4j 5.26.24 Community + `labs/apoc-5.26.24-core.jar` on 127.0.0.1:7687
(credentials generated into a 0600 file in the session scratchpad, never printed). No sealed path was read.

### D1. freeze-check.ts on the current tip, no answers applied

```bash
npx tsx scripts/v1.3/freeze-check.ts --dry-run
```

At the committed tip of this branch (working tree clean), the expected and observed result is exit 1 with
**9 of 14 unmet: F1, F2, F3, F4, F8, F9, F10, F11, F12**; F5, F6, F7, F13 OK; F14 skipped (dry run). The full
output, with the manifest summary, is `results/v1.3-freeze/dryrun-synthetic/freeze-check-dry-run.txt`. The unit
test `tests/unit/scripts/v1.3/freeze-check.test.ts` pins exactly this set.

| Id | Dry-run detail |
|---|---|
| F1 | no answers file `Docs/v1.3/construct-answers.json` |
| F2 | the switch file cannot be checked without an answers file (all A today, which is not an answer) |
| F3 | `construct-decisions.md`: `[Answer]:` empty for all 25 questions |
| F4 | `adr-v13.md`: no `## ADR-V13-03` section |
| F8 | no development-set re-run in `results/v1.3-reference/after-construct-answers` |
| F9 | no test-suite summary |
| F10 | no manifest |
| F11 | placeholders `<FREEZE_SHA>`, `<HOLDOUT_PATH>`, `<N_PER_STYLE>`; status "draft" |
| F12 | none of the four freeze rows in `sealed-hashes.md` |

Strict mode with `--probe-engine` against the local server additionally reports F14 OK
(`Neo4j Kernel 5.26.24 community, APOC 5.26.24`).

### D2. The runner and scorer end to end on a synthetic stand-in

```bash
S=$(mktemp -d)
npx tsx scripts/v1.3/synthetic-holdout.ts --out "$S/v1.3-holdout"         # writes $S/synthetic-id-map.json too
npx tsx scripts/v1.3/holdout-run.ts --dry-run --holdout "$S/v1.3-holdout" --deferred FF-DS01   # exit 1: FF-D01 needs the id map
npx tsx scripts/v1.3/holdout-run.ts --development-stand-in --commit HEAD --holdout "$S/v1.3-holdout" \
  --id-map "$S/synthetic-id-map.json" --expect-sealed-sha256 <sealed-method hash printed by the generator> --deferred FF-DS01 \
  --out results/v1.3-freeze/dryrun-synthetic/neo4j
npx tsx scripts/v1.3/holdout-run.ts --development-stand-in --engine cypher-interp --commit HEAD --holdout "$S/v1.3-holdout" \
  --id-map "$S/synthetic-id-map.json" --expect-sealed-sha256 <same> --deferred FF-DS01 \
  --determinism results/v1.3-freeze/dryrun-synthetic/neo4j --out results/v1.3-freeze/dryrun-synthetic/cypher-interp
```

The stand-in (`scripts/v1.3/lib/synthetic-holdout.ts`) is generated from the development set: 66 variants renamed
`<kind><nn>-syn-<rest>`, descriptions marked `[SYNTHETIC]`, the ddd rule FF-DT01 written as the provisional FF-D01
(with an id map), and one **planted miss** (an expected FF-S01 finding `src/domain/entities/Loan.ts ->
src/infrastructure/main.ts` that no code makes). It lies outside the repository. It is not hold-out data and its
figures are not validity figures; `--development-stand-in` heads every output accordingly.

| Check | Result |
|---|---|
| Structure dry run without the id map | exit 1, exactly one problem: `ddd: rule ids not in the frozen spec: FF-D01` |
| Structure dry run with the id map, `--expect-sealed-sha256` | exit 0; 331 files; `FF-D01 -> FF-DT01 x1` |
| Live run, Neo4j 5.26.24, freeze check at the branch commit | exit 0, 3 min 55 s; 71 variants; 57 blocking findings checked for correctness |
| Planted miss | clean-architecture M1 = 0.929 (13/14): the planted finding is the **only** miss listed; every other style and metric equals the development stand-in (layered 11/11, nestjs 11/11, hexagonal 13/13, ddd blocking all found) |
| Cross-check, `--engine cypher-interp`, no Neo4j variables | exit 0, 3 min 18 s; `raw/` byte-identical (71 files), `report.json` byte-identical, `holdout-scores.json` scores identical, evidence identical apart from `elapsedMs`; `--determinism`: identical raw rows |
| Secrets | the Neo4j password appears in no output file |

Outputs: `results/v1.3-freeze/dryrun-synthetic/{neo4j,cypher-interp}/` and `synthetic-id-map.json`.

### D3. Defects found and fixed by the dry run

1. **The sealed tree hash could never match.** `sealed-hashes.md` records the hold-out hash with file names
   `v1.3-holdout/<path>` (run from `../daedalus-sealed/`), while `holdout-run.ts` hashed `./<path>`: the same tree
   gives two different values (synthetic tree: `35c42509…` vs `433f76f8…`), so `--expect-sha256 1379b561…` would
   have stopped the real run. The runner now also computes the sealed-hashes method (`sealedTreeSha256`, named after
   the copy's basename) and checks it with a separate, opt-in `--expect-sealed-sha256`; `--expect-sha256` is
   unchanged and checks only the runner's own hash (review of PR #164). The copy must be named `v1.3-holdout`
   (step 5). Under test.
2. **No engine option on the runner.** `holdout-run.ts` could only use Neo4j, so the interpreter cross-check had no
   runner path. It now takes `--engine cypher-interp`, passed to `ue-baseline-live.ts`, with cross-check headers and
   `engine` in the provenance.
3. **Provenance file name.** The prespec (§2.4) and the readiness gate (V3) name `run-provenance.json`; the runner
   writes `holdout-run-provenance.json`. The prespec draft now names the runner's file; the gate, on its own branch,
   still says `run-provenance.json`.
4. **An all-A switch file is indistinguishable from "unanswered".** Hence the committed answers file (F1, F2).
5. **`N_PER_STYLE` depends on the deferred rules.** ddd counts 9 expected blocking findings without `--deferred
   FF-DS01` and 8 with it (synthetic stand-in). FF-DS01 stays deferred unless Q15 is B (Q15 A defers it "to
   hold-out evidence"); the manifest records the list and step 5 derives `$DEF` from it for every later step.
6. **Tier reasons say "unsigned".** Every tier override's reason ends `(ADR-V13-03, unsigned)` and is printed in
   reports; F5 requires the signed wording before `$X`.

### D4. Full test suite in this container

`freeze-check.ts --run-tests` at `c80a1716`: 365 suites, 4946 tests, **4900 passed, 6 failed, 40 pending**, in
538 s. The same 6 tests in 5 suites fail on an untouched `origin/v1.3` worktree in this container, so none is new:
`scripts/mutation/expected.test.ts` (static call form: `scripts/v1.3/lib/construct-rescore.ts` calls
`compileFunctions(` without `compilerInputFromSpec(`), `scripts/u5b/guards.test.ts` (needs `origin/v1.2e`),
`scripts/u5b/score-golden-acceptance.test.ts` (needs full git history), `scripts/generators/skeleton.test.ts`
(`npm ci --offline`), `llm-critic/replay-no-binary.test.ts` (two tests). F9 requires a green suite, so step 4 runs
in the author's full clone (all branches fetched, full history). The `construct-rescore.ts` offender was a real
defect against the static-call rule (BR-U5a-19); this branch fixes it (the call now reads
`compileFunctions(compilerInputFromSpec(spec), …)`, the same value as before), so 5 failures remain here, all
environmental.

### D5. Not covered by the dry run

- The real hold-out's structure, provisional ids and counts (step 5, author only).
- Whether the hold-out carries a separate blind manifest set (§B step 11).
- `ue-score.ts` on the development re-run (step 3) reads `../daedalus-sealed/v1.3-blind`, which no AI session reads.
