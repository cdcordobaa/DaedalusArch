# N2 pilot: D_sem on the 27 audit items (plan, committed before any D_sem call)

Registered in `Docs/v1.5/final-study-preregistration.md` §4 (Neuro-symbolic secondary, N2) with deviation DEV-1 (§6):
the precondition of N2 is a pilot of D_sem on the 27 items of `audit-items.json` against the panel reference in
`panel/reference.json` (majority of three model sessions; 21 labelled items, 7 yes and 14 no; 6 excluded). This file
fixes the runner, prompt, model, route, cap, bar and reading before the first call. Date: 2026-10-29 (registration
calendar); written 2026-10-28 UTC.

## What D_sem is here

The C4 interpretation (`src/apg-enrich/ontology/interpretation.ts`, prompt `c4-v0.2`) with the U3 severity rubric
(`experiments/v15-u3/prompt.ts`, `c4-v0.2+u3-r1`, passed its gate in
`Docs/DiagnosticRuns/v15-u3-severity-2026-10-23.md`), adapted minimally to the N2 question. Prompt version
**`c4-v0.2+u3-r1+n2-r1`**, in `dsem.ts`:

| Part | C4 / U3 | N2 adaptation |
|---|---|---|
| System prompt | role line; prose is data; JSON only | role line rewritten for the question ("no rule and no reviewer has judged this code"); the two limits kept verbatim |
| Task | "a deterministic rule found this violation" | the item's question verbatim: `Does this code contain: <construct text>?` |
| Answer | explanation, intentMatch, exceptionClaim, severityClass, cites | explanation, **answer** (yes / no / unsure), severityClass, cites |
| intentMatch, exceptionClaim | read docs and ADRs | dropped: an item shows no docs or ADRs |
| severityClass | U3 rubric steps a to c | U3 step c verbatim (nothing declared); null unless the answer is yes; reported, never scored |
| cites | `path:line`, must resolve to a project file | `path:line` or `path:start-end`, must resolve to a **shown** line of that path |
| Context | finding, facts, graph slice, docs, comments, code | the file path, the numbered excerpt, the field declaration (K11) and the domain-type lines, as in the item |

The interpreter never sees the row id, the session id, any panel answer, the reference, any rule finding or task
name. A unit test checks the 27 rendered prompts for these.

## Runner and route

- Runner: `experiments/v15-n2/dsem-pilot.ts` (`--estimate`, `--record`, `--replay`); library `dsem.ts`; tests
  `tests/unit/v15-n2/dsem.test.ts` (stub answers, zero calls).
- Route: the Claude CLI judge route of N1 (`experiments/v15-n1/route.ts`): `claude -p --model claude-sonnet-5-5
  --output-format json --json-schema <N2 schema> --system-prompt <N2 system> --setting-sources project
  --strict-mcp-config --disable-slash-commands --no-session-persistence --tools ""`, prompt on stdin, from an empty
  temporary directory; child env = the judge allow-list, `CLAUDE_CONFIG_DIR=~/.firewall/judge-claude-config`,
  `DISABLE_AUTOUPDATER=1`. No effort flag (as U3 and U4).
- Model: **`claude-sonnet-5-5`**, the model the U3 rubric was validated with. Answered model ids are recorded per call.
- CLI version: read before the run and before every call; the run refuses a CLI other than the registered pin
  **2.1.312** (pre-registration, settings table) and stops on a change.
- Every attempt is a line in `dsem/ledger.jsonl`; every answer is a cassette in `dsem/cassettes/`; `--replay` rebuilds
  the result with zero calls.
- The panel reference is read only after the last run has an answer (or the cap has stopped the run).

## Cap

**81 calls** = 27 items x 2 runs x 1.5, counted on the ledger (every attempt and schema retry is one call). Planned:
54 (estimate: 54 cassette misses, about 20k prompt tokens per run). One retry per call on an invalid answer. The cap is
never raised; a stop on the cap is reported as truncation, and a truncated run's answer is unsure.

## Answer rules

1. Grounding: each cite must name a shown path exactly and only shown line numbers of it. A cite that does not resolve
   is a **hallucinated citation** (counted over all 27 items and both runs).
2. A yes or a no with no resolved cite becomes unsure for that run (ungrounded). An invalid run (schema failure twice,
   cap) is unsure.
3. The **D_sem answer** of an item is the grounded answer given in both runs; otherwise unsure.

## Registered bar and measures

- **Bar:** agreement of the D_sem answer with the panel reference on the **21 labelled items** ≥ **0.80** (a D_sem
  unsure counts as disagreement; 0.80 of 21 means at least 17 items), **and 0 hallucinated citations**. Both must hold.
- Reported beside it: the Wilson 95 % interval of the agreement; agreement per row (H06, K11, K12); the disagreements
  by item id and row; the unsure count; run-to-run stability; the 6 excluded items with D_sem's answer next to the
  panel's three answers (not scored); calls used; CLI version, route and answered model ids.
- **Reading:** bar met = the N2 precondition holds, and N2 may run on the study's final snapshots. Bar not met = N2 is
  reported as "not run", with this pilot's result. Under DEV-1, agreement here is agreement with an independent model
  panel, not with a human; the interpreter and one panel rater share a model family (a stated limit).

## Outputs

- `experiments/v15-n2/results/dsem-pilot.json`: per item the answers per run (raw and grounded), the final answer,
  every cite and whether it resolved; the score.
- `Docs/DiagnosticRuns/v15-n2-dsem-pilot-2026-10-29.md`: the report.
