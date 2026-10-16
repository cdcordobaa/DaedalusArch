# Author review guide: fidelity adjudication prep (2026-10-16)

Everything in this folder is **proposed, not adjudicated**. An agent checked each row against the source, but no human has. The original sheets are unchanged, and `human_verdict` / `adjudication` are still empty. Those columns are yours to fill.

## What to review

Open `review-sheet.csv`. It has 235 rows, one per distinct edge or finding. The sheets overlap: the barrel cells repeat E1 edges, and the four reference sheets share rows. The `sets` column lists every sheet a row appears in.

How the rows were chosen (seed 20261016, sampled within each class):

| Class | Rows | How chosen |
|---|---|---|
| tool-bug | 5 | all |
| reference-bug | 1 | all |
| alias | 85 | random 10% of 846 |
| out-of-root | 64 | random 10% of 639 |
| other | 46 | random 10% |
| re-export | 29 | random 10% |
| type-only | 4 | random 10% |
| dynamic | 1 | random 10% |

For each row:

1. Read `evidence`. It quotes the cited line as `file:line` followed by the code, says where the text came from, and gives a one-line justification.
2. Open the file if you doubt the quote. Sources:
   - **SO4**: the upstream repo at `corpus/corpus.json` `commitSha`. ghostfolio is rooted at `apps/api`.
   - **E1**: your `../daedalus-e1-outcomes`. The quote came from the judge cassettes; see below.
   - **Reference**: `tests/fixtures/v1.3-reference/<style>/variants/<variant>`, applied to the clean project.
3. Fill `author_confirms` with `yes` or `no`, and add a reason in `author_note` if you answer `no`.

When you **confirm a sampled row**, you vouch for the class rule that produced it (`proposed_rule`). Every row under that rule passed the same mechanical checks. If you **reject one**, re-open every row under its rule: `grep <rule>` in the `*.proposed.csv` files.

Writing the adjudication itself is up to you. One way is to copy `proposed_verdict` into `human_verdict` / `adjudication` for each rule you have confirmed. The original sheets are not changed until you do that.

## Verdicts

| Value | Edge sheets | Reference sheets (finding level) |
|---|---|---|
| tool-correct | The APG is right: the edge exists in the code and the reference missed it. On an agreement row, the edge is confirmed. | The tool's position is right (finding or no finding). |
| reference-correct | The reference is right: the APG misses an import that the code has, or holds one the code lacks. | The manifest(s) that disagree with the tool are right. |
| both-acceptable | The dependency is real, but the graph may show it or leave it out: routed to the declaring file, or outside the configured scope. | The construct is ambiguous under the rule text, usually an open `construct-decisions.md` question. |

On the edge sheets, `proposed_verdict` is judged against the **v1.2E default APG**, the variant that the sheet's class columns describe. `proposed_edge_status` is `required` / `acceptable` / `absent`, and is used to score the other variants (dynamicImports, v13-literal, v13-resolved).

## Class rules (edge sheets)

| Rule | Rows | Proposal | Mechanical check on every row |
|---|---|---|---|
| R-agree | 171 | tool-correct | The cited line matches the file; all three extractors have the edge; the specifier is on the statement. |
| R-alias-depcruise | 829 | tool-correct, alias | APG and tsc have the edge, dependency-cruiser does not, and the specifier is a non-relative alias. dependency-cruiser does not expand `${configDir}`. |
| R-out-of-root | 639 | both-acceptable, out-of-root | One endpoint is outside the root (`../../libs/common`). It is a Package node by design. |
| R-excluded | 302 | both-acceptable, other | An endpoint matches a spec exclude, is not TypeScript (`dist/*.js`, `index.js`), or is outside the tsconfig file set. |
| R-barrel-routed | 194 | both-acceptable, re-export | The specifier resolves (tsc) to a barrel, the barrel has a re-export path to the target, and the target declares an imported name. Where the target text is missing, the check uses the chain only. |
| R-barrel-module-edge | 102 | reference-correct, re-export | The specifier resolves to a re-export file that declares none of the imported names. The v1.2E default drops the edge; the v1.3 `reExportEdges: 'both'` emits it. |
| R-json-require | 6 | both-acceptable, dynamic | `require()` of a `.json` asset. |
| R-dts | 2 | both-acceptable, type-only | The target is a `.d.ts` file, which `DEFAULT_EXCLUDE_PATTERNS` excludes. |

These rows were checked but produced no `R-unverified`, no `LINE MISMATCH` and no edge-level tool-bug. A check failure would have been marked that way.

The reference-sheet rows (`R-ref-read`) were proposed one by one, by reading each row's files. Grouped patterns are listed in `Docs/DiagnosticRuns/v1.3-fidelity-adjudication-prep-2026-10-16.md`.

## Caveats you should know before confirming

- **E1 text is a reconstruction.** The E1 cells are not in the repository. Their files were rebuilt from the judge-prompt quotes in `experiments/e1-grid/cassettes` (`scripts/v1.3/e1-sources-from-cassettes.ts`, 1219 files in 65 cells, no conflicting quotes). 29 rows in the E1 and barrel sheets cite a source file no judge saw. Those rows rely on the harness quote and say so. Barrel `index.ts` files are never quoted, so for 22 barrel rows the barrel's content comes from the tsc re-export edges.
- **The reference proposals agree with the author manifest on every scored row.** No blind-only finding is accepted: each is proposed tool-correct or both-acceptable. The 6 tool+author findings that blind leaves silent are both-acceptable, and every other scored row follows the author. The proposing agents saw `author_reason`, so anchoring is possible. Check the blind-only rows in the sample with that in mind.
- **The 53 layered FF-P06 rows** (barrels-only and baseline sheets) depend on Q1 in `Docs/v1.3/construct-decisions.md`. The same holds for FF-P01 (Q10) and FF-S03 (Q12).
