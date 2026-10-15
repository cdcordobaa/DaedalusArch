# D1 · pipeline

**Title on slide:** How the firewall works: code in, verdict out

**What it shows.** The DaedalusArch pipeline in v1.3. On the spec side, the YAML spec (style, layers, allowed dependencies, rules) is compiled into one Cypher query per rule. On the code side, the extractor turns the TypeScript project into the Architectural Property Graph (APG) in Neo4j, with a layer on every node. Evaluation runs every query on the graph; every returned row is a finding. Findings are split into blocking and advisory tiers. The frozen LLM judge reads units of code for two semantic dimensions (FF-N01 integrity, FF-N02 intent); in v1.3 its result is reported and never blocks. The verdict fails on any blocking finding; the AHS is the weighted score.

**One idea.** Rules are graph queries compiled from the spec; findings are rows.

**Sources.**
- Code: `src/apg-extractor`, `src/fitness-compiler`, `src/evaluation-engine`, `src/llm-critic` (module names).
- Tiers: `Docs/v1.3/rule-tiers.md`. The judge dimensions never block: `Docs/v1.3/pilot-outcome-memo.md` §4 ("They are reported per step and never block (rule-tiers.md)").
- Verdict rule in v1.3 ("any blocking violation"): `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md`, "Instrument and procedure".

**No numbers on this figure.**
