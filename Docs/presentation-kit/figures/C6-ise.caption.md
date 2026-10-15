# C6 · ise

**Title on slide:** Inferring the spec from the graph (ISE): accurate until folders are renamed

**What it shows.** Implicit Specification Extraction (ISE) infers a project's architecture spec from its own graph. Left: share of variants whose style is classified correctly, for the five reference projects and five rename probes (P1–P5: the layer folders renamed to names outside any vocabulary). Right: share of files assigned the right layer in the clean variant. Red marks the two probes that fail.

**One idea.** ISE is accurate when folder names follow the presets and breaks for hexagonal and DDD once they do not: the style is misread and the findings follow the wrong spec.

**Numbers and sources.** `Docs/DiagnosticRuns/ise-prototype-2026-10-15.md` §2:
- (a) Variants correct: clean 14/14, layered 13/13, nestjs 14/14, hexagonal 15/15, ddd 15/15; P1 14/14, P2 13/13, P3 14/14, **P4 0/15** (classified clean-architecture, confidence 0.67), **P5 0/15** (clean-architecture, 1.00).
- (b) Per-file layers: 5 reference projects 146/146; P1 29/29; P2 27/27; P3 28/29; **P4 20/30 (67%)**; **P5 6/31 (19%)**.
- (d) Planted violations under the inferred spec: P4 5/11, P5 0/12 (true spec 11/11, 11/12).
- Threat: the reference projects use the presets' folder names, so inference there "is close to a lookup" (§5).

**Caveats to say.** Exploratory, not pre-registered; development set; one probe per style; the rename probes are the real test and two of five fail.
