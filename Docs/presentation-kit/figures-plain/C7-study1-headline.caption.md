# C7-study1-headline (plain set)

**Slide claim.** Study 1 (plan locked in advance): on 7 real codebases the tool found 0.893 of the planted violations and 0.838 of its reports were right; on real code the share of right reports depends on how "unsure" labels are read (0.328 to 0.789); in AI-built projects a spec did not raise the health score; the AI reviewer agreed with a second AI panel on 0.982 of items.

**NUMBERS.md rows used.**
- Study 1: "0.893 (0.787 to 0.974), N = 75" (SO4 recall, strict, registered).
- Study 1: "0.838 (0.719 to 0.970)" (SO4 seeded differential precision, strict).
- Study 1: "0.328 (0.132 to 0.609); 0.608 (0.351 to 0.816); 0.789 (0.500 to 0.933)" (real-code precision under three "uncertain" rules: registered, post-hoc, post-hoc).
- Study 1: "Holm p = 0.0003; means 0.951 / 0.887 / 0.920" (mean AHS none / minimal-prose / full-aac).
- Study 1: "0.982 (0.949 to 1.000), AC1 0.982, κ 0, n = 36" (judge P4 agreement with the Gemini panel).

**Notes.**
- The post-hoc SO4 readings (0.918 corrected and labelled) of the original C7 are left out; the claim rests on the registered values.
- Health score = AHS; "unsure" = the labellers’ "uncertain".
