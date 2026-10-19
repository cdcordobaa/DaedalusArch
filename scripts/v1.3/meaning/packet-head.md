# Is this finding worth fixing? Rater packet (MEAN-01)

**For the rater.** Thank you for doing this. You will read 60 short findings from real, human-written TypeScript backends and answer two questions about each. There are no trick items, and there is no "right score" we hope for. Your honest reading is the data.

> **Resumen en español.** Va a leer 60 hallazgos de proyectos TypeScript reales, escritos por personas antes de 2023. En cada uno responde dos preguntas: **A**, si un desarrollador competente de ese estilo pediría cambiarlo en una revisión de código; **B**, si rompe un principio que la literatura del estilo establece, no solo una convención de carpetas del repositorio. Respuestas: `yes`, `no` o `unsure` (en inglés, porque la hoja se procesa automáticamente). Si responde `no`, añada un código de razón (§3). Tiempo: unos 90 segundos por ítem, unas 2 horas en total con la calibración. No consulte la herramienta, el repositorio DaedalusArch, la hoja de muestra ni las respuestas de otra persona.

## 0. Before you start

- **Do first:** the 5 calibration items in `mean-01-calibration.md` (about 15 minutes), then the short discussion with the author (about 20 minutes). Calibration answers are never counted.
- **Do not look up** anything about the tool that produced these findings, the DaedalusArch repository, the sample file, or anyone else's answers. You may open the linked source file on GitHub when the excerpt is not enough.
- **Do not change** an answer after you have moved on, and never after the calibration discussion.
- **Write your answers** in the boxes below each item, or in `mean-01-answers.csv` (one row per item). Use the exact words `yes`, `no`, `unsure`.
- **Order:** the items are in a fixed random order, and each one is independent. Do not let the previous answer steer the next.
- **Time:** aim for about 90 seconds per item. Cycles and DDD items take longer, import-direction items less. Take a break after item M30.

## 1. What every item shows you

- the **style** the repository claims (from its README or layout);
- the **rule, in plain words**;
- **the finding**: the import (or class, or cycle) the rule flagged, with the layers the study's layer map gave both ends;
- a **short code excerpt**, with `>>` on the flagged line;
- a **link** to the full file at the pinned commit.

Every finding has already been checked mechanically: the import exists at that line and resolves to that target, and both ends sit in those layers under the layer map. **You are not checking whether it is true. You are judging whether it matters.**

The layer maps (§L at the end) were written by the study from each repository's README and folders. They can be wrong for a file. If the file's real role does not fit the layer it was given, say so with code `M`.

## 2. The two questions

Answer both, in this order, for every item.

**A. Practitioner.** *Would a competent developer who works in this style ask for this to be changed in a code review?*
Picture a pull request that adds exactly this import (or class, or cycle) to this repository. You review it as an experienced developer of the claimed style, who respects how the style is usually practised. Answer `yes` if you would ask for a change (a different dependency, a moved file, an interface, a port). Answer `no` if you would approve it as it is, even if you would mention it in passing.

**B. Style fidelity.** *Does it break a principle that the style's literature states, and not only this repository's folder convention?*
Answer from what the style's sources say (§4), not from habit. Answer `yes` if the code, read for what it really does, breaks a stated principle. Answer `no` if the sources allow it, are silent about it (§4, reading R1), or if the "violation" exists only because of how the folders were mapped.

**`unsure`** is allowed for both, but only when the code you can see (excerpt plus the linked file) does not let you decide, or when the style's sources are genuinely split. Write a one-line note.

A and B can differ. "The literature says no, but every team does it" is A = `no`, B = `yes`. "Nothing in the books forbids it, but I'd still ask" is A = `yes`, B = `no`.

## 3. Why not? (only when A or B is `no`)

Give the **one** code that fits best:

| Code | Meaning | Typical case |
|---|---|---|
| `T` | test, mock or fixture code, not production architecture | a test file imports a fixture |
| `W` | wiring: the composition root, DI container or module registration, where dependencies are meant to be assembled | a router file imports controller factories from `main/` |
| `F` | an accepted framework idiom in this style | ORM decorators on an entity, `@Injectable()` on a service, a Nest module file |
| `M` | mapping artefact: the file's real role does not fit the layer or context it was given | an Express request handler that the map put in a "business" layer |
| `C` | harmless cycle: through a barrel `index.ts`, type-only, an ORM two-way relation, or inside one layer and one module | two entities that reference each other |
| `X` | other (write a note) | |

## 4. What each style requires

From the style sources the study uses (Martin for Clean; Buschmann et al. for Layered; Cockburn for Hexagonal; Evans and Vernon for DDD; the NestJS documentation):

- **Clean:** source dependencies point only inward. Entities and use cases know nothing of frameworks, databases or the UI. Data-access interfaces belong to the inner layer and their implementations to the outer one. No dependency cycles between components. The `main` / composition component is the outermost one: it may depend on everything, and nothing should depend on it.
- **Layered:** upper layers use lower ones, never the reverse. Strict layering also forbids skipping a layer. No cycles between layers.
- **Hexagonal:** the core (domain and its ports) talks to the outside only through ports, and does not depend on adapters, UI or databases. Driven adapters implement ports the core defines. Hexagonal does **not** require strict layering: an adapter may use domain types that a port speaks.
- **DDD:** outside code holds references only to an aggregate's root. Repositories exist only for aggregate roots. Value objects are immutable. The domain is free of UI, application and infrastructure code. Each bounded context is explicit, and other contexts reach it only through its published interface or an anti-corruption layer (or an explicitly declared shared kernel).
- **NestJS:** the Clean rules, plus module encapsulation: other modules use only what a module exports.

**Readings fixed for this packet:**
- **R1.** Where a style's sources are silent, the constraint does not apply in that style (B = `no`). Do not import a constraint from another style, for example strict layering into Hexagonal.
- **R2.** Judge the claim as stated. If the same import also breaks something else, that does not make this claim `yes`.
- **R3.** Test, mock and fixture code: B = `no` (the sources constrain production code). For A, answer as a reviewer would.
- **R4.** Cycles: B = `yes` only when the cycle crosses a boundary the style names (two layers, two modules or two contexts). A cycle among files inside one layer and one module is B = `no` (the acyclic-dependencies principle is stated for components). For A, answer as a reviewer would.
- **R5.** Read the file for what it does, not for its folder name. If the map put it in the wrong layer, answer B for its real role, and use code `M`.
