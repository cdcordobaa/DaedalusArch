# PUZZLE-01 baseline: the agent alone (arm `none`), 2026-10-21

**Exploratory, DEV split, NOT part of Study 2b.** Plan committed and pushed before any generator call
(`experiments/puzzle-01-baseline/plan.md`, commit `7c487b6a`). No frozen path (`src/`, `presets/`, `scripts/lib/`,
`scripts/v1.3/`), the freeze tag or any Study 2b file was changed. Records: `results/v1.4-puzzle-01-baseline/`.

**Question.** When a coding agent works alone, under architecture rules the repository states in writing
(`ARCHITECTURE.md`), does it fall into the traps of the PUZZLE-01 dev puzzles? Each puzzle's own oracle decides
"trapped". The DaedalusArch tool was not used. This is the reference a later tool arm must beat.

## 1. Headline

| Puzzle | Rung | Tests pass (final) | Clean solves | Rate, Wilson 95% | pass^5 | Trapped on |
|---|---|---|---|---|---|---|
| **P1** `p1-transfers` (DDD, one context) | 4 | 5/5 | **0/5** (provisional) | 0.00 [0, .43] | 0 | SG1 (D4) 5/5: both accounts saved in one store call (`saveAll([from, to])`). SG2 (D5) 2/5: the daily limit decided in the application service |
| **P2** `p2-loyalty` (DDD, two contexts) | 5 | 5/5 | **0/5 by the oracle; 1/5 if the author accepts case 12** (provisional) | 0.00 [0, .43]; or 0.20 [.04, .62] | 0 | SG2 (D4 across contexts): points written into membership inside the same `PlaceOrder` command in 4/5; the 5th (c07) used the stored event and a handler, which the oracle fails (pre-registered over-rejection P2-SG2-a). SG1 (D6/D10) 5/5 clean |
| **P4** `p4-library-holds` (Layered, positive control) | 1 | 5/5 | **5/5** | 1.00 [.57, 1] | 1 (plug-in 1.0) | none |
| P3 `p3-shipping-quotes` | – | – | **not run** (R1: its clean solution could not be restored exactly) | – | – | – |

- **Functional failures: 0.** Every final tree passes every regression and feature test (run from outside), and every
  turn's type-check reported 0 errors.
- **Caught-and-fixed: 0.** Each trap appears at the step that introduces it and stays until the end (P1 SG1 from step 1,
  P1 SG2 from step 2, P2 SG2 at step 3).
- **Behaviour was very uniform.** All five P1 runs added a `saveAll` to the account store at step 1. Four of five P2
  runs wrote points inside `PlaceOrder`, awarding them before the order save. P4 diffs are almost identical in shape
  (45–47 changed lines). Median changed lines against the seed: P1 120, P2 59, P4 46.
- **The tools see none of the agents' traps.** Of the 12 oracle FAILs on agent trees, the frozen instrument flags 0 and
  the DETECT-01 prototypes flag 0 (§5).

Counts are **provisional** until the author has hand-read the 12 cases in
`results/v1.4-puzzle-01-baseline/oracle-verdicts-to-read.md`. Proposed labels: 11 trap, 1 legit-clean (P2 c07).

## 2. Calls and isolation

| Phase | Cap | Used |
|---|---|---|
| Smoke | 1 | 1 (passed: status completed, served by `claude-sonnet-5-5`) |
| Read probe + confinement probes | 5 | 5 (read probe passed; `escape-write`, `node-modules-overwrite`, `command-chaining`, `allowed-command` passed) |
| Baseline turns | 66 | 48 (15 sessions × 3 = 45, plus the 3 turns of the redrawn session c12) |
| **Total** | **72** | **54** |

- **Models.** Every recorded turn (47) reports exactly `claude-sonnet-5-5` in `modelUsage`. Every turn completed on its
  first attempt (no harness retry). CLI 2.1.305 throughout.
- **One redraw.** The container restarted at about 02:33Z during session c12 (P1, run index 4), killing the driver while
  c12's step 3 was in flight. That call has no result. It is recorded in the ledger by hand and counted as used. c12 was
  redrawn whole as c16 (redraw 1 of 2) with the driver's new `--resume` mode, which keeps the seeded schedule. Agent
  behaviour was never grounds for a redraw.
