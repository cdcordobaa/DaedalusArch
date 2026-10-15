# F6 · judge-catch

**Title on slide:** LLM judge: does it fail planted anti-patterns, and stay quiet on twins?

**What it shows.** Left: for each planted anti-pattern (operator), the share of seeds where the frozen judge fails the unit that holds it, per round (round 1 on the `antipattern-nest` fixture; round 2 on E1 generated projects and hand-planted reference variants; DUP-RULE v2 re-judging the same DUP-RULE seeds with a fixed twin), and pooled. Right: false fails, on neutral twins (the same edit without the defect) and on clean units. Bars are proportions; whiskers are 95% Wilson intervals (where the doc prints the interval, it matches).

**One idea.** On the two operators whose seeds are not confounded (FRAMEWORK-LEAK + PERSIST-IN-DOMAIN), the judge catches 16/21 = 0.76 [0.55, 0.89] over both rounds; the pooled 30/35 includes 9 DUP-RULE seeds whose construct is confounded with the twin's cue, and DDD was never judged. With the fixed twin it rarely fails a neutral control (4/50); its weak spot is the framework leak (12/17 over all rounds).

**Numbers and sources.**
- Round 1 (`Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md` §3): REPO-BYPASS 4/4; DUP-RULE 1/1; FAT-CONTROLLER 1/1; PERSIST-IN-DOMAIN 1/1; FRAMEWORK-LEAK 2/4; pooled 9/11 = 0.82 [0.52, 0.95]; twins 3/33 = 0.09 [0.03, 0.24]; clean units 2/24 = 0.08 [0.02, 0.26].
- Round 2 (`Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` §3): DUP-RULE (E1) 8/8; FRAMEWORK-LEAK combined 10/13 = 0.77 [0.50, 0.92] (E1 6/8, hand-planted 4/5); PERSIST-IN-DOMAIN hand-planted 3/3; pooled 21/24 = 0.88 [0.69, 0.96]; twins 5/14 = 0.36 [0.16, 0.61]; clean units 1/24 = 0.04 [0.01, 0.20].
- DUP-RULE v2 (`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §3): seeds 9/9 = 1.00 [0.70, 1.00]; twins 2/9 = 0.22 [0.06, 0.55]; clean units 2/14 = 0.14 [0.04, 0.40].
- Pooled across rounds (same doc, "Pooled across rounds"): seeds **30/35 = 0.86 [0.71, 0.94]** (unchanged with v1 or v2 DUP-RULE), **qualified (2026-10-16)**: it includes 9 DUP-RULE seeds whose construct is confounded with the twin's cue, and DDD was never judged; the defensible figure is FRAMEWORK-LEAK + PERSIST-IN-DOMAIN, round 2 13/16 = 0.81 [0.57, 0.93], both rounds **16/21 = 0.76 [0.55, 0.89]** (`results/v1.3-judge-catch/{scores.json,round2/scores.json}`), drawn as the dark pooled bar; 30/35 is drawn grey without a whisker; twin false fail **8/47 = 0.17 [0.09, 0.30]** with the v1 twin, **4/50 = 0.08 [0.03, 0.19]** with v2. Other positives: FRAMEWORK-LEAK 12/17, PERSIST-IN-DOMAIN 4/4, REPO-BYPASS 4/4, FAT-CONTROLLER 1/1.

**Caveats to say.** Development data; construct sensitivity, not a validity estimate; n = 35 seeds; no pre-registration (author decision). The DUP-RULE catch is consistent with both the duplication and the foreign-method cue (v2 doc §4). E1 is development data for v1.3.
