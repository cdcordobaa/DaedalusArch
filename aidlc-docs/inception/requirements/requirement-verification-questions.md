# Requirements Verification Questions

Your PRD and ADR are comprehensive. These questions address the remaining gaps needed to begin implementation.

---

## Question 1
The PRD defines the scope as **v1.0 Must-Have (Thesis Deliverable)**. The Product Vision doc describes a post-thesis GitHub App product. **What scope should we build right now?**

A) v1.0 Must-Have only — the thesis CLI tool (APG pipeline, AoC parser, fitness functions, AVR/AHS scoring, CLI, batch runner, ground truth suite)
B) v1.0 Must-Have + some v1.1 Should-Have items (e.g., JSON Schema validation for AoC YAML, violation-count-weighted AVR)
C) Other (please describe after [Answer]: tag below)

[Answer]: B (v1.0 Must-Have + some Should-Have items). Rationale: Adding items like JSON Schema validation for AoC YAML (Layer B) ensures the instrument is robust for research and less prone to user error during benchmarking.

---

## Question 2
The `package.json` in the workspace is named "symphony" with dependencies for `liquidjs` and `chokidar` — which appear unrelated to the Architectural Firewall. **How should we handle the existing configuration files?**

A) Start fresh — replace `package.json`, `tsconfig.json`, and other config files with a clean Firewall project setup
B) Keep the existing files and add Firewall dependencies alongside them (there's a reason for the current setup)
C) Other (please describe after [Answer]: tag below)

[Answer]: A (Start fresh). Rationale: The current "symphony" config is unrelated. A clean setup with ts-morph and the correct dependencies is essential for a greenfield thesis artifact.

---

## Question 3
The PRD specifies the project structure as `src/extractor, src/compiler, src/evaluator, src/scorer`. **Should we follow this exact module structure, or do you have a preferred project layout?**

A) Follow the PRD structure exactly: `src/extractor/`, `src/compiler/`, `src/evaluator/`, `src/scorer/`, `src/cli/`
B) Use a more granular structure aligned with the 6 functional modules in the PRD (APG Extractor, Neo4j Ingestion, Fitness Compiler, Evaluation Engine, Scoring Engine, Batch Runner)
C) Use a clean architecture / hexagonal layout for the Firewall itself (domain/application/infrastructure)
D) Other (please describe after [Answer]: tag below)

[Answer]: B (Granular structure aligned with 6 functional modules). Rationale: Aligns perfectly with the functional modules in PRD Segment 9 and provides the best separation of concerns for a complex pipeline.

---

## Question 4
The PRD lists **Neo4j Community Edition** (ADR-003) as the graph database. **What is your Neo4j setup for development?**

A) Neo4j is already installed locally and running
B) Use Docker Compose for Neo4j (provide a `docker-compose.yml`)
C) I'll set up Neo4j separately — just provide the connection config
D) Other (please describe after [Answer]: tag below)

[Answer]: B (Use Docker Compose). Rationale: Critical for reproducibility in research. It ensures the environment is identical for any peer/reviewer running your benchmark.

---

## Question 5
The PRD mentions a **Clean Architecture style template** with 17 pre-built fitness functions. The spike validated all 17 compile to Cypher. **Do you have the spike code or Cypher queries from the spike available, or should we implement them from scratch based on the PRD spec?**

A) Spike code exists — I'll provide it or point to its location
B) No spike code available — implement from scratch based on the PRD/ADR specifications
C) Spike code exists but should be rewritten cleanly — use it only as reference
D) Other (please describe after [Answer]: tag below)

[Answer]: C (Spike code exists but should be rewritten cleanly). Rationale: You mentioned spike code exists; rewriting it cleanly ensures the thesis artifact follows the clean architecture specified in the PRD while benefiting from previous work.

---

## Question 6
The PRD specifies the **Ground Truth Suite** (20+ TypeScript projects with seeded violations) as a Must-Have. **Should we build the ground truth projects as part of this implementation, or is that a separate effort?**

A) Include ground truth project generation in this build scope
B) Exclude ground truth projects — I'll create those separately; focus on the Firewall tool itself
C) Include a small starter set (5-10 projects) to validate the pipeline; I'll expand to 20+ later
D) Other (please describe after [Answer]: tag below)

[Answer]: C (Include a small starter set 5-10 projects). Rationale: Essential for Phase 1 Validation (H1). You can reuse existing ones from the spike and expand as needed.

---

## Question 7
For the **CLI framework** (ADR-009), the PRD mentions `commander/yargs`. **Do you have a preference?**

A) Commander.js
B) Yargs
C) No preference — pick the best fit
D) Other (please describe after [Answer]: tag below)

[Answer]: A (Commander.js). Rationale: Chosen as the most standard and robust fit for the identified firewall CLI commands.

---

## Question 8: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]: X (Bare Minimum Security). Rationale: As discussed, we will enforce only high-impact rules: Supply Chain (SECURITY-10), Secret Management (SECURITY-12), Injection Prevention (SECURITY-05), and Safe Error Handling (SECURITY-15). Skip all infrastructure/cloud-specific rules.

---
