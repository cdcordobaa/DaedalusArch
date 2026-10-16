## Primary (plan §6-§7)

| set | n | repos | mean d [95% cluster CI] | median d [95% cluster CI] | d<0 / d>0 / d=0 | share d<0 of non-zero [Wilson] | sign test p |
|---|---:|---:|---|---|---|---|---|
| all matched, valid refactors | 76 | 17 | -0.27 [-0.95, 0.24] | 0.00 [0.00, 0.00] | 16 / 12 / 48 | 57.1% [39.1, 73.5] | 0.572 |
| one-commit guard (without ghostfolio-api a57b670d7b, d = -11.00) | 75 | 17 | -0.13 [-0.58, 0.25] | 0.00 [0.00, 0.00] | 15 / 12 / 48 | 55.6% [37.3, 72.4] | 0.701 |

Decision: **NULL**. Checks: n30 yes, signNeg no, ciBelow0 no, loroHolds yes, guardHolds no, contradicted no.

## Leave one repository out

| left out | n | mean d | median d | d<0 / d>0 | sign p |
|---|---:|---:|---:|---|---:|
| awesome-nest-boilerplate | 72 | -0.30 | 0.00 | 15 / 11 | 0.557 |
| budibase-server | 74 | -0.27 | 0.00 | 15 / 12 | 0.701 |
| clean-ts-api | 74 | -0.28 | 0.00 | 16 / 12 | 0.572 |
| directus-api | 66 | -0.33 | 0.00 | 12 / 9 | 0.664 |
| domain-driven-hexagon | 73 | -0.28 | 0.00 | 16 / 12 | 0.572 |
| etherpad | 74 | -0.28 | 0.00 | 16 / 12 | 0.572 |
| finance-project-ddd | 75 | -0.27 | 0.00 | 16 / 12 | 0.572 |
| ghostfolio-api | 70 | -0.02 | 0.00 | 13 / 12 | 1.000 |
| immich-server | 71 | -0.29 | 0.00 | 16 / 12 | 0.572 |
| logto-core | 70 | -0.33 | 0.00 | 15 / 10 | 0.424 |
| luizomf-clean-api | 74 | -0.29 | 0.00 | 16 / 11 | 0.442 |
| medplum-server | 66 | -0.35 | 0.00 | 14 / 9 | 0.405 |
| outline-server | 69 | -0.14 | 0.00 | 13 / 12 | 1.000 |
| podkrepi-api | 73 | -0.36 | 0.00 | 16 / 11 | 0.442 |
| reactive-resume-api | 74 | -0.22 | 0.00 | 15 / 11 | 0.557 |
| standardnotes-auth | 75 | -0.27 | 0.00 | 16 / 12 | 0.572 |
| unleash | 66 | -0.31 | 0.00 | 16 / 12 | 0.572 |

## Descriptive (plan §6)

| set | n | repos | mean d [95% cluster CI] | median d [95% cluster CI] | d<0 / d>0 / d=0 | share d<0 of non-zero [Wilson] | sign test p |
|---|---:|---:|---|---|---|---|---|
| family A (cycles) present | 10 | 5 | 0.10 [-0.18, 0.36] | 0.00 [0.00, 0.00] | 1 / 1 / 8 | 50.0% [9.5, 90.5] | 1.000 |
| families B-G only | 66 | 16 | -0.33 [-1.05, 0.27] | 0.00 [0.00, 0.00] | 15 / 11 / 40 | 57.7% [38.9, 74.5] | 0.557 |
| PR (merge or squash) | 62 | 12 | -0.37 [-1.20, 0.25] | 0.00 [0.00, 0.00] | 15 / 10 / 37 | 60.0% [40.7, 76.6] | 0.424 |
| direct commits | 14 | 6 | 0.17 [0.00, 0.32] | 0.00 [0.00, 0.00] | 1 / 2 / 11 | 33.3% [6.1, 79.2] | 1.000 |
| Δ without FF-S02 (all refactors) | 76 | 17 | -0.21 [-0.92, 0.33] | 0.00 [0.00, 0.00] | 15 / 12 / 49 | 55.6% [37.3, 72.4] | 0.701 |
| Δ per 100 files at P | 76 | 17 | -0.39 [-1.66, 0.39] | 0.00 [0.00, 0.00] | 16 / 12 / 48 | 57.1% [39.1, 73.5] | 0.572 |
| advisory Δ (all refactors) | 76 | 17 | 0.29 [-0.63, 1.03] | 0.00 [0.00, 0.00] | 23 / 23 / 30 | 50.0% [36.1, 63.9] | 1.000 |

