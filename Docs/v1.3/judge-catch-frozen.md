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
