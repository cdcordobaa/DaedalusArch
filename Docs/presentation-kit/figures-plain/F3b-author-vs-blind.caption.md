# F3b-author-vs-blind (plain set)

**Slide claim.** The same run scored against a second, blind answer key finds fewer of its expected violations (50/64 = 0.78) and is right on 50/54 = 0.93 of its reports; 39 disagreements wait for the author.

**NUMBERS.md rows used.**
- Development set: rules, "12/12, 11/11, 10/10, 12/12, 9/9; pooled 54/54 = 1.00 [0.93, 1.00]; 3 FF-P06 FLOWS_TO rows N/A" (author view now).
- Development set: rules, "12/14, 7/10, 10/13, 12/18, 9/9; pooled 50/64 = 0.78 [0.67, 0.86]" (blind recall).
- Development set: rules, "12/12, 7/11, 10/10, 12/12, 9/9; pooled 50/54 = 0.93 [0.82, 0.97]" (blind precision).
- Development set: rules, "39" (adjudication rows).

**Notes.**
- Pooled whiskers use the printed intervals; per-style whiskers are computed by kit.mjs wilson(), as in figures/.
