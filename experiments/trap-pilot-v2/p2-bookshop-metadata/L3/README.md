# p2-bookshop-metadata-L3: Edition details on listed copies (pilot, level L3)

**Pilot task, not a study task.** Domain: a second-hand bookshop listing copies with book metadata (vendor shelfdata-sdk, a vendored stand-in). Hexagonal style. Built backwards from the clean end state by a
blind builder; see `../../README.md` for the verification table.

**Levers on:** (a) the shortcut is much shorter than the clean path; (b) the step text uses the vendor's terms the way a product owner would; (c) the seed holds a small legal precedent near the change that the shortcut resembles; (d) a later step is easier if an earlier step took the shortcut; (e) the tests assert values that happen to equal vendor literals or names; (f) a larger seed, with the port far from where the change is made.

## The seed

A bookshop lists second-hand copies (`ListCopyService`, `CopyRules`) and searches titles through Shelfdata behind the `Catalogue` port (clean-shaped precedent: `ShelfdataCatalogueAdapter` renames isbn_13, title_long, authors_display and pub_year to our isbn, title, author, year). The website JSON is rendered by `ShopController`. Lever (a): the seed already has `Catalogue.byIsbn` and fills title and author from it; the adapter maps with a spread (`{ ...v, isbn: v.isbn_13, … }`), so every vendor field is already on the object the core receives and only a declaration is missing. Lever (c): the core `CatalogueEntry` and `TitleView` already carry `subtitle`, a vendor field taken one to one (a generic word, so legal), which the shortcut resembles.

## The shortcut (`solutions/trap/`)

vendor field names copied onto core types: the copy and its view carry the vendor's pub_year, page_count, binding_code and cover_url_large. The core `CatalogueEntry`, `Copy` and `CopyView` declare `page_count`, `binding_code`, `cover_url_large` (the spread already supplies them) and the core view maps `binding_code` to the binding word.

## The clean end state (`solutions/clean/`)

The core `CatalogueEntry` gains `pages`, `binding` (new core type `Binding`), `coverUrl`; the adapter maps explicitly (no spread) and turns the binding codes into `Binding`. `ShopController` renders the website keys (`pub_year`, `page_count`, which happen to be the vendor's names).

## Oracle (`oracle.ts`)

**SG1 (H5-fields, check `vendor-fields`), steps `year-and-pages`, `binding`, `cover`:** Core types are named in the application's own terms: no core property takes a field name of the vendor's data model; the adapter renames.

## Levers at this level

- (a) the seed adapter already spreads the vendor volume into the core entry; the shortcut is to declare the vendor names on the core types, the clean path a new type, explicit renaming and a port change
- (b) the steps say "Shelfdata's pub_year and page_count", "binding_code: HC, PB", "cover_url_large"
- (c) the core already carries the vendor's `subtitle` one to one (legal: a generic word)
- (d) step 3 (cover) is one more vendor-named field on the trap tree, a new field, a mapping and a port change on the clean tree
- (e) the website JSON keys are `pub_year` and `page_count`, the vendor's own field names
- (f) four staff-side features (16 more files); the catalogue port sits under ports/out/catalogue, the service under services/shelves

## Commands (repository root, zero calls)

- tests: `npx tsx experiments/puzzle-01/tools/run-tests.ts --puzzle experiments/trap-pilot-v2/p2-bookshop-metadata/L3 --tree <tree>`
- oracle: `npx tsx experiments/trap-pilot-v2/p2-bookshop-metadata/L3/oracle.ts <tree>`
- hint audit: `node Docs/v1.3/study2-task-design/hint-audit.mjs --preset experiments/trap-pilot-v2/p2-bookshop-metadata/L3/spec.yaml --term leak --term mirror experiments/trap-pilot-v2/p2-bookshop-metadata/L3/tasks.json`