## Post hoc (not in the plan)

| set | n | repos | mean d [95% cluster CI] | median d [95% cluster CI] | d<0 / d>0 / d=0 | share d<0 of non-zero [Wilson] | sign test p |
|---|---:|---:|---|---|---|---|---|
| POST HOC: families A-D only (intrinsic refactor phrases) | 30 | 11 | -0.85 [-2.17, 0.06] | 0.00 [0.00, 0.00] | 7 / 3 / 20 | 70.0% [39.7, 89.2] | 0.344 |
| POST HOC: phrase in the subject line (PR title) | 21 | 9 | -0.71 [-2.22, 0.28] | 0.00 [0.00, 0.00] | 3 / 2 / 16 | 60.0% [23.1, 88.2] | 1.000 |
| POST HOC: A-D and in the subject line | 9 | 5 | -1.93 [-3.71, 0.00] | 0.00 [0.00, 0.00] | 2 / 0 / 7 | 100.0% [34.2, 100.0] | 0.500 |
| POST HOC: |Δ| (does the tool register the change at all?) | 76 | 17 | 0.26 [0.00, 0.49] | 0.00 [0.00, 0.00] | 12 / 15 / 49 | 44.4% [27.6, 62.7] | 0.701 |

Non-zero blocking Δ: refactors 17/76 = 22.4% [14.5, 32.9]; controls 29/202 = 14.4% [10.2, 19.9].

Raw direction: refactors Δ<0 6, Δ>0 11 (sign p 0.332); controls Δ<0 8, Δ>0 21 (sign p 0.024).

## Per repository

| repo | universe | eligible | declared refactors | selected (cap 10) | matched and valid |
|---|---:|---:|---:|---:|---:|
| hoppscotch-backend | 319 | 318 | 0 | 0 | 0 |
| immich-server | 3601 | 2996 | 11 | 10 | 5 |
| podkrepi-api | 454 | 447 | 3 | 3 | 3 |
| hedgedoc-backend | 1151 | 436 | 0 | 0 | 0 |
| awesome-nest-boilerplate | 335 | 333 | 4 | 4 | 4 |
| mikro-orm-realworld | 1078 | 79 | 0 | 0 | 0 |
| clean-ts-api | 575 | 575 | 2 | 2 | 2 |
| standardnotes-auth | 1201 | 1186 | 1 | 1 | 1 |
| domain-driven-hexagon | 444 | 444 | 5 | 5 | 3 |
| bitloops-ddd-backend | 21 | 20 | 0 | 0 | 0 |
| medplum-server | 2997 | 2949 | 21 | 10 | 10 |
| ts-express-starter-prisma | 1 | 1 | 0 | 0 | 0 |
| reactive-resume-api | 127 | 124 | 2 | 2 | 2 |
| etherpad | 3948 | 3002 | 9 | 9 | 2 |
| pvarentsov-clean | 213 | 212 | 0 | 0 | 0 |
| luizomf-clean-api | 161 | 161 | 3 | 3 | 2 |
| dannielhugo-clean | 82 | 82 | 0 | 0 | 0 |
| bulletproof-nodejs | 47 | 47 | 0 | 0 | 0 |
| w3tec-express-boilerplate | 72 | 72 | 0 | 0 | 0 |
| talento90-typescript-node | 87 | 87 | 0 | 0 | 0 |
| zeldaplay-api | 35 | 35 | 0 | 0 | 0 |
| neoteric-nestjs-auth | 7 | 7 | 0 | 0 | 0 |
| vivify-nestjs-boilerplate | 28 | 25 | 0 | 0 | 0 |
| conduit-ports-adapters | 102 | 102 | 0 | 0 | 0 |
| ddialar-hexagonal-boilerplate | 4 | 4 | 0 | 0 | 0 |
| nest-products-hexagonal | 21 | 21 | 0 | 0 | 0 |
| ddd-forum | 118 | 118 | 0 | 0 | 0 |
| finance-project-ddd | 244 | 244 | 1 | 1 | 1 |
| event-sourcing-ddd | 4 | 4 | 0 | 0 | 0 |
| ghostfolio-api | 1987 | 1986 | 6 | 6 | 6 |
| directus-api | 3305 | 2936 | 29 | 10 | 10 |
| outline-server | 3124 | 3058 | 10 | 10 | 7 |
| logto-core | 2744 | 2664 | 6 | 6 | 6 |
| unleash | 3359 | 3271 | 26 | 10 | 10 |
| budibase-server | 4160 | 4143 | 4 | 4 | 2 |
| amplication-server | 826 | 803 | 0 | 0 | 0 |

