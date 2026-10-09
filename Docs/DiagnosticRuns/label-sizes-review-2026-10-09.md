# Label-size review (Fable, 2026-10-09, after PR #26)

Verdict: CONDITIONAL. The machinery is correct: a two-stage draw, Horvitz–Thompson weights, an order-blinded audit and a weighted item bootstrap. The registered sizes do not support all their claims. Dispositions are in ADR-021 item 8.

- **Blocking 1:** P3 has 10 items across about 54 cells × functions. That gives wrong per-cell FPAT values; aggregate.ts:553 and :685 write 0 or an inflated value into the SO5 permutation tests.
- **Blocking 2:** P1 + MS ≤ 59 is an unsupported projection. If it overflows, ceilingsFor refuses the plan, and every labelled output disappears at once.
- **Major 3:** the precision statement uses the wrong n (46 rather than 36 for the E1 headline) and ignores the Kish effective n. P2's equal allocation maximises weight variance.
- **Major 4:** κ and AC1 have no interval.
- **Major 5:** the audit seed is not registered.
- **Minor 6:** the labeller context is smaller than the judge's, an information asymmetry. Cut by kind.
- **Minor 7:** the budget counts logical calls, not agy attempts.
- **Minor 8:** the audit is blind only procedurally. It is drawn after the labels and excludes uncertain items.

What holds: the inclusion probabilities, consistent 1/p in every consumer, de-duplication, the lowering order, the Wilson arithmetic, the Kish-Wilson baseline precision, and an audit view with no label fields.
