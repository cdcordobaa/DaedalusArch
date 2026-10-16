# Papers: status, venues and readiness (2026-10-15)

Written on branch `v1.3-papers` from the committed files on `v1.3`. Every number below names its source file. Every
v1.3 number is a **development-set** number (marked *[dev]*): it comes from cases the v1.3 changes were made against,
and none is a validity estimate. Nothing in v1.3 is pre-registered (author decision). No sealed file was read.

**Venue dates must be verified.** They come from a web search on 2026-10-15 (EasyChair calls, conf.researchr.org
pages and event listings), and several came from secondary listings. Treat every date as *needs verification* on the
official call before planning around it. "Not found" means no 2027 date was published or found.

**Cross-cutting missing evidence** (applies to Papers 2 to 4; Paper 1 needs only the human audit):

| Missing | State | Source |
|---|---|---|
| Sealed hold-out run | Pre-specified in draft ("to be frozen"); not run | `Docs/v1.3/holdout-prespec.md` |
| Human labels | Author audit sheet (40 items) written, unanswered; the Study 1 30-item audit also unanswered; the v1.3 "meaningful" labeller stopped at a usage limit after one answer | `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md` §3, §4; `Docs/reports/director-report-2026-10.md` §3.7 |
| Graph adjudication | `human_verdict` column empty, so fidelity is agreement only | `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md` |
| Study 2 (firewall in the loop) | Informal outline only; not run in v1.3 | `Docs/v1.3/study2-outline.md` |

Note: the task brief listed `Docs/v1.3/study1-addenda.md`. No such file exists on `origin/v1.3` (checked with
`find . -iname '*addend*'`), so nothing was read from it.

---

## Paper 1: Do Specifications Make LLMs Better Architects? (`paper1-e1/`)

Empirical, pre-registered E1 factorial study (Study 1). Not edited on this branch.

**Venue candidates**

| Venue | Deadline found | Fit |
|---|---|---|
| MSR 2027 technical papers (Dublin, with ICSE 2027) | abstracts 20 Oct 2026, papers 23 Oct 2026 (event listing and aggregator; **verify**) | Good fit, but the deadline is days away; only realistic if the citation check is done now |
| ESEM 2027 | not found (**verify**; ESEM is usually in the autumn, deadline in spring) | Best methodological fit; 10-page `acmart` limit means cutting (see `paper1-e1/README.md` item 10) |
| Empirical Software Engineering (EMSE, journal) | rolling, no deadline | Fits the current length; no page pressure |

**Readiness.** Highest of the four. The draft compiles to 13 pages with figures (`paper1-e1/README.md`). The
registered results stand: spec-level effect Holm p = 0.0003, direction reversed through project size
(`Docs/reports/director-report-2026-10.md` §1 item 8).

