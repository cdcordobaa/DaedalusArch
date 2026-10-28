# CN-05: H11 (vendor vocabulary in the core), revision after HCAL-04, and the HCAL-05 admission design

Date: 2026-10-28. Written and committed before the R-MIRROR revision and before any HCAL-05 case exists.

## Why

HCAL-04 (`Docs/DiagnosticRuns/v15-hcal04-admission-2026-10-28.md`) scored H11 at 0/4: both blind domains vendored
their SDK inside the project (`vendor/<sdk>/index.d.ts` through tsconfig `paths`), and R-MIRROR counted as vendor types
only declarations resolved outside the tree. The construct is "an external SDK's types", whatever the install layout.

## Rule change (development, before the seal)

R-MIRROR: a module imported by an adapter through a bare (non-relative, non-alias-to-src) specifier is a vendor module,
wherever its declaration resolves (node_modules, a `paths` mapping to a vendored folder, or a `declare module`). Its
exported types are the vendor vocabulary. Everything else in R-MIRROR is unchanged (≥ 2 literal values, at most one
generic catch-all; ≥ 3 property names excluding `id`; core files only).

Development checks: HCAL-04 is now development evidence for H11 (its H11 cases are opened for this revision); the
earlier sets and study solutions as in CN-04, with no new finding on any clean case.

## HCAL-05 set

- 2 new domains, none used before: **dental lab orders** and **electric scooter rental**.
- Built by 2 fresh sessions, one per domain, from `experiments/hcal-05/BRIEF.md` (H11 construct only, the HCAL-04
  layout). They get none of the rules or earlier cases.
- Per domain: 2 positives, 2 twins, 1 legitimate case (10 cases).
- Same seal procedure; bases clean under every rule.

## Bar and use

H11 is admitted on HCAL-05 if recall is 4/4 and false positives 0/6. CAL-03 and HCAL-03 are re-run at the new rule hash;
the admitted rows keep their admission only if their records are identical. Scored once, zero calls; report
`Docs/DiagnosticRuns/v15-hcal05-admission-<date>.md`. The registration is committed after this scoring.
