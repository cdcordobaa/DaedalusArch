# F6-judge-catch (plain set)

**Slide claim.** On the two problem types whose planted cases are not confounded (database code in the core, framework leaks into the core), the AI reviewer catches 16/21 = 0.76 (plausible range 0.55–0.89) over both rounds; the 30/35 over all rounds includes confounded cases. With the fixed harmless control it wrongly fails 4/50.

**NUMBERS.md rows used.**
- Judge and cheap proxies: "4/4, 1/1, 1/1, 1/1, 2/4; pooled 9/11" (round 1 catch per operator).
- Judge and cheap proxies: "8/8; 10/13 = 0.77 [0.50, 0.92] (E1 6/8, hand 4/5); 3/3; pooled 21/24" (round 2).
- Judge and cheap proxies: "9/9 = 1.00 [0.70, 1.00]" (DUP-RULE v2 seeds caught).
- Judge and cheap proxies: "30/35 = 0.86 [0.71, 0.94]", qualified: "both rounds 16/21 = 0.76 [0.55, 0.89]" on FRAMEWORK-LEAK + PERSIST-IN-DOMAIN.
- Judge and cheap proxies: "8/47 = 0.17 [0.09, 0.30] → 4/50 = 0.08 [0.03, 0.19]" (pooled twin false fails, v1 → v2 twin).

**Notes.**
- 30/35 is shown without a whisker and in grey, labelled "includes confounded cases".
- Plain words: AI reviewer = LLM judge; planted problem = seed; harmless control = twin.
