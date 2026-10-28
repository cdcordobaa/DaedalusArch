# v1.5 final study: runbook (cloud root)

All commands run as **root, from the repository root** of a fresh clone of `main` in a claude.ai cloud container.

**One phase per container.** The sandbox is shared state: `/srv/gh` (fixed in the `gclaude` wrapper), the harness
runs directory and the cell ids. So Stage 1, lane A and lane B each run in their own container (their own routine),
and each runs `setup-sandbox.sh` once. Plans: `stage1-plan.md` (Stage 1); the pre-registration (study).

## 0. Prepare (every container)

```sh
[ -f /root/.ccr/ca-bundle.crt ] && ! grep -q '^cafile=' /root/.npmrc 2>/dev/null && echo 'cafile=/root/.ccr/ca-bundle.crt' >> /root/.npmrc
npm ci
/opt/claude-code/bin/claude --version     # the pin for this run; the driver checks it before every turn
```

## 1. Phases

| Phase | `--phase` | Tasks (`--tasks`) | Replicates | Turns | Caps (sessions / total) |
|---|---|---|---|---|---|
| Stage 1 | `stage1` | `t01,t13` | 1 | 12 | 13 / 16 |
| Study, lane A (DDD) | `lane-a` | `t01,t02,t03,t04,t05,t06,t07,t08,t09,t10,t11,t12` | 3 | 216 | 229 / 232 |
| Study, lane B (Hexagonal) | `lane-b` | `t13,t14,t15,t16,t17,t18,t19,t20,t21,t22,t23,t24,t25` | 6 | 468 | 497 / 500 (check against make-input) |

- The neutral ids are those of the full set: t01–t12 are the confirmatory DDD tasks and t13–t25 the confirmatory
  Hexagonal tasks, in `study-set.json` order. `make-input.ts` prints the counts and caps; check them against this
  table.
- Each lane has its own seeded plan: mulberry32, seed 20261029, interleaved by replicate round over that lane's task × arm
  cells.

## 2. Command sequence (one phase; set `PH`, `R` and `TASKS` from the table)

```sh
PH=stage1; R=1; TASKS=t01,t13          # lane A: PH=lane-a R=3 TASKS=t01,…,t12; lane B: PH=lane-b R=6 TASKS=t13,…,t25
I=/srv/o/$PH/input.json
D=experiments/v15-study
RES=results/v1.5-study/$PH

# 2.1 Sandbox, isolation and scripted S4 (zero calls). It closes the clone (chmod 700) and stops on any failure.
sh $D/setup-sandbox.sh $R --tasks $TASKS --phase $PH          # evidence: $RES/isolation/

# 2.2 Dry pipeline (zero calls). It must print "passed": true.
npx tsx $D/run-study.ts --dry --input $I
mkdir -p $RES/dry && cp /srv/o/$PH/out/dry/dry-result.json $RES/dry/
#     commit $RES/isolation and $RES/dry before any call (step 3)

# 2.3 Smoke (2 calls), then READ probe (1 call). Any failure: STOP and report.
npx tsx $D/run-study.ts --smoke  --input $I
npx tsx $D/run-study.ts --probes --input $I

# 2.4 Sessions (the plan, inside the cap). After a container restart: the same command with --resume.
npx tsx $D/run-study.ts --sessions --input $I
#   npx tsx $D/run-study.ts --sessions --resume --input $I
#   exit 3 = stop (CLI version change or hub p95 over 5 s): do not resume; report.

# 2.5 Score (zero calls): scores.json and cells.json.
npx tsx $D/score-study.ts --results /srv/o/$PH/out --input $I --node-modules /srv/h/skeleton-install/node_modules --out $RES/scores

# 2.6 Records (no envelopes, no prompts, no trees). Then reopen the clone.
O=/srv/o/$PH/out; mkdir -p $RES/run/sessions $RES/run/hub $RES/smoke $RES/probes
cp $O/calls.jsonl $O/turns.jsonl $O/schedule.json $O/state.json $RES/run/ 2>/dev/null || true
cp $O/redraws.jsonl $O/resumes.jsonl $RES/run/ 2>/dev/null || true
for s in $O/sessions/*/; do id=$(basename $s); [ -f $s/session.json ] && cp $s/session.json $RES/run/sessions/$id.json; done
cp $O/hub/*.push.jsonl $O/hub/*.calls.jsonl $O/hub/*.ledger.json $RES/run/hub/ 2>/dev/null || true
cp $O/smoke/smoke-result.json $RES/smoke/ 2>/dev/null || true
cp $O/probes/probes-result.json $RES/probes/ 2>/dev/null || true
cp /srv/vault/private-id-map.json $RES/private-id-map.json   # committed after generation only
sh $D/setup-sandbox.sh --open
```

## 3. Where results go

| Phase | Results directory | Branch |
|---|---|---|
| Stage 1 | `results/v1.5-study/stage1/` | `results/v15-stage1` |
| Lane A | `results/v1.5-study/lane-a/` | `results/v15-lane-a` |
| Lane B | `results/v1.5-study/lane-b/` | `results/v15-lane-b` |

```sh
git checkout -b results/v15-$PH            # Stage 1: results/v15-stage1
git add $RES && git commit -m "v1.5 study $PH: records and scores" && git push -u origin HEAD
```

Before committing, check that no file under `$RES` holds chat text, an envelope, a canary or a personal path:

```sh
grep -rl canary- $RES
```

This must print nothing.

The analysis reads the two lanes' `scores/cells.json` together; the lanes are one study with one plan per lane.
Stage 1 is never pooled with the study.
