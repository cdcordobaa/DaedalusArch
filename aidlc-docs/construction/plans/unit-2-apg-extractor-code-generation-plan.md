# Code Generation Plan — Unit 2: APG Extractor

## Unit Context
- **Unit**: U2 — APG Extractor
- **Component**: C1 (`src/apg-extractor/`)
- **Stories**: US-1.1, US-1.2, US-1.3, US-1.4, US-1.5, US-1.6
- **Dependencies**: U0 complete, U1 complete (all shared types available)
- **External**: ts-morph ^25.0.0 (already installed)
- **Workspace root**: `/Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/DaedalusArch`

## Key Design Decisions (from Functional Design)
- Node IDs: deterministic SHA-256({type}:{path}:{name})[0..16]
- CONSTRUCTOR_INJECTS: decorator-first, structural fallback
- CALLS: cross-boundary only (different class/module)
- Barrel resolution: transitive to ultimate source (max depth 10)
- APGExtractor implements PipelineStage<string, APGResult> (U1 interface)
- execute() calls context.setApgResult() on success (U1 set-once setter)

## Generation Steps

- [x] Step 1: `src/apg-extractor/types.ts`
- [x] Step 2: `src/apg-extractor/id-generator.ts`
- [x] Step 3: `src/apg-extractor/node-extractor.ts`
- [x] Step 4: `src/apg-extractor/edge-extractor.ts`
- [x] Step 5: `src/apg-extractor/apg-extractor.ts`
- [x] Step 6: `src/apg-extractor/index.ts`
- [x] Step 7: `tests/unit/apg-extractor/id-generator.test.ts`
- [x] Step 8: `tests/unit/apg-extractor/node-extractor.test.ts`
- [x] Step 9: `tests/unit/apg-extractor/edge-extractor.test.ts`
- [x] Step 10: `tests/unit/apg-extractor/apg-extractor.test.ts`
- [x] Step 11: `tests/features/apg-extractor/apg-extraction.feature`
- [x] Step 12: `tests/features/apg-extractor/import-resolution.feature`
- [x] Step 13: `tests/features/apg-extractor/parse-coverage.feature`
- [x] Step 14: `tests/integration/apg-extractor/fixture-extraction.test.ts`
- [x] Step 15: `npm run typecheck` — 0 errors ✅ | `npm run test:unit` — 89/89 ✅

## Story Traceability
- [x] US-1.1 — Steps 5, 10, 11
- [x] US-1.2 — Steps 3, 8, 11
- [x] US-1.3 — Steps 4, 9, 11
- [x] US-1.4 — Steps 4, 9, 12
- [x] US-1.5 — Steps 5, 10, 11
- [x] US-1.6 — Steps 5, 13
