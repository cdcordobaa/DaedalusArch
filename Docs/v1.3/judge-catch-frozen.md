# v1.3 judge catch test: frozen operators (U-F, FR-V9)

> **Frozen 2026-10-15, committed before any judge call of this unit.** Development-set work only. This is not a pre-registration and not a prereg bump (author decision: no pre-registration until the tool is shown fit). No file in `scripts/lib/prereg.ts` `REGISTERED_ARTEFACTS` is touched.

Base: `origin/v1.3` @ `942ccb81`. The anti-pattern operators of #79 (five positives, five twins) are used exactly as hashed below. A change to any of these files after this commit invalidates the catch numbers of this unit. The judge prompt and rubric are not changed in this unit.

## Operator registry and catalogue (sha256)

| File | sha256 |
|---|---|
| `Docs/operator-catalogue-antipatterns.md` | `fde082f94754e4e11b10d5c295d4d537e53a1f74776adc0a53934baf1e1fed0b` |
| `scripts/lib/mutation/antipatterns/index.ts` | `e4cab72ca926058b9a04fce84911140723ed580ca3dd01c6a1be380ca81bf37b` |
| `scripts/lib/mutation/antipatterns/common.ts` | `40552e3762d04892353f12925859ab6ba8688fec169040468adad472bdb0f72b` |
| `scripts/lib/mutation/antipatterns/ap-repo-bypass.ts` | `8532ef7986ac031d305723e6621d552329e73ab81b2a758b4a85bbd9341f73e5` |
| `scripts/lib/mutation/antipatterns/ap-fat-controller.ts` | `866d1ecaf2befd4f704e1df315e9b183bf312dd886a7d9aa206a5d515bd1ffdb` |
| `scripts/lib/mutation/antipatterns/ap-persist-in-domain.ts` | `1994e50bac8f2c353f28387967c61513893f2e0563d05ef6ae600b42a996c6dd` |
| `scripts/lib/mutation/antipatterns/ap-dup-rule.ts` | `dda3acccdd81a894c97ba244efadf278ea7571a73081cc34e1518b3f054bdff8` |
| `scripts/lib/mutation/antipatterns/ap-framework-leak.ts` | `d6ed07f199ee6ca65ce7baf000e56b77ed2e04e416e40b123f6a3bc66a9d9b05` |
| `scripts/lib/mutation/registry.ts` | `d248d248bc664eee907376775415f3a1aa30c0a352a2d026ef13b6a37d03fbb7` |
| `scripts/lib/mutation/types.ts` | `b505a52a6ba91fd52f044cafb63f574574793238e6628bea506548f2fbef11c8` |
| `scripts/lib/mutation/sites.ts` | `a42eb76ba1650aff883f5f148d9c21f3dec91ce6d778586af8a587842eb47005` |

The registry's `catalogueVersion` is the sha256 of the catalogue file (`loadAntipatternRegistry`).

Combined registry digest (sha256 of the sorted `shasum -a 256` lines of the catalogue and the seven `antipatterns/*.ts` files): `59d70946bb57fce2f37b13661cfd25f0818eb28f36e9c7ef3394bb284246d36b`.

## Judge instrument (unchanged; recorded for reference)

| Item | Value |
|---|---|
| `src/llm-critic/rubric.ts` | `52960e02663363a38c62bfe101fa899c05424394d7ef80fc9717ee291dcfefc8` |
| `src/llm-critic/frozen.ts` | `b6301b67345ad6d75aa6395dd3f4f55e075afaa14cab6d4f9ba90af4d3d21f0f` |
| `FROZEN_SHA256` (rubric text) | `f8b2dabb865107b5f315c82f7917a3ae1ee265136ffcc733db4f530c76eaec5a` |
| Judge CLI | pinned `2.1.294` under `~/.firewall/judge-cli`, config dir `~/.firewall/judge-claude-config` (ADR-018 isolation) |
| Model, effort, runs | `claude-opus-5-5`, `high`, 3 runs per unit, majority vote |

## Operators in scope

| Positive | Twin | Probed function |
|---|---|---|
| AP-REPO-BYPASS | AP-REPO-BYPASSn | FF-N01 `architectural-integrity` |
| AP-FAT-CONTROLLER | AP-FAT-CONTROLLERn | FF-N02 `intent-alignment` |
| AP-PERSIST-IN-DOMAIN | AP-PERSIST-IN-DOMAINn | FF-N02 `intent-alignment` (both-catch control: FF-P01 expected) |
| AP-DUP-RULE | AP-DUP-RULEn | FF-N01 `architectural-integrity` |
| AP-FRAMEWORK-LEAK | AP-FRAMEWORK-LEAKn | FF-N02 `intent-alignment` |

## AP-DUP-RULE v2 (appended 2026-10-15, before any v2 judge call)

