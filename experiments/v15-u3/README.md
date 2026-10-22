# v1.5 U3: S1 severity calibration (exploratory)

Thinking note: [`ops/notes/v15-u3-severity-note.md`](../../ops/notes/v15-u3-severity-note.md). Development material only. Nothing under `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, `tests/fixtures/v1.4-c4/` or the v1.4 tag is changed; they are imported read-only.

| File | What |
|---|---|
| `prompt.ts` | The rubric variant `c4-v0.2+u3-r1`: the frozen C4 prompt with item 4 replaced; the control arm is the frozen prompt |
| `run.ts` | Prepares each project with the v1.4 runner, interprets the manifest's target finding through `claude -p` (`claude-sonnet-5-5`), grounds, merges and scores with the frozen C4 code. Ledger, hard cap 60, cassettes, `--replay` |
| `analyse.ts` | The measures of note §6, zero calls |
| `cases/` | Six new pairs, answers (`expected-c4.json`) written and hashed (`set.json`) before any call |
| `ledger.jsonl` | One line per provider call (retries included) |
| `cassettes/<arm>/<project>/` | Every recorded answer |
| `results/<arm>/` | Per project `interpretation.json` and `score.json`; `metrics.json` |

Replay with zero calls (repository root):

```bash
npx tsx experiments/v15-u3/run.ts --set all --arm rubric --replay
npx tsx experiments/v15-u3/run.ts --set original --arm control --only c4-04t-superseded-adr,c4-05-intent-contradicted --replay
npx tsx experiments/v15-u3/analyse.ts --arm rubric
```
