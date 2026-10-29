R-AXA regression fixtures (2026-10-29, instrument v1.5.1). Each folder is overlaid on a trap-family seed by
`tests/unit/v15-instrument/r-axa-shared-helpers.test.ts`:

- `f19-kitchen-routes/`: a new inbound HTTP route that imports the driving side's shared reply helper
  (`../shared/reply`), as the seed routes already do. Known false positive of R-AXA v1: must not fire.
- `f19-kitchen-reads-db/`: the same route also imports the in-memory database of an outbound adapter. Must fire,
  once, for that import only.
- `f19-shared-reaches-store/`: the shared helper itself imports an outbound adapter, so it is no longer a helper:
  the routes importing it must fire (the exemption is conservative).

The f24 true positive (an inbound MQTT handler importing an outbound in-memory store) is read from the task's own
reference solution, unchanged.