> Appended only; nothing above this line was changed. The author authorised fixing AP-DUP-RULE because its twin is not a neutral control: the twin's `validate<Method>` forwarder is itself failed as a misplaced responsibility, 5/5 in round 2 (`Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md`). The v1 operator and its hashes above stay frozen. v2 is a new registry entry pair, AP-DUP-RULE2 and AP-DUP-RULE2n (catalogue §8, rationale written before the code). Development-set work; not a pre-registration; no `REGISTERED_ARTEFACTS` file touched.

Base: `origin/v1.3` @ `95637b75`, branch `v1.3-duprule-v2`.

**v1 files, re-checked unchanged** (byte-identical to the table above): `ap-dup-rule.ts` `dda3accc…`, `common.ts` `40552e37…`, `ap-repo-bypass.ts`, `ap-fat-controller.ts`, `ap-persist-in-domain.ts`, `ap-framework-leak.ts`, `registry.ts`, `types.ts`, `sites.ts`, `rubric.ts` `52960e02…`, `frozen.ts` `b6301b67…`.

**Files changed by addition only.** The catalogue (two §1 rows, two §2 rows, §8, one changelog row; every v1 row unchanged) and `antipatterns/index.ts` (the v2 import, two entries appended after the ten v1 entries, `FROZEN_V1_OPERATORS`). Their sha256 therefore differ from the table above, which records them at round 1 and 2. The round 1 and 2 seeding scripts now read `FROZEN_V1_OPERATORS` (the same ten entries in the same order), so they reproduce their outputs.

| File | sha256 |
|---|---|
| `Docs/operator-catalogue-antipatterns.md` | `3cc3d03c2be0a0406e2410b16c8220fdd610c9d98d31fc02057103ce819b1e38` |
| `scripts/lib/mutation/antipatterns/index.ts` | `c1eef5d3952cdf5a896018b29781fc47d1e3132ab0d12024b7398d1ed642c5d5` |
| `scripts/lib/mutation/antipatterns/ap-dup-rule-v2.ts` | `72342a9ebe03c60c9213691c22e3ccba9ad71eb1b8e9567a8fd0284ad4fa1f68` |

Harness (seeding, judge runner with the `AP-DUP-RULE2` → FF-N01 mapping, scoring, cheap proxies), frozen with the operators:

| File | sha256 |
|---|---|
| `scripts/v1.3/judge-catch-v2-seed.ts` | `f689b6409b5447d0e694a7c4e1892c0c70ed636a6bd53bff512dc5ca81ec7e50` |
| `scripts/v1.3/judge-catch-v2-score.ts` | `5eee56220fe0afe586c82716d3a66049c21380484ff63565d7095c4a9fd016f0` |
| `scripts/v1.3/cheap-semantics-v2-eval.ts` | `34df15848ebf74519699a788b7fe9d4108d1685f1e2fa98e9c84a146c78390c0` |
| `scripts/v1.3/judge-catch-run.ts` | `25a654f62ae5093aa570498a8bdc6beeccd721ac5bcd5103816b1d1ecc0c24f6` |
| `scripts/v1.3/judge-catch-seed.ts` | `ded298ea57e53435b7a15e2a3c6eada55a0f63e456a5d67788156defdf6f317d` |
| `scripts/v1.3/judge-catch2-seed.ts` | `524e74cdd3586d2b3e0db3dc7ebe67a753baaaf6ca3f059ecd8806bb9b8c8c54` |

Combined v2 registry digest (sha256 of the `shasum -a 256` lines, sorted by path, of the catalogue and the eight `antipatterns/*.ts` files): `afe879b51c3d1cd0c84a203e0f819000eccd427e155acb7db2c4480648764444`.

Judge instrument: unchanged (table above). Model `claude-opus-5-5`, effort `high`, 3 runs per unit, majority vote, pinned CLI `2.1.294` with the isolated config dir. Budget for this unit: at most 200 live calls.

| Positive | Twin | Probed function |
|---|---|---|
| AP-DUP-RULE2 (the AP-DUP-RULE edit, unchanged) | AP-DUP-RULE2n (the rule moves once into a policy function: the domain file of its `is<X>` guard as an assertion function, else the first service's own file; the second service is not touched) | FF-N01 `architectural-integrity` |


## Re-hash after the #108 lint (appended 2026-10-15, merge train)

`scripts/v1.3/judge-catch-run.ts` and `scripts/v1.3/judge-catch-seed.ts` were edited by the #108 lint commit `12b10ee8`
(no disables; type narrowing only). In the runner, `readJson<T>` now returns `unknown` with the cast at each call site,
`arg()` uses `??` for the same default, and `process.env['NEO4J_URI']` became `process.env.NEO4J_URI`. In the seeder, a
redundant `as Record<string, number>` was dropped. Behaviour is unchanged. Their latest sha256:

| File | sha256 |
|---|---|
| `scripts/v1.3/judge-catch-run.ts` | `e152cea0f6f7051d6dbb1e937150caaecec79fdd22e23cae3164d45d26712234` |
| `scripts/v1.3/judge-catch-seed.ts` | `5ed299fe2db80c838211ab858a3c437bc67c25f37f324257cb3960a4b48a9c0f` |
