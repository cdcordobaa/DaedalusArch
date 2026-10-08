# U5a dev-split declaration gate (BR-U5a-36 a; OI-U5a-13)

Measured 2026-10-08 on `v1.2e` at `69caee1` (Build and Test worktree, branch `v1.2e-build-and-test`), against the Build and Test Neo4j lane (`bolt://localhost:7693`). The 22 FR-24 acceptance entries are the forced sites of `business-logic-model.md` §2.3 (`tests/unit/scripts/mutation/forced-sites.ts`), applied with `scripts/mutate.ts --base fixtures/correct-reference --site <forced site> --split dev` (default cycle strategy `simple-cycles`, catalogue DRAFT, `catalogueVersion` `f94fc4e7…5d2dbc`, 22 rows, 0 rejections). MO-S03 and MO-S03n run under `tests/fixtures/u5a/layered/firewall.spec.yaml`, the other 20 under `specs/clean-arch.yaml`. Gate: `GOLDEN_REQUIRED=1 npx tsx scripts/u5a-freeze-gate.ts --manifest <scratch> --copies <scratch> --base fixtures/correct-reference --out <scratch>`; the baseline is evaluated once per spec, each copy through `bin/firewall.ts evaluate --symbolic-only`. Raw output: `u5a-freeze-gate-a.json`.

**Result: exit 0, 22/22 rows pass.** No row (positive or twin) has a new key outside `expected.keys ∪ collateral`; every in-coverage positive shows at least one expected key. OI-U5a-13 (template predicate drift since U3): no drift found, so no collateral rule changed and no catalogue changelog entry is needed.

| Row | New | Expected among new | Collateral among new | Undeclared | Pass |
| --- | --- | --- | --- | --- | --- |
| MO-S01 | 4 | 2 (FF-S01, FF-S04) | 2 (FF-S02) | 0 | yes |
| MO-S01n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-P01 | 1 | 1 (FF-P01) | 0 (—) | 0 | yes |
| MO-P01n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-C04 | 2 | 1 (FF-C04) | 1 (FF-CV05) | 0 | yes |
| MO-C04n | 1 | 0 (—) | 1 (FF-CV05) | 0 | yes |
| MO-SO01 | 1 | 1 (FF-SO01) | 0 (—) | 0 | yes |
| MO-SO01n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-CV02 | 1 | 1 (FF-CV02) | 0 (—) | 0 | yes |
| MO-CV02n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-DF01 | 5 | 1 (FF-P06) | 4 (FF-S01, FF-S02, FF-S04) | 0 | yes |
| MO-DF01n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-X01 | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-X01n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-X02 | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-X02n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-SO02 | 1 | 1 (FF-SO02) | 0 (—) | 0 | yes |
| MO-SO02n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-X03 | 1 | 0 (—) | 1 (FF-CV05) | 0 | yes |
| MO-X03n | 0 | 0 (—) | 0 (—) | 0 | yes |
| MO-S03 | 1 | 1 (FF-S03) | 0 (—) | 0 | yes |
| MO-S03n | 0 | 0 (—) | 0 (—) | 0 | yes |

Notes:

- Declared collateral that did not fire is allowed by the rule (only undeclared new keys fail). MO-CV02 declares `naming-conventions` (FF-CV01) collateral on the renamed class; it does not fire, consistent with the FF-CV01 `'.*'` default residual that the sensitivity run (Step 30) expects not to fire (ADR-016 b).
- MO-X01 (dynamic import, outside coverage), MO-X02 and MO-X03 (judge probes) have no symbolic expected key; MO-X03 shows only its declared `test-file-pairing` (FF-CV05) site collateral.
- Twins: 11/11 show no undeclared key; MO-C04n shows only its declared FF-CV05 site collateral.
