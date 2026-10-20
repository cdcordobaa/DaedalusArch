# v1.3 human labelling protocol: blind union design

**2026-10-15. Status: defined; nothing labelled yet.** This protocol produces the human reference for the hold-out run (`Docs/v1.3/holdout-prespec.md` §7). It runs only after the hold-out outputs are committed. It extends the author audit of `Docs/v1.3/labelling.md` §6 in four ways: it adds a second rater, decoys, items the tool missed, and a calibration step.

## 1. Why a union

If raters see only what the tool found, they can measure its precision but never its recall. If they see only what the manifest expects, they cannot judge the tool's extra findings. Each sheet therefore shows the union of both, plus decoys, so that a rater cannot tell an item's source from its presence.

## 2. Items

For each hold-out case (variant) drawn into the sample:

- **Manifest findings ∪ tool findings ∪ 1–2 decoys.** An item that is in both the manifest and the tool output (matched as in `scripts/v1.3/lib/compare.ts`) appears once.
- **Decoys** are true facts of the case that neither the manifest nor the tool flags: an import edge, a declaration or a placement, drawn with a fixed seed from the case's expected graph. They are written in the same wording as a finding, for example "X (application) imports from Y (domain) (line 3)".
- **Neutral rendering**, as `scripts/v1.3/audit-sheet.ts` does it: style, file and line, the claim with no rule id, template name or violation type (`claimText`), and a 31-line excerpt with every comment removed (`excerpt-scrub.ts`). Manifest-only items get a claim written from the manifest's rule, file and target, in the same wording as the tool's message for that template.
- **Answer per item**, to the question *"Would an architect following this style want this changed?"*: `yes`, `no` or `uncertain`, with an optional one-line note.
- **"Anything else?"** On a seeded subsample of **20 cases**, the rater also sees the whole case (file tree and the files of the items) and lists any violation of the style that is not on the sheet. This is the only check of what the manifest and the tool both missed.
- **Order.** Items are shuffled across cases with a fixed seed. A rater never sees an item's source, its rule, the tool's verdict, the manifest, or another rater's answer.

**Tooling gap.** `audit-sheet.ts` samples tool findings only. The union sheet needs a `union` mode (manifest items, decoys, a seeded draw by stratum, and a source-blind key), and a human–human agreement mode. Both are built and tested on the development set before the hold-out run, and their hashes are recorded at freeze.

## 3. Stratification and sample size

**Strata** are style (5) × source (manifest-only, tool-only, both, decoy). The draw is round-robin over the strata in a seeded order, as in `selectAuditStratified`. About **25% of the items are negatives**: decoys, plus items expected to be "no", such as near-miss findings. The real allocation is filled from the hold-out counts after the run. A stratum with fewer items than its share is taken whole.

There are two options. The director or the author picks one before the sheet is drawn.

| | **Option A: 60 items** | **Option B: 120 items** |
|---|---|---|
| Rater time | about 2–3 h per rater, plus the 20-case "anything else?" pass | about 5–10 h per rater, plus the same pass |
| Per style | about 12 items | about 24 items |
| Wilson 95% half-width of a pooled proportion | ±0.09 at p = 0.85; ±0.12 at p = 0.5 | ±0.06 at p = 0.85; ±0.09 at p = 0.5 |
| Binary κ standard error (observed agreement 0.90, 25% negatives, so κ ≈ 0.73) | ≈ 0.10 (95% interval about ±0.20; lower bound ≈ 0.53) | ≈ 0.07 (about ±0.14; lower bound ≈ 0.59) |
| Per style | descriptive only (±0.2 or wider) | descriptive only (about ±0.15) |

**Per-rule figures are not reportable** under either option. There are about 15–20 blocking rule and template pairs, so each would get 3–8 items. Per-rule numbers are listed only as counts.

With κ ≈ 0.73, neither option gives a lower bound above 0.60. The κ gate (§6) is therefore judged on the point estimate, and its interval is reported beside it.

## 4. Raters

| Role | Who | Use of the labels |
|---|---|---|
| **Second rater** | an independent rater (§5) | **the primary human reference** for every human-reference figure |
| Author | Cristian Cordoba | secondary rater; enters the agreement pairs only. **Never adjudicates a hold-out disagreement.** |
| Gemini | the *meaningful* labeller of `labelling.md` §5 (tools off, two permuted runs) | third rater, for agreement only |

Hold-out disagreements are not adjudicated. They are reported as the agreement tables, and the human-reference figures use the second rater's labels. An item the second rater marks `uncertain` is reported as uncertain, never resolved by the author.

## 5. Rater qualification and calibration

**Qualification.** A professional TypeScript developer with shipped production code in at least 2 of the 5 styles (Clean, Layered, NestJS, Hexagonal, DDD). The rater has no part in building the tool, writing the manifests or writing the thesis, and declares any conflict of interest.

**Calibration** comes before any blind labelling:
1. Both human raters answer the 10 development-set items of `audit/view/v1.3-calibration-sheet.md` on their own (about 30 minutes).
2. They open the key (`audit/key/v1.3-calibration-sheet.key.json`) together and discuss each item, especially the 3 ambiguous ones (about 30 minutes). The discussion settles how the codebook is read. It does not settle any hold-out answer.
3. Calibration answers are never counted. If the discussion shows a codebook gap, the codebook gets a dated note before the blind sheet is drawn, and never after.

## 6. Agreement

