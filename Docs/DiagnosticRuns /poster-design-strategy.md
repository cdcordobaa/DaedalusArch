# Thesis Poster Design Strategy

## Layout: "Hero Center" with Administrative Wings

3-column layout with central hero zone (~50%) flanked by context wings (~25% each) and a bottom administrative strip (~15% height).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 4px gradient accent bar (blue→purple→green) ▓▓▓ │
├─────────────────────────────────────────────────────────────────────────────┤
│                         HEADER BAR (~8% height)                           │
│  [Shield]   Architectural Governance for AI-Assisted Development   [QR]   │
│             A Spec-Driven Neuro-Symbolic Framework                        │
│             Cristian D. Cordoba · Dir: Andrés Arévalo · UNAL              │
├────────────────┬────────────────────────────────┬───────────────────────── ┤
│                │                                │                         │
│  LEFT COLUMN   │      CENTER COLUMN (HERO)      │     RIGHT COLUMN        │
│  ~24% width    │      ~52% width                │     ~24% width          │
│                │                                │                         │
│ ┌────────────┐ │ ┌────────────────────────────┐ │ ┌───────────────────┐   │
│ │THE VERIFI- │ │ │                            │ │ │  METHODOLOGY      │   │
│ │CATION GAP  │ │ │   SOLUTION ARCHITECTURE    │ │ │  [DSR] [Quasi-exp]│   │
│ │            │ │ │                            │ │ │  [Quantitative]   │   │
│ │ ╱ blue     │ │ │  ┌─────┐    ┌──────┐      │ │ │                   │   │
│ │╱  line     │ │ │  │ AoC │───▶│Cypher│      │ │ │  Worldview: ...   │   │
│ │  ↗ GAP     │ │ │  │YAML │    │Comp. │      │ │ │  Language: TS     │   │
│ │ ╱ orange   │ │ │  └─────┘    └──┬───┘      │ │ │  Stack: ts-morph  │   │
│ │╱  line     │ │ │  ┌─────┐    ┌──▼───┐  ┌──┐│ │ │    + Neo4j        │   │
│ │            │ │ │  │ TS  │───▶│ APG  │─▶│CG││ │ └───────────────────┘   │
│ │ [80%][9×]  │ │ │  │Code │    │Neo4j │  │  ││ │                         │
│ │ [Review]   │ │ │  └─────┘    │L1-L5 │  │  ││ │ ┌───────────────────┐   │
│ └────────────┘ │ │             └──────┘  └┬─┘│ │ │VALIDATION STRATEGY│   │
│                │ │                  ┌─────▼┐ │ │ │                   │   │
│ ┌────────────┐ │ │                  │ PASS │ │ │ │ ┌───────────────┐ │   │
│ │ SPECIFIC   │ │ │                  │BLOCK │ │ │ │ │Phase 1: Instr.│ │   │
│ │ OBJECTIVES │ │ │                  │ AHS  │ │ │ │ │Validation     │ │   │
│ │            │ │ │                  └──────┘ │ │ │ │(teal card)    │ │   │
│ │ SO1 [●]───┐│ │ └────────────────────────────┘ │ │ └───────────────┘ │   │
│ │     ↓     ││ │                                │ │ ┌───────────────┐ │   │
│ │ SO2 [●]───┤│ │ ┌────────────────────────────┐ │ │ │Phase 2: Fact. │ │   │
│ │     ↓     ││ │ │  EVALUATION DIMENSIONS     │ │ │ │Benchmark      │ │   │
│ │ SO3 [●]───┤│ │ │  ┌──────────────────────┐  │ │ │ │(indigo card)  │ │   │
│ │     ↓     ││ │ │  │    ◇ Structural      │  │ │ │ └───────────────┘ │   │
│ │ SO4 [●]───┘│ │ │  │   ╱ ╲    (T1)       │  │ │ │ ┌───────────────┐ │   │
│ │            │ │ │  │  ◇   ◇ Pattern(T1)  │  │ │ │ │Phase 3: Dev.  │ │   │
│ │ ┊DSR ──SO3│ │ │  │  │ ◈ │ Conv.(T1)    │  │ │ │ │Study          │ │   │
│ │ ┊Eval──SO4│ │ │  │  ◇   ◇ Testab.(T2)  │  │ │ │ │(green card)   │ │   │
│ │            │ │ │  │   ╲ ╱  Complex.(T2) │  │ │ │ └───────────────┘ │   │
│ └────────────┘ │ │  │    ◇ Evolvab.(T2)   │  │ │ │  ···▲Triangulate  │   │
│                │ │  │  ■ Compliant         │  │ │ └───────────────────┘   │
│                │ │  │  ■ Non-compliant     │  │ │                         │
│                │ │  └──────────────────────┘  │ │ ┌───────────────────┐   │
│                │ │  (dark background card)     │ │ │  HYPOTHESES       │   │
│                │ └────────────────────────────┘ │ │  H1 Precision/cov │   │
│                │                                │ │  H2 Failure patt. │   │
│                │                                │ │  H3 Spec quality  │   │
│                │                                │ │  H4 APG > AST     │   │
│                │                                │ │  H5 Testability   │   │
│                │                                │ └───────────────────┘   │
├────────────────┴────────────────────────────────┴────────────────────────  ┤
│                       FOOTER STRIP (~15% height)                          │
│  ┌──────────────────┐  │  ┌───────────────┐  │  ┌──────────────────────┐  │
│  │  TIMELINE        │  │  │    BUDGET      │  │  │  KEY REFERENCES      │  │
│  │  (Gantt bars)    │  │  │  (donut chart) │  │  │  (6 citations)       │  │
│  │  13 weeks        │  │  │  134.4M COP    │  │  │                      │  │
│  │  SO1 ████        │  │  │    ┌───┐       │  │  │  DORA (2025)         │  │
│  │  SO2 █████       │  │  │   │72% │       │  │  │  Faros AI (2025)     │  │
│  │  SO3   █████     │  │  │   │14% │       │  │  │  GitClear (2024)     │  │
│  │  SO4-C   ███     │  │  │   │12% │       │  │  │  Slater (2025)       │  │
│  │  SO4-1    ███    │  │  │   │ 2% │       │  │  │  Ford/Richards(2025) │  │
│  │  SO4-2      ████ │  │  │    └───┘       │  │  │  Hevner et al.(2004) │  │
│  │  ◆S4 ◆S8 ◆S10◆13│  │  │               │  │  │                      │  │
│  └──────────────────┘  │  └───────────────┘  │  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Color System

