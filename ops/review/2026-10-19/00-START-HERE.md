# Review packet, 2026-10-19

Every other file in this folder is a link to the real document, so an edit here edits the original. This folder doesn't contain the sealed list and never will. Read in number order.

## 1. F23: the sealed-list overlap check (yours alone, about 30 min)

**Why.** Agents invented the domains of the practice tasks without seeing the 6 sealed Study 2 tasks. If a practice domain matches a sealed one, the study has practised on its own test. Only you may look, because any agent that reads the sealed list contaminates it.

**Steps.** Close every Claude window first.

- [ ] 1. In a plain terminal, from the repo root, run `shasum -a 256 ../daedalus-sealed/v1.3-study2-tasks.md`. It must equal row 1 of `1b-sealed-hashes.md`.
- [ ] 2. Open the sealed file and read the 6 task domains.
- [ ] 3. For each candidate below, ask: is it the same product area, or close enough that practising one helps with the other? Tick the box if it's clear.
  - [ ] repair café
  - [ ] school bus tracking
  - [ ] vineyard harvest
  - [ ] ice rink
  - [ ] tool-library
  - [ ] bike-repair
  - [ ] choir-rehearsals
  - [ ] kayak-rentals
  - [ ] todo-list
  - [ ] recipe-box
  - [ ] book-club
  - [ ] gym-log
  - [ ] plant-care
  - [ ] chore-chart
  - [ ] garden-plots
  - [ ] food-bank
  - [ ] youth-league
  - [ ] hive-health
- [ ] 4. Note which architecture styles the 6 sealed tasks use. Gate V4 assumes Layered and DDD (see `1e`, V4).
- [ ] 5. Close the sealed file. Write the outcome below **without any sealed domain, title or text**. Candidate names are fine to write.

**Outcome:**

```
F23 date:
Method (by eye / offline model as an aid):
Overlapping candidates (or "none"):
Styles as assumed (Layered + DDD)? yes / no -> style names only:
```

Then tell Claude "F23 done", and it will log the line in audit.md and triage Q7, and replace any overlapping practice task.

Background: `1a` Part 1 (the full reasoning and sources), `1c` (the rule for practice tasks), `1d` Q7 (where the answer goes), `1f` (the later unsealing procedure, not needed today).

## 2. This morning's results (read when convenient)

- `2a`, §9: the 3 Claude sessions, both arms complete (6 + 6), and the Gemini debugging.
- `2b`: NS-03. The graph should complement reading, and the design rule is provisionally supported.

## 3. Where the thesis stands

- `3a`: the instrument map. Parts C1–C6, and the weakest link C3m.
- `3b`: the defensibility conditions. Row 1.4 is the chain F23, then freeze, then hold-out.
- `3c`: REV-02, the external examiner's critique that shaped v3 of the map.

## 4. Meaning labels (deferred until after results)

- `4a`: the codebook. Sign §12 before your first label.
- `4b`: the 60-item rater packet.
- **Never open** `results/v1.3-meaning/mean-01-sample.csv`. It is the answer key.
