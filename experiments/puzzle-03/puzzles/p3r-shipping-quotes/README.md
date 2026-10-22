# P3r `p3r-shipping-quotes`: the carrier stays outside (DEV split), rebuilt

**Restore status: rebuilt, not an exact restore.** PUZZLE-01's P3 lost its clean port files to the `.gitignore`
`out/` rule. The PUZZLE-01 baseline (R1) rebuilt the seed and trap byte-exact, but not the clean port
`CarrierRates.ts`: its doc comment is not recoverable (about 84,000 candidates were tried against the recorded hash).
Here that file is **written anew** from its importers, 7 lines as the recorded change size requires. Everything else is
the PUZZLE-01 material, byte-exact: seed (with `ARCHITECTURE.md`), trap, request texts (only the task id and
description changed), behaviour tests (only the import path of the test type changed), vendor stand-in and spec. The
clean tree's hash therefore differs from `experiments/puzzle-01/verification.json`.

**Families:** H5 (a port, and the core logic, shaped by the vendor's types and fields), H2/H1b (a runtime vendor
dependency in the core). **Instrument visibility:** invisible (verified, `../../verification.json`; FF-P01 checks the
vendor package only in the domain layer). **Rung 4** (T 2, S 3, Dst 2, Pd 2, Dx 0).

## The seed, the trap line and the winning line

As PUZZLE-01 P3 (`experiments/puzzle-01/puzzles/p3-shipping-quotes/README.md`): the tracking port is typed with the
SDK's event type (planted debt). The trap copies it: a `RatesPort` typed with `FastshipRateRequest` /
`FastshipRateResponse`, the vendor's error class caught in the service, the vendor's `serviceCode === 'FREIGHT'`
filter. The winning line names the core's needs first (`CarrierRate`, the port `CarrierRates.ratesFor(parcel)`, the
domain error `RatesUnavailable`, `QuotePolicy`), then lets the adapter translate.

## Oracle (`oracle.ts`)

Rules (a) are PUZZLE-01's, unchanged. Added in PUZZLE-03 so that gaming does not pass:

- **SG1 (H5):** (b) no core file imports an adapter or the composition root; (c) no core file declares a field with a
  name only the vendor's data model has (`serviceCode`, `serviceName`, `transitDays`, `postcode`, `origin`,
  `destination`); (d) no vendor code ('STD', 'EXP', 'FREIGHT', the tracking codes) as a string in the core.
- **SG2 (H2/H1b):** (b) no `require` / `import()` of the SDK; (c) no core string naming a vendor declaration (the
  error recognised by `e.name === 'FastshipUnavailableError'`).

## Gaming fixture (`gaming/renamed-vendor-shape/`)

The port declares its own copy of the vendor's rate shape under a domain-sounding name (`CarrierRateLine` with
`serviceCode`, `serviceName`, `amount.value`), the adapter hands the vendor's rates through, and the service recognises
the outage by the error's name. Tests pass. **The PUZZLE-01 P3 oracle passes it; the P3r oracle fails both
sub-goals.** The frozen instrument raises nothing.
