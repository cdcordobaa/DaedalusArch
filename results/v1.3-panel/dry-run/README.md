# v1.3 model panel: dry run with FAKE raters (not a result)

Produced by `npx tsx scripts/v1.3/model-panel.ts dry-run` (seed 20261016). No real model was called. The three raters are deterministic stubs (`DRY_RUN_PROFILES` in `scripts/v1.3/lib/panel/adapters.ts`, accuracy 0.96 / 0.94 / 0.70) that were given each item's truth: decoy truth from the key, target truth from a seeded latent draw. The tables show that the harness, the cassettes (record, then replay, identical) and every branch of the authority rule work. They say nothing about any model.

- `panel-set.json`: what raters see (40 items: 20 wild targets, 10 known-correct and 10 known-wrong reference decoys).
- `panel-key.json`: origin, source id, rule and decoy truth per item (never sent).
- `labels.json`, `report.json`, `report.md`: labels and every table of Docs/v1.3/model-panel.md §6.
- `cassettes/`: one file per call (fake answers).
