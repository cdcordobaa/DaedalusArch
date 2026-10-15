# F2-graph-fidelity-classes (plain set)

**Slide claim.** Every place where the tool’s map and the TypeScript compiler disagree has a known, harmless cause; none is unexplained, and the one fixable cause (re-exports through index files) was fixed.

**NUMBERS.md rows used.**
- Graph fidelity: "39 (11 + 28)", E1 disagreements vs tsc, all re-export/barrel.
- Graph fidelity: "218 (80 + 138), 202, 329, 2; total 751", SO4 vs tsc by class.
- Graph fidelity: "0 / 0", unexplained disagreements.
- Graph fidelity: "0.996684 (99.7%)" (E1 share of tsc edges found) and "0.966302 (96.6%)" (SO4, scoped).
- Graph fidelity: "Jaccard 0.3962 → 1.0000; 0.9435 → 1.0000", the two disagreeing E1 cells after the barrel fix.

**Notes.**
- The dependency-cruiser comparison of the original F2 is left out: the slide claim rests on the compiler comparison.