- **Isolation verdict: achieved.** The generator ran as an unprivileged user (uid 1500) through a wrapper. The clone, the
  driver, its input (every step's request) and all records sat in root-only 0700 directories. The clone's former path
  was left empty and root-only, and each finished session's cell was closed. Evidence (`results/v1.4-puzzle-01-baseline/isolation/`):
  every listed path is denied to the generator user; a recursive fingerprint sweep over the whole file system as that
  user found **0** readable files with puzzle ids, README phrases, later-step request phrases or the canary tokens
  (the first sweep found the wrapper's own comment naming the experiment; it was reworded and the sweep re-run before
  any call). The sweep was re-run after the container restart: 0. The **READ probe** asked the generator for the first
  line of P1's README at its former path, a canary in the vault and a canary in the out root: 3 permission denials,
  nothing quoted. The CLI's `--restricted` file-tool confinement refused all three paths before the OS-level denial
  was reached. R2: the work tree held only the skeleton and the seed (with `ARCHITECTURE.md`). `tests/behaviour.ts` was
  run from outside at scoring time only.
- **Credentials.** The CLI reads the claude.ai login from the generator's own home, written by the wrapper from the
  host token. The frozen allow-listed child environment is unchanged. No host-remote variable reaches the generator.

## 3. Revisions made before any call (logged in `experiments/puzzle-01-baseline/revisions.md`)

- **R1, restore.** `.gitignore` gains `!experiments/**/ports/out/`. The P3 seed and trap port files were rebuilt
  **byte-exact** (tree hashes equal `verification.json`). The P3 clean port `CarrierRates.ts` is 7 lines with an
  unrecoverable doc comment: about 84,000 candidates were tried against the recorded hash with no match, and no copy
  exists. **P3 dropped.** The HEXDDD-01 S1 seed rebuilds exactly from its builder (`e3cfa16c…5700`). verify.ts: P1, P2,
  P4 VALID with equal hashes.
- **R7, declared rules.** A neutral `ARCHITECTURE.md` in every seed (DDD: one aggregate per transaction, others through
  domain events; contexts only through their published interface; business rules in the domain model. Hexagonal: ports
  carry only domain types; vendor code in adapters. Layered: lower layers never depend on upper layers). Hint audit:
  0 FAIL, and no task, step, feature or trap word. Seeds differ from the verified hashes only by this file.
- **R4, oracle repairs.** P1 SG1 also fails on any non-read store method taking two accounts or two account ids,
  whatever its name. P2 SG1 also fails on 500 / 1500 / 2000 compared in sales. Both checked on synthetic trees.
  Verdicts on seed, clean and trap unchanged. Hand-read categories pre-registered.

Changes after the plan commit, all logged: the driver gained `--read-only` / `--skip-read` (so the brief's order of
READ probe, smoke, then confinement probes could be kept) and `--resume` (after the restart); the scorer's path to
`turns.jsonl` was fixed. None changes a frame, a cap, an outcome definition or an oracle.

## 4. Per sub-goal

| Puzzle | Sub-goal | Family | Oracle pass on final trees | Caught-and-fixed | Hand-read proposal |
|---|---|---|---|---|---|
| P1 | SG1 | D4: one aggregate per command | 0/5 | 0 | 5 × trap (store `saveAll` of both accounts, called from the transfer service) |
| P1 | SG2 | D5: limit inside the account | 3/5 | 0 | 2 × trap (limit and per-day tally in `Transfer`); the 3 passes keep the limit in `Account` |
| P2 | SG1 | D6/D10: one owner of the tier rule | 5/5 | 0 | passes read: tier through the published interface, threshold changed inside membership |
| P2 | SG2 | D4 across contexts | 0/5 | 0 | 4 × trap (write inside `PlaceOrder`); 1 × legit-clean (c07, category P2-SG2-a) |
| P4 | SG1 | layered dependency | 5/5 | 0 | passes read: no upward import, no dynamic import, callback or registry |

## 5. Visibility (R6): frozen instrument and DETECT-01 prototypes

Trees: the 5 agent final trees plus the clean and trap trees of each puzzle (P2 also trap-alt). "Flags" means a new
finding (not on the seed) in a file the oracle cites for a FAIL, or any new mapped finding for a PASS
(`results/v1.4-puzzle-01-baseline/visibility.json`). Prototype mapping fixed in the plan: D4 → X1, X1b; D5 → X4; P2 SG1 and
P4 SG1 have no prototype rule.

| Puzzle / sub-goal | Oracle FAILs (agent + reference) | Frozen flags a FAIL | Prototype flags a FAIL | Agent-tree FAILs flagged (frozen / prototype) | False flags on PASS trees |
|---|---|---|---|---|---|
| P1 SG1 (D4) | 6 (5 + trap) | 0 | 0 | 0/5 / 0/5 | 0 / 0 |
| P1 SG2 (D5) | 3 (2 + trap) | 0 | 0 | 0/2 / 0/2 | 0 / 0 |
| P2 SG1 (D6/D10) | 2 (trap, trap-alt) | 1 (trap: FF-DS02) | no rule | – | 0 / – |
| P2 SG2 (D4) | 7 (5 + trap, trap-alt) | 1 (trap, co-located FF-DS02) | 1 (trap: X1) | 0/5 / 0/5 | 0 / 0 |
| P4 SG1 (layered) | 1 (trap) | 1 (trap: FF-S01) | no rule | – | 0 / – |

**Agreement.** Neither column raises a false flag (0 on every oracle-PASS tree). Neither sees any of the 12 agent-tree
FAILs. The frozen instrument sees only the authors' reference traps (P2 SG1, P4). The prototypes see only P2's
reference trap, whose two repository saves in one flow are X1's exact shape. Why the agents' traps are missed: in P1 the
two accounts go into one `saveAll(accounts: readonly Account[])` call (X1 needs two saves in one flow; X1b counts
identity-bearing parameters, and an array of one type is a single parameter). In P2 the member write goes through the
sales ACL to membership's published `awardPoints` (no repository save on the member side in sales, and no
cross-context import beyond the planted debt). These are concrete extension points for X1 / X1b. **None was built
here.**

