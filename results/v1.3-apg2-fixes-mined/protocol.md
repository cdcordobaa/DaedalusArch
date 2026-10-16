# v1.3 APG v2 fixes-mined: protocol (fixed before the run)

Committed 2026-10-16 with the walker (`scripts/v1.3/apg2-fixes-mined-run.ts`, `scripts/v1.3/lib/apg2-fixes-mined.ts`),
**before any corpus walk**. The only runs before this commit were two calibration probes at the pin
(domain-driven-hexagon, immich-server: one snapshot each, for the runtime and the item counts).

## Question

SO2 claims that the extended graph (APG v2: type flow through signatures, components with Martin metrics, public API
and deep imports, async channels, I/O) carries architecture information an import graph cannot. That was shown on
planted cases (25/27). Here, on real histories: **do developers remove what the APG v2 templates and the cheap
semantic proxies flag, more often and sooner than unflagged import edges?** And separately: **do they remove the items
an import graph cannot see?** (the direct real-world test of SO2).

## Reuse of the symbolic fixes-mined walk

Unchanged from `results/v1.3-fixes-mined/protocol.md` (branch `v1.3-validity-fixes-mined`, copied verbatim here as
`corpus.json` and `specs/` stay in `results/v1.3-fixes-mined/`):

- the corpus (36 projects at their pins) and the committed layer specs;
- the commit list (first-parent, touching the walked path, parentless commits removed) and `evenlySpaced`;
- the harness tsconfig (`flattenTsconfig`, production code, tests excluded), sparse checkouts, no dependency installed;
- one snapshot per (tree of the walked path, tsconfig blob);
- the bot filter, the mass-change thresholds, rename detection (`-M50%`), the architecture-word list, the statistics
  (Wilson 95%, log-normal rate-ratio CI, Cohen's h, repository-cluster bootstrap with 2,000 resamples and seed
  20261016, sign test, Kaplan-Meier).

Changed:

- **Sample size: up to 100 evenly spaced commits per project** (the symbolic walk used 200). Reason: an APG v2 snapshot
  with the cheap proxies costs about 10x a symbolic one (calibration: immich 23 s for 458 files, 64% of it the cheap
  proxies), and the walk must finish in one session.
- **Instrument per snapshot**: `extractAPG` with `V13_APG2_OPTIONS`; components = the spec's layers and DDD contexts
  plus one folder component per top-level folder (as the wild run); the nine APG v2 templates as their in-memory
  mirrors with `apg2Params` of the spec's layer model; the cheap proxies (`enrichCheap`, default thresholds), all
  except `co-change` (its flags follow the history, not the code) and `test-topology` (the harness excludes tests).
  Templates, tiers and proxies are read as they are on `origin/v1.3`; none is edited.

## Items and identity

- APG v2 rows: rule + the named files, member, type, channel or component (never a line).
  `boundary-type-leak`: file, member, leaked type, type file. Deep imports: file, target, component. Async: publisher
  file, subscriber file, channel, transport. I/O and nondeterminism: file, member, category. ADP / SDP: component pair.
  Main-sequence distance: component.
- Proxy flags: proxy/kind + file + class.method (+ the other end's file and unit for two-ended flags). Rule = `proxy/kind`.
- Tiers: `APG2_TEMPLATE_TIERS` for the templates; every proxy flag is advisory.

## Disappearance classes (first match)

1. RENAMED (a named file is a rename source), 2. FILE-DELETED, 3. COMPONENT-GONE (a named component has no file),
4. MASS-OR-BOT, then by shape:
   - edge (deep imports, baseline edges): **FIXED-BY-DEV** if the file pair has no APG relation at the child, else OTHER;
   - component dependency (ADP, SDP): **FIXED-BY-DEV** if the component DEPENDS_ON edge is gone, else OTHER;
   - member, pair, file, main-sequence distance: **RESOLVED-IN-PLACE** (gone with every named file still there).
     For member-level items the record says whether the member itself is still declared (`memberStays`).

**Credited** (the fix rate's numerator) = FIXED-BY-DEV + RESOLVED-IN-PLACE.

## Import-graph visibility (SO2)

An item is **import-graph-invisible** when (i) its rule cannot be written as a dependency-cruiser rule (path rules over
file imports, `moreUnstable`, cycles, `reachable`) and (ii) where the per-item test of the wild run applies, the file
import graph does not show the relation (`importGraphSees`):

- expressible (never invisible): `deep-import-*`, `component-adp-cycle`, `component-sdp-violation`,
  `sdk-spread/vendor-sdk-outside-adapters`, `reachability/unreachable-module`;
- per-item test: type leak (an import edge between the member's file and the type's file), async (an import edge
  between publisher and subscriber), I/O and nondeterminism (the file imports the API's package; a global such as
  `Date`, `process.env`, `fetch` never), two-ended proxy flags (an import edge between the ends);
- no import relation to test (main-sequence distance, single-file proxy flags): invisible.

## Baselines

- (a) Every internal file IMPORTS / RE_EXPORTS edge at the parent that no item rests on (the deep-import edge, the
  type-leak file pair), classified as an edge: all, both files layered, **cross-layer** (primary, as in the symbolic walk).
- (b) Every file -> package import at the parent: removed while the file stays, not renamed, not mass/bot. The closer
  comparison for file- and member-level items (I/O, nondeterminism, proxies).
- Touched-only rates (secondary): exposures restricted to pairs where the commit touched a file the item (edge) names.
  Member- and file-level items can only disappear in place when their file is edited, so this removes the churn
  difference between item kinds.

## Statistics and outputs

- Per rule and per group (APG v2 blocking, APG v2 advisory, proxies; invisible vs seen): exposures, credited, Wilson
  95%; rate ratio vs baseline (a) cross-layer and vs (b), log-normal CI and repository bootstrap CI; Cohen's h; distinct
  fix commits; one-credit-per-commit sensitivity; the rate without the single commit with the most credits.
- Survival: lineages over the grid of sampled commits (left-censored ones excluded), Kaplan-Meier median and one-year
  survival, items vs unflagged edges; the share of lineage ends with every file in place.
- Fix-commit messages: architecture words in credited-removal commits vs every non-bot sampled commit and vs
  baseline-removal commits.
- Report `Docs/DiagnosticRuns/v1.3-apg2-fixes-mined-2026-10-16.md` with 15 example fix commits (permalinks), chosen
  across rules and repositories by a seeded draw from the credited, non-mass, non-bot removals.

Third-party source is never committed: clones and the snapshot cache live in a scratch directory.
