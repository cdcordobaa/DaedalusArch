# v1.5 Hexagonal study: agent pilot (§5.1), run 2 (after DEV-HX-1): ALL GATES PASS

Pilot data, not study data; never pooled with the study. Pre-registration `Docs/v1.5/hexagonal-study-preregistration.md`
(REGISTERED 2026-10-30, with DEV-HX-1), runbook `experiments/v15-study/RUNBOOK.md`. Neither was changed. Run 1 (stopped,
mechanism stop) is reported on branch `results/v15-hx-pilot` and is not pilot data for the gates (DEV-HX-1).

## Setup (all passed)

| Item | Value |
|---|---|
| `main` HEAD | `07d0224e66710a47280c4923b98dbe4bef2c2cdb` (merge of PR 461; holds DEV-HX-1) |
| Registration status line | "Status: REGISTERED 2026-10-30"; §6 holds DEV-HX-1 |
| Task seal | `verify-seal.sh`: seal ok, root `db7347acf8106989`, 752 files |
| Script sha256 (§9.1, 12 files) | all 12 match |
| Rules root | 45 of 45 OK; sha256 of `RULES-FROZEN.sha256` = `098d67bd4fdc97c5` |
| CLI pin (`/opt/claude-code/bin/claude --version`) | **2.1.316**; run 1 recorded 2.1.314, so **not equal** (see Unexpected). Every turn record carries 2.1.316; no version change during the run |
| make-input | 11 tasks × 2 arms × 2 replicates = 44 sessions, 132 turns; caps sessions 140, total 143 |
| setup-sandbox | listing denied (23 paths), sweep empty (positive control found, 50 patterns), S4 clean (`isolation/`) |
| `--dry` | passed (`dry/`); committed and pushed before any call (commit `59e02f60e`) |
| `--smoke` | passed, 2 calls (`smoke/`) |
| `--probes` | passed, 1 call (`probes/`) |

## Sessions

Started detached (`DAEDALUS_MIRROR_SEM=off nohup … --sessions`) at 2026-11-02T02:23:26Z; finished on its own at
2026-11-02T03:31:24Z (`stopped: null`). No STOP line, no exit 3.

| Item | Value |
|---|---|
| Generator calls | smoke 2, probes 1, sessions 132 = **135 of 143** (session cap 140: 132 used) |
| Turns per arm | none 66, combined 66 (all `completed`) |
| Redraws / resumes | 0 / 0 |
| Hub judge calls (R-MIRROR-SEM) in sessions | **0**: the hub ran with `DAEDALUS_MIRROR_SEM=off` (no judge object); no judge cache directory was created; no hub ledger holds an R-MIRROR-SEM finding |
| Integrity flags | 0 of 22 `combined` sessions |
| Wall time | setup start 02:18:40Z; sessions 02:23:26Z to 03:31:24Z (68 min); scoring and records to about 04:00Z |

### Integrity per `combined` session (from `session.json`)

| Session | Task | Rep | Edits / with hook | Fail-open | Hub p95 / max (ms) | Flagged |
|---|---|---|---|---|---|---|
| c001 | t01 | 0 | 9 / 9 | 0 | 430 / 573 | no |
| c002 | t03 | 0 | 9 / 9 | 0 | 434 / 554 | no |
| c005 | t07 | 0 | 8 / 8 | 0 | 521 / 533 | no |
| c006 | t11 | 0 | 16 / 16 | 0 | 675 / 842 | no |
| c008 | t06 | 0 | 10 / 10 | 0 | 431 / 511 | no |
| c011 | t10 | 0 | 12 / 12 | 0 | 402 / 456 | no |
| c015 | t09 | 0 | 16 / 16 | 0 | 482 / 525 | no |
| c016 | t08 | 0 | 13 / 13 | 0 | 437 / 474 | no |
| c018 | t04 | 0 | 10 / 10 | 0 | 409 / 410 | no |
| c020 | t02 | 0 | 13 / 13 | 0 | 644 / 662 | no |
| c021 | t05 | 0 | 15 / 15 | 0 | 576 / 667 | no |
| c025 | t01 | 1 | 9 / 9 | 0 | 526 / 527 | no |
| c026 | t10 | 1 | 14 / 14 | 0 | 507 / 519 | no |
| c028 | t09 | 1 | 16 / 16 | 0 | 472 / 537 | no |
| c031 | t08 | 1 | 14 / 14 | 0 | 539 / 548 | no |
| c034 | t02 | 1 | 13 / 13 | 0 | 582 / 586 | no |
| c037 | t06 | 1 | 10 / 10 | 0 | 461 / 502 | no |
| c038 | t07 | 1 | 8 / 8 | 0 | 359 / 377 | no |
| c040 | t05 | 1 | 15 / 15 | 0 | 478 / 489 | no |
| c042 | t11 | 1 | 16 / 16 | 0 | 662 / 771 | no |
| c043 | t03 | 1 | 9 / 9 | 0 | 457 / 483 | no |
| c044 | t04 | 1 | 9 / 9 | 0 | 383 / 492 | no |

Every `combined` session has a `deliveryAudit` in `session.json` (33 to 79 check records each).

