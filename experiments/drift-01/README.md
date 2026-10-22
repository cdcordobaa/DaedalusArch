# DRIFT-01: the Study 2b drift protocol on DDD and Hexagonal seeds, with the v1.5 instrument (v1.5-exp)

**Exploratory, DEV split, NOT Study 2b.** Design: `ops/notes/drift-01-design.md` (committed before any generator
call). Part A report: `Docs/DiagnosticRuns/drift-01-rescores-2026-10-23.md`. Pilot report:
`Docs/DiagnosticRuns/drift-01-pilot-2026-10-23.md`. Records: `results/v1.5-exp-drift-01/`.

| File | Role |
|---|---|
| `plan.ts` | The run plan: per task and replicate a shared step-1 session (arm `none`), then one session per arm for steps 2–5 |
| `run-drift.ts` | The driver: `--dry` (zero calls), `--checks` (4 calls), `--sessions [--resume]` (78 turns + redraws, cap 94) |
| `pull.ts`, `mcp-relay.cjs` | Arm `pull`: the PUZZLE-02 hub, tool sentence and argv, copied from `origin/pilot/puzzle-02-tool-arm` (`9d8205004`) |
| (imported) `../edit-gate/` | Arm `gate`: hub, settings and relay; the hub's optional `baseline` is the task seed |
| `score-drift.ts`, `lib/v15-identity.ts` | Zero-call scorer: frozen rules (check-correct) plus R-D4 and R-XCTX as edge identities; D_v15, D_frozen, D_v15_seed, per-step and exposure |
| `setup-sandbox.sh` | The isolation layout; closes the clone in place with chmod (never moves it); `--open` reopens it |
| `test/unit.ts` | Unit tests (identities, renames, exposure, plan), zero calls |

```
npx tsx experiments/drift-01/test/unit.ts --out experiments/drift-01/results/unit.json
sh experiments/drift-01/setup-sandbox.sh
npx tsx experiments/drift-01/run-drift.ts --dry      --input /srv/o/input.json
npx tsx experiments/drift-01/run-drift.ts --checks   --input /srv/o/input.json
npx tsx experiments/drift-01/run-drift.ts --sessions --input /srv/o/input.json
sh experiments/drift-01/setup-sandbox.sh --open
npx tsx experiments/drift-01/score-drift.ts --manifest <blocks.json> --node-modules /srv/h/skeleton-install/node_modules --out results/v1.5-exp-drift-01/score
```