## 6. Go/no-go reading (design §9, R5, R6)

- **§9 band** (at least 2 puzzles with `none` clean-solve rate in [0.2, 0.8]): **not met.** P1 0/5 and P4 5/5 are
  outside. P2 is 0/5 by the oracle, or 1/5 ("in band, provisional" under R5) if the author accepts case 12. At most one
  puzzle is in band. **No-go** for a registered study on these three puzzles as they stand.
- **R5, sizing a tool arm.** P1 and P2 land at 2/5 or below, but nothing the tool can see trapped them: the frozen
  instrument flags 0 of their 12 failing sub-goals, and the prototypes flag 0. The one puzzle the frozen instrument sees,
  P4, scores 5/5. **The baseline does not size a tool arm.** A 5-vs-5 comparison on P1/P2 would test generic attention
  (blind control, design §5), not the rules.
- **R6, harder visible puzzle.** P4 scored 5/5 ≥ 4/5, so **a harder visible puzzle must be authored before any `mcp`
  arm**: rung 2 or 3, with an existing upward import as house style.
- **"mcp + detect" arm.** Not worth building now. The prototypes are visible on 0 trapped agent trees, in puzzles at
  0/5. It becomes worth building only once X1 / X1b (or a new rule) flag the agents' actual shapes (§5) on these trees
  without new false flags.

## 7. Limits

- **DEV puzzles**, public and composed. The rates belong to these puzzles and are never pooled.
- **n = 5 per puzzle.** Wilson intervals are wide: 0/5 → [0, .43], 5/5 → [.57, 1].
- **One vendor and one model** (`claude-sonnet-5-5`). Claude sessions also wrote the puzzles, the oracles and this
  scoring (design V5).
- **A claude.ai cloud sandbox**, not the pinned study machine. CLI 2.1.305 (HEXDDD-01: 2.1.304), Node 22.22.0, Ubuntu
  24.04.5. The generator ran as an unprivileged user with a credentials file. That differs in mechanics, not in argv or
  environment variables, from the HEXDDD-01 runs.
- **Rules declared in `ARCHITECTURE.md`** (R7). "Trapped" here means the agent broke a stated rule, not only that it
  failed to infer one.
- **Each turn is a fresh CLI process** (`--no-session-persistence`, frozen argv). A session shares its work tree across
  the 3 steps, not a conversation.
- **P3 not run.** One infrastructure redraw (container restart).
- **Oracle verdicts are provisional** until the author's hand read. One FAIL (P2 c07) is a pre-registered
  over-rejection candidate.

## 8. Recommendation for the later tool run (R8)

- Use the **same sandbox image, CLI (2.1.305) and Node (22.22.0) pins**, the same unprivileged-generator isolation and
  the same driver.
- Include **2 interleaved `none` sessions** in its seeded order as a drift check against this baseline.
- Before that run: author the harder visible puzzle (R6). Decide from the hand read whether P2's oracle should accept
  the event-handler placement (case 12). Extend X1 / X1b to the agents' shapes if an "mcp + detect" arm is wanted.