**Still missing.** Citation verification (`paper1-e1/README.md` item 1); the author audit (P4 has no panel-vs-audit
row); 2025–2026 related work. v1.3 adds a caveat, not new evidence: under v1.3 no E1 cell has a blocking finding
(0 of 65), so the reversed effect lies entirely in advisory rules *[dev, descriptive]*
(`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1). The paper should say this in one paragraph.

**Honest rating: 3.5 / 5.** A careful, pre-registered null-ish result with a clear confound story. Its weakness is
that every cell passes and no structural rule ever fires, so it measures coupling proxies, not architectural
violations. Likely a borderline-to-weak accept at ESEM or EMSE once citations and related work are fixed.

---

## Paper 2: A Spec-Driven Neuro-Symbolic Architectural Firewall for TypeScript (`paper2-tool/`)

Tool and approach paper. **Updated 2026-10-16 on branch `v1.3-paper2-update`** to the later v1.3 evidence: seven new
subsections of Section 7 (interpreter parity, convergent agreement, external correctness, metamorphic invariance,
rule mutation, replication package, null results), and a revised abstract, contribution list, limits, threats and
conclusion. Compiles with `pdflatex` + `bibtex` (TeX Live from the container's apt): 24 pages in this class, no
errors and no undefined references.

**Target venue (verified 2026-10-16): ECSA 2027 research track.**

| Item | Value | Verified at |
|---|---|---|
| Event | 21st ECSA, 27 Sep to 1 Oct 2027, Porto, Portugal (FEUP) | https://conf.researchr.org/home/ecsa-2027 |
| Abstract (mandatory) | **Fri 12 Mar 2027**, 23:59 AoE | https://conf.researchr.org/track/ecsa-2027/ecsa-2027-research-track |
| Paper | **Fri 19 Mar 2027**, 23:59 AoE | same page |
| Notification | Wed 28 Apr 2027 | same page |
| Format | Springer LNCS, research papers 16 + 2 pages (provisional, pending publisher confirmation), HotCRP, double-anonymous (replication package must be anonymised) | same page |

Why this venue: it is the venue the paper was written for; the deadline leaves about five months for the sealed
hold-out run and the human labels, which the paper needs; and the 16 + 2 LNCS limit is reachable from the current
24 pages of `article` by moving Section 6.7 and part of Section 7 to an appendix or the replication package.
The page limits are marked provisional on the call; re-check them in January 2027.

**Alternatives checked and set aside (2026-10-16):**

| Venue | Date found | Why not |
|---|---|---|
| ICSA 2027 research track (Sydney, Mar 2027) | research-track page not found on conf.researchr.org (404); other ICSA 2027 track pages say "to be announced" | Earlier listing gave 30 Oct / 4 Nov 2026: two weeks away, 10 + 2 pages, no hold-out yet |
| ICSE 2027 Tool Demonstration and Data Showcase | notification 11 Dec 2026 (https://conf.researchr.org/dates/icse-2027, search result, not opened); submission 23 Oct 2026 per the earlier listing | One week away; a 4-page demo would drop the evaluation |
| SANER 2027 tool demo (Richmond, VA, 9-12 Mar 2027) | paper 23 Oct 2026, 5 pages incl. references (https://conf.researchr.org/track/saner-2027/saner-2027-tool-demo-track) | One week away; demo format |
| ICPC 2027 tool demo | 19 Nov 2026 (https://conf.researchr.org/dates/icpc-2027, search result, not opened) | Possible cut-down demo; weaker topical fit |

**Readiness.** v1.2E core: complete and registered (seeded recall 0.918, real-code precision 0.33 to 0.79;
`results/so4-heldout/agg/prf_overall.csv`, `results/so4-heldout/agg/precision_baseline.csv`). v1.3 evidence now in
the paper (*[dev]* = development set; *[expl]* = exploratory, human-written code outside the development set):

- graph fidelity as agreement, Jaccard 0.988 (E1) and 0.913 (SO4, tsc) *[dev]*
  (`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`);
- reference set pooled blocking recall 57/57 (author) and 53/67 (blind) *[dev]*
  (`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3);
