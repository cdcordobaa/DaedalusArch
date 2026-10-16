# v1.3 merge train MT5 (2026-10-16)

This is a scheduled merge train for `v1.3`. It ran under the author's standing instruction of 2026-10-16: merge anything that is not CRITICAL, and ignore `[hold]` prefixes and "do not merge without review" notes. It started at v1.3 tip `ae0c8d57` with 48 open PRs into `v1.3` or into stacked v1.3 branches. It followed the dependency order of `Docs/v1.3/hold-queue-triage-2026-10-16.md` (§4), skipping the PRs that had already merged.

For each PR the train did the following:
1. merged `v1.3` into the head branch (a merge commit, no force-push), keeping both sides of trivial conflicts;
2. ran `npx tsc --noEmit`;
3. ran `npx jest --maxWorkers=2` on the PR's own test files plus `--findRelatedTests` for its changed `src/` and `scripts/` files, plus `v12e-byte-identity.test.ts`;
4. removed `[hold] ` from the title;
5. merged it with a merge commit.

No `.env` file or secret was read, and `main` and `v1.2e` were not touched.

A second train (MT6) started on the same queue at about 14:03 UTC. It merged #133 and #181 and fixed `tsconfig.scripts.json` errors (`f8e77081`). MT5 then stopped acting on PRs so the two trains would not race.

## Merged (24)

In merge order. "Base failures" means the tests listed under *Test results*, which fail identically on `ae0c8d57`.

| PR | Merge notes and test results |
|---|---|
| #224 | Night report, docs only. tsc 0. |
| #223 | Artifact-eval docs and scripts. `README.md` conflict resolved keeping both. tsc 0. Its B1, B4 and B7 questions stay open in its doc. |
| #217 | Paper 2 update. `papers/STATUS.md` resolved on v1.3's newer order, keeping #217's verified ECSA dates. tsc 0. |
| #221 | APG2 fixes-mined. tsc 0. jest 1 suite, 5/5. |
| #207 | Neo4j version parity. tsc 0. No TypeScript tests touched. |
| #205 | Study 2 forecaster. tsc 0. jest 14/14. |
| #209 | Human erosion. tsc 0. jest 7/7. |
| #215 | Replication part 2. `package.json` keeps both scripts. tsc 0. |
| #197 | Snapshot measures. tsc 0. jest 7/7. |
| #231 | K2 spec ladder (on #186). tsc 0. jest 3/3. |
| #225 | Rule-mutation tests. Retargeted to `v1.3` after #190. tsc 0. jest 126/126. |
| #141 | Judge v2.2 prep. tsc 0. jest 39 suites; the only failure is a base failure (replay-no-binary). |
| #191 | Judge v2.2 run (on #141). tsc 0. #228 was then retargeted to `v1.3`. |
| #144 | Rule-gap catalogue (opt-in). tsc 0. jest 165 suites; the only failures are base failures. |
| #145 | Rule mining (`propose_rules` opt-in). tsc 0. jest 18 suites, 243 passed. |
| #176 | MCP interpreter parity (OFF by default). `context.ts` takes the union of the `fastRulesEngine`, `hints` and `ruleMining` flags. tsc 0. jest 12 suites, 149 passed. |
| #185 | Metamorphic testing. tsc 0. jest 107 suites; the only failures are base failures. All byte-identity hash pins pass. |
| #222 | MT-B1 barrels (OFF by default). Retargeted to `v1.3` after #185. tsc 0. jest 37 suites, 524 passed. Byte-identity hashes 48/48. |
| #208 | Judge steering prep. tsc 0. jest 14 suites; the only failures are base failures. |
| #199 | Loop engine tee. tsc 0. jest; the only failures are base failures. |
| #200 | Acceptance runner. `plan.ts` and `eslint.config.mjs` keep both sides. tsc 0. All 7 loop suites pass (83 tests). |
| #174 | Unsealer tooling. tsc 0. jest; the only failures are base failures. |
| #167 | External correctness X1. tsc 0. jest; the only failures are base failures. |
| #198 | Known groups K1. tsc 0. jest; the only failures are base failures. |

#133 and #181 were merged afterwards by MT6, not by MT5.

## Left open: CRITICAL (19, one comment each on the PR)

The number in brackets is the CRITICAL rule from the train's instructions.

