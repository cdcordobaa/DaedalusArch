# Story-to-Unit Mapping — Architectural Firewall

## Summary

| Unit | Stories | Must | Should | Total |
|------|---------|------|--------|-------|
| U0: Infrastructure | 0 | 0 | 0 | 0 |
| U1: Shared Domain + Validation | 6 | 4 | 2 | 6 |
| U2: APG Extractor | 6 | 6 | 0 | 6 |
| U3: Spec Parser + Compiler | 13 | 10 | 3 | 13 |
| U4: Neo4j Ingestion + Persistence | 12 | 10 | 2 | 12 |
| U5: Router + Eval Paths | 13 | 11 | 1 | 13* |
| U6: Scoring + Reports | 10 | 10 | 0 | 10 |
| U7: CLI + CI/CD | 21 | 19 | 2 | 21 |
| **TOTAL** | **81** | **70** | **10** | **81** |

*US-11.1 and US-11.2 (Verdict Merge) are in U5 since merge logic is tightly coupled with the router's result aggregation, but scoring computation is in U6.

---

## Detailed Mapping

### U0: Infrastructure Scaffolding
No user stories — pure infrastructure setup.

---

### U1: Shared Domain + Validation Set
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-6.1 | Consolidated Violation Types | Must | Epic 6 |
| US-6.2 | Custom Violation Types | Should | Epic 6 |
| US-17.1 | Clean Reference Projects | Must | Epic 17 |
| US-17.2 | Seeded Violation Projects | Must | Epic 17 |
| US-17.3 | Project Manifests | Must | Epic 17 |
| US-17.4 | Usage Examples for Adopters | Should | Epic 17 |

---

### U2: APG Extractor
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-1.1 | Parse TypeScript Project | Must | Epic 1 |
| US-1.2 | Extract Node Types | Must | Epic 1 |
| US-1.3 | Extract Edge Types | Must | Epic 1 |
| US-1.4 | Resolve Complex Imports | Must | Epic 1 |
| US-1.5 | Output APG as JSON | Must | Epic 1 |
| US-1.6 | Report Parse Coverage | Must | Epic 1 |

---

### U3: Spec Parser + Fitness Compiler
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-4.1 | Parse 3-Layer AoC YAML | Must | Epic 4 |
| US-4.2 | Auto-Load Clean Architecture Template | Must | Epic 4 |
| US-4.3 | JSON Schema Validation | Should | Epic 4 |
| US-4.4 | Layer Definitions | Must | Epic 4 |
| US-4.5 | Fitness Function Route Tags | Must | Epic 4 |
| US-4.6 | Semantic Criteria Blocks | Must | Epic 4 |
| US-4.7 | Neuronal Confidence Thresholds | Should | Epic 4 |
| US-5.1 | Multi-Format ADR Parsing | Must | Epic 5 |
| US-5.2 | Dual Rule Production | Must | Epic 5 |
| US-5.3 | Manual AoC YAML Authoring (v1) | Must | Epic 5 |
| US-5.4 | ADR Reference Validation | Should | Epic 5 |
| US-7.1 | Compile to Cypher | Must | Epic 7 |
| US-7.2 | Support 7 Dimensions | Must | Epic 7 |

---

### U4: Neo4j Ingestion + Persistence
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-2.1 | Ingest APG into Neo4j | Must | Epic 2 |
| US-2.2 | Apply Layer Annotations | Must | Epic 2 |
| US-2.3 | Handle Unmapped Files | Must | Epic 2 |
| US-2.4 | Stateless Per-Project Evaluation | Must | Epic 2 |
| US-3.1 | Versioned Snapshots | Must | Epic 3 |
| US-3.2 | Delta APG (Incremental Update) | Must | Epic 3 |
| US-3.3 | Snapshot Storage Model | Must | Epic 3 |
| US-3.4 | Structural Drift Detection | Must | Epic 3 |
| US-3.5 | Coupling Drift Detection | Must | Epic 3 |
| US-3.6 | Convention and Violation Trend Drift | Must | Epic 3 |
| US-3.7 | Drift Reports Between Snapshots | Should | Epic 3 |
| US-3.8 | CI/CD Drift Threshold Alerts | Should | Epic 3 |

