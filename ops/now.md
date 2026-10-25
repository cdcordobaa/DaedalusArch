# Now: live state

Updated: 2026-10-24. Read this first in a new session. Keep it under 150 lines; update at every milestone. Rules for keeping it: `ops/notes/token-antipatterns-and-continuity-plan.md`.

## Where things stand

- Study 2b (confirmatory) is closed. H1 p=0.0132 (RR 0.62), H2 p=0.0001 (RR 0.48), H3 p=0.4257; ledger C8039–C8053, per-task means C10195–C10201.
- v1.5 is the semantic-instrument cycle, run through AI-DLC. Everything is exploratory until the instrument works; one final confirmatory study follows.
- Objective numbering is Kap3 `tab:fw-objectives` (SO1 spec format, SO2 APG, SO3 gate, SO4 validation, SO5 spec effect). Synthesis: `Docs/DiagnosticRuns/v1.5-exploratory-synthesis-2026-10-23.md` §4.
- main CI: Build & Test green after PR #378 (body-parser fixed, zod advisory triaged in `scripts/lib/audit-allowlist.json`). The Architectural Firewall check is a known failure.

## Open threads

| Thread | State | Next step |
|---|---|---|
| Director deck | thesis repo PR #35, `Presentacion/director-2026-10-24/` | author approves, then publish to surge |
| Non-Claude models | Gemini API key works (no generation call yet); no OpenRouter or xAI key | write a 2-run pilot design note before any call |
| Token use | antipatterns and plan written | follow the plan; weekly profile |
| COMPREHEND-02 | not started | design note |
| Kap8 / Kap9 | Kap8 over budget | restructure Kap8, write Kap9 |
| v1.5 critical path | open | move code to `src/`, author final-study tasks, fix P5 test |
| Answer keys | P2 and P5 wrong | fix |
| Meaning labels | 60 author labels pending | author |
| Hold-out spec format | open | fix |

## Pending author decisions

1. New coordinator session per thread or day, using this file as the handoff.
2. OpenRouter account and key (author creates it).
3. Small Grok spend, or Gemini and free models only.
4. Go-ahead for the 2-run non-Claude pilot design note.

## Standing constraints

- Never open `results/v1.3-meaning/mean-01-sample.*`, `../daedalus-sealed/`, or the sealed hold-out `daedalus-heldout/detect-02/`.
- Never touch tag `v1.4-freeze-2026-10-20` or the registered 2b artefacts.
- No escape or tamper prompts to Gemini or any third-party model; use scripted confinement checks.
- No `HEAVY_ADMISSION_BYPASS`; no `--admin` merges; max 2 heavy processes; `jest --maxWorkers=2`.
- Design note before any experiment call; 2-case pilots.
- Public repo: no billing figures, personal absolute paths, or quotes of the author.
