# v1.3 sealed hashes

Recorded 2026-10-14, before any v1.3 labelling or generation.

| Artefact | sha256 | Note |
|---|---|---|
| ../daedalus-sealed/v1.3-study2-tasks.md (kept outside the repo) | 82a2f512e50d4eafb4ce6a42335adc2b6c2f882a6238e298a747303d0090169c | Study 2 task list: 6 multi-step greenfield tasks. Never used in v1.3. |
| Docs/v1.3/rule-tiers.md | 290794e0bf8edc0d02b631b576b1181cb3e9fb603af3b4fd110a61b60543f27a | A priori rule tiers |
| Docs/v1.3/style-rule-sources.md | 7ce49c630178bad9effd27ae4acce6286effcffd2099b6d353023fca23715c28 | Rule sources; the only rule input for the blind manifest writer |

## Hold-out and blind manifests (recorded late, 2026-10-15T20:38Z)

These rows were added after the adversarial review of 2026-10-15 (finding B1, M2). The sealed directories were **not opened** to compute them: only file hashes were computed, and only `v1.3-holdout/out.sha256` was read.

**Method (directory manifest hash).** Run from `../daedalus-sealed/`:

```sh
find <dir> -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256
```

The paths inside the manifest are relative to `../daedalus-sealed/` (for example `v1.3-holdout/...`), so the command must be run from that directory to reproduce the value. A NUL-separated variant (`find -print0 | sort -z | xargs -0`) gives the same values. The hold-out manifest includes `out.sha256` itself.

| Artefact | sha256 | Note |
|---|---|---|
| ../daedalus-sealed/v1.3-holdout (directory manifest, method above) | 1379b561789b18133e0ca76eb8bcbba470543dcc1455d0260e54532a40f5fa8f | Hold-out set, 207 cases, as found on 2026-10-15T20:38Z. |
| ../daedalus-sealed/v1.3-holdout/out.sha256 (value inside the file) | cddec14a2863168af95c6254e93b1235e3a2ba631fe937599479688d3bb1fcc4 | The hold-out author's own content hash of the 207-case set ("sha256 of the sorted file hashes", a different method from the row above). Matches the value logged in `aidlc-docs/audit.md` on v1.2e, commit `3e69928f`. |
| 62-case hold-out (superseded; logged only) | a94360e1278208fd8391056873e0fa01c71fd14aad8da68dfcf74b669cb41feb | The original 62-case set's content hash, as logged in `aidlc-docs/audit.md` on v1.2e, commit `3837943f` (2026-10-14T20:59-05:00). The audit log says the original 62 cases are unchanged inside the 207-case set; this value cannot be re-verified from the enlarged directory without opening it. |
| ../daedalus-sealed/v1.3-blind (directory manifest, method above) | 82209b390a6f79e5091e8db1420f07b12c34ab38966d2e999e8835ada9942987 | Blind manifests read by `ue-score.ts --blind`, as found on 2026-10-15T20:38Z. Never hashed before this row. |

**Honest note.** The hold-out was written by a Fable model (same vendor as the tool's judge). It was enlarged from 62 to 207 cases on 2026-10-15 (commit `3e69928f`, 12:27-05:00), after the after-fixes development measurement (commit `b35bf172`, 2026-10-14 21:07-05:00) and after `Docs/v1.3/construct-decisions.md` was written (`be17c4d9`, 2026-10-15 12:00-05:00). The enlargement was done by the AI under the author's "max progress" delegation, without an explicit author decision (`aidlc-docs/audit.md` on v1.2e: "User Input: (none; option A taken under 'max progress')"). The enlarging agent had access to the development-set results. These hashes are recorded late: the 62-case seal was 2026-10-14, the 207-case re-seal 2026-10-15 12:27-05:00, and these rows 2026-10-15T20:38Z. Nothing here shows that the files were unchanged between the re-seal and this row, apart from the `out.sha256` value matching the logged one.

Note on timestamps: the `aidlc-docs/audit.md` entry timestamps (08:00Z and 19:00Z for the two hold-out entries) do not match their commit times (01:59Z and 17:27Z on 2026-10-15). The commit times are used here.

## Loop pilot freeze (2026-10-16, before the first pilot run)

Exploratory loop pilot (`Docs/v1.3/pilot-outcome-memo.md`), not Study 2. Recorded in the same commit as the filled memo §7, before any live pilot run. No sealed directory was read.

| Artefact | sha256 | Note |
|---|---|---|
| Docs/v1.3/pilot-outcome-memo.md | f8a885c3d6b1400ed4dcfaa91efa181856091bc6fdb43bd2e3297aefd6dfe802 | Memo with §7 filled (`daedalus-mcp` out, `orderSeed` 20261015) |
| Docs/v1.3/pilot-tasks.md §2 (JSON block) | 5b72d1182c5a6ededd8fcf1ce5715c960ac14e2105631ee6e67f72053fdce22f | Pilot tasks block; equals `experiments/loop-pilot/pilot-tasks.json` |
| Docs/v1.3/pilot-tasks.md (whole file) | c6f414cf4d98849ed41624924d1437f2f7b4db832a63299ab64ca713ebb677b1 | |
| experiments/loop-pilot/plan.json | 4104919ee0c02937b6b639b5d20b71d3757d8e1cca2c8757536f6c64bb7f6d83 | Pilot plan (none, gate; k = 4; 1 run) |
| Harness commit | 419e29067e6eebcf8358d2fd6d0eb3181e2a2fe9 | `origin/v1.3` + `origin/v1.3-review-fixes-2` (PR #159, R01 pinned tsconfig) |
| specs/clean-arch.yaml | 91bd152e0ae58dcc28a35f2ebc6fe264bf9ff7cd11a2fa6a8094ef54fcd6f6a8 | `market-vendors` spec |
| presets/hexagonal.yaml | d085d6b9badca2e79ade19b12fcfff96d1317df139d646772871266f0ed20ab7 | `shelter-adoptions` spec |
| presets/ddd.yaml | ce28a78582a92571c5c8ff2c9144eb2161c580e140db3af880d451737b6260f7 | Base of the per-run DDD specs frozen after step 1 |
| presets/clean-architecture.yaml | 285447919fcedee05b8c0a5b01a61a82a36e2c0a482010b3b305863ae2dddf68 | Source of the Clean layout sentence |
