# cypher-interp parity against Neo4j 5.26.24 + APOC

Statements: 72388 (equal 71822, order 360, float-drift 206, content 0, error 0, unsupported 0, both-error 0); projects: 81.

`float-drift` applies only to universal:averageInstability, universal-literal:averageInstability (bound 16 ULP; both values per cell in parity-float-drift.json). "non-empty" = statements that returned rows on both engines; a template under 50 is **thin**. Per binding: pipeline / spec / low / high; synthetic = the same on the synthetic graphs only.

| template / query family | statements | projects | equal | order | float-drift | content | error | unsupported | both-error | Neo4j rows | non-empty | non-empty p/s/l/h | synthetic s/l/h | thin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| abstraction-ratio | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 494 | 494 | 28 / 304 / 0 / 162 | 6 / 0 / 6 |  |
| agent-reimplementation | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| aggregate-boundary | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 434 | 326 | 2 / 128 / 128 / 68 | 8 / 8 / 8 |  |
| application-service-thin | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 2076 | 548 | 2 / 190 / 298 / 58 | 4 / 4 / 0 |  |
| boundary-type-leak | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 156 | 48 | 0 / 10 / 32 / 6 | 4 / 4 / 4 | thin |
| bounded-context-modules | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 176 | 158 | 2 / 62 / 62 / 32 | 0 / 0 / 0 |  |
| component-adp-cycle | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 78 | 24 | 0 / 8 / 8 / 8 | 4 / 4 / 4 | thin |
| component-instability | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 17132 | 1055 | 103 / 360 / 592 / 0 | 12 / 12 / 0 |  |
| component-main-sequence-distance | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 130 | 50 | 0 / 4 / 42 / 4 | 4 / 4 / 4 |  |
| component-sdp-violation | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 118 | 82 | 0 / 38 / 38 / 6 | 4 / 4 / 4 |  |
| context-isolation | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 35316 | 1252 | 4 / 492 / 492 / 264 | 12 / 12 / 12 |  |
| controller-no-entity | 2366 | 81 | 2366 | 0 | 0 | 0 | 0 | 0 | 0 | 2450 | 698 | 0 / 8 / 684 / 6 | 6 / 0 / 6 |  |
| core-isolation | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 3154 | 482 | 6 / 188 / 188 / 100 | 12 / 12 / 12 |  |
| deep-import-declared-api | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 50 | 26 | 0 / 10 / 10 / 6 | 4 / 4 / 4 | thin |
| deep-import-inferred-api | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin |
| dependency-direction | 1622 | 81 | 1622 | 0 | 0 | 0 | 0 | 0 | 0 | 454 | 418 | 22 / 156 / 156 / 84 | 12 / 12 / 12 |  |
| dependency-direction-graph | 1600 | 81 | 1600 | 0 | 0 | 0 | 0 | 0 | 0 | 352 | 316 | 12 / 120 / 120 / 64 | 8 / 8 / 8 |  |
| dependency-inversion | 826 | 81 | 826 | 0 | 0 | 0 | 0 | 0 | 0 | 582 | 202 | 6 / 76 / 0 / 120 | 0 / 0 / 2 |  |
| domain-event-placement | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 44 | 26 | 2 / 8 / 10 / 6 | 4 / 6 / 4 | thin |
| domain-purity | 1682 | 81 | 1682 | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 188 | 16 / 68 / 68 / 36 | 4 / 4 / 4 |  |
| domain-stability | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 5238 | 598 | 6 / 0 / 592 / 0 | 0 / 12 / 0 |  |
| domain-state-purity | 856 | 81 | 856 | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 172 | 6 / 66 / 66 / 34 | 2 / 2 / 2 |  |
| endpoint-bypasses-application | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| env-read-outside-config | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| framework-exception-in-core | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| hidden-coupling | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| ingest | 4212 | 81 | 4212 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 |  |
| ingest-verify | 892 | 81 | 532 | 360 | 0 | 0 | 0 | 0 | 0 | 3750 | 892 | 568 / 324 / 0 / 0 | 12 / 0 / 0 |  |
| inheritance-depth | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin |
| interface-segregation-proxy | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 1312 | 244 | 0 / 2 / 240 / 2 | 2 / 2 / 2 |  |
| io-outside-adapters | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 48 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin |
| judge-graph:classes | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 7386 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| judge-graph:edges | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 33233 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| judge-graph:files | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 10775 | 385 | 0 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| judge-graph:interfaces | 385 | 81 | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 3685 | 370 | 0 / 147 / 147 / 76 | 0 / 0 / 0 |  |
| layer-skip-graph | 1600 | 81 | 1600 | 0 | 0 | 0 | 0 | 0 | 0 | 8424 | 746 | 6 / 292 / 292 / 156 | 12 / 12 / 12 |  |
| max-fan-in | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 29506 | 1418 | 0 / 504 / 608 / 306 | 12 / 12 / 10 |  |
| module-domain-imports-infrastructure | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin |
| module-fan-out | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 25632 | 1458 | 44 / 504 / 608 / 302 | 12 / 12 / 8 |  |
| naming-controllers | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 16 | 0 / 6 / 4 / 6 | 6 / 4 / 6 | thin |
| naming-conventions | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 5626 | 490 | 0 / 126 / 296 / 68 | 6 / 6 / 6 |  |
| naming-repos | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 1522 | 518 | 4 / 176 / 250 / 88 | 0 / 6 / 0 |  |
| naming-services | 856 | 81 | 856 | 0 | 0 | 0 | 0 | 0 | 0 | 584 | 182 | 0 / 0 / 182 / 0 | 0 / 6 / 0 |  |
| no-cyclic-deps | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 226 | 178 | 10 / 64 / 64 / 40 | 12 / 12 / 12 |  |
| no-domain-outward-dep | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 3158 | 486 | 10 / 188 / 188 / 100 | 12 / 12 / 12 |  |
| no-index-logic | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 18 | 0 / 6 / 6 / 6 | 6 / 6 / 6 | thin |
| no-layer-skip | 1566 | 81 | 1566 | 0 | 0 | 0 | 0 | 0 | 0 | 19678 | 1330 | 10 / 524 / 524 / 272 | 12 / 12 / 12 |  |
| no-orphan-files | 1652 | 81 | 1652 | 0 | 0 | 0 | 0 | 0 | 0 | 210 | 48 | 0 / 16 / 16 / 16 | 12 / 12 / 12 | thin |
| nondeterminism-in-core | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 308 | 174 | 0 / 86 / 86 / 2 | 0 / 0 / 0 |  |
| port-adapter-pattern | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 1382 | 606 | 4 / 152 / 368 / 82 | 8 / 12 / 8 |  |
| port-dependency-inversion | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 198 | 2 / 76 / 0 / 120 | 0 / 0 / 2 |  |
| repository-aggregate-root | 1570 | 81 | 1570 | 0 | 0 | 0 | 0 | 0 | 0 | 106 | 58 | 2 / 20 / 20 / 16 | 12 / 12 / 12 |  |
| repository-pattern | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 90 | 90 | 4 / 32 / 32 / 22 | 8 / 8 / 8 |  |
| single-responsibility-proxy | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 5000 | 398 | 0 / 64 / 300 / 34 | 0 / 6 / 0 |  |
| test-file-pairing | 882 | 81 | 882 | 0 | 0 | 0 | 0 | 0 | 0 | 23368 | 858 | 112 / 296 / 296 / 154 | 6 / 6 / 6 |  |
| undeclared-async-coupling | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 66 | 18 | 0 / 6 / 6 / 6 | 4 / 4 / 4 | thin |
| universal-literal:averageInstability | 456 | 81 | 351 | 0 | 105 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:cyclicDependencyCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:maxFanIn | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:maxFanOut | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal-literal:orphanFileCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:abstractionRatio | 912 | 81 | 912 | 0 | 0 | 0 | 0 | 0 | 0 | 912 | 912 | 142 / 304 / 304 / 162 | 6 / 6 / 6 |  |
| universal:averageInstability | 456 | 81 | 355 | 0 | 101 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:cyclicDependencyCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:maxFanIn | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:maxFanOut | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| universal:orphanFileCount | 456 | 81 | 456 | 0 | 0 | 0 | 0 | 0 | 0 | 456 | 456 | 71 / 152 / 152 / 81 | 3 / 3 / 3 |  |
| untested-component | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
| use-case-isolation | 1596 | 81 | 1596 | 0 | 0 | 0 | 0 | 0 | 0 | 76 | 76 | 4 / 28 / 28 / 16 | 4 / 4 / 4 |  |
| value-object-immutability | 800 | 81 | 800 | 0 | 0 | 0 | 0 | 0 | 0 | 2224 | 306 | 4 / 6 / 292 / 4 | 2 / 6 / 2 |  |
| vendor-sdk-outside-adapters | 770 | 81 | 770 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 12 | 0 / 4 / 4 / 4 | 4 / 4 / 4 | thin |