| Token | Hex | Usage |
|-------|-----|-------|
| Blue primary | `#2563EB` | Inputs, SO1, SO2 |
| Blue light | `#3B82F6` | Secondary blue elements |
| Blue fill | `#DBEAFE` | Light blue card backgrounds |
| Purple primary | `#7C3AED` | Processing, SO3 |
| Purple light | `#8B5CF6` | Secondary purple elements |
| Purple fill | `#EDE9FE` | Light purple card backgrounds |
| Green primary | `#059669` | Outputs, SO4, validation |
| Green light | `#10B981` | Secondary green elements |
| Green fill | `#D1FAE5` | Light green card backgrounds |
| Danger | `#DC2626` | Problems, violations |
| Danger fill | `#FEE2E2` | Light red backgrounds |
| Dark text | `#1F2937` | Headings, body text |
| Secondary text | `#6B7280` | Captions, metadata |
| Card border | `#E5E7EB` | 1px card borders |
| Radar bg | `#1F2937` | Dark card for radar chart |
| Phase 1 | `#0891B2` | Teal — instrument validation |
| Phase 2 | `#4F46E5` | Indigo — factorial benchmark |
| Phase 3 | `#059669` | Emerald — developer study |

---

## Section-by-Section Content Specification

### HEADER BAR (full width, ~8% height)

```
[Shield icon]                                                          [QR placeholder]
         Architectural Governance for AI-Assisted Development
              A Spec-Driven Neuro-Symbolic Framework
   Cristian D. Cordoba Aguirre · Dir: Andrés R. Arévalo Murillo
        Universidad Nacional de Colombia · Ing. Sistemas
              Master's Thesis Proposal
```

- 4px gradient accent stripe at very top edge: `#2563EB` → `#7C3AED` → `#059669`
- Title: bold, largest text on poster (~24pt equivalent)
- Subtitle: lighter weight, slightly smaller
- Author/affiliation: small, secondary text color

