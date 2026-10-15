# F7 · proxies-judge-rules

**Title on slide:** Three instruments on the same planted seeds

**What it shows.** For the 11 round-1 seeds (five anti-pattern operators on the `antipattern-nest` fixture), the share caught by the designated cheap proxy (orange; deterministic, no LLM), by the LLM judge (blue) and by the symbolic v1.3 rules (green); plus the 9 DUP-RULE v2 seeds (8 of them on E1 projects). On the right, the three less circular checks: hand-written analogues, false flags on the clean reference projects, and the symbolic rules' blind spot.

**One idea.** The three instruments see different things: the symbolic rules see none of these semantic anti-patterns; the proxies match the judge on the fixture they were written for, but not on real generated code.

**Numbers and sources.**
- Round-1 three-way (`Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` §2, §3): proxy (primary) 4/4, 1/1, 1/1, 1/1, 4/4, pooled **11/11 = 1.00 [0.74, 1.00]**; judge 4/4, 1/1, 1/1, 1/1, 2/4, pooled **9/11**; symbolic 0/11. Proxy twin false flags raw 2/42, paired 0/42.
- Hand-written analogues: **6/6 [0.61, 1.00]** (§4).
- Clean reference projects: **14** defect flags over **146** files (§5 table, Total), down from 101 before one revision made on those same projects (§6). So the 14 is a tuned-on-dev number.
- DUP-RULE v2 (`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §5): judge **9/9 = 1.00 [0.70, 1.00]**; cheap `clones` 1/9, `shared-literals` 2/9, either **2/9 = 0.22 [0.06, 0.55]**; symbolic 0/9.

**Caveats to say.** Circular by construction (the proxies were written after reading the operators and round-1 results); 10 of 11 round-1 seeds on one 8-file fixture; development data, no pre-registration.
