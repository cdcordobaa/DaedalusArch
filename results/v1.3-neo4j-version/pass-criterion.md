# Pass criterion (committed before any run): Neo4j version independence

Job P1 (night backlog 2026-10-16, #26). Fixed before Neo4j 2025.x was started.

- Engine under test: the latest Neo4j 2025.x Community release whose tarball is on dist.neo4j.org on 2026-10-16
  (probed: 2025.12.1; 2025.12.2-2025.12.4 return 404), with the APOC core jar bundled in that tarball
  (`labs/apoc-2025.12.1-core.jar`). One instance, bolt 127.0.0.1:7687, default configuration plus the APOC jar
  in `plugins/` (as for the 5.26.24 reference run). Exact versions and sha256 recorded in run-provenance.json.
- Command: `npx tsx scripts/v1.3/ue-baseline-live.ts --out <scratch>` (default `--engine neo4j`), unchanged code.
- Compared files: `raw/` (71 files), `report.json`, `report.md`, against `results/v1.3-reference/after-member-facts`.
  Also `evidence/` with `elapsedMs` removed (secondary).
- **PASS** iff every compared file is byte-identical. `elapsedMs` is the only field allowed to differ (it lives only in
  `evidence/`).
- **Otherwise**: list every divergent file and, per divergent rule/template, classify the difference with the trap
  classes of `Docs/v1.3/cypher-interpreter.md` (content / order / error / unsupported, and T-numbered trap where one
  applies). A divergence is reported as found; nothing is re-run to make it go away, no template is edited.
- Control (rules block item 3): the same comparison with `--engine cypher-interp`.
- Optional, time permitting: the memory-parity sweep against 2025.12.1, `order` class only.
