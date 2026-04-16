# User Personas — Architectural Firewall (DaedalusArch)

---

## Persona 1: Developer (DEV)

**Name**: Dana — Senior TypeScript Developer
**Role**: Individual contributor on a product team
**Experience**: 3-7 years writing TypeScript, familiar with clean architecture concepts but not an architecture specialist

### Goals
- Get fast, actionable feedback on architectural compliance before opening a PR
- Understand *what* violated and *where* — not just a score
- Run evaluations locally during development to catch issues early
- Trust the tool's output enough to fix violations without manual review

### Pain Points
- Architectural drift happens silently — no feedback until code review
- Manual architecture reviews are slow and inconsistent across reviewers
- Existing linters catch syntax issues but miss structural/coupling violations
- Doesn't know all the ADRs by heart — needs the tool to enforce them

### Key Interactions
- Runs `firewall evaluate` from the CLI during development
- Reads PR comments posted by the GitHub Action
- Fixes violations flagged in reports
- Uses `--symbolic-only` for fast local checks, full neuro-symbolic in CI

### Success Metrics
- Time from evaluation to understanding what to fix: < 30 seconds
- False positives rare enough to maintain trust (precision >= 90%)

---

## Persona 2: Architect (ARCH)

**Name**: Alex — Software Architect / Tech Lead
**Role**: Defines architectural decisions, writes ADRs, designs system structure
**Experience**: 8+ years, deep knowledge of design patterns, SOLID principles, clean architecture

### Goals
- Encode architectural decisions as enforceable specs (AoC YAML)
- Define fitness functions that capture both structural rules and semantic intent
- Monitor architectural health trends across the project over time
- Ensure ADR compliance is measurable, not just aspirational

### Pain Points
- Writes ADRs that developers forget or misinterpret
- No quantitative way to measure architectural compliance
- Semantic violations (naming coherence, abstraction quality) escape graph queries
- Architectural drift is invisible until it's too late

### Key Interactions
- Authors AoC YAML specs (Layer A model, Layer B fitness functions, Layer C weights)
- Writes `semantic_criteria` blocks with rules and rubrics for neuronal evaluation
- References ADRs via `adr_ref` in fitness functions
- Reviews drift reports between snapshots
- Configures scoring weights to reflect project priorities
- Runs batch evaluations across the validation set

### Success Metrics
- AoC spec captures all architectural decisions from ADRs
- Drift detection catches degradation within 1-2 PRs
- AHS trends correlate with perceived architectural health

### v1.1 Additions — Demo Presenter
Alex also presents the architectonic firewall to stakeholders, thesis evaluators, and potential adopters.

**Demo-Specific Goals**:
- Show end-to-end value in under 5 minutes: skill → spec → evaluation → interactive report
- Produce a self-contained HTML dashboard that can be shared via email/Slack
- Demonstrate the tool working on a real open-source repo, not just test fixtures
- Show both symbolic and neuronal evaluation results side-by-side

**Demo-Specific Interactions**:
- Runs Claude Code skill on a target repo to generate spec
- Opens generated HTML report in browser to walk through findings
- Filters violations by severity/dimension during live demo
- Shows architecture graph with layer coloring and violation highlighting
- Explains baseline vs new violations for brownfield adoption story

---

## Persona 3: Team Lead (LEAD)

**Name**: Taylor — Engineering Manager / Team Lead
**Role**: Responsible for team delivery, code quality gates, CI/CD governance
**Experience**: 5+ years in engineering leadership, manages 4-8 developers

### Goals
- Automate architectural compliance as a CI/CD gate on every PR
- Configure governance thresholds (what blocks a PR vs. what warns)
- Get high-level health scores without reading every violation detail
- Ensure consistent enforcement across the team — no "it depends on the reviewer"

### Pain Points
- Architecture reviews are bottlenecked on 1-2 senior people
- No objective way to set merge criteria for architectural quality
- Different reviewers have different standards
- Wants to balance velocity (don't block too aggressively) with quality (don't let drift accumulate)

### Key Interactions
- Configures GitHub Action workflow (thresholds, symbolic-only vs full, blocking rules)
- Sets AHS threshold for PR blocking (e.g., block if AHS < 0.70)
- Reviews PR comments for verdict (hard block / soft block / warning / pass)
- Monitors drift reports and violation trends across releases
- Overrides soft blocks when business urgency justifies it
- Runs batch evaluations to compare team health across projects

### Success Metrics
- PR merge decisions are objective and automated
- Architectural debt accumulation slows measurably
- Team spends less time on manual architecture reviews

---

## Persona-Story Mapping Summary

| Persona | Primary Epics | Interaction Mode |
|---------|--------------|------------------|
| DEV | CLI, Evaluation (Symbolic + Neuronal), Violation Reports | CLI local + PR comments |
| ARCH | Spec Parsing, Fitness Compiler, Drift Detection, Scoring, Validation Set | AoC YAML authoring + drift reports |
| LEAD | CI/CD Integration, Verdict Merge, Scoring, Drift Detection | GitHub Action config + PR verdicts |

---

## Methodology Constraints (Apply to All Stories)

Per user decision (Q7: B), development methodology requirements are not standalone stories but apply as constraints:

- **METH-01 (BDD)**: Every story's acceptance criteria must be expressible as Gherkin Given/When/Then scenarios that can directly feed `.feature` files
- **METH-02 (TDD)**: Implementation of every story follows Red-Green-Refactor; tests written before production code
- **METH-03 (DDD)**: All stories use ubiquitous language (APG, AoC, AVR, AHS, fitness function, dimension, layer, violation, symbolic, neuronal, hybrid, verdict); domain objects are rich, not anemic
