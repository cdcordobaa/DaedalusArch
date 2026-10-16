# Group C reproducibility audit: APG v2 ablation / live / scope (2026-10-15)

Repo `<REPO>`, branch `v1.3-replication`, HEAD `96a5e77d`. Nothing in the repo was edited. All scripts and outputs are in
`<scratch>/work/` (my recomputation scripts: `abl.py`, `fix.py`, `ref.py`, `ref2.py`, `v13cmp.py`) and
`<scratch>/run/` (git-archive exports `head/`, `abl72/` = 72fa9203, `c15e755eb/`, `c33ec13ef/`, and their outputs).
Neo4j was not used and no model was called. Node v22.22.0 was used locally, the same as the ablation run.

---

### apg2-ablation-2026-10-15.md

Raw sources used: `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/{ablation.json, table.md, cost.json, cost.md, byte-identity.json, depcruise/*.json}`, `tests/fixtures/v1.3-apg2/cases.json`. For the "Update" paragraph I also used `Docs/DiagnosticRuns/apg2-live-2026-10-15/fixtures-live.json` and `reference-live.json`. I re-ran the ablation in scratch exports (see Regeneration).

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Cases total (planted / near-miss / control) | 47 (27/19/1) | 47 (27/19/1) | yes | ablation.json |
| 2 | APG v2 detects planted | 27/27 | 27/27 | yes | ablation.json `apg2` |
| 3 | Same template on v1.3 graph (b1) | 0/27 | 0/27 | yes | ablation.json `v13Graph` |
| 4 | v1.3 rules at locus (b2) | 0/27 | 0/27 | yes | ablation.json `v13Rules` |
| 5 | dep-cruiser translated | 0/27 | 0/27 | yes | ablation.json `dcTranslated` |
| 6 | dep-cruiser hand-written | 10/27 | 10/27 (TF5, CP1–3, PA1–4, IO6, IO7) | yes | ablation.json `dcHand` |
| 7 | APG-v2-only planted cases | 17 (TF1–4, CP4–6, AS1–5, IO1–5) | 17, the same ids | yes | ablation.json |
| 8 | Near-misses reported by APG v2 | 0/19 | 0/19 | yes | ablation.json |
| 9 | Control clean in every arm | pass | apg2=false, v13Rules=[], dcT=[], dcH=[] | yes | ablation.json CTL |
| 10 | Near-misses with another arm firing | NM-CP1, NM-IO3 (v1.3 rule, T, H) | NM-CP1, NM-IO3: all three arms | yes | ablation.json |
| 11 | "v1.3 edge between locus files" = none | TF1–4, AS1–5 | TF1–4, AS1–5 | yes | ablation.json `v13LinkingEdges` |
| 12 | Linking-edge types for TF5 / CP1–3 / CP6 / PA1–4 / NM-CP1 | as in the doc's case table | identical | yes | ablation.json |
| 13 | All 47 pass (pass recomputed independently from the criterion) | all pass | 47/47, and my pass recomputation equals the stored `pass` | yes | ablation.json |
| 14 | table.md matches ablation.json | — | table.md regenerated from ablation.json in Python is byte-identical | yes | table.md |
| 15 | CP3 instability kernel → plugins | I=0.17 → 0.5 | 0.167 → 0.5 (mirror at 72fa9203) | yes | recomputed with in-memory mirror (`run/abl72/cp-rows.ts`) |
| 16 | CP4 distance | D=0.83 | 0.833 (A=0, I=0.167) | yes | same |
| 17 | CP5 distance | D=1 | 1 (A=1, I=1) | yes | same |
| 18 | `plugins` instability in APG v2 vs dep-cruiser | 0.5 vs 0.667 | APG v2 0.5; dep-cruiser 0.667 **not checked** (depcruise metrics output not committed) | partial | — |
| 19 | SDP rows produced by the cycles | billing→shipping, catalog→pricing, **promo→catalog** | APG v2 SDP rows: billing→shipping, catalog→pricing, kernel→plugins. **No promo→catalog row.** | **no** | mirror at 72fa9203; fixtures-live.json (components: sdp-violation 3) |
| 20 | Update: live template runs on fixtures | 63 | 63 (7×9, all multiset-, order- and exclude-equal) | yes | apg2-live/fixtures-live.json |
| 21 | Update: live template runs on dev variants | 639 on 71 | 71 variants × 9; mirrorEqual on 71/71, 0 mirrorDiffs | yes (the count is derived as 71×9; only a per-variant boolean is stored) | apg2-live/reference-live.json |
| 22 | Update: cases agree with ablation.json | 47 | 47 (my comparison of apg2/apg2Rows/v13Graph) | yes | fixtures-live.json vs ablation.json |
| 23 | Cost: projects, runs, node | 14, 3, v22.22.0 | 14, 3, v22.22.0 | yes | cost.json |
| 24 | Cost table: files / nodes / edges (all 14 rows) | as in the doc | identical to cost.json, **and re-extracted identically** at 72fa9203 | yes | cost.json, re-run |
| 25 | Cost table: ms, RSS, pass timings (all 14 rows) | as in the doc | identical to cost.json/cost.md (cost.md regenerated from cost.json matches) | yes (raw only) | cost.json |
| 26 | Pass total on reference projects | 38–64 ms | 38.1–63.7 | yes | cost.json |
| 27 | Pass share of extraction | ~10–14 % of a 360–415 ms extraction | 9.8–14.1 % of the v1.3 time (8.4–12.1 % of the v2 time) | yes (definition: share of the v1.3 time; hexagonal 9.8 % rounds to 10) | cost.json |
| 28 | Pass share on DDD | 4 % of 1.5 s | 4.1 % (of 1545 ms) | yes | cost.json |
| 29 | v1.3 time range on 4 reference projects | 360–415 ms | 358–414 | yes (rounded) | cost.json |
| 30 | End-to-end Δ time range | −149 … +109 ms | −149 … +109 | yes | cost.json |
| 31 | Δ peak RSS | −3 … +7 MB | −3 … +7 | yes | cost.json |
| 32 | Edge growth on reference projects | ~40 % | 38.3–44.8 % | yes | cost.json |
| 33 | Nodes added on reference projects | 4–6 | 4,4,4,6,4 | yes | cost.json |