## Scoring (zero calls)

`DAEDALUS_MIRROR_SEM=off npx tsx experiments/v15-study/score-study.ts --results /srv/o/hx-pilot/out --input
/srv/o/hx-pilot/input.json --counted hx-i --require-delivery-audit --node-modules /srv/h/skeleton-install/node_modules
--out results/v1.5-hx-study/hx-pilot-r2/scores`: exit 0, 44 sessions scored, all complete. Gate (b):
`npx tsx scripts/v1.5/hx-gate-b.ts --results /srv/o/hx-pilot/out --scores <RES>/scores/scores.json --json <RES>/gate-b.json`: exit 0.

No D_hx contrast, p value or effect size was computed (pilot data; gates only).

## Gates (§5.1), as registered

| Gate | Numbers | Exit |
|---|---|---|
| (a) delivered = scored | `auditVerdict` flags **0 of 22** sessions (0 rule-list mismatches, 0 counted rules not delivered); `findingsAgreement`: **0 differences**; comparable snapshots **66 of 66** (every editing session has 3, minimum 3 ≥ 1); evasion-candidate steps: **none** (0 not comparable) | **PASS** |
| (b) ledger completeness | 22 sessions, 66 steps: 0 agree, 66 nothing new, 0 not comparable, **0 missing**, 0 without audit | **PASS** |
| (c) the `none` arm traps | **11 of 11** tasks fail a trap sub-goal in ≥ 1 of 2 `none` runs (≥ 8 needed) | **PASS** |
| (d) the agent repairs | counted keys first exposed (push or pull) in `combined` sessions, pooled: **37 exposed, 37 resolved by session end (1.00)**; ≥ 6 exposed and ≥ half resolved | **PASS** |
| (e) acceptance holds | tasks passing tests in ≥ 1 of 2 runs: **combined 11, none 10** (11 ≥ 10 − 1) | **PASS** |

Re-levering round: not used.

**Gate (c) per task** (`none` runs with a failed trap sub-goal, of 2): t01 1, t02 1, t03 2, t04 1, t05 1, t06 2, t07 2,
t08 2, t09 1, t10 1, t11 2. **Gate (e) per task** (runs with all tests passing, of 2): `combined` 2 on all 11 tasks; `none`
2 on every task except t10 (0 of 2).

**Gate (d) method.** Exposed keys: the scorer's attribution rows (`scores.json`, `attribution.rows`) whose attribution is
not `unexposed`, restricted to counted rules (`HX_COUNTED_RULES`, plus R-MIRROR2 `[literal]`/`[error]`); resolved = not on
the final tree (`onFinalTree` false). The hub ledger does not record R-MIRROR2's shape word. It was taken from the identity
subject: in `r-mirror2-vendor-lexicon.cypher` the only branch whose subject is `<symbol> '<term>'` (lines 14–15) returns
shape `literal` or `error`, both counted under option (i); the field, field-set, field-list and decl branches return a
bare symbol. By rule: R-TRANSPORT 3, R-AXA 6 (all resolved); R-MIRROR2 quoted-term (counted) 28 (all resolved);
R-MIRROR2 with a bare-symbol subject (8: 6 dotted field names, not counted; 2 `Evening`, decl or field-set), all
resolved; R-MIRROR (not counted) 8. Every reading gives PASS: non-MIRROR2 counted rules alone are 9 of 9; adding the 2 bare-symbol
subjects (`Evening`, decl or field-set) gives 39 of 39.

**Gate (b) note.** No `combined` step snapshot (the tree of the turn's last push) held a new counted identity, so the 66
steps are "nothing new" and the check found nothing to miss; the 37 exposed keys were all resolved within the turn that
exposed them.

## Unexpected

- **CLI version 2.1.316**, not run 1's 2.1.314 (a fresh container). Constant over the whole run; it is the pin of this
  pilot (§9.1 CLI version pin rule).
- **Order seed.** `input.json` carries `orderSeed` 20261029 (`lib/plan.ts`, `ORDER_SEED`), while §2 of the registration
  states `20261030` for this study. The scripts are pinned by hash and were not changed; recorded for the author.
- **Scorer rerun.** The first scorer invocation was ended by the coordinating tool's 10-minute command limit after 36
  of 44 sessions (no output written). It was rerun detached, unchanged, from the start (zero calls); that run is the one
  recorded here.
- The R-MIRROR2 shape word is not in the hub ledger (see gate (d) method).

## Records

`isolation/`, `dry/`, `smoke/`, `probes/`; `run/` (`turns.jsonl`, `calls.jsonl`, `schedule.json`, `state.json`,
`sessions/*.json`, `hub/*.push.jsonl`, `*.calls.jsonl`, `*.ledger.json`); `sessions/` (step trees from `--keep-trees`: 44
sessions, 176 steps, 3569 files, tree hashes and canaries checked); `scores/` (`scores.json`, `cells.json`); `gate-b.json`;
`private-id-map.json` (after generation). Checked before commit: no `costUsd`, no canary marker (`grep -rl canary-` empty),
no personal path, no chat or agent message text; `git status --short --ignored` lists no ignored file under this folder.
