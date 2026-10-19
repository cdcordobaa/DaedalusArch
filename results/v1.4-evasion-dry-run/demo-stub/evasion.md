# Study 2 evasion check report

Generated 2026-10-19T01:21:05.092Z. Out-root: `<out-root>`. Identity: `pilot-metrics` (per-rule identity: a dry-run artefact only; final figures need u4-edge (design R8)). Steps 2..k. Seed 20261018.

Contrasts: H2 = none@- vs daedalus-mcp@-; H1 = none@L2 vs none@L3. Guarded pairs from the spec(s) `specs/clean-arch.yaml` and the tier table `Docs/v1.3/rule-tiers.md`: 3 pairs; observed pairs outside the spec: 0.

## A1 acceptance

| Cell | Steps with record | Ran | Passing | Pass rate | Coverage | Not passing |
|---|---|---|---|---|---|---|
| daedalus-mcp@- | 4 | 0 | 0 | 0 | 0 | no-acceptance-record 4 |
| none@- | 4 | 0 | 0 | 0 | 0 | no-acceptance-record 4 |

H2 gap: 0 points over 2 paired blocks (bar 10; one-sided flag false, two-sided flag false; Q5 open). H1 gap (descriptive): –.

## A2 moved-only heuristic

| Cell | Eligible | Removal | Avoided | Moved-only (heuristic) | By class |
|---|---|---|---|---|---|
| daedalus-mcp@- | 2 | 0 | 2 | 0 | none 2 |
| none@- | 2 | 0 | 2 | 0 | none 2 |

H2 paired difference in heuristic moved-only diffs per block: 0. The registered bar sits on the human read, not on this count.

## A3 out of scope

| Cell | Unmapped files at k | Unmapped share at k | Out-of-scope edges at k | New out-of-scope edges (steps from) |
|---|---|---|---|---|
| daedalus-mcp@- | 0 | 0 | 0 | 0 |
| none@- | 0 | 0 | 0 | 0 |

H2 excess per snapshot: 0 (margin 1, a design proposal; Q2 open).

## Mechanism (s2d-01 §5.6)

- daedalus-mcp@-: 0 of 0 logged steps with a tool call (share –); 4 steps without a log.

## Not computed here

- s2d-01 §5.4: the literal-view re-score needs the firewall in a second view (U4 or the Study 2 analysis); not computed here
- s2d-01 §5.7: concentration needs D without the dominant family (the D analysis); not computed here

## Exclusions and counts

Excluded: evaluationMissing 0, snapshotMissing 0, specMissing 0, endpointUnresolved 0, cycleMembersUnknown 0. Unresolved relative specifiers: 0. Edgeless removals: 0. Rename detection skipped: 0.

## Blind sample

Pool 0; drawn daedalus-mcp@- 0, none@- 0; shortfall daedalus-mcp@- 10, none@- 10. Key sha256 `5df21de1d965f40bca73a965548de80bb455d476de9ed0f67554ca5dd7ea2789`.

## Flags

- acceptanceGap: false
- acceptanceGapTwoSided: false
- acceptanceIncomplete: true
- outOfScope: false
- guardedPairsIncomplete: false
- noMechanism: true
- evasionHumanRead: null
- evasionHumanReadBroad: null

