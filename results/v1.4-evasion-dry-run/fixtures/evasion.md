# Study 2 evasion check report

Generated 2026-10-19T01:21:38.904Z. Out-root: `<out-root>`. Identity: `pilot-metrics` (per-rule identity: a dry-run artefact only; final figures need u4-edge (design R8)). Steps 2..k. Seed 20261018.

Contrasts: H2 = none@L2 vs daedalus-mcp@L2; H1 = none@L2 vs none@L3. Guarded pairs from the spec(s) `specs/clean-arch.yaml`, `tests/fixtures/v1.4-evasion/spec-hexagonal.yaml`, `tests/fixtures/v1.4-evasion/spec.yaml` and the tier table `Docs/v1.3/rule-tiers.md`: 17 pairs; observed pairs outside the spec: 1.

## A1 acceptance

| Cell | Steps with record | Ran | Passing | Pass rate | Coverage | Not passing |
|---|---|---|---|---|---|---|
| daedalus-mcp@L2 | 14 | 14 | 14 | 1 | 1 | – |
| none@L2 | 14 | 14 | 14 | 1 | 1 | – |

H2 gap: 0 points over 14 paired blocks (bar 10; one-sided flag false, two-sided flag false; Q5 open). H1 gap (descriptive): –.

## A2 moved-only heuristic

| Cell | Eligible | Removal | Avoided | Moved-only (heuristic) | By class |
|---|---|---|---|---|---|
| daedalus-mcp@L2 | 12 | 11 | 1 | 8 | deleted 2, dynamic-escape 2, inlined 1, none 1, relocated-unguarded 1, relocated-unmapped 4, wrapped 1 |
| none@L2 | 12 | 11 | 1 | 8 | deleted 2, dynamic-escape 2, inlined 1, none 1, relocated-unguarded 1, relocated-unmapped 4, wrapped 1 |

H2 paired difference in heuristic moved-only diffs per block: 0. The registered bar sits on the human read, not on this count.

## A3 out of scope

| Cell | Unmapped files at k | Unmapped share at k | Out-of-scope edges at k | New out-of-scope edges (steps from) |
|---|---|---|---|---|
| daedalus-mcp@L2 | 0.286 | 0.083 | 0.571 | 8 |
| none@L2 | 0.286 | 0.083 | 0.571 | 8 |

H2 excess per snapshot: 0 (margin 1, a design proposal; Q2 open).

## Mechanism (s2d-01 §5.6)

- daedalus-mcp@L2: 0 of 0 logged steps with a tool call (share –); 14 steps without a log.

## Not computed here

- s2d-01 §5.4: the literal-view re-score needs the firewall in a second view (U4 or the Study 2 analysis); not computed here
- s2d-01 §5.7: concentration needs D without the dominant family (the D analysis); not computed here

## Exclusions and counts

Excluded: evaluationMissing 0, snapshotMissing 0, specMissing 0, endpointUnresolved 0, cycleMembersUnknown 0. Unresolved relative specifiers: 0. Edgeless removals: 2. Rename detection skipped: 0.

## Blind sample

Pool 24; drawn daedalus-mcp@L2 10, none@L2 10; shortfall none. Key sha256 `428865d101bb31ab4e581234caf0155c85d976c037780e60daeadcf0a412f292`.

## Flags

- acceptanceGap: false
- acceptanceGapTwoSided: false
- acceptanceIncomplete: false
- outOfScope: false
- guardedPairsIncomplete: true
- noMechanism: true
- evasionHumanRead: null
- evasionHumanReadBroad: null

