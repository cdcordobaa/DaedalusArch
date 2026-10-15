# F1-measurement-chain (plain set)

**Slide claim.** Each link from code to meaning has evidence on the development set; the last link, meaning, is the least measured: the AI reviewer is checked on 21 clean planted cases, and the human labels and the sealed test have not run.

**NUMBERS.md rows used.**
- Graph fidelity: "0.996684 (99.7%)" and "0 / 0" unexplained disagreements.
- Development set: rules, "71 variants; 5 clean, 14 near-miss, 52 planted; 146 files".
- Development set: rules, "12/12, 11/11, 10/10, 12/12, 9/9; pooled 54/54 = 1.00 [0.93, 1.00]; 3 FF-P06 FLOWS_TO rows N/A".
- Development set: rules, "pooled 50/64 = 0.78 [0.67, 0.86]" (blind recall) and "pooled 50/54 = 0.93 [0.82, 0.97]" (blind precision); "39" adjudication rows.
- Judge and cheap proxies: "30/35 = 0.86 [0.71, 0.94]", qualified: "both rounds 16/21 = 0.76 [0.55, 0.89]".

**Notes.**
- The richer-map row (25/27) and the backing-file column of the original F1 are left out.
