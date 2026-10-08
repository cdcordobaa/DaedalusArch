# SEN-01 seeded copies (BR-U4-SEN-01; BT-F Step 36)

Copies built under the session scratchpad from `fixtures/correct-reference` (development set only). The files here are the exact seeded sources, stored as `.txt` so no tool compiles or lints them.

| Copy | Change | Probed function |
|---|---|---|
| base | none (`correct-reference`, uncapped) | both |
| S | `src/domain/entities/Task.ts` replaced by `S-src-domain-entities-Task.ts.txt`: `save(storageDir)` and `static findById(storageDir, id)` reading and writing `tasks.json` through `fs` / `path` (a repository-style save with storage access in the entity) | FF-N02 |
| I | `NotificationFormatter.ts` (e-mail / SMS message formatting) and `DateUtils.ts` (general date helpers) added beside `Task.ts` in `src/domain/entities/` | FF-N01 |

**Review line (probe independence, BR-U5a-28, 29)**: S adds storage access to the entity; it moves no entity guard into a controller handler (not MO-X02). I adds two files of unrelated concerns; it duplicates no invariant as an exported free function in a new domain module and leaves `Task.isValid` where it is (not MO-X03). No rubric text was changed.