## Blocking rules that moved across refactors

| rule | refactors with a change | net Δ over refactors |
|---|---:|---:|
| FF-P01 | 2 | 5 |
| FF-P03 | 1 | 2 |
| FF-S01 | 11 | -4 |
| FF-S02 | 3 | -38 |
| FF-S03 | 10 | 4 |

## Every matched refactor

| repo | commit | kind | families | files / lines | P files | B at P | Δ refactor | Δ controls | d | subject |
|---|---|---|---|---|---:|---:|---:|---|---:|---|
| immich-server | 74438f5bd8 | squash #18782 | G | 8 / 85 | 535 | 134 | 0 | 0, 0, 0 | 0.00 | feat(web): improved user onboarding (#18782) |
| immich-server | 845b0f2073 | squash #19752 | G | 5 / 18952 | 394 | 162 | 0 | 0, 0 | 0.00 | chore: use pnpm for builds (#19752) |
| immich-server | 02beb85642 | squash #21740 | CD | 4 / 51 | 397 | 162 | 0 | 0, 0 | 0.00 | feat(album): show per-user contributions in shared albums (#21740) |
| immich-server | 4dcc049465 | squash #23621 | EF | 50 / 3208 | 411 | 167 | 3 | 2, 7, 0 | 0.00 | feat: workflow foundation (#23621) |
| immich-server | 8db61d341f | squash #25185 | G | 46 / 2013 | 464 | 177 | 0 | 0 | 0.00 | docs(openapi): add descriptions to OpenAPI specification (#25185) |
| podkrepi-api | 530d9b79f6 | squash #604 | G | 55 / 1774 | 503 | 150 | 6 | 4, -2, -2 | 6.00 | [1/2]: Overhaul of  donations module (#604) |
| podkrepi-api | e60ec14cd2 | squash #606 | G | 2 / 6 | 519 | 156 | 0 | 0, 0, 0 | 0.00 | bank-import: Add amount in donation create bank object (#606) |
| podkrepi-api | d540599ee3 | squash #657 | G | 9 / 508 | 539 | 160 | 0 | 0, 0, 0 | 0.00 | Persisting created new campaignApplication to db (#657) |
| awesome-nest-boilerplate | de12ff2ef7 | direct | G | 24 / 598 | 15 | 0 | 2 | -1, 0, 0 | 2.33 | refactor(architecture): changed application architecture |
| awesome-nest-boilerplate | 536dcdf210 | direct | G | 3 / 39 | 22 | 2 | -1 | 0, 0, 0 | -1.00 | fix(architecture): moved utils functions to utilsServers |
| awesome-nest-boilerplate | 44d59b8ca6 | direct | G | 3 / 52 | 97 | 26 | 0 | 0, 0, 0 | 0.00 | docs: document UUID v7 strategy and fix .env.example defaults |
| awesome-nest-boilerplate | d24d9d1362 | direct | G | 19 / 4004 | 98 | 26 | 0 | 0, 0, 0 | 0.00 | chore: remove .cursor rules and config |
| clean-ts-api | 7e1011f1d2 | direct | F | 10 / 79 | 161 | 13 | 0 | 0, 0, 0 | 0.00 | refactor: add types to AddAccount usecase |
| clean-ts-api | 1ea06984ac | direct | F | 8 / 42 | 161 | 13 | 0 | 0, 0, 0 | 0.00 | refactor: add types to AddSurvey usecase |
| standardnotes-auth | cb74b23e45 | squash #659 | B | 4 / 16 | 393 | 252 | 0 | 0, 0, 0 | 0.00 | feat(syncing-server): refactor syncing to decouple getting and saving items (#659) |
| domain-driven-hexagon | dd89aa8a16 | direct | G | 1 / 6 | 101 | 22 | 0 | 0, 0, 0 | 0.00 | docs: moved unrelated to architecture and DDD links to different repos |
| domain-driven-hexagon | 0949fe5f78 | direct | G | 1 / 15 | 81 | 30 | 0 | 0 | 0.00 | docs: added example code snipper to 'Enforcing architecture` section |
| domain-driven-hexagon | 4d8140bf3f | direct | G | 1 / 10 | 82 | 30 | 0 | 0, 0 | 0.00 | docs: updated 'Enforcing architecture' section |
| medplum-server | 3844220953 | squash #5046 | G | 1 / 10 | 235 | 147 | 0 | 0, 0, 0 | 0.00 | Release Version 3.2.5 (#5046) |
| medplum-server | efda824b97 | squash #6016 | A | 1 / 12 | 266 | 151 | 0 | 0, 0, 0 | 0.00 | Release Version 3.2.33 (#6016) |
| medplum-server | cebbbfeb7d | squash #6291 | G | 27 / 16037 | 282 | 166 | 4 | 0, 0 | 4.00 | Tokens in main resource tables (#6291) |
| medplum-server | 6fae9c2647 | squash #6906 | A | 28 / 1985 | 318 | 198 | 7 | 14, 2, 0 | 1.67 | Stop writing and drop old token implementations (#6906) |
| medplum-server | 53477cc59a | squash #6945 | A | 1 / 12 | 324 | 206 | 0 | 0, 0, 0 | 0.00 | Release Version 4.3.1 (#6945) |
| medplum-server | b206051d64 | squash #7184 | G | 5 / 455 | 336 | 218 | 0 | -1, 0, 0 | 0.33 | Add operation to update User email correctly (#7184) |
| medplum-server | 365bb971db | squash #8914 | G | 1 / 14 | 388 | 260 | 0 | 0, 0, 0 | 0.00 | Release Version 5.1.7 (#8914) |
| medplum-server | 2a1ccac37f | squash #9154 | G | 3 / 675 | 411 | 276 | 0 | 0, 0, 4 | -1.33 | feat(server,app): add `User/$rescope` operation (#9154) |
| medplum-server | 3121e14203 | squash #9191 | G | 3 / 405 | 435 | 284 | 0 | 4, 3, 0 | -2.33 | Add error message to bot deployment without projectmembership (#9191) |
| medplum-server | 39c4978d68 | squash #10832 | A | 1 / 14 | 488 | 296 | 0 | 0, 0, 0 | 0.00 | Release Version 5.2.3 (#10832) |
| reactive-resume-api | 6d8d8f6e55 | squash #3062 | B | 30 / 5874 | 19 | 0 | 0 | 7, 8 | -7.50 | feat: add AI agent workspace (#3062) |
| reactive-resume-api | 8c40313980 | squash #3541 | G | 22 / 1761 | 67 | 71 | 3 | 0 | 3.00 | feat(deploy): support Vercel Hobby alongside Docker (#3541) |
| etherpad | d6d636955c | squash #6511 | G | 41 / 3726 | 91 | 71 | 0 | 0 | 0.00 | Feat/bundle js (#6511) |
| etherpad | a4261c2895 | squash #7782 | G | 2 / 24 | 127 | 84 | 0 | 0 | 0.00 | fix(a11y): drop role=textbox / aria-multiline from innerdocbody (#7778) (#7782) |
| luizomf-clean-api | 4ebbb93fcd | direct | E | 1 / 2 | 84 | 6 | 1 | 0, 0, 0 | 1.00 | refactor: moved middlewares to presentation layer |
| luizomf-clean-api | d448cad091 | direct | E | 56 / 172 | 86 | 6 | 0 | 0 | 0.00 | refactor: move use cases interfaces to domain layer |
| finance-project-ddd | fe28b25e80 | direct | A | 2 / 5 | 4 | 0 | 0 | 0, 0 | 0.00 | fix: solve circular imports errors on domain shared |
| ghostfolio-api | c973ffd3ba | squash #100 | G | 54 / 353 | 105 | 49 | -4 | 0, -7, 0 | -1.67 | Feature/reorganize helper lib (#100) |
| ghostfolio-api | ea3a9d3b79 | squash #896 | A | 10 / 57 | 150 | 52 | 0 | 0, 0, 0 | 0.00 | Feature/eliminate circular dependencies in common library (#896) |
| ghostfolio-api | e26b015407 | squash #4325 | G | 14 / 401 | 239 | 107 | 0 | 0, 0, 0 | 0.00 | Bugfix/cannot register cron jobs (#4325) |
| ghostfolio-api | a57b670d7b | squash #5925 | D | 40 / 203 | 261 | 140 | -11 | 0, 0, 0 | -11.00 | Task/enforce module boundaries for api and common modules (#5925) |
| ghostfolio-api | 6deaccfe16 | squash #5944 | D | 61 / 1177 | 261 | 130 | 0 | 19, 0, 0 | -6.33 | Task/enforce module boundaries for client module (#5944) |
| ghostfolio-api | 362997324e | squash #5947 | D | 1 / 2 | 232 | 130 | 0 | 0, 0, 0 | 0.00 | Task/enforce module boundaries for ui module (#5947) |
| directus-api | f90c31b798 | squash #4625 | G | 32 / 2009 | 169 | 113 | 0 | -1, 0, 0 | 0.33 | GraphQL 2.0 (#4625) |
| directus-api | bf72917a4c | squash #8009 | G | 36 / 1693 | 214 | 115 | 0 | 2, 0, 0 | -0.67 | Add Insights Module & API Aggregation Functionality (#8009) |
| directus-api | 25375cc481 | squash #9861 | B | 19 / 724 | 249 | 131 | -3 | 2, 0, 0 | -3.67 | Add notifications system and support user mentions in comments (#9861) |
| directus-api | 3f4ad0fe87 | squash #13274 | A | 1 / 204 | 297 | 128 | 0 | 0, 0, 0 | 0.00 | Environment variable with _FILE suffix containing invalid path throws error on start (#132 |
| directus-api | 2983e61870 | squash #18014 | A | 384 / 5019 | 369 | 133 | 0 | 0 | 0.00 | The Great TypeScript Modernization Program Season 3 Episode 6: The Big One (#18014) |
| directus-api | 76f60913e3 | squash #20031 | G | 27 / 852 | 397 | 149 | 0 | 2, 0, -1 | -0.33 | Secure Extensions (#20031) |
| directus-api | c893b9fa65 | squash #22125 | BC | 8 / 302 | 452 | 148 | 2 | 0, 0, 0 | 2.00 | Add public registration (#22125) |
| directus-api | e539b6b11f | squash #25004 | G | 18 / 3502 | 602 | 181 | 4 | 0, 0, 0 | 4.00 | Refactor `applyQuery` (#25004) |
| directus-api | ea31721914 | squash #25437 | A | 16 / 2109 | 613 | 182 | 0 | 2, 0, 0 | -0.67 | Improve Content Versioning (#25437) |
| directus-api | 3dca307974 | squash #27861 | BG | 1 / 24 | 828 | 194 | 0 | 0, 0, 0 | 0.00 | Add @directus/cli (#27861) |
| outline-server | 1e39b564fe | squash #4026 | B | 7 / 281 | 248 | 201 | 0 | 0, 0 | 0.00 | Throttle email notifications upon updating document frequently (#4026) |
| outline-server | a6125be6f1 | squash #4397 | G | 10 / 3200 | 258 | 210 | 0 | 2, 0, 0 | -0.67 | Introduce zod for server-side validations (#4397) |
| outline-server | 33afa2f029 | squash #4861 | G | 13 / 1354 | 282 | 216 | -7 | -9, 4, 2 | -6.00 | Plugin architecture (#4861) |
| outline-server | 1749ffe20d | squash #8477 | E | 6 / 168 | 403 | 237 | 0 | 0, 0, 0 | 0.00 | feat: Redirect to previous subdomains (#8477) |
| outline-server | b91d9e9a72 | squash #11448 | G | 12 / 2722 | 478 | 269 | -2 | 4, 0 | -4.00 | feat: Extract search into pluggable provider system (#11448) |
| outline-server | 6a14ac8ae6 | squash #12859 | G | 7 / 117 | 508 | 283 | 0 | 0 | 0.00 | feat: Slab importer (#12859) |
| outline-server | 9e2565184e | squash #14092 | B | 26 / 68 | 552 | 312 | 0 | 0, 0, 0 | 0.00 | chore: Prune stale comments, TODOs, and type suppressions (#14092) |
| logto-core | 985fe7203a | squash #1104 | G | 9 / 3052 | 83 | 20 | 2 | 0, 0 | 2.00 | refactor(core): separate session routes and UTs (#1104) |
| logto-core | d38543122d | merge #2039 | B | 8 / 1646 | 96 | 28 | 1 | 0, 0, 0 | 1.00 | Merge pull request #2039 from logto-io/feature/decouple-passcode-verification |
| logto-core | cfe4fce51c | squash #4069 | A | 3 / 8 | 181 | 16 | 0 | 0, 0, 0 | 0.00 | fix: support circular reference when normalizing errors (#4069) |
| logto-core | 12a472b99c | squash #8755 | G | 7 / 500 | 472 | 160 | 0 | 0, 0, 0 | 0.00 | feat(core): add avatar/image upload APIs (#8755) |
| logto-core | defa67c4c5 | squash #9269 | B | 8 / 412 | 509 | 167 | 0 | 0, 0, 2 | -0.67 | feat(core): add saml sso connector signing-key management routes (#9269) |
| logto-core | 43999c7189 | squash #9452 | B | 3 / 327 | 535 | 169 | 0 | 0, 0, 0 | 0.00 | fix(core): revalidate consent-time user scopes against the current client scope (#9452) |
| unleash | 36922d156d | squash #1542 | D | 5 / 35 | 244 | 121 | 0 | 0, 0, 0 | 0.00 | refactor: fix a few eslint module boundary type overrides (#1542) |
| unleash | 1d0bc833b3 | squash #3315 | B | 16 / 143 | 495 | 130 | 0 | 0, 0, 0 | 0.00 | chore: refactor segments to stop depending on the implementation (#3315) |
| unleash | 0101491a83 | squash #3942 | G | 35 / 52 | 519 | 135 | 0 | 0, 0, 0 | 0.00 | refactor: playground in feature oriented architecture (#3942) |
| unleash | 2843388673 | squash #4771 | G | 8 / 298 | 565 | 139 | 0 | 0, 0, 0 | 0.00 | refactor: feature oriented architecture for feature dependencies (#4771) |
| unleash | 7a6cb0c527 | squash #5489 | G | 19 / 414 | 613 | 148 | 0 | 0, 0 | 0.00 | refactor: tag type service feature oriented architecture and tx support (#5489) |
| unleash | 5a75093cbc | squash #6189 | G | 27 / 331 | 649 | 154 | 0 | 0, 0, 0 | 0.00 | feat: project applications e2e PoC (#6189) |
| unleash | 84707e2bf3 | squash #6638 | B | 2 / 6 | 681 | 154 | 0 | 0, 0, 0 | 0.00 | chore: create new flag to hide insights ui (#6638) |
| unleash | 3bb7426392 | squash #10311 | B | 1 / 22 | 844 | 155 | 0 | 0, 0, 0 | 0.00 | feat: decouple error impact metrics from logger (#10311) |
| unleash | 53dd4eedef | direct | EF | 2 / 178 | 921 | 155 | 0 | 0, 0, 0 | 0.00 | feat(addon): Readies addon service layer for project addon route |
| unleash | 310b4dc91c | direct | G | 5 / 273 | 938 | 156 | 0 | 0, 0, 0 | 0.00 | refactor(playground): Move complex single-feature query into a new read model |
| budibase-server | 5e3bec86ed | merge #14191 | C | 6 / 498 | 371 | 228 | 0 | 0, 1, 0 | -0.33 | Merge pull request #14191 from Budibase/BUDI-8430/automation-code-away-from-controller |
| budibase-server | 5b86bbe1f5 | merge #18608 | B | 7 / 144 | 523 | 243 | 0 | 0, 0, 0 | 0.00 | Merge pull request #18608 from Budibase/codex/decouple-channel-chat-from-agent-chat |

