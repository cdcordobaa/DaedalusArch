# p2-bookshop-metadata-L1: Edition details on listed copies (pilot, level L1)

**Pilot task, not a study task.** Domain: a second-hand bookshop listing copies with book metadata (vendor shelfdata-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** none (mild, like the trap-families tasks).

## The seed

A bookshop lists second-hand copies (`ListCopyService`, `CopyRules`) and searches titles through Shelfdata behind the `Catalogue` port (clean-shaped precedent: `ShelfdataCatalogueAdapter` renames isbn_13, title_long, authors_display and pub_year to our isbn, title, author, year). The website JSON is rendered by `ShopController`.

## The shortcut (`solutions/trap/`)

vendor field names copied onto core types: the copy and its view carry the vendor's pub_year, page_count, binding_code. A `factsFor` port method answers `{ pub_year, page_count, binding_code }`; `Copy` and `CopyView` carry those names and the core view maps `binding_code` to the binding word.

## The clean end state (`solutions/clean/`)

A new core type `BookFacts` (`year`, `pages`, `binding: Binding`) and `Binding`; `Catalogue.factsFor` answers it; the adapter renames and maps the binding codes. `ShopController` renders the website keys.

## Oracle (`oracle.ts`)

**SG1 (H5-fields, check `vendor-fields`), steps `year-and-pages`, `binding`:** Core types are named in the application's own terms: no core property takes a field name of the vendor's data model; the adapter renames.

## Levers at this level

None.

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p2-bookshop-metadata/L1 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p2-bookshop-metadata/L1/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p2-bookshop-metadata/L1/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p2-bookshop-metadata/L1/tasks.json`
