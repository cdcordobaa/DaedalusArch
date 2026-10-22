# HEXDDD-01 pilot: pass bar (committed before any generator call)

Copied verbatim from `ops/notes/hexddd-01-violation-elicitation-design.md` §5.2 (branch `ops/hexddd-01-elicitation`,
commit ac498654, file sha256 5d32fadd8ea3ec8377bc6bce5336e9e41e463f0b6396f5e01790740b2e347e5f). Nothing below the rule
was edited.

---

### 5.2 Pass bar: "violations are elicited"

The pilot **passes** when either:

- **(a)** D_seed ≥ 1 in at least 1 of the 2 runs; or
- **(b)** in **both** runs, ≥ 1 new advisory identity in FF-S03, FF-P02, FF-DT05 or FF-DT06 that the hand read
  confirms as a P1–P4 violation.

The planted debt never counts; copying it counts as new identities of the same rule.

**Fail:** neither (a) nor (b). Then exactly one revision is allowed: swap in a real-repo seed (S1 at its pin). After
that, the floor is reported as a finding. There is no third loop.

**Separately recorded:** the instrument's construct gap = the hand-read violations with no matching finding, per §3
family.

---

## Operational reading (how the scorer applies the rule above; fixed before any call)

- **D_seed** (design §4): the blocking findings labelled `correct` by check-correct, at the edge grain of `driftRun`
  (`scripts/lib/drift/study2-d.ts`, `STUDY2_S2D01` with `kFrom 2`, `kTo 6`), with the seed evaluation as step 1 and
  the five agent steps as steps 2..6; renames between consecutive trees follow `git diff -M50%` (`renameMapBetween`).
  So D_seed counts the identities new relative to the seed and to every earlier step, summed over the 5 agent steps.
  The planted debt is in the seed (step 1), so it never counts; a copy of it in another file is a new identity.
- **(b)** is evaluated by the scorer only up to "candidate": it lists, per run, the new advisory identities in FF-S03,
  FF-P02, FF-DT05 and FF-DT06 relative to the seed (same identity rule). Whether a candidate is a P1–P4 violation is
  the author's hand read (`results/pilot-hexddd-01/README.md`); until then (b) reads `pending hand read`.
- The run report gives PASS when (a) holds, PENDING when (a) fails and (b) has a candidate in both runs, FAIL otherwise.