## Excluded refactors

| repo | commit | reason | subject |
|---|---|---|---|
| immich-server | 82beb040bc | layered share 0.16 < 0.2 | Remove production build on docker file to test build for arm architecture |
| immich-server | c0a6b3d5a3 | snapshot failed (no source files) | refactor(server): system config (#1353) |
| immich-server | 98b72fdb9b | layered share 0.01 < 0.2 | feat: set person birth date (web only) (#3721) |
| immich-server | 7702560b12 | layered share 0.01 < 0.2 | feat(web): re-assign person faces (2) (#4949) |
| immich-server | 33529d1d9b | layered share 0.01 < 0.2 | refactor(server): auth dto (#5593) |
| domain-driven-hexagon | bc798c1c36 | no valid control | docs: added 'Enforcing architecture' section |
| domain-driven-hexagon | 43ae414c95 | no valid control | Merge pull request #148 from feyroozecode/patch-1 |
| etherpad | b2ccd0a191 | snapshot failed (no source files) | LibreOffice: decouple the extension of the temporary file from its type |
| etherpad | e0d6d17bf0 | snapshot failed (no source files) | webaccess: Restructure for readability and future changes |
| etherpad | a000a93dc6 | snapshot failed (no source files) | Refactor startup/shutdown for tests |
| etherpad | 2ea8ea1275 | snapshot failed (no source files) | restructure: move bin/ and tests/ to src/ |
| etherpad | 12f81cfb5e | no valid control | Feat/restructure api (#6664) |
| etherpad | b195b135e4 | no valid control | test(admin): skip anonymizeAuthorSocket when ep_hash_auth is installed (#7796) |
| etherpad | 3e6f9d7bb2 | no valid control | fix(pad): attribute default welcome text to the system author (#7885) (#7887) |
| luizomf-clean-api | 7ec1381443 | no control inside the caliper | refactor: move user models to domain layer |
| outline-server | e2b28dfeb7 | snapshot failed (no source files) | refactor: Policies Architecture (#1016) |
| outline-server | 28aef82af9 | snapshot failed (no source files) | chore: Refactoring event processors and service architecture (#2495) |
| outline-server | bf45e97641 | no control inside the caliper | chore: Enforce `type` import consistency (#10968) |
| budibase-server | 8a80d8801a | snapshot failed (no source files) | Page Layout & Screen restructure (#87) |
| budibase-server | 34b957f331 | snapshot failed (no source files) | Builder saves backend and front end seperately (#88) |
