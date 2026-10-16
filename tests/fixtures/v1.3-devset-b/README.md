# v1.3 development set B (devset-b)

An expansion of the v1.3 development set (`tests/fixtures/v1.3-reference`, 71 cases), kept in a separate directory
so the 71 cases and their results (`results/v1.3-reference/*`) are unchanged. Same five styles, same on-disk formats
(patch format for clean-architecture, layered, nestjs and hexagonal; overlay format for ddd), same manifest schemas.

- `<style>/project/` (or `ddd/clean/`), `spec.yaml`, `expected-graph.json`: byte copies of the reference set's files.
  The `clean` variant is therefore the same case as in the reference set (in-sample); it is kept only as the runner's
  baseline and is not counted as a devset-b case.
- `<style>/variants/<id>/`: new variants only. `v..`: violations (one planted defect, every expected finding listed).
  `n2x`-`n4x`: look-alikes that resemble a violation of one blocking rule but conform to its definition.
  `n6x`: further clean variants (a conforming change to the project); the schema allows the `clean` kind for the
  baseline only, so these are stored as `near-miss` with no expected finding.
- `<style>/devset-b.json`: the role of every variant (`baseline`, `violation`, `look-alike`, `clean`) and the rule
  it targets; read by `scripts/v1.3/devset-b-score.ts`.

**Provenance.** devset-b is development data, written by Claude (an AI model) on 2026-10-16 from the rule
definitions (the reference notes, `Docs/v1.3/style-rule-sources.md`, `Docs/v1.3/rule-tiers.md` and each spec),
before the tool was run on it. It is not a hold-out and not independent of the tool's authors.

Commands (repository root):

```sh
npx tsx scripts/v1.3/validate-reference.ts --check --set devset-b
NEO4J_URI=... NEO4J_PASSWORD=... npx tsx scripts/v1.3/ue-baseline-live.ts --set devset-b --out results/v1.3-devset-b
npx tsx scripts/v1.3/devset-b-score.ts --raw results/v1.3-devset-b/raw --out results/v1.3-devset-b
```
