# D4 · method

**Title on slide:** The method: what is frozen, what is open, what is sealed

**What it shows.** The four stages of the thesis method in order: Study 1 (frozen, pre-registered, v1.2E instrument); the v1.3 development set (AI-written reference projects on which the tool is fixed and measured); the sealed hold-out (manifests sealed outside the repository, run exactly once on a frozen tool); Study 2 (firewall in the loop, pre-registered only after the hold-out validation passes).

**One idea.** Development numbers are for building; validity numbers come only from the hold-out, which nobody has run or tuned on.

**Sources.**
- Study 1 frozen: "registration now stands at version 25, with 85 registered artefacts" (`Docs/reports/director-report-2026-10.md` §1).
- Development set: `Docs/v1.3-reference-notes.md`, `Docs/v1.3-ddd-notes.md`; construct decisions `Docs/v1.3/construct-decisions.md`.
- Hold-out: "run once; after that it is spent", "No tuning on the hold-out, of any kind" (`Docs/v1.3/holdout-prespec.md` §2, §6); status "draft, to be frozen".
- Study 2: "NOT A PRE-REGISTRATION … Study 2 is not run in v1.3"; prerequisites §8 (`Docs/v1.3/study2-outline.md`). Tasks sealed (`Docs/v1.3/validation-protocol.md` §4).

**No numbers measured here.** No hash values are shown anywhere in the kit.
