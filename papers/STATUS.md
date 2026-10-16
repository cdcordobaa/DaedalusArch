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

Tool and approach paper. **Revised on this branch:** new Section 7 (v1.3), abstract, contributions, threats and
conclusion. Compiles with `pdflatex` + `bibtex` (TeX Live from the container's apt): 20 pages in this class, no
undefined references.

**Venue candidates**

| Venue | Deadline found | Fit |
|---|---|---|
| ICSA 2027 technical research papers (Sydney, 8–12 Mar 2027) | abstract 30 Oct 2026, paper 4 Nov 2026 (EasyChair call; **verify**) | Right venue, but 10 pages + 2 of references: the paper must lose half its length, and the v1.3 evidence is development-only |
| ICSE 2027 Tool Demonstration and Data Showcase | 23 Oct 2026 (conf.researchr.org dates page; **verify**) | A short tool paper on the v1.2E evaluation plus v1.3 features; feasible only with an immediate cut-down |
| ECSA 2027 (research or tools track) | not found (**verify**; ECSA 2026's main deadline was 13 Mar 2026, so expect early 2027) | Best realistic target: by then the hold-out run and human labels can exist |

**Readiness.** v1.2E core: complete and registered (seeded recall 0.918, real-code precision 0.33–0.79;
`results/so4-heldout/agg/prf_overall.csv`, `results/so4-heldout/agg/precision_baseline.csv`). v1.3 section:
written, every figure development-set:

- graph fidelity is agreement, Jaccard 0.988 (E1) and 0.913 (SO4, tsc), 0 unexplained disagreements *[dev]*
  (`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md`);
- reference set pooled blocking recall 57/57 (author view) and 53/67 (blind view) *[dev]*
  (`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3);
- 0 incorrect of 2,668 checkable findings *[dev]* (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`);
- APG v2 25/27 vs 0/27 on designer-planted cases *[dev]* (`Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`;
  `Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`);
- eleven defects found and fixed (Table 12 of the paper).

**Still missing.** The hold-out run (the only thing that turns Section 7 into validity evidence); human labels for
meaningfulness and the graph adjudication; the 20-seeds-per-style target (styles have 9–12 violation variants;
`Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md`); usefulness to architects; Study 2. Citation
verification and the cut to a venue's page limit.

**Honest rating: 2.5 / 5 today, 3.5 / 5 with the hold-out and human labels.** The engineering and the candour are
strong; the reviewer's main objection (`paper2-tool/REVIEW-adversarial.md` M2: the breadth claim is the least
evaluated part) is only partly answered, because the v1.3 evidence is development-set and the APG v2 cases were
planted by their designer. Submitting to ICSA 2027 now would likely draw a weak reject on validity; ECSA 2027 after
the hold-out is the better bet.

---

## Paper 3: When the Judge Cannot Rule (`paper3-judge/`)

Retitled *When the Judge Cannot Rule: A Pre-Registered, Falsifiable Evaluation of an LLM Architectural Judge inside a
Neuro-Symbolic Firewall*. **Revised on branch `v1.3-paper3-update` (2026-10-16):** new abstract and framing (Study 1
pre-registered; each follow-up test committed its decision rule before any call or number, and the negative results
are reported beside the positive ones); Lesson 11 now states the defensible 16/21; new Lessons 13 (CHECK-2), 14
(unanimity null) and 15 (complementarity); FR-V8 filter-and-explain added to the layered-gate section; three new
recommendations; threats and conclusion updated. Compiles with `pdflatex` + `bibtex`: **12 pages** in this class, no
undefined references.

**Venue candidates (verified online 2026-10-16 on the official pages; re-check before submitting)**

| Venue | Deadline (AoE) | Format | Fit |
|---|---|---|---|
| [LLM4Code 2027](https://llm4code.github.io/) (4th edition, ICSE 2027 workshop, Dublin, 1 May 2027) | **13 Nov 2026** (llm4code.github.io) | page limit not stated on the page; check the call | Best fit: topics include empirical studies and benchmarking of LLMs on code tasks |
| [FORGE 2027](https://conf.researchr.org/track/forge-2027/forge-2027-research-papers) (ACM conference on AI Foundation Models and SE, with ICSE 2027, Dublin, 26–27 Apr 2027) | abstract **25 Oct 2026**, paper **30 Oct 2026**; notification 4 Jan 2027 | full 10 pp + 2 refs, new-idea 4 pp + 2 refs; IEEE template, double-anonymous | Good fit for evaluation and quality assurance of FM-based systems; the deadline is two weeks away and the paper would need anonymising and an IEEE conversion |
| [AgentArch 2027](https://agentarch.org/) (Workshop on Architecting Agentic AI Systems, with ICSA 2027, Sydney, 8–12 Mar 2027) | **20 Dec 2026**; notification 19 Jan 2027 | research 8 pp, short 4 pp; IEEE CS format; ICSA Companion proceedings | Architecture audience; the layered gate and guarding agent-written code fit, LLM-as-judge is not named in the call |
| Fallback: Empirical Software Engineering (journal) | rolling | no page limit | For a longer version once the human labels exist; ESEM 2027's call was not yet published (search, 2026-10-16) |

Not found on 2026-10-16: an ICSA 2027 New and Emerging Ideas deadline (the track page lists dates as TBA).

**Readiness.** Lessons 1–10 rest on registered Study 1 data. The v1.3 material is all development data *[dev]*:
- catch: pooled 30/35, defensible restricted claim 16/21 = 0.76 [0.55, 0.89]
  (`Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md` header note);
- CHECK-2 (PR #191, open): v1 and v2.2 both 40/40 on ten unseen bases in five styles; clean false fail 16/48 vs 8/48;
  twin false fail 12/40 vs 7/40; v2.2 NOT CANDIDATE on the pre-fixed D1 rule (7/21 layered business clean units,
  rule ≤ 1); FF-N01 non-discriminating because every layered base plants a direct-ORM service in its business layer
  (a base-construction defect, reported as such); exploratory second-vendor rater 134/137, κ = 0.954;
- unanimity (PR #165, open): rule not met for v1 (0.883, lower bound 0.778) or v2.1 (0.900, lower bound 0.7985);
  null result;
- complementarity (PR #179, open): rules see 9/35 seeds; judge catches 22/26 symbolic-blind seeds (8/12 without
  DUP-RULE); judge false fail 2/48 on symbolic-pass clean units and 10/55 on twins;
- FR-V8 filter-and-explain 65/66 (62/63 with the FF-P06 N/A rows removed, `Docs/v1.3/post-merge-review-2026-10-16.md`
  R26) (`Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md` §4).

**Dependency on open PRs.** Lessons 13–15 cite reports on PR branches #191, #165 and #179, which are marked hold for
the author's review. The `% src:` comments use `git show origin/<branch>:<path>`. If any of those reports changes in
review, these lessons must be re-checked; if a PR is closed unmerged, its lesson must go.

**Still missing.** Human labels on the judge's fails (no catch has a human check); a CHECK-3 with bases that do not
plant the FF-N01 grey zone, if FF-N01 is to be claimed at all; a pre-specified cross-vendor arm (the Gemini rater was
exploratory and shared the prompt); a duplication positive that is not also a misplaced method; citation
verification; the cut to the venue's page limit (12 pages now; LLM4Code and AgentArch need about 4–8, FORGE 10 in
two-column IEEE). Lessons 3–4 and 10 are the natural candidates for an appendix or for removal.

**Honest rating: 3.5 / 5 for a workshop, unchanged.** The framing is stronger: the paper now reports a falsification
test that rejected the authors' own revision, a null on self-consistency and a base-construction defect, which
reviewers of judge papers rarely see. The numbers are still small, all follow-up data are development data, the
bases and seeds were written by the same team, and no human has checked a catch.

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
3. Paper 3 to LLM4Code 2027 (13 Nov 2026), cut to the workshop limit, once PRs #191, #165 and #179 are reviewed;
   AgentArch 2027 (20 Dec 2026) as the second choice.
4. Paper 2 to ECSA 2027 with the hold-out numbers; a cut-down tool demo is an option before that.
5. Paper 4 after the follow-up has at least its frozen proxies and independent seeds.
