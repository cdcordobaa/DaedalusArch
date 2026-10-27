# Hint audit: combined-mode frame (decision C8, 2026-10-26)

Frame: `frame-combined.txt`, which is the PUZZLE-04 pull sentence verbatim (hint-audited and run) followed by the
disclosure sentence of the combined delivery design §1.4:

> The same checks also run automatically after each file you create or edit, and report new findings to you.

Tool: `Docs/v1.3/study2-task-design/hint-audit.mjs --frame <file> --frame-rung L2|L3`, against `presets/hexagonal.yaml`,
`presets/ddd.yaml` and the P5 and P6 puzzle specs. Full output: `frame-combined-audit.txt`.

**Result: 0 FAIL in all 8 audits.** The disclosure adds one WARN per audit: "file" (an ordinary word that can hint),
used as the object the checks run on. The tested pull sentence already carries the same WARN three times.

**Verdict:** pass. The disclosure sentence is kept. The fallback (the pull sentence alone) is not needed. The
`none` arm keeps the baseline frame verbatim. The frame text is frozen by hash in the Stage 1 run plan.
