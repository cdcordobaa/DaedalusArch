# Anti-pattern operator site count (label-free; DRAFT v1.3; 2026-10-12)

**What.** A label-free count of the sites of the DRAFT anti-pattern operators (`Docs/operator-catalogue-antipatterns.md`) on the fixtures and the seven held-out SO4 corpus bases. It also records a no-install smoke check of the edits. No detector output was read, no judge or model was called, and nothing was seeded into a registered run. The only judge-related input is the stored baseline unit selection (`corpus/selections/*.json`), the BR-U5a-06 label-free exception.

**How.**

```sh
# corpus clones (scratch, outside the repository): git init; git fetch --depth 1 origin <commitSha>; git checkout FETCH_HEAD
# for the 7 held-out entries of corpus/corpus.json; overlays applied with git apply corpus/overlays/<name>/*.patch;
# ghostfolio-test/apps/api/tsconfig.monorepo.json written by scripts/lib/base-preparation.ts monorepoTsconfig.
npx tsx scripts/antipattern-sites-cli.ts --clones <scratch>/corpus --smoke 6 \
  --out Docs/DiagnosticRuns/antipattern-site-count-2026-10-12.json
```

- Clones: all seven HEADs equal `commitSha` in `corpus/corpus.json` (realworld-test `c1c2cc4e`, ghostfolio-test `6d4cae31`, truthy-demo `9b9a61be`, dry-run-test `dd003475`, zhuravlevma__nestjs-active-record `3f222860`, nestjslatam__ddd `51bb2f11`, v-aguiar__valex `f6f99ea8`). No `npm ci` was run, and no prisma generate step.
- Count: `findSites` (stable order), then `evaluatePreconditions`: the operator's own preconditions, the judge placement against the stored selection, and the cycle cap. The count is run twice, once with the selection and once without it ("without placement").
- Smoke: for each operator and base, up to 6 eligible sites are drawn without placement (mulberry32(20261012)). Each is applied in memory to a fresh ts-morph project of the base, and the edited files' diagnostics are compared before and after. Nothing is written to disk. TS2307 ("cannot find module") is ignored, because an uninstalled clone cannot resolve the packages an edit imports. This is not the BR-U5a-07 type-check of record. Seeding runs the pinned tsc on installed copies and drops any failing application.

## Site counts

Cell: `eligible (eligible without judge placement) / candidates`.

| Operator | antipattern-nest | correct-reference | variant-a-structural | variant-b-pattern | variant-c-everything | variant-d-subtle | realworld-test | ghostfolio-test | truthy-demo | dry-run-test | zhuravlevma__nestjs-active-record | nestjslatam__ddd | v-aguiar__valex | Fixtures eligible | Corpus eligible (bases with ≥ 1) | Corpus eligible without placement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AP-REPO-BYPASS | 4 (4) / 4 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 32 (32) / 32 | 7 (101) / 101 | 19 (38) / 38 | 0 (4) / 4 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 4 | 58 (3) | 175 |
| AP-REPO-BYPASSn | 4 (4) / 4 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 32 (32) / 32 | 7 (101) / 101 | 19 (38) / 38 | 0 (4) / 4 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 4 | 58 (3) | 175 |
| AP-FAT-CONTROLLER | 1 (1) / 1 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (2) / 2 | 0 (0) / 0 | 0 (0) / 0 | 0 (4) / 4 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 1 | 0 (0) | 6 |
| AP-FAT-CONTROLLERn | 1 (1) / 1 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 3 (3) / 3 | 5 (11) / 11 | 0 (4) / 4 | 0 (7) / 7 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 1 | 8 (2) | 25 |
| AP-PERSIST-IN-DOMAIN | 1 (1) / 3 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 5 | 0 (0) / 17 | 0 (0) / 6 | 1 (5) / 10 | 0 (0) / 2 | 0 (0) / 5 | 0 (0) / 0 | 1 | 1 (1) | 5 |
| AP-PERSIST-IN-DOMAINn | 3 (3) / 3 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 5 (5) / 5 | 6 (17) / 17 | 4 (6) / 6 | 5 (10) / 10 | 2 (2) / 2 | 0 (5) / 5 | 0 (0) / 0 | 3 | 22 (5) | 45 |
| AP-DUP-RULE | 1 (1) / 1 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 6 (6) / 6 | 0 (0) / 0 | 0 (0) / 0 | 10 (36) / 72 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 1 | 16 (2) | 42 |
| AP-DUP-RULEn | 1 (1) / 1 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 6 (6) / 6 | 0 (0) / 0 | 0 (0) / 0 | 0 (36) / 72 | 0 (0) / 0 | 0 (0) / 0 | 0 (0) / 0 | 1 | 6 (1) | 42 |
| AP-FRAMEWORK-LEAK | 4 (4) / 4 | 0 (0) / 2 | 0 (0) / 1 | 0 (0) / 2 | 1 (1) / 1 | 0 (0) / 1 | 26 (26) / 26 | 51 (334) / 334 | 26 (69) / 70 | 14 (47) / 47 | 7 (10) / 10 | 3 (37) / 37 | 0 (0) / 0 | 5 | 127 (6) | 523 |
| AP-FRAMEWORK-LEAKn | 4 (4) / 4 | 2 (2) / 2 | 1 (1) / 1 | 2 (2) / 2 | 1 (1) / 1 | 1 (1) / 1 | 26 (26) / 26 | 51 (334) / 334 | 26 (69) / 70 | 14 (47) / 47 | 7 (10) / 10 | 3 (37) / 37 | 0 (0) / 0 | 11 | 127 (6) | 523 |

## Smoke check (no install; edited files' new diagnostics, TS2307 excluded)

| Operator | Applied | New diagnostics | Apply errors |
|---|---|---|---|
| AP-REPO-BYPASS | 26 | 0 | 0 |
| AP-REPO-BYPASSn | 26 | 0 | 0 |
| AP-FAT-CONTROLLER | 7 | 0 | 0 |
| AP-FAT-CONTROLLERn | 20 | 0 | 0 |
| AP-PERSIST-IN-DOMAIN | 6 | 0 | 0 |
| AP-PERSIST-IN-DOMAINn | 33 | 0 | 0 |
| AP-DUP-RULE | 13 | 0 | 0 |
| AP-DUP-RULEn | 13 | 0 | 0 |
| AP-FRAMEWORK-LEAK | 41 | 0 | 0 |
| AP-FRAMEWORK-LEAKn | 47 | 0 | 0 |

Before the fix recorded below, the smoke check found 1 broken application out of 220: an AP-REPO-BYPASS edit on a Mongoose field named `model` declared a local `model` that shadowed the imported `model()` accessor (TS2448, TS2347). The local name now avoids every file binding and the accessor. The table above is the run after that fix.

## Reading

See `Docs/operator-catalogue-antipatterns.md` §5. In short:

- On the 7 held-out bases, AP-REPO-BYPASS has 58 eligible sites (3 bases), AP-DUP-RULE 16 (2 bases) and AP-FRAMEWORK-LEAK 127 (6 bases). AP-PERSIST-IN-DOMAIN has 1 and AP-FAT-CONTROLLER 0. The frozen MO-X02 and MO-X03 place 0 on the same bases.
- Without judge placement the pools are 175, 42, 523, 5 and 6.
- Judge placement is the largest filter for every operator.