Mismatches:
- **#19, SDP rows "promo → catalog".** The doc's Notes say the cycles produce APG v2 SDP rows billing → shipping, catalog → pricing and promo → catalog. The APG v2 mirror (re-run at 72fa9203) and the live Cypher (fixtures-live.json: components `component-sdp-violation` = 3) give billing → shipping, catalog → pricing and kernel → plugins (the last is the planted CP3). promo → catalog is a **dependency-cruiser** `H-folder-sdp` violation (table.md, CP2), not an APG v2 row. Classification: doc typo (the two tools are conflated). Severity: low; no headline count is affected.
- **Ablation result is stale against HEAD code: CP4 and CP5. This is a finding of the replication smoke run, and I have confirmed and root-caused it.** Running `scripts/apg2-ablation.ts` on a clean HEAD export gives `FAILED: CP4, CP5` (exit 1). ablation.json changes only in CP4 and CP5 (`apg2: true→false`, `apg2Rows: 1→0`, `pass: true→false`), and table.md changes in the same two rows (`yes … pass` → `no … FAIL`). Every other byte is identical.
  - Bisection by running the ablation on git-archive exports:
    - 72fa9203 (the commit that wrote the run): byte-identical to the committed files;
    - 15e755eb (F-P01-ALIAS fix): still byte-identical;
    - 33ec13ef ("APG v2 template scope per the scope ADR draft"): CP4/CP5 FAIL.
  - Root cause: change 5 of the scope ADR (`c.kind <> 'layer' AND c.typeCount >= $minTypes`, `APG2_MIN_TYPES_FOR_DISTANCE = 4`). `kernel` holds 2 classes (clock.ts, registry.ts) and `contracts` holds 2 interfaces (api.ts), as the scope doc says.
  - This is deliberate and acknowledged:
    - ADR draft ccfe6f90 (committed before 33ec13ef) says any planted case lost to the minimum is "reported as lost; the minimum is not changed to keep it";
    - apg2-scope-2026-10-15.md §1 reports 25/27, with CP4 and CP5 lost and "ablation.json predates the scope change";
    - the HEAD unit test `tests/unit/fitness-compiler/apg2-templates.test.ts` marks CP4/CP5 `LOST_TO_SCOPE` and asserts that they are reported with `minTypes: 0`. I ran it with apg2-scope.test.ts on the HEAD export: 84/84 pass.
  - However, **apg2-ablation-2026-10-15.md was not updated after 33ec13ef** (since 72fa9203 it has only the 2-line live-run "Update"). It still says 27/27, 17 APG-v2-only cases including CP4/CP5, and its "To reproduce" commands now produce a FAIL.
  - Classification: **expected scope change, not a regression** (the code behaves as the pre-registered ADR says). For the ablation document and its "To reproduce" block it is a **stale number / stale reproduction recipe**: the committed outputs reproduce only at 72fa9203–15e755eb.
  - Severity: medium. A reader re-running the documented command at HEAD gets a FAIL, and the doc carries no forward pointer to the scope doc. Suggested fix: add an update note pointing to apg2-scope §1 (27→25 under the current code), and pin the reproduction to `git checkout 72fa9203`.

