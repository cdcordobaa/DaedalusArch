# Presentation kit: DaedalusArch v1.3

Figures, worked rule examples and a numbers index for the thesis director meeting and for the session that builds the slides. Every figure is one idea, 1600 px wide, delivered as SVG and as PNG at 2x (3200 px), with a caption file (`<name>.caption.md`) that says what it shows and where every number comes from. No slides are included.

- **Every number** is in [`NUMBERS.md`](NUMBERS.md), with its meaning and its exact source (document and section, or data file). The **caveats to state on slides** are at the end of that file.
- **The five reference projects** are described in [`reference-projects.md`](reference-projects.md).
- **Worked rule examples** (spec YAML → compiled Cypher → violating code → finding) are in [`examples/`](examples/) as markdown cards with the full Cypher, and in `figures/` as slide figures.
- **Badges.** Each chart carries a badge: *DEVELOPMENT SET* (v1.3 dev data, not a validity estimate), *STUDY 1* (registered or declared post-hoc), *STUDY 1 DATA, READ BY THE v1.3 DEV INSTRUMENT* (descriptive), or a design badge (nothing measured).
- **Palette.** Layers: domain green, application blue, inbound adapters purple, outbound adapters / infrastructure orange, config grey. Before/after: grey/blue. Instruments: judge blue, cheap proxies orange, symbolic rules green. Status chips: green done on the dev set, orange defined or pending, grey with a lock sealed.
- **No hash values** appear anywhere in the kit. Sealed material (hold-out manifests, blind manifests, Study 2 tasks) was not opened.

## Figure index

All paths are under `Docs/presentation-kit/`. Each figure has `.svg`, `.png` and `.caption.md` with the same basename.

### A. The graph

| Figure | One line | Files |
|---|---|---|
| A1 apg-hexagonal-overview | The real APG of the hexagonal reference project: 30 files by layer, 74 import edges | `figures/A1-apg-hexagonal-overview.{svg,png,caption.md}` |
| A2 apg-violation-highlight | Same graph for variant v01: the planted domain → outbound-adapter edge in red, FF-S01 + FF-S04 | `figures/A2-apg-violation-highlight.{svg,png,caption.md}` |
| A3 import-graph-vs-apg | One slice ("cancel a booking"): what an import graph sees vs what the APG adds | `figures/A3-import-graph-vs-apg.{svg,png,caption.md}` |
| A4 schema | Node and edge types, with v1.3 and APG v2 additions marked | `figures/A4-schema.{svg,png,caption.md}` |
| A5 graph-photo | Neo4j-browser-style rendering of real rows: BookRoomService and its neighbours | `figures/A5-graph-photo.{svg,png,caption.md}` |

### B. Worked rule examples

| Figure | One line | Files |
|---|---|---|
| B0 rule-anatomy | Spec → template → Cypher → violation row, on hexagonal FF-S01 | `figures/B0-rule-anatomy.{svg,png,caption.md}` |
| B1 example-ffs01-clean | Dependency direction (Clean): domain imports an infrastructure clock | `figures/B1-example-ffs01-clean.*`, card `examples/B1-example-ffs01-clean.md` |
| B2 example-ffdt03-ddd | Value-object immutability (DDD g01): the `set` accessor that was missed, then found via member facts | `figures/B2-example-ffdt03-ddd.*`, card `examples/B2-example-ffdt03-ddd.md` |
| B3 example-adapter-isolation-hex | Adapter → adapter (Hexagonal v05): found as advisory FF-S03; construct question Q5 | `figures/B3-example-adapter-isolation-hex.*`, card `examples/B3-example-adapter-isolation-hex.md` |
| B4 example-apg2-tf1 | APG v2 case TF1: a persistence type leaks through an inferred return type, with no import | `figures/B4-example-apg2-tf1.*`, card `examples/B4-example-apg2-tf1.md` |

### C. Results charts (kept where no F figure covers them)

| Figure | One line | Files |
|---|---|---|
| C4 apg2-uniqueness | APG v2 detects 25/27 planted cases; import graph 0/27, hand-written dependency-cruiser 10/27; false alarms 29 → 0 | `figures/C4-apg2-uniqueness.{svg,png,caption.md}` |
| C6 ise | Spec inference: right style and layers on preset folder names; fails for renamed hexagonal and DDD | `figures/C6-ise.{svg,png,caption.md}` |
| C7 study1-headline | Study 1 on one axis: SO4 recall and precision, real-code precision, E1 spec effect, judge P4 | `figures/C7-study1-headline.{svg,png,caption.md}` |

C1, C2, C3 and C5 are covered by F3, F2, F6/F7 and F9.

### D. Diagrams