---

### U5: Router + Evaluation Paths
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-8.1 | Route Dispatch | Must | Epic 8 |
| US-8.2 | Neuronal Result Tagging | Must | Epic 8 |
| US-8.3 | Symbolic-Only Mode | Must | Epic 8 |
| US-9.1 | Execute Cypher Queries | Must | Epic 9 |
| US-9.2 | Cycle Detection with APOC | Must | Epic 9 |
| US-10.1 | Context Assembly | Must | Epic 10 |
| US-10.2 | Semantic Violation Detection | Must | Epic 10 |
| US-10.3 | Structured Verdict Output | Must | Epic 10 |
| US-10.4 | Configurable LLM Provider | Should | Epic 10 |
| US-10.5 | Determinism Controls | Must | Epic 10 |
| US-10.6 | Multi-Run Reproducibility | Must | Epic 10 |
| US-10.7 | Rubric-Based Evaluation | Must | Epic 10 |
| US-10.8 | Full Audit Logging | Must | Epic 10 |
| US-11.1 | Merge Symbolic and Neuronal Results | Must | Epic 11 |
| US-11.2 | Confidence Calibration | Must | Epic 11 |

---

### U6: Scoring Engine + Reports
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-12.1 | Compute AVR Per Dimension | Must | Epic 12 |
| US-12.2 | Compute AHS (Weighted Complement) | Must | Epic 12 |
| US-12.3 | Universal Health Metrics | Must | Epic 12 |
| US-12.4 | Dual Scoring | Must | Epic 12 |
| US-12.5 | Symbolic-Only Scoring Mode | Must | Epic 12 |
| US-13.1 | JSON Report Output | Must | Epic 13 |
| US-13.2 | Human-Readable Summary | Must | Epic 13 |
| US-13.3 | CSV Batch Output | Must | Epic 13 |
| US-NFR-1 | Deterministic Reproducibility | Must | NFR |
| US-NFR-3 | Detection Accuracy | Must | NFR |

---

### U7: CLI + CI/CD + Pipeline Orchestration
| Story | Title | Priority | Epic |
|-------|-------|----------|------|
| US-14.1 | Single Project Evaluation | Must | Epic 14 |
| US-14.2 | Batch Evaluation | Must | Epic 14 |
| US-14.3 | CLI Flags | Must | Epic 14 |
| US-14.4 | Exit Codes | Must | Epic 14 |
| US-14.5 | Commander.js Framework | Must | Epic 14 |
| US-15.1 | GitHub Action on PR | Must | Epic 15 |
| US-15.2 | PR Comment with Results | Must | Epic 15 |
| US-15.3 | Check Status Based on Verdict | Must | Epic 15 |
| US-15.4 | Manual Trigger | Should | Epic 15 |
| US-15.5 | Neo4j Service Container | Must | Epic 15 |
| US-15.6 | Configurable CI Mode | Should | Epic 15 |
| US-16.1 | Sequential Batch Evaluation | Must | Epic 16 |
| US-16.2 | Batch CSV Output | Must | Epic 16 |
| US-16.3 | Graceful Failure Handling | Must | Epic 16 |
| US-16.4 | Batch Performance | Must | Epic 16 |
| US-NFR-2 | Performance Targets | Must | NFR |
| US-NFR-4 | Resilience | Must | NFR |
| US-NFR-5 | Reproducible Environment | Must | NFR |
| US-NFR-6 | Developer Experience | Must | NFR |

---

## Coverage Verification

- **All 81 stories assigned**: Yes (70 Must + 10 Should + 0 unassigned)
- **All 17 epics represented**: Yes
- **All 6 NFR stories assigned**: Yes (US-NFR-1 and US-NFR-3 in U6, US-NFR-2/4/5/6 in U7)
- **No orphan stories**: Every story maps to exactly one unit