Not reproducible from committed files:
- The dep-cruiser folder instability of `plugins` (0.667): depcruise's JSON output is not committed, only its configs. Classification: missing raw file. It is deterministic if re-run.
- The graphify column ("6 derivable …"): a reading of adapter notes on another branch, not data. Not a computed number.
- Wall-clock times and RSS: these match cost.json, and they cannot be byte-reproduced by design. My re-run at 72fa9203 gave v1.3 times of 393→418 ms, 1157→1482 ms and so on.

Regeneration:
- **The ablation runs without Neo4j and without any model.** `ROOT = process.cwd()` and the output directory is hard-coded to `<cwd>/Docs/DiagnosticRuns/apg2-ablation-2026-10-15`; there is no output flag. To keep the repo untouched, run it from an exported tree:
  ```
  S=<scratch>/abl72; mkdir -p $S
  git -C <REPO> archive 72fa9203 | tar -x -C $S          # or HEAD; see below
  ln -s <REPO>/node_modules $S/node_modules
  ln -s <REPO>/experiments/tool-comparison/depcruise/node_modules $S/experiments/tool-comparison/depcruise/node_modules
  cd $S && npx tsx scripts/apg2-ablation.ts
  cmp $S/Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json <REPO>/Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json
  ```
  - Without dep-cruiser installed, (c) is written as `not run` and the outputs differ. Install it with `npm ci` in `experiments/tool-comparison/depcruise`. It is now present (gitignored) in the repo; it was absent when this audit started, and was presumably installed by the replication run. `depcruise --version` gives 18.4.0.
  - Results:
    - **at 72fa9203: byte-identical**: ablation.json, table.md and all 14 `depcruise/*.json` configs (exit 0);
    - **at HEAD: depcruise configs identical; ablation.json and table.md differ only in CP4/CP5** (exit 1).
  - Deterministic: yes (two runs at different absolute paths gave the same bytes, so no paths, timestamps or timings are embedded).
- **byte-identity.json is not written by apg2-ablation.ts (or any apg2 script).** Its "same" result in the export comparison is just the git-archived copy.
  - It was assembled from two `scripts/apg-hash.ts` runs (base 3e2c96ae vs branch v1.3-apg2) without `--relative`. Its 21 projects have before == after, which is internally consistent with `identical: true`.
  - The hashes embed the absolute checkout path (the live doc §3 says so itself). They cannot be reproduced except at the original path. I tried to run apg-hash (print-only) from the repo root, and the permission classifier denied it, so I did not retry.
  - Classification: missing raw file / path-dependent; not deterministic across paths.
