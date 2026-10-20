# HEXDDD-01 exploratory pilot (2 cases: S1-debt Hexagonal, S2-debt DDD)

**Exploratory. Not part of the confirmatory Study 2b**, not registered, and nothing here reads or changes a Study 2b
file, the freeze tag `v1.4-freeze-2026-10-20` or a frozen path (`src`, `presets`, `scripts/lib`, `scripts/v1.3`).
Design: `ops/notes/hexddd-01-violation-elicitation-design.md` §5 (on branch `ops/hexddd-01-elicitation`, PR #331; file
sha256 `5d32fadd8ea3ec8377bc6bce5336e9e41e463f0b6396f5e01790740b2e347e5f`). The question is the design's: are
Hexagonal and DDD violations elicited at all under brownfield pressure?

Everything in this folder was committed **before any generator call**.

| File | Shown to the agent? | What it is |
|---|---|---|
| `tasks.json` | yes, one `request` per step, inside the frame | S1 and S2, 5 steps each (design §4 pressure families) |
| `design-notes.md` | never | The pressure family and the tempted violation families of each step |
| `seeds/build-seeds.mjs`, `seeds/s1-hex-debt/`, `seeds/s2-ddd-debt/`, `seeds/seeds.sha256.json` | the seed tree is the agent's starting directory | Seed builder, the built trees and their sha256 (`node seeds/build-seeds.mjs --check`) |
| `seeds/seed-eval.json` | no | The seeds evaluated exactly as a loop snapshot (zero calls): 0 type errors each; S1 one FF-S01 identity, S2 one FF-DS02 identity (the planted debt) |
| `specs/s1-hexagonal.yaml`, `specs/s2-ddd.yaml` | no | Evaluator specs (design §5.1) |
| `pass-bar.md` | no | Design §5.2 verbatim, and how the scorer applies it |
| `plan.json` | no | The loop plan: arm `none`, `claude-sonnet-5-5`, 2 runs × 5 steps, 0 repair turns, `callBudget` 10, `hardCap` 12 |
| `run-pilot.ts` | no | The driver: the loop harness unchanged, plus the seed start, the brownfield frame and a call ledger |
| `hint-audit/` | no | The frame template, every prompt the driver sends (`--frames`), and the hint-audit output |

## Seeds (design §4, §7)

- **S1-debt**: `tests/fixtures/v1.3-reference/hexagonal/project/src` + variant `v05-inbound-adapter-reads-outbound-adapter`
  (planted FF-S03 under the sealed preset; FF-S01 under the signed Q5 C), + vendored typings of the two SDKs the
  steps name (`@paystream/node`, `sqlwell`) under `src/types/` (the harness tsconfig includes only `src/**`; the
  extractor skips `.d.ts`). Tree sha256 `e3cfa16c…5700`, 32 files.
- **S2-debt**: `tests/fixtures/v1.3-reference/ddd/clean/src` + overlay of `v08-cross-context-internal-import`
  (planted FF-DS02), with the overlay's one marker comment line naming the violation dropped. Tree sha256
  `5caf330d…70e2`, 31 files.
- The seeds keep the reference projects' own doc comments (for example "Driven port", "Aggregate root"). They are the
  existing code's conventions, as in any documented brownfield project; the requests and the frame name nothing.

## Specs (design §5.1)

- `s1-hexagonal.yaml`: the hex reference `spec.yaml` with `@paystream/node` and `sqlwell` added to FF-P01
  `forbidden_imports`. sha256 `f35cdbc3ef1176d9eb1089ca3d70ad045c60e7fac5122296bafbf632565ee1f4`.
- `s2-ddd.yaml`: `presets/ddd.yaml` verbatim (its `architecture.ddd` block declares the reference project). sha256
  `b317788c7e6f5e60edbb2d087df1865300bbf12f233b666c36143a6db963e460`.
- Construct switches as at main (Q5 C, Q6 B, Q16 B among them), read by the evaluator through `src/shared/construct-switches.ts`.

## Frame (design §5.1, §8 item 2)

The harness's step frames name a style and `src/` (`scripts/lib/loop/prompts.ts`), which the design forbids, and the
harness has no seed start (design §8 item 1). Both are frozen, so `run-pilot.ts` adds them from outside:
`BrownfieldFrameAgent` sends `hint-audit/frame-template.txt` filled with the request and the harness's exact
type-check command, and records per turn the sha256 of the harness frame it replaced and of the text it sent
(`turns/step-NN/frame-<turnId>.json`). The arm `none` adds no tool sentence.

## Hint audit (run before any call; `hint-audit/hint-audit-output.txt`)

`Docs/v1.3/study2-task-design/hint-audit.mjs`: requests 0 FAIL against their own spec (S1: 0 FAIL / 6 WARN; S2: 0 FAIL /
4 WARN), 0 FAIL against the other three styles; frame template and every sent prompt audited as a no-hint frame:
0 FAIL. One term is waived and recorded: `tsconfig.json`, which occurs only inside the harness's own type-check
command (`<H>/runs/<runId>/tsconfig.json`, BR-U5a-52), outside the agent's directory. WARN verdicts: `API` (Paystream's
API key), `endpoint`, `database`, `client` (the SQL client's name), `service`, `separately`, `directory`: ordinary
product words naming no structure of the project.

## Calls

At most 1 (smoke) + 5 (confinement probes 1–5) + 12 (pilot hard cap) = 18 generator calls. `run-pilot.ts` counts
every spawn of the Claude binary other than `--version` in `<out-root>/calls.jsonl` and refuses one past the cap (per
phase, per pilot run: 6, and 18 in total), so the harness's own retries are capped too. Scoring is zero-call; C1d and
C4 are not run.

## Exploratory differences (declared before any call)

- **Machine**: a Linux cloud sandbox (Ubuntu 24.04, x86_64), not the pinned macOS study machine. Node 22.22.0.
- **CLI**: Claude Code `2.1.304` (the plan pins it; the driver's probe checks it).
- **No generator isolation**: the sandbox has no dedicated logged-in Claude config directory, so `generatorIsolation`
  is off; turns run with the E1 allow-listed environment (`scripts/lib/generators/env.ts`).
- **Seed start and frame** from the driver, not the harness (above).
- **npm cache**: the skeleton's packages were put in the npm cache from the session shell, because the harness's cache
  warm runs with an allow-listed environment that lacks this sandbox's proxy certificate. The skeleton install itself
  is the harness's (`npm ci --offline --ignore-scripts`, read-only, hashed).
- **Engine**: `cypher-interp` (no Neo4j).

## Run (repository root)

```bash
O=<absolute out-root outside the repo>; H=<absolute harness root>; B=$(command -v claude)
npx tsx experiments/pilot-hexddd-01/run-pilot.ts --smoke  --out-root $O --harness-root $H --binary $B   # 1 call
npx tsx experiments/pilot-hexddd-01/run-pilot.ts --probes --out-root $O --harness-root $H --binary $B   # 5 calls
npx tsx experiments/pilot-hexddd-01/run-pilot.ts --pilot  --out-root $O --harness-root $H --binary $B   # 10, cap 12
```
