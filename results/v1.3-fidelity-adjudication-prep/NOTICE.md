# Third-party attribution

No third-party source tree is committed. The `evidence` column of `so4/adjudication.proposed.csv`, and the `evidence` column of `review-sheet.csv` for its SO4 rows, quote short excerpts from the projects below. Each excerpt is the single import, export or `require()` line an edge comes from, along with file paths and line numbers. The same lines already appear in `source_line_text` of `results/v1.3-fidelity/so4/adjudication.csv`.

Each excerpt is copyright its project's authors and is used under that project's licence at the pinned commit (`corpus/corpus.json`):

| Project (rows) | Repository @ pinned SHA | Licence |
|---|---|---|
| ghostfolio-test (1,486) | https://github.com/ghostfolio/ghostfolio/tree/6d4cae31232386649e5ee8cda140b9dcbd2b6f2b | AGPL-3.0 (LICENSE is the GNU Affero General Public License v3) |
| nestjslatam__ddd (313) | https://github.com/nestjslatam/ddd/tree/51bb2f1128515cc228478e9a1555f385b3a3ecfe | MIT (LICENSE "MIT License, Copyright (c) 2023 NESTJS Latam") |
| truthy-demo (130) | https://github.com/gobeam/truthy/tree/9b9a61be6c0a6439c2afeb4170ef42b545e8fe54 | MIT (LICENSE "MIT License, Copyright (c) 2022"; package.json "MIT") |
| realworld-test (80) | https://github.com/lujakob/nestjs-realworld-example-app/tree/c1c2cc4e448b279ff083272df1ac50d20c3304fa | ISC (package.json "ISC"; no licence file) |
| dry-run-test (35) | https://github.com/brocoders/nestjs-boilerplate/tree/dd0034750fc7f6ec15712afbecf50fa9828018a2 | MIT (LICENSE "MIT License, Copyright (c) 2023 Brocoders") |
| zhuravlevma__nestjs-active-record (1) | https://github.com/zhuravlevma/nestjs-active-record/tree/3f2228608cea46e2609ad8cd5ef9753ae4a20869 | MIT (LICENSE "MIT License, Copyright (c) 2023 Maksim Zhuravlev") |
| v-aguiar__valex (1) | https://github.com/v-aguiar/valex/tree/f6f99ea80bfb05b68049ca57ee76058dab96612e | MIT (LICENSE "MIT License, Copyright (c) 2022 Victor Aguiar Ribeiro") |

The MIT, ISC and AGPL-3.0 licences ask that their notices accompany copies of substantial portions of the software. Single import lines are not substantial portions, but the full notices are at the links above. The ghostfolio excerpts are used read-only, as recorded for that base in `corpus/corpus.json`.

The E1 excerpts come from code generated in this project's experiments, and the reference excerpts come from this repository's own fixtures. Neither is third-party.