---

### LEFT COLUMN — "The Why" (~24% width)

#### Box 1: THE VERIFICATION GAP

```
┌─────────────────────────────────┐
│  THE VERIFICATION GAP           │
│  ━━━━━━ (red underline bar)     │
│                                 │
│  Code Volume                    │
│  ▲                              │
│  │        ╱ AI Code Generation  │
│  │      ╱   (+98% PR volume)    │
│  │    ╱                         │
│  │  ╱  ← THE GAP (pink fill)   │
│  │╱____________________________│
│  │  ── Verification Capacity    │
│  │     (+21% task completion)   │
│  └──────────────────── Time ▶   │
│                                 │
│  (Faros AI, 2025)               │
│                                 │
│  [80% boundary] [9× churn] [Review bottleneck]
│   violations      increase    U-shaped curve
│   (Slater '25)  (GitClear '24) (LinearB '25)
│                                 │
│  "No existing benchmark         │
│   measures architectural        │
│   compliance"                   │
└─────────────────────────────────┘
```

#### Box 2: SPECIFIC OBJECTIVES

```
┌─────────────────────────────────┐
│  SPECIFIC OBJECTIVES            │
│  ━━━━━━ (blue underline bar)    │
│                                 │
│  ┌─[SO1]─────────────────┐     │
│  │ AoC Specification      │  ┐  │
│  │ YAML schema + templates │  │  │
│  └────────────┬───────────┘  │  │
│               ↓              │  │
│  ┌─[SO2]─────────────────┐  │  │
│  │ APG Pipeline            │ DSR │
│  │ ts-morph → Neo4j (5L)   │  │  │
│  └────────────┬───────────┘  │  │
│               ↓              │  │
│  ┌─[SO3]─────────────────┐  │  │
│  │ Conformance Gate        │  ┘  │
│  │ Cypher compiler + AHS   │     │
│  └────────────┬───────────┘     │
│               ↓             Eval │
│  ┌─[SO4]─────────────────┐  ┘  │
│  │ Empirical Validation    │     │
│  │ 3-phase quasi-experiment│     │
│  └────────────────────────┘     │
└─────────────────────────────────┘
```

- SO1, SO2: blue `#2563EB` badge
- SO3: purple `#7C3AED` badge
- SO4: green `#059669` badge
- Right bracket: "DSR Cycle" spans SO1–SO3, "Eval" spans SO4

---

### CENTER COLUMN — "The What" / HERO (~52% width)

#### Box 3: SOLUTION ARCHITECTURE (the star — ~60% of center column)

```
┌──────────────────────────────────────────────────────────────────┐
│  SOLUTION ARCHITECTURE                                           │
│  ━━━━━━ (purple underline bar)                                   │
│                                                                  │
│  ┌──────────────┐                           ┌──────────────────┐ │
│  │ AoC Spec     │    ┌──────────┐           │ Conformance Gate │ │
│  │ (YAML)       │───▶│  Cypher  │──┐        │ ────────────────│ │
│  │              │    │ Compiler │  │        │ Scoring Engine   │ │
│  │ A: Arch Model│    └──────────┘  │        │ 6 Eval Dimens.  │ │
│  │ B: Fitness F.│                  ├───────▶│                  │ │
│  │ C: Scoring W.│                  │        │  ┌────────────┐  │ │
│  └──────────────┘                  │        │  │ PASS/BLOCK │  │ │
│                     ┌────────────┐ │        │  │  (green)   │  │ │
│  ┌──────────────┐   │    APG     │─┘        │  └────────────┘  │ │
│  │ TypeScript   │──▶│  (Neo4j)   │          │                  │ │
│  │ Source Code  │   │            │          │ AHS Score +      │ │
│  │              │   │ L1 Files   │          │ Violation Report │ │
│  │ ts-morph     │   │ L2 Decls   │          └──────────────────┘ │
│  │ extraction   │   │ L3 Deps    │                               │
│  └──────────────┘   │ L4 Annot.  │                               │
│                     │ L5 Violat. │                               │
│      BLUE           └────────────┘    PURPLE          GREEN      │
│     inputs              PURPLE                       outputs     │
└──────────────────────────────────────────────────────────────────┘
```

