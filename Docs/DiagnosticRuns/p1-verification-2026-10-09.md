# P-1 verification (Fable, 2026-10-09)

Verdict: PASS, no blocking issues. The full report is in the orchestrator transcript, and its dispositions are in ADR-021 item 5.
- The chain order holds: the rule and generator came before the specs, and the specs before the single count; nothing registered moved after 02fbb2f.
- The generator check reproduces the committed specs byte for byte. --check-prereg v2 passes on all six plans with 36 artefacts.
- k = 2 gives 85 and k = 3 gives 126. That was recomputed over 63 golden rows (7 bases × 9 symbolic positives), with no twin or probe rows.
- Per base at k = 2: realworld 8, ghostfolio 10, truthy-demo 15, dry-run-test 14, zhuravlevma 12, nestjslatam 16, valex 10.
- Major 1 (held-out set not named in the registered plans) and Major 2 (count inputs not registered) go to P-U6. So do the minor items: presets and generator inputs, MarvinRF permanently excluded, the audit and plan lag, and the 5811645 note.
- Ch7 duties: the capacity history 29/42 -> 47/69 -> 85/126; the three floor-motivated decisions (remap; ghostfolio +10; E7 +38); the counterfactual N = 111 at k = 3 without the ghostfolio repair; exclusions by name; style mismatches and imbalance (5 nestjs, 1 clean, 1 layered); the vocabulary written after the projects were known; the margin 85 vs 80; the catalogue hashed as DRAFT in v1; the post-hoc items.