- **cost.json / cost.md**: `npx tsx scripts/apg2-cost.ts` (no Neo4j, no model). It also hard-writes into `<cwd>/Docs/...`, so I ran it from the 72fa9203 export.
  - files, nodes and edges were identical for all 14 rows;
  - ms, RSS and pass timings differ (wall-clock, not deterministic);
  - so cost.json/cost.md are **not** byte-identical, as expected.
- Env vars: none for the ablation or cost scripts; cwd must be the tree root.
- Pinned CLIs (package-lock): dependency-cruiser 18.4.0 and typescript 5.9.3 (experiments/tool-comparison/depcruise/package-lock.json); root: tsx 4.21.0, ts-morph 25.0.1, typescript 5.9.3, jest 29.7.0, neo4j-driver 5.28.3.

---

### apg2-live-2026-10-15.md

Raw sources used: `Docs/DiagnosticRuns/apg2-live-2026-10-15/{fixtures-live.json, reference-live.json}`, `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json`, `results/v1.3-reference/after-member-facts/raw/<style>/<variant>.json` (71 files), `tests/fixtures/v1.3-byte-identity/v12e-hashes.json`; I re-ran `scripts/v1.3/judge-catch2-ffp01-repro.ts` (HEAD export).

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Fixture template runs, mirror = live | 63, 0 disagreements | 63 runs, 63 multisetEqual & orderEqual & excludeVariantEqual, onlyLive/onlyMirror empty | yes | fixtures-live.json |
| 2 | Per-project live rows (7-row table) | e.g. type-flow btl 5 / MSD 1; components ADP 5 / SDP 3 / MSD 2; … control 0 | identical for all 7 projects | yes | fixtures-live.json |
| 3 | b1 rows | 0 everywhere | 0 | yes | fixtures-live.json |
| 4 | Cases agree with ablation.json | 47/47 | 47 (stored `agrees` and my own comparison) | yes | fixtures-live.json + ablation.json |
| 5 | Planted detected / NM reported / control | 27/27, 0/19, clean | 27, 0, (false, 0 rows) | yes | fixtures-live.json |
| 6 | Dev variants | 71 = 14 CA, 13 layered, 14 nestjs, 15 hex, 15 DDD; 5 clean, 14 NM, 52 violation | identical | yes | reference-live.json |
| 7 | Dev template runs equal | 639 (71×9) | mirrorEqual 71/71, 0 diffs | yes (derived count) | reference-live.json |
| 8 | v1.3 findings equal on APG v2 vs v1.3 graph | 71/71 | v13Equal 71/71, v13FindingsDefaultGraph "equal" 71/71 | yes | reference-live.json |
| 9 | v1.3 findings equal committed CLI raw | equal finding for finding | 71/71 equal as multisets (24/71 in the same order) | yes (as a multiset) | results/v1.3-reference/after-member-facts/raw |
| 10 | Violation variants with new rows vs clean | 21 of 52 | 21 when rows are compared without `line/lines`; **22** with full rows (layered v08 differs only by a clock-read line shift 40→41) | definition | reference-live.json |
| 11 | Per style "x of N" | CA 5/10, layered 3/9, nestjs 3/10, hex 5/11, DDD 5/12 | the same (layered 3 line-insensitive, 4 line-sensitive) | yes (definition) | reference-live.json |
| 12 | Rows over all variants per style | 31, 24, 37, 50, 199 | 31, 24, 37, 50, 199 | yes | reference-live.json |
| 13 | Clean-variant rows | CA 1 adv (D=0.73), layered 1, nestjs 2, hex 2 (D=1, D=1), DDD 9 blk + 4 adv | identical (CA D=0.727) | yes | reference-live.json |
| 14 | Clean+NM blocking/advisory per style | 0/4, 0/8, 0/8, 1/8, 28/12 | identical | yes | reference-live.json |
| 15 | Blocking false alarms clean+NM | 29 rows on 4 of 19 (DDD clean, g02, n01; hex n02) | 29 rows; the same 4 variants (9+9+10+1) | yes | reference-live.json |
| 16 | Advisory rows on clean+NM | 40, on all 19 | 40; each of the 19 has ≥1 advisory row | yes | reference-live.json |
| 17 | Template totals (dev) | btl 3, ADP 40, SDP 16, MSD 69, deep-declared 138, deep-inferred 4, nondet 71; async and io 0 | identical | yes | reference-live.json |
| 18 | Variants with ADP/SDP rows on layers | 16 (listed) | 16, the same list; all 40 ADP rows `kind: layer` | yes | reference-live.json |
| 19 | ADP rows per planted import | 2–4 | 2 or 4 per variant | yes | reference-live.json |
| 20 | main.ts rows on DDD violation variants | 9 × 12 = 108 | 108 (9 on each of 15 DDD variants) | yes | reference-live.json |
| 21 | MSD values | D ≥ 0.7: CA 0.73, hex 1.0, DDD 0.75, ordering 0.71 | 0.727, 1, 0.75, 0.706 | yes | reference-live.json |
| 22 | layered n03 deep-import-inferred rows | 4 | 4 | yes | reference-live.json |
| 23 | v1.3 misses | 2: CA v07, nestjs v09 (FF-P05) | only those two violation variants have no expected (rule, file) finding (FF-S02 cycles matched on the cycle file list) | yes | reference-live.json |
| 24 | btl rows at planted locus | CA v09 toLoanResponse→HttpTypes; layered v04 renderProductRow→ProductRecord | identical | yes | reference-live.json |
| 25 | F-P01-ALIAS repro table, shapes A–D | A Package:typeorm + info 008; B File:vendor/typeorm.ts; C Package:typeorm; D Package:typeorm, 3 Package nodes | identical output (re-run, no Neo4j) | yes | re-run of judge-catch2-ffp01-repro.ts |
| 26 | Fixture projects pinned for V12E | 29 | 29 entries in v12e-hashes.json | yes | tests/fixtures/v1.3-byte-identity/v12e-hashes.json |
| 27 | V12E 29/29 identical; V13 28/29 identical | as stated | not recomputable (the before/after hash files were not committed) | — | missing |
| 28 | jest 79 suites / 1090 passed; 42 suites / 597 passed / 1 failed; golden 7/81; prereg 85 artefacts | as stated | not recomputable (no logs committed) | — | missing |

