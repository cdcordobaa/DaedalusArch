# REV-03: adversarial review of `ops/notes/s2d-01-study2-drift-design.md`

**Reviewer:** Fable (adversarial lens), 2026-10-18. Read-only, no model calls, no sealed read. The note's dates are ignored; the design is judged as it would run after `ops/03-build-list.md`.

## Verdict

The design answers REV-01 finding 1 better than expected: D is a sum, not a slope, it leaves out step 1, and it was already a registered secondary. It is still not defensible as written. The power claim rests on three Opus-by-hand values and will be re-based on one task; the primary measures propagation of an inherited step-1 pattern and must be named so; and the promotion, the new fallback and the dropped H3 are protocol changes that need a dated deviation and a new protocol line, not a design note.

## Findings, by severity

**1. The base rate is three hand-written trajectories, and the pilot replaces them with one task.**
Claim (§3): mean 2.67, θ 4.27, power 1.00 / 0.79 / 0.19 at 32 blocks. Why it fails: 1, 2, 5 recompute exactly from `results/v1.3-floor-probe/{market-vendors,youth-league,hive-health}/none/step-0*.json`, but market-vendors has four steps (its k = 5 value is extrapolated), all three are one Opus session by hand (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` §6), and the task-to-task spread is 5×. θ from three points is not an estimate, and the NB tail is wrong in kind: D is bounded by the number of new slices. The pilot bar (§4) then re-bases power on 6 runs of **one** Layered task (ice-rink × 3 × 2 generators), so between-task variance, the dominant component in probe 1, is never measured before registration. Fix: pilot two Layered tasks (a probe-1 task is admissible for a base rate); set bar 2 to the pilot mean's one-sided 80 % lower bound; register power as a band over θ ∈ {1, 4, ∞}; state the MDE as "RR ≤ 0.25 only" and keep the RR 0.5 figure out of any headline.

**2. The promotion and the fallback are protocol changes recorded outside the protocol.**
Claim (§1, §4): promoting a secondary "is a smaller move"; the exploratory fallback "is declared as part of the M3 deviation". Why it fails: nine documents carry the identical `study2-protocol` line (`primary=Y…; k=4; fallback=do-not-run; generators=…,codex-pin`) that `scripts/v1.3/protocol-consistency-check.mjs` enforces; the note changes primary, k, cells, fallback and generators and carries no line. Gate rule 1 (`Docs/v1.3/study2-readiness-gate.md:20`) forbids relaxing a criterion after pilot numbers are seen; `do-not-run → run as exploratory` is such a relaxation. The promotion itself is defensible, because probe 1 §5 item 3 proposed this outcome on 2026-10-16 before the level decision and the deviation registered it as a secondary; the note does not cite that trail. One misstatement weakens §2's disclosure: the tool arm did not "have D = 0". Probe 1 §2.3 built its later steps with `scripts/xform_*.py` under a stated assumption. D = 0 there is constructed, not observed. Fix: a second dated deviation with a new protocol block, the probe-1 §5.3 citation, the list of what had been seen, the tool-arm sentence corrected, and the fallback decided there: keep `do-not-run`, or declare the relaxation and its reason.

**3. D measures propagation of an inherited pattern, conditional on the pattern existing.**
Claim (§2): D is "drift from a common state". Why it fails: in probe 1 every post-step-1 identity was a step-1 habit copied into a new slice (`floor-probe` §3.3). With a shared start, D per cell is "how many new slices copy the inherited pattern"; a block whose step-1 tree has Y₁ = 0 contributes 0 in every cell and only dilutes the sign-flip, and Sonnet's and Gemini's step-1 habits are unmeasured (finding 6). A second mediator: the `mcp` agent can see inherited violations (`check_file`, `check_import`) and repair them before adding slices, so D = 0 can arrive through repair, the mechanism the `gate` arm was dropped for. Fix: name the construct "propagation of inherited blocking patterns to new slices"; add "≥ 4 of 6 step-1 trees with Y₁ ≥ 1" to the pilot bar; register D per new slice and D conditioned on no inherited removal as secondaries; report the Y₁ = 0 block count as a falsifier.

**4. Dropping H3 leaves "delivered" and "checked" confounded, and the substitute is not a test.**
Claim (§8): "H1 rejected and none@L3 ≈ mcp@L2" reads as spec delivery. Why it fails: `mcp@L2` includes `get_architecture_spec` and `which_layer` (`Docs/v1.3/study2-outline-v2.md:90`), which deliver more than L3's sentences, so H2 is delivery plus checking by construction. `none@L3 vs mcp@L2` is not a registered contrast, "≈" has no margin, and both cells sit at the reduced mean where power is lowest. REV-02 named this cost for D2b; the note drops the only isolating contrast without taking it on. Fix: register `none@L3 vs mcp@L2` as a descriptive equivalence with a pre-stated margin (RR interval within [0.5, 2]); label H2 "firewall as deployed (delivery plus checking)"; put the claim limit in the pre-registration.

**5. Three evasion lines are not pre-registrable as written.**
§5.4 has no margin, so count noise triggers it. §5.7 "loses the effect" is undefined. §5.5's blind reader is the task author, and probe 1 showed the tool arm adds test files (+1 to +3 advisory), a tell. §5.1 needs acceptance checks that do not exist for tasks not yet written, with D12 now non-waivable. Fix: §5.4 a margin of one identity per snapshot; §5.7 "Holm-adjusted p > 0.05 or RR interval covering 1 after removing the family"; §5.5 strip test files from the shown diff and add the free rater as second reader; put D12 on the build list before the freeze.

**6. The generator claim is right, so §3 is a placeholder.**
`scripts/lib/loop/style.ts` has `LoopStyle = 'clean' | 'hexagonal' | 'ddd'`; `scripts/lib/generators/` has a Codex adapter and no Gemini one; the ice-rink frame fails hint-audit (`fixtures/v1.3-rehearsal-tasks/README.md:46`); E1's Sonnet cells are Clean, single-shot, 0 blocking. No Sonnet or Gemini step in Layered exists anywhere. Every §3 figure is Opus-by-hand data standing in for two other models, and the Layered loop style, frame rule and Gemini adapter are prerequisites that §6 lists only partly. Fix: label §3 "placeholder, superseded by the pilot"; add the Layered style and frame rule to the readiness list as blocking.

## What survives

- D summed over steps 2–5 with a shared start: not Y renamed (none-arm removals were 0 in probe 1), not the ≤ 0.08 slope.
- The paper trail: probe 1 §5.3 proposed this outcome before the level decision; the deviation registered it.
- The pilot bar as a hard gate, 32 blocks, Holm over 2, both correlation models, the honest-null route, per-generator sign agreement as a falsifier.
- The evasion list's shape.

## Three changes first

1. The second dated deviation with a new `study2-protocol` line, the probe-1 §5.3 citation, the corrected tool-arm sentence and an explicit fallback decision (finding 2).
2. Power re-based on a two-task pilot's lower bound over a θ band, MDE "RR ≤ 0.25 only", plus the Y₁ ≥ 1 bar line (findings 1, 3).
3. `none@L3 vs mcp@L2` registered as a margin-bounded equivalence, H2 relabelled (finding 4).