- Input boxes: `#2563EB` blue with white text
- APG cylinder + Cypher Compiler: `#7C3AED` purple
- Conformance Gate: `#5B21B6` dark purple
- PASS/BLOCK badge: `#059669` green
- Arrows: dark gray `#374151`

#### Box 4: EVALUATION DIMENSIONS (~40% of center column)

```
┌──────────────────────────────────────────────────────────────────┐
│  EVALUATION DIMENSIONS                                           │
│  ━━━━━━ (purple underline bar)                                   │
│                                                                  │
│  ┌────────────────────────── dark card #1F2937 ───────────────┐  │
│  │                                                             │  │
│  │              Structural [T1]                                │  │
│  │                  ◆                                          │  │
│  │   Evolvab. ◆╱     ╲◆ Pattern                               │  │
│  │    [T2]   ╱  ■ ◈    ╲  [T1]                                │  │
│  │          ╱    ╲  ╱    ╲                                     │  │
│  │  Complex.◆─────◆─────◆ Convention                          │  │
│  │    [T2]        Testability [T2]   [T1]                      │  │
│  │                                                             │  │
│  │   ■ Compliant (blue polygon)                                │  │
│  │   ◈ Non-compliant (red polygon)                             │  │
│  │                                                             │  │
│  │   6 Core Dimensions · T1: Fully Static | T2: Proxy Static  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- Dark background card: `#1F2937`
- Blue polygon: `#3B82F6` semi-transparent
- Red polygon: `#DC2626` semi-transparent
- T1 badges: blue `#2563EB`
- T2 badges: purple `#7C3AED`

---

### RIGHT COLUMN — "The How" (~24% width)

#### Box 5: METHODOLOGY

```
┌─────────────────────────────────┐
│  METHODOLOGY                    │
│  ━━━━━━ (green underline bar)   │
│                                 │
│  [DSR] [Quasi-exp] [Quant.]    │
│   (3 rounded badges)            │
│                                 │
│  Worldview   Pragmatism +       │
│              Post-positivism    │
│  Scope       Explanatory +      │
│              descriptive        │
│  Language    TypeScript          │
│              (greenfield only)  │
│  Stack       ts-morph + Neo4j   │
│              + Cypher           │
└─────────────────────────────────┘
```

#### Box 6: VALIDATION STRATEGY

```
┌─────────────────────────────────┐
│  VALIDATION STRATEGY            │
│  ━━━━━━ (green underline bar)   │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Phase 1 (teal #0891B2)  │    │
│  │ INSTRUMENT VALIDATION   │    │
│  │ · Golden dataset        │    │
│  │ · Seeded violations     │    │
│  │ · Threshold calibration │    │
│  │ → Precision, Recall, F1 │    │
│  └────────────┬────────────┘    │
│               ↓                 │
│  ┌─────────────────────────┐    │
│  │ Phase 2 (indigo #4F46E5)│    │
│  │ FACTORIAL BENCHMARK     │    │
│  │ · 3 LLMs × 3 spec lvls │    │
│  │ · Two-factor ANOVA      │    │
│  │ → Failure taxonomy      │    │
│  └────────────┬────────────┘    │
│               ↓                 │
│  ┌─────────────────────────┐    │
│  │ Phase 3 (green #059669) │    │
│  │ DEVELOPER STUDY         │    │
│  │ · Treatment vs Control  │    │
│  │ · Naturalistic ground   │    │
│  │   truth                 │    │
│  │ → Practical impact      │    │
│  └─────────────────────────┘    │
│                                 │
│  ···· ▲ Triangulation ····      │
│  (dotted lines to all 3 cards)  │
└─────────────────────────────────┘
```

#### Box 7: HYPOTHESES

```
┌─────────────────────────────────┐
│  HYPOTHESES                     │
│  ━━━━━━ (gray underline bar)    │
│                                 │
│  H1  Detection precision,      │
│      coverage, score validity   │
│  H2  Systematic failure         │
│      patterns across LLMs      │
│  H3  Formal specs → higher     │
│      detection accuracy         │
│  H4  Full APG > AST-only       │
│  H5  Structural compliance     │
│      ≠ testability              │
└─────────────────────────────────┘
```

