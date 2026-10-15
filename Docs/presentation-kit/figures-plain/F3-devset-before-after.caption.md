# F3-devset-before-after (plain set)

**Slide claim.** Against the author key, the fix round took "reports right" for the defining rules from 52/107 = 0.49 to 54/54, with no planted violation lost and no false fail left on the clean apps or the look-alikes. Development set, not a validity estimate.

**NUMBERS.md rows used.**
- Development set: rules, "12/12, 11/11, 10/10, 12/12, 7/9; pooled 52/54 = 0.96 [0.87, 0.99]" (blocking recall before).
- Development set: rules, "12/13, 11/64, 10/10, 12/13, 7/7; pooled 52/107 = 0.49 [0.39, 0.58]" (blocking precision before).
- Development set: rules, "12/12, 11/11, 10/10, 12/12, 9/9; pooled 54/54 = 1.00 [0.93, 1.00]; 3 FF-P06 FLOWS_TO rows N/A" (recall and precision now, author view).
- Development set: rules, "4/5 → 5/5" (clean variants passing) and "5/14 → 0/14" (near-misses with a blocking false positive).

**Notes.**
- Plain words: violations found = blocking recall; reports right = blocking precision; author key = author manifest; look-alike = near-miss; clean app = clean variant.
- The blind-key view of the same run is F3b.
