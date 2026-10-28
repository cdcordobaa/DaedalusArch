# N1: model-supplied aggregate roots (v1.5 final study, neuro-symbolic secondary)

Registered in `Docs/v1.5/final-study-preregistration.md` §4 (branch `v15/final-study-prereg`). No Holm correction and
no confirmatory claim.

## What N1 measures

S3 names the aggregate roots from the code alone. The spec's `aggregates` block is hidden. S3 sees the context names,
the head of the README and a numbered listing of the domain and store types, and must cite a line for every root.
The admitted DDD rules are then re-run with S3's roots in place of the declared roots:

- **(a) CAL-03.** On the sealed CAL-03 cases, recall and FP against the labels for each admitted row: K01, K02, K03,
  K05, K10, K13, K14, K15 and K16. K10 is scored by R-D5S alone, as in the admission report. The run also reports the
  pooled recall with its Wilson lower bound, the incorrect findings on the admitted rows' clean cases, and any
  admitted-rule hit on other rows' clean cases. The same numbers are computed for the declared roots, and the sealed
  `result.json` rows are copied beside them for comparison.
- **(b) DDD study snapshots.** On each tree, the admitted rules run once with the declared roots and once with S3's
  roots. Two agreement measures come out:
  - The share of identical findings over the union. A finding's identity is `tree|rule|file|line`.
  - Cohen's κ over that union.

**Registered reading:** "facts supplied by the model preserve the admitted rules' results" when both of these hold:

- On CAL-03, pooled recall over the admitted rows is ≥ 0.90 and there are 0 incorrect findings on clean cases.
- On the study snapshots, agreement is ≥ 0.90.

The record contains `reading.recallAtLeast090`, `reading.zeroIncorrectOnClean` and `reading.agreementAtLeast090`.

**Roots.** S3 runs 2 times per tree. A root counts only when it is named and grounded in both runs, with the same type
name and file. A root from one run only is listed under `dropped`. The grounded roots become spec `aggregates`
entries through `src/v15-instrument/s3-ownership.ts`, which is unchanged:

- `module` is the root file's folder plus `/**`.
- `inner_entities` is empty.
- `context` is the model's answer.

If S3 names no root, the block is removed. The instrument then falls back to inferred roots. The record shows this
as `s3RootSource: fallback`.

**CAL-03 basis (a choice made here).** S3 runs on each domain's **base** tree only: 2 trees. Every case of the domain
is then scored with the base spec's `aggregates` replaced by those roots. Roots are a property of the base. A case is a
small change to it, and no CAL-03 case overlays `spec.yaml`. Running S3 per case would put 160 cases × 2 calls behind
one fact that the cases do not vary.

**Caveat.** A spec invariant's `owner` must name a declared aggregate (`spec.ts`). If S3 names the owner under another
name, that invariant drops out and K10 can miss. This is part of what N1 measures, not something the runner corrects.

**κ caveat.** Over the union of identities, every identity is present on at least one side, so there is no
both-absent cell. κ is then ≤ 0 whenever the two sides differ, and undefined (`null`) when they are identical. The
record still reports this κ as registered (`kappaUnion`). Beside it is a supplementary κ over tree × admitted-rule
cells (`kappaTreeRuleCells`): a cell is true when the rule fires anywhere in the tree, so both-absent cells exist. The
decision uses the identical-findings share.

## S3 configuration (unchanged)

The prompt is `u4-s3-facts-v1`. System prompt, schema, answer check, listing and grounding all come from
`src/v15-instrument/s3-ownership.ts`. The model is `claude-sonnet-5-5`, the model S3 passed U4 with. It is a constant
(`N1_MODEL`) and no flag changes it. Cassettes are keyed with the U4 recipe: sha256 of (part, prompt version, model,
run, system, schema, prompt). The run index is part of the key, so the 2 runs are 2 different calls.

## Modes

