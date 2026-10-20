# Hold-out prespec, addendum 3: attempt 3, which combines attempts 1 and 2 (2026-10-20, before attempt 3)

**Recorded 2026-10-20T11:07Z, before attempt 3, and before anything of it was done.** This is a separate addendum to the frozen `Docs/v1.3/holdout-prespec.md`, which is not edited, with its own row in `Docs/v1.3/sealed-hashes.md`. Decision: `ops/decisions.md` DELEG-H3, made under the author's delegation (GO-2B). It follows addendum 1 (DELEG4), addendum 2 (DELEG5) and the run note `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`.

## Attempt 3, one try only

**What it is.** Attempt 1's path-only layout plus attempt 2's header-only repair of creation patches. No other change. Addendum 2 §1 still governs the content deviation (header lines only, hunks byte-identical). Addendum 2 §2 (fallback F-RF) still applies if layered gets no hold-out figure.

**Steps.**
1. A fresh script-made copy of the sealed tree is checked against `1379b561…`.
2. **Layout.** Attempt 1's `MAP.sha256` no longer exists: it was deleted with the attempt-1 work directory. So the attempt-1 blind adapter session is re-run **unchanged** (same prompt, flags and allow-list; Write only on `converted/MAP.sha256`).
3. **Header repair, by a deterministic script, not a model.** Under each patch-format style (`clean-architecture`, `layered`, `nestjs`, `hexagonal`), in every `variants/<id>/variant.patch`, a file-header line `--- a/<p>` becomes `--- /dev/null`, keeping its line ending, **if** `<p>` is not a file under that style's `project/`. A file-header line is a line outside any hunk, as hunks are counted from their `@@` lines. This is the creation form the frozen parser reads (`scripts/v1.3/lib/unified-diff.ts`: an old side of `/dev/null` is a new file). Every other line, including `+++ b/<p>`, stays unchanged. The script prints counts only.
4. **Verification by script** (the attempt-2 verifier, unchanged). For each rewritten patch, the hunk-line sequence must be byte-identical and the changed lines only creation-form headers. Every other converted file must match a source file by content hash. Counts and booleans only; the fixed output filter prints no path.
5. `holdout-run.ts --dry-run` at the freeze tag, `--style clean-architecture,layered,nestjs,hexagonal`.
   - **0 problems:** the live run **once**, on one capped Neo4j 5.26.x with APOC (heap 512m). Aggregates only (addendum 1). Figures are reported as computed against ADR-V14-04 option (1), layered first.
   - **Any problem:** STOP. No further change, no live run; redacted counts only.
6. **Expected count.** Attempts 1 and 2 both found 34 creation patches. A script count other than 34 is reported, and the structure check decides.

**Reporting.** Any figure is reported as "hold-out with the header-only repair of addenda 2–3 (34 patches; ddd not scorable)". ddd remains not scorable, because the frozen loader reads ddd only in overlay format.

## Changelog
- 2026-10-20: addendum 3 (DELEG-H3), before attempt 3.