Mismatches:
- **#10, "21 of 52" violation variants add rows.** With full-row comparison it is 22: layered v08's only difference from clean is the `OrderService.placeOrder` clock read moving from line 40 to 41. The live doc's 21 corresponds to ignoring line numbers; its listed variants (16 ADP/SDP + layered v04 + DDD g03, v08, v02, v05) total 21 and exclude layered v08. The scope doc counts it the other way ("before it was 22, counted the same way"). So the two docs disagree on the before-value, and both are internally derivable. Classification: rounding/definition ambiguity. Severity: low.

Not reproducible from committed files (missing raw file): the V12E/V13 before/after hash comparison of §3 (28/29 V13 identical); all §4 jest, golden and prereg counts; the "output files are byte-identical to the first run's" claim (the first run's outputs are not committed separately); the live FF-P01 `firewall evaluate` verdict on antipattern-nest (needs Neo4j; no output committed).

Regeneration:
- `npx tsx --env-file=<env> scripts/v1.3/apg2-live.ts fixtures [--out <dir>]` and `... reference [--out <dir>]`.
  - **Needs Neo4j** (`NEO4J_URI`, `NEO4J_PASSWORD` required; `NEO4J_USER` defaults to `neo4j`) and takes the shared Neo4j lock.
  - No APOC call found in `src/neo4j-ingestion` or `apg2-templates.ts`. Neo4j 5.x is assumed; the doc does not state a server version.
  - The doc claims the output is deterministic ("byte-identical to the first run's"). I did not verify this (no Neo4j).
  - Not run here.
- `npx tsx scripts/v1.3/judge-catch2-ffp01-repro.ts <scratch>`: no Neo4j; deterministic (prints only); re-run and matching.
- `npx tsx scripts/apg-hash.ts --relative <out.json>`: no Neo4j; deterministic with `--relative`.
- The doc also mentions `HEAVY_ADMISSION_BYPASS=1` (a local hook bypass, irrelevant here).

---

### apg2-scope-2026-10-15.md

Raw sources used: `Docs/DiagnosticRuns/apg2-scope-2026-10-15/{fixtures-live.json, reference-live.json}` (after), the apg2-live-2026-10-15 files (before), ablation.json, `results/v1.3-reference/after-member-facts/raw`, ADR draft at ccfe6f90, and the fixture source of CP4/CP5. I re-ran the ablation at 33ec13ef/HEAD and the HEAD unit tests.

| # | Number (what) | Claimed | Recomputed | Match | Source file |
|---|---|---|---|---|---|
| 1 | Planted caught, before → after | 27/27 → 25/27 (CP4, CP5 lost) | 27 → 25; lost CP4, CP5 | yes | live vs scope fixtures-live.json |
| 2 | Ablation recall after | 0.926 | 25/27 = 0.9259 | yes | scope fixtures-live.json |
| 3 | NM reported / control | 0/19, clean | 0/19, clean | yes | scope fixtures-live.json |
| 4 | Fixture template runs equal | 63/63 | 63/63 | yes | scope fixtures-live.json |
| 5 | b1 rows | 0 | 0 | yes | scope fixtures-live.json |
| 6 | Cases as in ablation.json | 45/47 (CP4, CP5 differ) | 45; CP4, CP5 | yes | scope fixtures-live.json + ablation.json |
| 7 | MSD rows per project, before → after | type-flow 1→0, components 2→0, public-api 2→0, async 1→0, io 1→0 | identical | yes | both fixtures-live.json |
| 8 | Other template counts unchanged (ADP 5+2, deep-import 4 on public-api) | unchanged | unchanged | yes | both fixtures-live.json |
| 9 | CP4/CP5 type counts | kernel 2 classes, contracts 2 interfaces | 2 and 2 (`export class/interface` in the fixture files) | yes | tests/fixtures/v1.3-apg2/components/src |
| 10 | CP4/CP5 reported with minTypes 0 | yes (unit test) | unit test passes on the HEAD export (84/84 in 2 suites) | yes | tests/unit/fitness-compiler/apg2-templates.test.ts |
| 11 | Dev template runs equal | 639/639, 71 variants, 0 problems | mirrorEqual 71/71 | yes | scope reference-live.json |
| 12 | v1.3 findings unchanged | 71/71 | v13Equal 71/71; equal to the committed CLI raw 71/71 (multiset) | yes | scope reference-live.json + results raw |
| 13 | Blocking rows clean+NM, before → after | 29 on 4 → 0 on 0 | 29 on 4 → 0 on 0 | yes | both reference-live.json |
| 14 | Advisory rows clean+NM | 40 → 21 | 40 → 21 | yes | same |
| 15 | Blocking rows all 71 | 181 → 4 | 181 → 4 | yes | same |
| 16 | Advisory rows all 71 | 160 → 101 | 160 → 101 | yes | same |
| 17 | Per-style clean+NM table (before / after) | CA 0/4→0/0; layered 0/8→0/4; nestjs 0/8→0/8; hex 1/8→0/0; DDD 28/12→0/9; total 29/40→0/21 | identical | yes | same |
| 18 | DDD main.ts rows removed on clean+NM | 27 | 27 (9×3) | yes | live reference-live.json |
| 19 | Remaining advisory: nondeterminism | 18 = layered 4, nestjs register 4 + cancel 4, DDD OrderPlaced 3 + InvoiceIssued 3 | identical | yes | scope reference-live.json |
| 20 | Remaining advisory: ordering MSD | 3, A=0.294 I=0 D=0.706 | 3, the same values | yes | same |
| 21 | Blocking rows on violation variants | 4: CA v09, layered v04, DDD g03, DDD v08 (as named) | identical | yes | same |
| 22 | ADP rows after | 0 (40 removed) | 0 | yes | same |
| 23 | MSD rows over 71 after | 14, all DDD ordering | 14, all ordering (module) | yes | same |
| 24 | SDP on layer components, violation variants | 16 | 16 rows, all `kind: layer`, all on violation variants | yes | same |
| 25 | Violation variants with rows vs clean | 21 after; 22 before "counted the same way" | 21 after, 22 before (full-row comparison); line-insensitive gives 20 / 21 | yes (definition; see live #10) | both reference-live.json |
| 26 | Template totals, before → after | deep-decl 138→2, deep-inf 4→0, btl 3→2, ADP 40→0, SDP 16→16, MSD 69→14, nondet 71→71 | identical | yes | both reference-live.json |
| 27 | ADR predictions (0 blocking, 21 advisory) committed before the measurement | yes | ccfe6f90 (13:53) predicts 29→0 and 40→21 and states the minimum of 4 types; it precedes 33ec13ef (14:05) and 53a610d9 (14:06) | yes | git history |
| 28 | jest 81 suites / 1117 passed; new suite 21 tests; golden 7/81; prereg 85 | as stated | not recomputable (no logs committed); the 2 apg2 suites pass on the HEAD export | — | missing |

Mismatches: none in the headline numbers. The one definitional point: "before it was 22, counted the same way" is true under full-row comparison but contradicts the live doc's "21 of 52", which used a line-insensitive count. Classification: rounding/definition ambiguity. Severity: low.

Not reproducible from committed files (missing raw file): §4 jest, eslint, golden and prereg counts. The scope doc's §4 row "45/47 cases as in ablation.json" is reproducible.

Regeneration:
- `npx tsx --env-file=<env> scripts/v1.3/apg2-live.ts fixtures --out <dir>` and `... reference --out <dir>`. They need Neo4j (NEO4J_URI and NEO4J_PASSWORD) and are not run here.
- No-Neo4j cross-check: the ablation at HEAD (export recipe above) yields exactly the scope doc's fixture outcome: CP4/CP5 lost, everything else unchanged.

---

### CP4/CP5 root cause (replication run request)

| Tree (git archive into scratch) | ablation.json / table.md vs committed | exit |
|---|---|---|
| 72fa9203 (wrote the run) | byte-identical | 0 |
| 15e755eb (F-P01-ALIAS) | byte-identical | 0 |
| 33ec13ef (scope ADR implementation) | CP4, CP5 apg2 false, rows 0, pass false | 1 (`FAILED: CP4, CP5`) |
| HEAD 96a5e77d | same as 33ec13ef | 1 |

- Cause: the `component-main-sequence-distance` predicate `c.typeCount >= $minTypes` (minTypes = 4) in 33ec13ef. The predicate was pre-registered in ADR ccfe6f90, acknowledged in apg2-scope §1 and §6 item 2, and pinned in the HEAD unit test (`LOST_TO_SCOPE`).
- Classification: **expected scope change**, not a regression.
- The ablation doc and its committed ablation.json/table.md are **stale** relative to HEAD code: they have no forward note, and "To reproduce" at HEAD gives FAIL. They reproduce byte-for-byte only at 72fa9203 (or 15e755eb).

### Secrets / personal paths grep

I grepped all three docs, their raw folders and `results/v1.3-reference/after-member-facts/raw` for `/Users/`, `/home/`, `/tmp/`, `C:\`, `sk-ant-`, AKIA, ghp_, xox, private-key headers, password, secret, token, `bolt://` and api-key.
- No secrets and no absolute personal paths.
- False positives only: the file name `src/common/guards/api-key.guard.ts` (many lines in both reference-live.json) and the word "token" in variant descriptions (live reference-live.json:4428, 4684; scope reference-live.json:4111, 4367).
- Doc lines 3 (live and scope) and scope line 150 name `~/.daedalus-bt.env`, Neo4j instance `daedalus-neo4j-bt` and port 7693. This is local infrastructure metadata with a home-relative path, not a credential.
- The depcruise configs do not embed absolute paths: they were byte-identical when regenerated at a different path.
