# D_sem provenance (zero model calls)

Classifier dsem-provenance/v1; `scripts/v1.4/dsem-provenance.ts` sha256 `f459367b53761ea0bbde7cebc7f1a7bfd70a6c4182d87303a9af6874ba6fb5be`, lib sha256 `8dd4a406f61684862dcf32c376c96f86bed82876db7bf8f0d7d73901c8255ca1`.
C4 snapshots read: 4; interpreted findings: 17; stable grounded claims: 0.

| Cell | Blocks (C4 output / D_sem not run) | D, every block | D, where D_sem exists | D_sem (all claims) | D_sem (non-agent claims) | Evasion candidates | Registered reading (sem-01 P3) |
|---|---|---|---|---|---|---|---|
| none@L2 | 6 (4 / 1) | 9 | 7 | 7 | 7 | 0 | P3 holds: D_sem over non-agent claims equals D; no gap between D and D_sem over all claims (over 5 of 6 blocks; 1 with D > 0 has no C4 output) |
| none@L3 | 6 (0 / 2) | 4 | 0 | 0 | 0 | 0 | P3 holds: D_sem over non-agent claims equals D; no gap between D and D_sem over all claims (over 4 of 6 blocks; 2 with D > 0 have no C4 output) |
| mcp@L2 | 6 (0 / 2) | 3 | 0 | 0 | 0 | 0 | P3 holds: D_sem over non-agent claims equals D; no gap between D and D_sem over all claims (over 4 of 6 blocks; 2 with D > 0 have no C4 output) |

Contrast readings: not computed (5 cell-blocks with D > 0 have no C4 output: none@L3 hive-health/rep1, mcp@L2 hive-health/rep1, none@L3 ice-rink/rep2, none@L2 youth-league/rep2, mcp@L2 youth-league/rep2).