| Figure | One line | Files |
|---|---|---|
| D1 pipeline | Code → APG; spec → Cypher; findings by tier → judge (non-blocking) → AHS and verdict | `figures/D1-pipeline.{svg,png,caption.md}` |
| D2 measurement-chain | The four links (code → graph, spec, rules, meaning) as questions and kinds of evidence | `figures/D2-measurement-chain.{svg,png,caption.md}` |
| D3 neurosymbolic-layers | Facts → cheap proxies → LLM judge / ontology → rules over both, with status | `figures/D3-neurosymbolic-layers.{svg,png,caption.md}` |
| D4 method | Study 1 (frozen) → v1.3 dev set → sealed hold-out (not yet run) → Study 2 (pre-registered later) | `figures/D4-method.{svg,png,caption.md}` |

### F. Deck-session figures

| Figure | One line | Files |
|---|---|---|
| F1 measurement-chain | Seven pieces of evidence over the four links, each with a status chip and its backing file | `figures/F1-measurement-chain.{svg,png,caption.md}` |
| F2 graph-fidelity-classes | Disagreements with tsc and dependency-cruiser by class (E1, SO4): 0 unexplained; barrel fix | `figures/F2-graph-fidelity-classes.{svg,png,caption.md}` |
| F3 devset-before-after | Per style, author view: blocking recall and precision before vs after the fix round, plus false alarms | `figures/F3-devset-before-after.{svg,png,caption.md}` |
| F3b author-vs-blind | Same run scored against author vs blind manifests (53/67 recall blind) | `figures/F3b-author-vs-blind.{svg,png,caption.md}` |
| F4 construct-questions | The seven high-stakes construct questions with rows at stake and the recommended option | `figures/F4-construct-questions.{svg,png,caption.md}` |
| F5 apg2-ablation-grid | 27 planted cases × 6 representations; CP4/CP5 dropped by the 4-type minimum | `figures/F5-apg2-ablation-grid.{svg,png,caption.md}` |
| F6 judge-catch | Judge catch per operator and round, twin and clean false fails (30/35; 4/50) | `figures/F6-judge-catch.{svg,png,caption.md}` |
| F7 proxies-judge-rules | Cheap proxies vs judge vs rules on the 11 round-1 seeds and 9 DUP-RULE v2 seeds; 6/6 analogues; 14 flags / 146 files | `figures/F7-proxies-judge-rules.{svg,png,caption.md}` |
| F8 timeline | Construct decisions → freeze → hold-out → labelling (model, two humans) → pilot → Study 2 prereg | `figures/F8-timeline.{svg,png,caption.md}` |
| F9 study1-under-v13 | E1: 0 blocking in every cell, 100% advisory; SO4 recall 67/73 → 73/73 | `figures/F9-study1-under-v13.{svg,png,caption.md}` |
| F10 study2-design | Steps × arms (none, daedalus-mcp, gate) with snapshot/score points and the repair turn | `figures/F10-study2-design.{svg,png,caption.md}` |
| F11 pilot-decision | Zero erosion in the none arm → Study 2's primary outcome becomes the advisory erosion rate | `figures/F11-pilot-decision.{svg,png,caption.md}` |

## Data behind the graph figures

`data/` holds the extracted graphs and compiled queries the figures are drawn from (node ids replaced by readable keys):

- `data/hexagonal.clean.json`, `data/hexagonal.v01-domain-uses-outbound-adapter-constant.json` (`V13_DEFAULT_OPTIONS`), `data/hexagonal.clean.apg2.json` (`V13_APG2_OPTIONS`);
- `data/compiled-cypher.json`: the Cypher and parameters for B1–B4 and A2/B0, compiled with `V13_COMPILE_OPTIONS`;
- `data/type-flow.boundary-type-leak.json`: the APG v2 rows on the type-flow fixture (B4).

## Rebuilding

The generators are in `tools/` (plain Node ES modules; no new repository dependency). Figure tooling stays outside the repository:

1. Data (repository root, after `npm ci`): `npx tsx Docs/presentation-kit/tools/extract.ts <out> hexagonal/clean hexagonal/v01-domain-uses-outbound-adapter-constant hexagonal/clean:apg2`, `npx tsx Docs/presentation-kit/tools/compile.ts <out>/compiled.json`, `npx tsx Docs/presentation-kit/tools/tf1.ts <out>/tf1.json`, then `python3 Docs/presentation-kit/tools/trim.py` (edit its two paths) to write `data/`. No Neo4j is needed.
2. Figures: in a scratch directory outside the repository, `npm i @hpcc-js/wasm-graphviz@1.6.1`; then from the repository root `KIT_TOOLS=<scratch dir> node Docs/presentation-kit/tools/figs-<group>.mjs` for each generator (`figs-graph`, `figs-graph2`, `figs-graph3`, `figs-examples`, `figs-diagrams`, `figs-diagrams2`, `figs-devset`, `figs-judge`, `figs-results`).
3. PNGs: with Playwright 1.55.0 installed outside the repository, `NODE_PATH=<its node_modules> node Docs/presentation-kit/tools/render.mjs Docs/presentation-kit/figures/*.svg Docs/presentation-kit/examples/*.svg`.

Text is at least 14 px at 1600 px width; each PNG was rendered and checked for clipping and overlap.
