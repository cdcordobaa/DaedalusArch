# MEAN-01 meaning analysis fixtures (synthetic)

These files are **synthetic**. They are not drawn from the MEAN-01 frame. No project, repository, finding id or SHA
in them is real. They keep the column layout of `results/v1.3-meaning/mean-01-sample.csv`, so the loader reads them
like the real sample. The tests of U7 (`tests/unit/scripts/v1.3/meaning-analysis.test.ts`) use them.

| File | Strata | Use |
|---|---|---|
| `sample-60.csv` | 4 strata: `FF-S01/ddd` (N 200, n 7), `FF-S01/layered` (N 100, n 6), `FF-S03` (N 50, n 4), `FF-P01` (N 434, n 43). Σ N_h = 784. Rule FF-S01 has n = 13 and rule FF-S03 has n = 4. 2 `testOrMock` items. | κ cases T1 to T8 and T11 to T22 |
| `sample-10.csv` | 2 strata: `S-A` (N 90, n 5) and `S-B` (N 10, n 5). Σ N_h = 100. | Stratified estimator cases T9 and T10 |

The answer sheets are built inside the tests, either with `scripts/v1.3/lib/meaning/simulate.ts` or as inline CSV
strings. No sheet in this directory or in the tests holds a real label.