---

### FOOTER STRIP (full width, ~15% height)

3 zones separated by thin vertical lines:

#### Footer Left (40%): TIMELINE · 13 Weeks

```
┌────────────────────────────────────────────────────┐
│  TIMELINE · 13 Weeks                               │
│                                                    │
│  S1  S2  S3  S4  S5  S6  S7  S8  S9  S10 S11 S12 S13
│  SO1 ████████████                                  │
│  SO2 ██████████████                                │
│  SO3             ██████████████████                │
│  SO4-C                ██████████                    │
│  SO4-P1                       ██████████           │
│  SO4-P2                               ████████████ │
│       ◆         ◆              ◆              ◆    │
│     AoC+APG   Gate E2E     GO/NO-GO       Delivery │
└────────────────────────────────────────────────────┘
```

- SO1, SO2 bars: blue `#2563EB`, `#3B82F6`
- SO3 bar: purple `#7C3AED`
- SO4 bars: green `#059669`, `#10B981`, `#047857`
- Milestones: diamond markers at S4, S8, S10, S13

#### Footer Center (30%): BUDGET · 134.4M COP

```
┌────────────────────────────┐
│  BUDGET · 134.4M COP       │
│                            │
│        ┌────────┐          │
│       ╱ 72%     ╲          │
│      │Researcher │         │
│      │  134.4M   │         │
│      │   COP     │         │
│       ╲ 14.4%   ╱          │
│        └────────┘          │
│                            │
│  ■ Researcher (72%)        │
│  ■ Industry (14.4%)        │
│  ■ University (12%)        │
│  ■ Cloud (1.6%)            │
└────────────────────────────┘
```

- Donut chart with total in center
- Researcher: `#2563EB`, Industry: `#7C3AED`, University: `#0891B2`, Cloud: `#059669`

#### Footer Right (30%): KEY REFERENCES

```
┌────────────────────────────┐
│  KEY REFERENCES             │
│                            │
│  DORA (2025)               │
│  Faros AI (2025)           │
│  GitClear (2024)           │
│  Slater (2025)             │
│  Ford & Richards (2025)    │
│  Hevner et al. (2004)      │
└────────────────────────────┘
```

---

## Design Principles

1. **Color coding by SO** — consistent colors across objectives, timeline, architecture, validation
2. **One number per block** — 98% PR growth, 6 dimensions, 30+ rules, < 5 sec/project, 90+ corpus
3. **Z-shaped read path** — title → problem (top-left) → solution (center) → validation (right) → admin (bottom)
4. **Text density rule** — if >5 lines of prose, replace with a visual
5. **3-second test** — "AI generates code too fast to review → instrument checks it via graph → validated in 3 phases"
6. **Card style** — rounded corners (8px), 1px `#E5E7EB` border, subtle drop shadow
7. **Section headers** — ALL CAPS, bold, colored underline bar matching section theme
8. **Typography** — sans-serif (Inter/Helvetica), `#1F2937` dark for body, `#6B7280` for captions
9. **Accent** — thin gradient stripe at top edge only (blue→purple→green)

## Generated Assets Inventory

| # | Asset | File | Role in Layout |
|---|-------|------|----------------|
| 1 | Architecture pipeline (hero) | `poster-architecture-hero-v3.png` | Center — Box 3 |
| 2 | Verification gap (problem) | `poster-verification-gap.png` | Left — Box 1 |
| 3 | Radar chart (6 dimensions) | `poster-radar-dimensions.png` | Center — Box 4 |
| 4 | Validation phases (3 cards) | `poster-validation-phases.png` | Right — Box 6 |
| 5 | Objectives flow (SO1-SO4) | `poster-objectives-flow.png` | Left — Box 2 |
| 6 | Timeline Gantt (13 weeks) | `poster-timeline-gantt.png` | Footer left |
| 7 | Budget donut chart | `poster-budget-pie.png` | Footer center |
| 8 | Full poster composite v1 | `poster-full-v1.png` | Full layout draft |
| 9 | Full poster composite v2 | `poster-full-v2.png` | Full layout refined |
