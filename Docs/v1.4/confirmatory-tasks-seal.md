# Confirmatory Study 2 tasks: seal record (Layered), 2026-10-19

**What is sealed.** The 4 Layered confirmatory tasks, written blind.

- **The writer:** a separate `claude -p` session, Opus, with no saved transcript and tools limited to reading the repo and writing into the sealed folder. Gate V10c: the writer never runs or scores a study.
- **The script:** `ops/review/2026-10-19/confirmatory-writer.sh`. The prompt is `confirmatory-writer-prompt.md` in the same folder.
- **Where the tasks live:** `daedalus-sealed/v14-confirmatory/`, outside the repository, next to the retired list. No agent session reads them before the confirmatory run.

## Hashes (sha256)

| File | sha256 |
|---|---|
| `tasks.json` | `6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc` |
| `MANIFEST.sha256` (one sha256 per sealed file: tasks, 20 acceptance tests, design notes, audit sheet, hint audit) | `e680aeb06e8c0297c158aa87241bb66e6ba2638ff77e4b1e3bd6c02e02b3abbf` |

## Checks at sealing

- **Shape:** 4 tasks × 5 steps; 20 acceptance-test files; 24 files sealed in all.
- **Hint audit** (`Docs/v1.3/study2-task-design/hint-audit.mjs --preset presets/layered.yaml`, re-run by the script): **0 FAIL**, 8 WARN. Each WARN is justified in the sealed audit sheet.
- **Domain check (the F23 check for these tasks):** an external-examiner session, started by the author, read the 4 tasks and the retired sealed list (hash checked: OK) against every practice domain. Its verdict: **GO**, with no overlap, no borderline task and no pair too similar, at high confidence. Its message names no domain. Script for re-runs: `ops/review/2026-10-19/confirmatory-domain-examiner.sh`.
- **The writer's note:** the step requests name their HTTP routes, so the hidden acceptance tests share a contract with the agent (D12 option a). That needs the author's approval and the start convention. The acceptance tests were syntax-checked only, never run against a reference service.

## Not sealed yet

The 2 DDD confirmatory tasks. They are sealed before any DDD Stage A (exploratory registration, amendment 1).