- 0 incorrect of 2,668 checkable findings *[dev]* (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`);
- APG v2 25/27 vs 0/27 on designer-planted cases *[dev]* (`Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`);
- interpreter parity: 65,254 real-graph statements and 836,000 fuzzed statements, 0 mismatches
  (`Docs/v1.3/cypher-interpreter.md`, `Docs/v1.3/cypher-interp-fuzz.md`; #128, #183 merged);
- convergent agreement with dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS: kappa 1.000 on the reference
  set, 0.913 to 1.000 elsewhere, 0 of 253 disagreements our bug *[dev]/[expl]*
  (`Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md`; #166 merged);
- external human-written set: 283/283 blocking findings correct, negative control 500/500 rejected *[expl]*
  (#167, not merged); wave 2 brings 35 projects, unlabelled (#181, not merged);
- metamorphic invariance 637/655 *[dev]* (#185, not merged);
- rule mutation: development sets kill 90/273 (33%), stated as a limit of the oracle *[dev]* (#190, not merged);
- replication: 531-row audit and 160-file smoke run (#117 merged); 5,154 numbers, 4,587 reproduce, 58 differ (#215,
  not merged);
- null results stated as limitations: developer-fix mining (#168) and known groups (#198), both not merged.

**Still missing.** The hold-out run (the only thing that turns Section 7 into validity evidence); human labels for
meaningfulness and the graph adjudication; the 20-seeds-per-style target; a second specification author on the
external set (verdicts flip on 5 of 15 with one); usefulness to architects; Study 2. Citation verification and the
cut to 16 + 2 LNCS pages. Seven of the cited reports are on unmerged PRs: re-check their numbers after merge.

**Honest rating: 3 / 5 today, 3.5 to 4 / 5 with the hold-out and human labels.** The v1.3 additions answer part of
the adversarial review's M2 (breadth is the least evaluated part) with independent-tool agreement and correctness on
human-written code, and the mutation analysis and null results make the limits explicit. The central gap is
unchanged: no hold-out and no human judgement of whether findings matter.

---

## Paper 3: When the Judge Cannot Rule (`paper3-judge/`)

Workshop paper on an LLM judge inside a gate. **Revised on this branch:** new Section 5 (v1.3 catch test, three-way
comparison, layered framing, same-vendor threat), lessons 11 and 12, two recommendations, threats and conclusion.
Compiles: 10 pages in this class, no undefined references.

**Venue candidates**

| Venue | Deadline found | Fit |
|---|---|---|
| LLM4Code 2027 (ICSE 2027 workshop, Dublin) | not found; the 2027 page exists (**verify**; past editions had deadlines around Nov–Jan) | Best fit |
| ICSA 2027 New and Emerging Ideas track | not found (**verify**) | Good fit for the layered-gate argument |
| ICSE 2027 co-located LLM-for-SE workshops (e.g. the LLMSC page found) | not found (**verify**) | Alternative |

**Readiness.** Lessons 1–10 rest on registered Study 1 data. The new v1.3 material *[dev]*: catch 30/35
[0.71, 0.94], twin false fail 4/50 [0.03, 0.19] with the v2 twin, DUP-RULE confounded with a misplaced-method cue
(`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §3, §4); three-way 11/11 vs 9/11 vs 0/11 (circular) and
DUP-RULE proxies 1–2/9 vs judge 9/9 (`Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` §2;
`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §5).

**Still missing.** Human labels on the judge's fails (the catch test has no human check); a cross-vendor judge arm
(the robustness check is same-vendor, and 14 of 16 round-2 seeds are in same-vendor generated code;
`Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` §1a); a duplication positive that is not also a misplaced
method; the length must come down from 10 to about 6 pages, probably by moving Lessons 3–4 or 10 to an appendix.

**Honest rating: 3.5 / 5 for a workshop.** The bound argument and the catch-test confound are useful lessons for
others; the numbers are small and the new ones are development data. Over-length now.

---

## Paper 4: How Much Architectural Semantics Is Cheaply Computable? (`paper4-cheap-semantics/`)

**New on this branch:** outline (`README.md`) and an extended abstract (`main.tex`, 2 pages of body, compiles).

**Venue candidates**

| Venue | Deadline found | Fit |
|---|---|---|
| ICSA 2027 New and Emerging Ideas | not found (**verify**) | Good: an idea plus a study design |
| ICPC 2027 (Dublin) early-research or short track | tool demos 19 Nov 2026 (conf.researchr.org dates; **verify**); other tracks not checked | Program-comprehension angle on cheap semantics |
| EASE 2027 short papers / emerging results (Hanoi, 15–18 Jun 2027) | not found (**verify**) | Good for the follow-up design with first data |

**Readiness.** Extended abstract only. Its three results are development data *[dev]*: 11/11 vs 9/11 vs 0/11, circular
by construction (`Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` banner, §2); less-circular analogues 6/6 (§4);
DUP-RULE proxies 1–2/9 vs judge 9/9 (`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §5). Clean-project precision
(14 flags) is tuned on the same projects (`cheap-semantics-2026-10-15.md` §6).

**Still missing.** The unbiased follow-up in its Section 5: proxies frozen before positives, seeds the proxy author
never saw, construct-only twins, human labels, held-out precision on real projects, and a verification arm.

**Honest rating: 2 / 5 as a paper today; 3 / 5 as a new-ideas submission built on the follow-up design.** The
question is good and the DUP-RULE reversal is interesting, but every positive result is circular or tiny.

---

## Suggested order

1. Paper 1: verify citations and decide MSR 2027 (if the 23 Oct date holds) or ESEM/EMSE.
2. Run the hold-out and the author audit; these unblock Papers 2, 3 and 4 together.
3. Paper 3 to LLM4Code 2027 once its deadline is confirmed, cut to about 6 pages.
4. Paper 2 to ECSA 2027 (abstract 12 Mar 2027, paper 19 Mar 2027, verified) with the hold-out numbers.
5. Paper 4 after the follow-up has at least its frozen proxies and independent seeds.
