# ops/: the working surface for plans, status and decisions

This folder is where the author and the agent plan, track and decide. It replaces chat and Notion for day-to-day work. Notion stays for finished, shareable pages.

**How to use it**
- Open `00-overview.md` first. It fits on one screen and links to everything else.
- Write comments straight into the files. Use a line that starts with `> AUTHOR:`. The agent reads these lines at the start of each work block, answers them in place with `> AGENT:`, and then deletes the pair once it is settled.
- Decisions that are yours sit in `decisions.md`. Each one has a checkbox. Tick it, or write your answer under it.
- Each file ends with a short changelog, newest entry first, so you can see what moved since you last read it.

| File | What it holds |
|---|---|
| [`00-overview.md`](00-overview.md) | Both tracks on one screen: status per objective, the next move, and what is waiting on you |
| [`01-instrument-map.md`](01-instrument-map.md) | The instrument split into parts C1–C6, the three neural roles, what counts as a rule, and drift as the main outcome (draft) |
| [`02-defensibility-conditions.md`](02-defensibility-conditions.md) | For every claim: the condition that makes it defensible, the evidence now, the gap and how it closes |
| [`04-north-star.md`](04-north-star.md) | How the part tests and the whole-instrument checks add up to SO1–SO5 |
| [`03-build-list.md`](03-build-list.md) | What still has to be built, per map part, before Study 2 |
| [`track-1-instrument.md`](track-1-instrument.md) | SO1–SO3, the instrument, read three ways: per objective, per link of the chain, and applied to a few projects |
| [`track-2-scale.md`](track-2-scale.md) | SO4–SO5, the instrument at scale: validity beyond the development set, and the agent study |
| [`decisions.md`](decisions.md) | Open author decisions, each with its options, a recommendation and its cost |
| [`notes/`](notes/) | Thinking notes, one per idea, written before any run (`ns-01-…` is the first) |

**Rules for this folder**
- **This repository is public.** No slides, emails, thesis text, defence notes, billing or spend figures, or personal paths go here. Those stay in the private thesis repository.
- **Every number has a source.** It cites the compendium (`Docs/v1.3/compendium/`), a `Docs/DiagnosticRuns/` report, or a null and limit id such as `N63` from `Docs/v1.3/compendium/nulls-and-limits.md`. This folder adds no new measurement. When a run produces a number, its DiagnosticRuns report comes first and this folder links to it.
- **Status key:** the same as the compendium. **GREEN**: committed, reproducible evidence, within its stated scope. **AMBER**: evidence exists but is development-only, partial or below target. **RED**: no evidence yet, or a null result. **(dev)**: measured on the development material the tool was tuned on.
- **Pace.** Each experiment gets a short design note here first: its question, what result would change our minds, and its call count. It runs only after you have read the note.

## Changelog
- 2026-10-18: added the conditions register and the gap-closing plan.
- 2026-10-18: added `01-instrument-map.md`.
- 2026-10-18: folder created. Track assessments written from the compendium as of `612b3727`.