- **Gate:** Cohen's κ ≥ 0.60 on the **binary split** (`yes` vs not `yes`), with Gwet's AC1 alongside, because κ is unstable when one answer dominates.
- **All pairs:** author–second rater, author–Gemini, second rater–Gemini. Each pair gets the 3×3 table, κ and AC1 on the three-way and binary labels, and observed agreement with its Wilson interval, from `audit-sheet.ts agreement` or its human–human mode.
- If a pair is below the gate, the result is reported as it is. The protocol is not re-run with a new sample to reach the gate.

**V6 pointer (delegated edit to a frozen document, 2026-10-20; author's delegation DELEG2, item V6-PTR):** for the C3m (MEAN-01 meaning) labels, κ is defined in `ops/notes/mean-01-codebook-and-sample.md` §4 and dated in its §12 sign-off (binding from 2026-10-19, before any label). This line only points there; nothing above changes.

## 7. Reported figures

From the second rater's labels: the share of `yes` among the tool's blocking findings (human *meaningful* precision), and the share of manifest items the rater confirms. From the "anything else?" pass: violations that the manifest and the tool both missed, per case. Also the decoy false-yes rate, which is the raters' own false-alarm rate. Every figure is given per source stratum and pooled, with Wilson intervals.

---

## Appendix A. Codebook (one page)

**The question.** *Would an architect following this style want this changed?* Answer for the style named on the item, from the code you see. Do not answer from the style you would prefer.

**What each style requires** (from `Docs/v1.3/style-rule-sources.md`):
- **Clean:** source dependencies point only inward. Entities and use cases know nothing of frameworks, databases or the UI. Data-access interfaces belong to the inner layer, and their implementations to the outer one. No dependency cycles between components.
- **Layered:** upper layers use lower ones, and never the reverse. Strict layering also forbids skipping a layer. No cycles.
- **Hexagonal:** the core (domain and its ports) talks to the outside only through ports. It does not depend on adapters, UI or databases. Driven adapters implement ports the core defines. Hexagonal does **not** require strict layering: an adapter may use domain types that a port speaks.
- **DDD:** outside code holds references only to an aggregate's root. Repositories exist only for aggregate roots. Value objects are immutable. The domain is free of UI, application and infrastructure code. Each bounded context is explicit, and other contexts reach it only through its published interface or an anti-corruption layer.
- **NestJS:** the Clean rules, plus module encapsulation: other modules use only what a module exports.

**Answer `yes`** when the code breaks one of these constraints in a way the style's sources state, and the claim is true of the code.
**Answer `no`** when the claim is false, or when it is true but the style allows it. Examples: an inward import in Clean, an adjacent downward import in Layered, a measured number on code whose role makes it expected, such as a controller being unstable.
**Answer `uncertain`** only when the code shown does not let you decide, or when the style's sources are genuinely silent. Add a one-line note.

**Readings fixed for this protocol** (the construct decisions):
- **P1:** where a style's sources say nothing, the constraint does not apply in that style. Do not import a constraint from another style, for example strict layering into Hexagonal.
- **P2:** one edge breaks one constraint. Judge the claim as stated; do not answer `yes` because the same edge breaks something else.
- **Open questions:** type-only imports (Q2), file cycles inside one layer (Q3), adapter-to-adapter imports (Q5), a missing `implements` under structural typing (Q9), and files outside every bounded context (Q15). Answer them on the style's own reading if you can. If you cannot, answer `uncertain` and say why. Your notes on them are useful data.

**Do not** look up the tool, the manifests, the repository history or another rater's answers. Do not change an answer after the calibration discussion.

## Appendix B. Instrucciones para los evaluadores (español)

**La pregunta.** Para cada ítem: *¿Querría cambiar esto un arquitecto que sigue este estilo?* Responda según el estilo indicado en el ítem y según el código que ve, no según el estilo que usted preferiría.

**Respuestas.** Escriba `yes` (sí), `no` o `uncertain` (no estoy seguro) en la columna `[Answer]`. Use las palabras en inglés, porque la hoja se procesa automáticamente. Puede añadir una nota de una línea.
- `yes`: el código rompe una restricción que las fuentes del estilo establecen, y la afirmación es cierta en el código.
- `no`: la afirmación es falsa, o es cierta pero el estilo la permite. Por ejemplo: una importación hacia dentro en Clean, una importación al nivel inmediatamente inferior en Layered, o una métrica alta en un archivo cuyo papel la explica.
- `uncertain`: solo si el código mostrado no permite decidir, o si las fuentes del estilo no dicen nada. Explique por qué en una línea.

**Lo que exige cada estilo:** consulte el Apéndice A (Clean, Layered, Hexagonal, DDD, NestJS). Las mismas lecturas valen aquí. Donde las fuentes de un estilo callan, la restricción no se aplica (P1). Cada afirmación se juzga tal como está escrita (P2). En las preguntas abiertas (importaciones solo de tipo, ciclos dentro de una capa, adaptador a adaptador, `implements` ausente con tipado estructural, archivos fuera de todo contexto), responda según la lectura del propio estilo o, si no puede, `uncertain` con una nota.

**"¿Algo más?"** En los 20 casos marcados, revise el caso completo y anote cualquier violación del estilo que no esté en la hoja.

**No** consulte la herramienta, los manifiestos, el historial del repositorio ni las respuestas de otro evaluador. No cambie una respuesta después de la sesión de calibración.

**Tiempo estimado:** calibración, unos 60 minutos (10 ítems y discusión). Opción A, 60 ítems: 2–3 horas. Opción B, 120 ítems: 5–10 horas. A esto se suma la revisión "¿algo más?" de 20 casos.
