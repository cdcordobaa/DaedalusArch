# Unit of Work Plan — Architectural Firewall (DaedalusArch)

## Plan Overview

Decompose the system into ordered units of work for the Construction Phase. Each unit will go through: Functional Design -> NFR Requirements -> NFR Design -> Infrastructure Design -> Code Generation.

---

## Execution Checklist

### Part 1: Planning
- [x] Step 1: Analyze application design context
- [x] Step 2: Collect user input on decomposition (questions below)
- [x] Step 3: Analyze answers for ambiguities
- [x] Step 4: Get user approval of plan — APPROVED

### Part 2: Generation
- [x] Step 5: Generate unit-of-work.md — 8 units (U0-U7)
- [x] Step 6: Generate unit-of-work-dependency.md — dependency matrix + critical path
- [x] Step 7: Generate unit-of-work-story-map.md — all 81 stories mapped
- [x] Step 8: Validate completeness and get final approval — APPROVED

---

## Unit Decomposition Questions

The Application Design defines 11 components (C1-C11) and 6 services (S1-S6). These need grouping into construction units.

---

### Question 1
**How should components be grouped into units of work?** Each unit goes through the full Construction loop (Functional Design -> Code Gen).

A) One unit per component — 11 units (C1 through C11), each built independently. Maximum granularity but more overhead.
B) Logical groupings — ~6-7 units grouping related components (e.g., C3+C4 Spec+Compiler, C5+C6+C7 Router+Eval+Critic, C8+S6 Scoring+Reports). Balanced.
C) Pipeline-phase groupings — 4 large units: Ingestion (C1+C2+C3), Compilation+Routing (C4+C5), Evaluation (C6+C7), Scoring+Output (C8+C9). Fewer units but each is larger.
X) Other (please describe after [Answer]: tag below)

[Answer]: B (Logical groupings)

---

### Question 2
**What should the build order be?** Units have dependencies — the order determines what's built first.

A) Bottom-up — start with Shared Domain (C10/C11), then foundation modules (C1, C3), then dependent modules. Most testable at each step.
B) End-to-end slice — build a thin vertical slice through the entire pipeline first (extract -> ingest -> compile -> evaluate -> score -> CLI for 1 fitness function), then widen. Earliest working demo.
C) Risk-first — start with the highest-risk components (C7 LLM Critic, C5 Router) to validate the neuro-symbolic architecture early, then fill in surrounding modules.
X) Other (please describe after [Answer]: tag below)

[Answer]: A (Bottom-up)

---

### Question 3
**Should infrastructure (Docker Compose, GitHub Action) be its own unit or bundled with the last functional unit?**

A) Separate infrastructure unit — Docker Compose + GitHub Action + CI workflow as their own unit of work at the end
B) Bundled — Docker Compose with Neo4j Ingestion (C2), GitHub Action with CLI (C9)
C) Infrastructure first — set up Docker Compose and project scaffolding as Unit 0 before any functional units
X) Other (please describe after [Answer]: tag below)

[Answer]: C (Infrastructure first)

---

### Question 4
**How should the validation set (FR-17, sample projects) be handled?**

A) Separate unit at the end — build 5-10 sample projects + manifests as the final unit, after all modules work
B) Incremental — add 1-2 sample projects per unit as you build modules, growing the validation set organically
C) First unit — create the validation set first as golden test data, then build modules to pass against it (true TDD at system level)
X) Other (please describe after [Answer]: tag below)

[Answer]: C (First unit — Golden tests)

---

---