- **#229**: (1, 2, 4) It carries #170's `sealed-hashes.md` freeze edits and the `tiers.ts` and `extension-templates.ts` changes, and it asks the T1 construct question.
- **#228**: (1, 4) It adds a new pre-registration and decision rule, and the Fleet and NestJS base questions are open. It was retargeted to `v1.3`.
- **#220**: (4) It asks 10 construct and claim questions.
- **#213**: (4) It carries #139's frozen-schema amendment.
- **#212**: (4) It asks which filters become the default at the freeze, and it carries #139.
- **#206**: (2, 4) It makes an ungated `tsconfigPath` change to cypher-interp `evaluate_project`, and it needs the sealed-list domain check.
- **#189**: (4) It needs the sealed-list domain check.
- **#188**: (2) It makes the accelerated engine and MemoryGuard the default, and verdicts flip.
- **#180**: (2, 4) It changes the gate-arm stop and resume behaviour without a flag, and it asks for sign-off.
- **#173**: (1) It adds the frozen-tunables manifest tool and a CI step.
- **#171**: (3, 4) It has a key-shaped `sk-ant-…` test literal, and the Linux `.credentials.json` allow-list decision is open.
- **#170**: (1, 2, 4) It writes the freeze into `sealed-hashes.md`, carries #159, and asks the DDD T1 question.
- **#164**: (1, 4) It edits the hold-out prespec draft and the sealed-hashes check, and it asks for sign-off.
- **#159**: (2, 4) It makes ungated default changes (R01, R03, R05–R07, `--bare-lines`) and the R04 schema amendment, and it asks about the FE default.
- **#156**: (2) Its engine wiring would override v1.3's default, and it hard-codes local paths.
- **#151**: (2, 4) It adds a 30 s default interpreter timeout, and it asks about `CALL { WITH }` and the merge order.
- **#139**: (4) It amends the FROZEN report schema and asks for a decision.
- **#133**: (4) It asked for the `conduit` decision. MT6 has since merged it with conduit noted as a limitation.
- **#232**: (4) It carries #133. With #133 and #181 now on v1.3, this reason no longer holds, so the next train can re-check it.

## Left open: not critical but blocked (4)

- **#210**: It has non-trivial conflicts in `scripts/lib/loop/{loop,main,plan,types}.ts` after #199 and #200 (10 hunks). It needs a re-merge and a re-run of the loop-replay identity check.
- **#196**: It has non-trivial conflicts in `scripts/lib/loop/*` and `src/mcp-server/{context,tools}.ts`. It needs a re-merge that keeps both flags.
- **#203**: It still carries #160's pre-merge commits and has semantic conflicts in `study2-rehearsal.ts` and its doc. It needs a rebase to the A1 commits.
- **#204**: Its key reads are behind the explicit `--adapter gemini|openai` and are scrubbed from output, and it was green after the v1.3 merge. But GitHub refused the merge (405, conflict after concurrent merges), and the session's safety classifier blocked further automated handling of this key-reading PR. It is left for the author, and its `[hold]` title is restored.

## Test results

**Full `npx jest --maxWorkers=2`, before and after:**
- Before, at `ae0c8d57`: 396 suites, 5,376 tests, 6 failed.
- After the last MT5 merge, at `38f199fd`: 424 suites, 5,831 tests, 7 failed.
- `npx tsc --noEmit` is 0 at both.

**Base failures** (the 6 tests that fail identically at `ae0c8d57`, all environmental or pre-existing):
- `replay-no-binary.test.ts` (2 tests: a cassette miss);
- `u5b/guards.test.ts`, the results guard;
- `u5b/score-golden-acceptance.test.ts`, which needs a non-shallow clone;
- the BR-U5a-45 `installSkeleton` `npm ci --offline` test;
- the BR-U5a-19 static call form test.

**The one new failure is from this train.** It is `v12e-byte-identity.test.ts › the pinned list covers every fixture project`. #141 added 10 `tests/fixtures/v1.3-check2/*/project` fixtures and #222 added `fixtures/unit/v13-mtb1-layerless-barrel`, but neither added pins to `tests/fixtures/v1.3-byte-identity/v12e-hashes.json`.
- Every existing pin still matches.
- The hashes of the 11 new fixtures were computed with `scripts/apg-hash.ts --relative`. The edit to the pin file was blocked by the session's permission classifier, so the author needs to add the 11 pins.
- The per-PR runs did not catch this, because `--findRelatedTests` does not reach fixture-only changes. From #208 onwards, the train ran the byte-identity test on every PR.

**The `tsconfig.scripts.json` errors were also from this train.** The per-PR runs used only the root `tsconfig.json`, so they missed `tsconfig.scripts.json` errors introduced by #197, #174, #198 and #167. MT6 fixed them in `f8e77081` (no behaviour change). Later trains should also run `npx tsc --noEmit -p tsconfig.scripts.json`.