```bash
# 0 calls: count trees, batches and planned calls; fix the cap in caps.json
npx tsx experiments/v15-n1/n1.ts --estimate --cal03
npx tsx experiments/v15-n1/n1.ts --estimate --snapshots <dir-of-trees> [--spec <spec.yaml>]

# record (calls the model up to the cap), then score (0 calls)
npx tsx experiments/v15-n1/n1.ts --cal03 [--route judge|ambient] [--pin <cli-version>]
npx tsx experiments/v15-n1/n1.ts --snapshots <dir-of-trees> [--spec <spec.yaml>] [--route ...] [--pin ...]

# cassettes only; a cassette miss is an error (exit 3)
npx tsx experiments/v15-n1/n1.ts --cal03 --replay
npx tsx experiments/v15-n1/n1.ts --snapshots <dir> --replay

# 0 calls, plumbing check: declared roots fed through the S3 path (must reproduce the declared condition)
npx tsx experiments/v15-n1/n1.ts --cal03 --control --out <file>
```

- **`--snapshots <dir>`:** every subfolder that has a `src/` is a tree. The spec is `--spec` if given, else the tree's
  own `spec.yaml`. Each tree is copied to a scratch folder before scoring, so nothing is written next to a snapshot.
- **Output:** `results/n1-<target>.json`, or `-replay.json`, or `--out`. It records:
  - the requested model and the answered models;
  - the route (kind, argv flags, env policy, config dir in `~` form);
  - the CLI version and the pin;
  - the cap, the calls used and any truncation;
  - per tree: both runs' roots, the kept and dropped roots, and each answer's cassette key.
- **Exit codes:** 0 ok; 2 refused (no cap, listing changed since the cap was fixed, CLI version unreadable, or pin
  mismatch); 3 cassette miss in replay; 4 stopped on the cap or on a CLI version change, with the result written and
  marked `truncated`.

## Call cap

The cap is **2 × trees × 1.5**, rounded up (pre-registration §9). `--estimate` writes it to `caps.json` per target,
together with a sha256 of the listing. A record run refuses to start in these cases:

- There is no cap for its target.
- The listing has changed since the cap was fixed.

Once calls for a target are on the ledger, the cap is not rewritten.

Every attempt counts against the cap, retries included (one retry on an invalid answer). Each attempt is one line of
`ledger.jsonl`. When the cap is reached, the run stops asking. The unanswered batches are listed under
`truncatedAnswers`. Trees with an incomplete S3 are not scored, and the reading is "not reached". The CLI version is
read before every call, and a change stops the run.

CAL-03 estimate (2026-10-28): 2 trees with 1 batch each, so 4 planned calls and a cap of 6.

## Route: where it can run

The call is `claude -p --model claude-sonnet-5-5 --output-format json --json-schema <S3 schema> --system-prompt <S3
system> --setting-sources project --strict-mcp-config --disable-slash-commands --no-session-persistence --tools ""`.
This is the U4 S3 argv. The prompt goes on stdin, and the cwd is a fresh empty temporary folder.

- **`--route judge` (default; the registered "Claude CLI judge route")** builds the child env as follows:
  - the judge allow-list (`JUDGE_ENV_ALLOW`);
  - `CLAUDE_CONFIG_DIR` set to the judge config dir (`~/.firewall/judge-claude-config`, override with
    `N1_JUDGE_CONFIG_DIR`);
  - `DISABLE_AUTOUPDATER=1`.

  Its subscription login lives in the macOS keychain, so **this route needs the author's machine.**
- **`--route ambient`** passes the parent env, minus `ANTHROPIC_API_KEY` and `CLAUDE_CONFIG_DIR`, and sets
  `DISABLE_AUTOUPDATER=1`. It uses whatever login the `claude` on PATH has. This is the route for a cloud session or
  routine. It was not tested at build time. Before the first call, check that `claude --version` works and that the
  session is signed in with a subscription. Removing the API key keeps a cloud run off API billing.

Either way, pass `--pin <version>` to refuse a CLI other than the pinned one. The version is recorded in every case.

## Tests

`tests/unit/v15-n1/n1.test.ts` uses stub answers only. It covers:

- the root swap and the spec block it produces;
- dropping a root named in one run only, including through `s3Roots` on a fixture tree;
- cap enforcement with retries, plus the stop on a CLI version change;
- cassette replay, and the error on a cassette miss;
- the κ and agreement math, and the Wilson bound.

```bash
npx jest --maxWorkers=2 --forceExit tests/unit/v15-n1
```
