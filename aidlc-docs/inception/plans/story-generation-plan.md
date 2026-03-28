# Story Generation Plan — Architectural Firewall (DaedalusArch)

## Plan Overview

Generate user stories and personas for the Architectural Firewall product, converting 17 functional requirements (including the new hybrid operational model), 6 non-functional requirements, and 3 methodology requirements into user-centered narratives with testable acceptance criteria.

---

## Execution Checklist

### Part 1: Planning
- [x] Step 1: Validate user stories need (assessment complete)
- [x] Step 2: Collect user input on story approach (questions below)
- [x] Step 3: Analyze answers for ambiguities — no issues found
- [x] Step 4: Get user approval of plan — APPROVED

### Part 2: Generation
- [x] Step 5: Define user personas (`personas.md`)
- [x] Step 6: Generate epic structure (17 epics + NFR stories)
- [x] Step 7: Generate user stories per epic with acceptance criteria (`stories.md`) — 81 stories
- [x] Step 8: Map personas to stories (DEV/ARCH/LEAD per story + summary table)
- [x] Step 9: Verify INVEST criteria compliance
- [x] Step 10: Final review and approval — APPROVED

---

## Story Generation Questions

Please answer the following questions to guide story creation.

---

### Question 1
**What are the primary user personas for the Architectural Firewall?** The requirements suggest several distinct users. Which personas should we define stories for?

A) Three personas: Developer (runs CLI), Architect (writes AoC specs + ADRs), DevOps/Team Lead (configures CI/CD + governance thresholds)
B) Two personas: Developer (runs CLI + writes specs) and Team Lead (configures CI/CD + governance)
C) Four personas: Developer, Architect, Team Lead, and Open Source Contributor (adopts the tool for their own project)
X) Other (please describe after [Answer]: tag below)
[Answer]: A (Developer, Architect, Team Lead)


---

### Question 2
**What story breakdown approach should we use?** This determines how stories are organized and grouped.

A) Epic-based: Group stories under epics matching the pipeline modules (APG Extraction, Ingestion, Spec Parsing, Evaluation, Scoring, CLI, CI/CD, Validation Set)
B) User Journey-based: Group stories by end-to-end workflows (First Setup, Single Evaluation, CI/CD Integration, Drift Monitoring, Batch Evaluation)
C) Persona-based: Group stories by who performs the action (Developer stories, Architect stories, Team Lead stories)
X) Other (please describe after [Answer]: tag below)
[Answer]: A (Epic-based matching pipeline modules)


---

### Question 3
**What level of story granularity do you want?** This affects how many stories we produce and how detailed each one is.

A) Coarse-grained: ~15-20 stories covering major capabilities (1 story per FR or grouped FRs), each with 3-5 acceptance criteria
B) Medium-grained: ~30-40 stories breaking each FR into 2-3 stories, each with 2-4 acceptance criteria
C) Fine-grained: ~50+ stories with one story per sub-requirement (FR-01.1, FR-01.2, etc.), each with 1-2 focused acceptance criteria
X) Other (please describe after [Answer]: tag below)
[Answer]: C (Fine-grained: ~50+ stories, 1 per sub-requirement)


---

### Question 4
**How should acceptance criteria be formatted?** This determines the testing and verification style.

A) Given/When/Then (Gherkin-style) — aligns with BDD methodology (METH-01) and can directly feed feature files
B) Checklist format — simple pass/fail items (e.g., "AHS score is displayed in PR comment")
C) Hybrid — Given/When/Then for complex behavioral flows, checklists for simple verifications
X) Other (please describe after [Answer]: tag below)
[Answer]: A (Gherkin-style Given/When/Then - METH-01 compliant)


---

### Question 5
**Should stories include priority/MoSCoW tags?** This helps with sprint planning and delivery sequencing.

A) Yes — tag each story as Must/Should/Could/Won't to align with PRD MoSCoW scope
B) Yes — but use numeric priority (P0-critical, P1-high, P2-medium, P3-low) instead of MoSCoW
C) No — all stories are Must-Have for v1.0; prioritization happens at Workflow Planning
X) Other (please describe after [Answer]: tag below)
[Answer]: A (MoSCoW - Must/Should/Could/Won't)


---

### Question 6
**How should the neuro-symbolic dual-path be represented in stories?** The symbolic and neuronal paths are architecturally distinct but serve the same user goal (evaluation).

A) Separate stories: Distinct stories for symbolic evaluation and neuronal evaluation, with a third for the combined/merged verdict
B) Single stories with dual acceptance criteria: Each evaluation story has both "symbolic path produces X" and "neuronal path produces Y" criteria
C) Mode-based stories: Stories for `--symbolic-only` mode vs full neuro-symbolic mode as separate user journeys
X) Other (please describe after [Answer]: tag below)
[Answer]: A (Separate stories: Symbolic, Neuronal, Merged Verdict)


---

### Question 7
**Should we include stories for the development methodology (BDD/TDD/DDD)?** METH-01 through METH-03 define how code is built, not what users interact with.

A) Yes — include "As a contributor..." stories for development workflow (feature files first, TDD cycle, domain model adherence)
B) No — methodology requirements are developer constraints, not user stories. Reference them as non-functional constraints in relevant stories
C) Include only a DDD story for ubiquitous language (ensuring the product uses consistent terminology for users)
X) Other (please describe after [Answer]: tag below)
[Answer]: B (Methodology handled as constraints on every story)


---

### Question 8
**How should the "Stateless vs. Persistent" choice be represented in user stories?**
This determines how users interact with the tool's memory and drift-detection capabilities.

A) **Implicit Capability**: One core "Evaluation" story with acceptance criteria covering both fresh runs and persistent/incremental updates.
B) **Separate User Journeys**: Parallel stories for "One-off Benchmark" (Stateless) and "Ongoing Architectural Monitoring" (Persistent).
C) **Feature-focused**: A specific story for "Configuring project snapshots and drift thresholds."
X) Other (please describe after [Answer]: tag below)
[Answer]: B (Separate User Journeys: Stateless Benchmarking vs. Persistent Monitoring)


---
