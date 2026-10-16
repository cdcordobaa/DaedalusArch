# Papers: status, venues and readiness (2026-10-15; Papers 1 and 4 refreshed 2026-10-16)

Written on branch `v1.3-papers` from the committed files on `v1.3`. Every number below names its source file. Every
v1.3 number is a **development-set** number (marked *[dev]*): it comes from cases the v1.3 changes were made against,
and none is a validity estimate. Nothing in v1.3 is pre-registered (author decision). No sealed file was read.

**Venue dates.** The Paper 1 and Paper 4 tables were checked on the official pages on 2026-10-16 (2027.msrconf.org
and conf.researchr.org); Paper 3's on 2026-10-16 as well. Paper 2's dates come from a web search on 2026-10-15 and
still need checking on the official call, except ICSA 2027 NEMI, now verified (below). Re-check every date before
submitting. "Not found" means no 2027 date was published or found.

**Cross-cutting missing evidence** (applies to Papers 2 to 4; Paper 1 needs only the human audit):

| Missing | State | Source |
|---|---|---|
| Sealed hold-out run | Pre-specified in draft ("to be frozen"); not run | `Docs/v1.3/holdout-prespec.md` |
| Human labels | Author audit sheet (40 items) written, unanswered; the Study 1 30-item audit also unanswered; the v1.3 "meaningful" labeller stopped at a usage limit after one answer | `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md` §3, §4 |
| Graph adjudication | `human_verdict` column empty, so fidelity is agreement only | `Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md` |
| Study 2 (firewall in the loop) | Informal outline only; not run in v1.3 | `Docs/v1.3/study2-outline.md` |

Note (2026-10-16): `Docs/v1.3/study1-addenda.md` now exists on `origin/v1.3` and is used by Paper 1 (addendum A1).

---

## Paper 1: Do Specifications Make LLMs Better Architects? (`paper1-e1/`)

Empirical, pre-registered E1 factorial study (Study 1). **Refreshed on branch `v1.3-paper1-4-refresh` (2026-10-16)**
with the v1.3 evidence: a new post-hoc Section 7, "The Floor: No Blocking Violation in 65 Projects"; the A1 addendum
(the `none` level carries a three-folder hint) in Section 3.2 and the threats; the corrected v1.3 figures (blocking
recall 54/54 with 3 FF-P06 field-initialiser rows N/A, not 57/57, PR #120; the judge's defensible catch 16/21); and a
threats paragraph on the v1.3 validity evidence. Compiles with `pdflatex` + `bibtex`: **16 pages** in this class, no
undefined references.

**Venue candidates (verified online 2026-10-16; re-check before submitting)**

| Venue | Deadline (AoE) | Format | Fit |
|---|---|---|---|
| [MSR 2027 technical papers](https://2027.msrconf.org/track/msr-2027-technical-papers) (Dublin, with ICSE 2027, 26–27 Apr 2027) | abstract **20 Oct 2026**, paper **23 Oct 2026**; notification 8 Jan 2027 (official track page) | 10 pp + 2 refs, IEEE template, double-anonymous | Fits, but the deadline is in four to seven days and the paper is 16 pages in `article`, with unverified citations; not realistic without a large cut |
| ESEM 2027 | **not published** (no 2027 page on conf.researchr.org, 404 on 2026-10-16; ESEM 2026's deadline was in April) | 10 pp + refs in past calls | Best methodological fit; expect a spring 2027 deadline |
| [EASE 2027 research papers](https://conf.researchr.org/home/ease-2027) (Hanoi, 15–18 Jun 2027) | abstract **15 Jan 2027**, paper **22 Jan 2027** (conf.researchr.org home page) | 10 pp + 2 refs, ACM, double-anonymous (secondary listing; check the call) | Realistic near-term target for an empirical study with a candid floor result |
| Empirical Software Engineering (EMSE, journal) | rolling | no page limit | Fits the current length; the floor and validity material need no cut |

**Readiness.** Highest of the four. The registered results stand: spec-level effect Holm p = 0.0003, direction
reversed through project size (`Docs/DiagnosticRuns/e1-size-analysis-2026-10-10.md`, lines 20 and 83-94). The floor is now a central,
framed result: under v1.3, 0 of 65 cells has a blocking finding, and all the RQ1 difference sits in advisory metrics
*[dev, descriptive]* (`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md` §1). The paper argues that this zero is
not a blind spot (reference recall 54/54 + 3 N/A, blind 50/64; SO4 73/73 as a development reading; 283/283 correct
blocking findings on human code) and states that the semantic side is not covered (judge 16/21, not re-run on E1).

**Dependency on open PRs.** The threats paragraph and the floor bullets cite reports on hold: #167 (external
correctness) and #198 (known groups, null). Their `% src:` comments use `git show <sha>:<path>`, pinned to the
branch tips of 2026-10-16. #168 (fixes mined, null) and #185 (metamorphic) have merged and are cited by their v1.3
paths. These
sentences are provisional: see the submission gate below.

**Still missing.** Citation verification (`paper1-e1/README.md` item 1); the author audit (P4 has no panel-vs-audit
row); 2025–2026 related work; a cut to 10 pages for any conference.

**Honest rating: 3.5 / 5, unchanged.** The floor is now stated plainly rather than hidden, which makes the paper more
honest and gives it a clear message (agents stay above the rule floor; specifications change coupling style), but it
also confirms that E1 measures coupling proxies, not violations. Likely a borderline accept at EASE or ESEM, or a solid
EMSE submission, once citations and related work are fixed.

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
- reference set pooled blocking recall 54/54 (author view; 3 FF-P06 field-initialiser rows reported N/A, recall
  unestimated; PR #120) and 50/64 (blind view) *[dev]*
  (`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md`, "Correction (2026-10-16)");
- 0 incorrect of 2,668 checkable findings *[dev]* (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md`);
- APG v2 25/27 vs 0/27 on designer-planted cases *[dev]* (`Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`);
- interpreter parity: 65,254 real-graph statements and 836,000 fuzzed statements, 0 mismatches
  (`Docs/v1.3/cypher-interpreter.md`, `Docs/v1.3/cypher-interp-fuzz.md`; #128, #183 merged);
- convergent agreement with dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS: kappa 1.000 on the reference
  set, 0.913 to 1.000 elsewhere, 0 of 253 disagreements our bug *[dev]/[expl]*
  (`Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md`; #166 merged);
- external human-written set: 283/283 blocking findings correct, negative control 500/500 rejected *[expl]*
  (#167, not merged); wave 2 brings 35 projects, unlabelled (#181, not merged);
- metamorphic invariance 637/655 *[dev]* (#185, merged into v1.3 on 2026-10-16);
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

Update (later on 2026-10-16): the ICSA 2027 New and Emerging Ideas track page now lists abstract 16 Dec 2026 and paper
20 Dec 2026, at most 5 pages including references (see Paper 4).

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

**Dependency on open PRs.** None left. Lessons 13–15 cite reports from #191, #165 and #179, which have all merged
into v1.3 (2026-10-16); the `% src:` comments now give plain v1.3 paths.

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

Extended abstract (`main.tex`). **Refreshed on branch `v1.3-paper1-4-refresh` (2026-10-16)** with a section of
further v1.3 results: batch-2 proxies (PR #110), the guard-unit fix for duplicated rules, the advisory post-filters as
cheap relevance (PR #139, PR #213), the blind-miss classification (PR #134) and the in-process Cypher interpreter.
Compiles: **3 pages** with references.

**Venue candidates (verified online 2026-10-16; re-check before submitting)**

| Venue | Deadline (AoE) | Format | Fit |
|---|---|---|---|
| [ICPC 2027 Early Research Achievements](https://conf.researchr.org/dates/icpc-2027) (Dublin, with ICSE 2027) | optional abstract 19 Nov 2026, paper **26 Nov 2026**; notification 14 Jan 2027 | 4 pp + 1 refs (search summary of the track page; check the call) | Best near-term fit: research in progress without full evaluation; program-comprehension angle |
| [ICSA 2027 New and Emerging Ideas](https://conf.researchr.org/track/icsa-2027/icsa-2027-new-and-emerging-ideas) | abstract **16 Dec 2026**, paper **20 Dec 2026** | at most 5 pp including references, IEEE | Good: an idea with initial evidence plus the follow-up design; architecture audience |
| [EASE 2027 short papers and emerging results](https://conf.researchr.org/home/ease-2027) (Hanoi, 15–18 Jun 2027) | abstract **22 Feb 2027**, paper **1 Mar 2027** | check the call | Later option, after the frozen-proxy follow-up has first data |

**Readiness.** Extended abstract only; all figures are development data *[dev]*. Round 1: 11/11 vs 9/11 vs 0/11,
circular by construction; analogues 6/6; DUP-RULE 1–2/9 vs judge 9/9. New in v1.3: the guard units make all nine
copied rules clone units (projected 9/9, **not measured**; +8 clean flags,
`Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md` §B); batch 2 catches 29/29 of its own planted cases and
0/3 independent analogues (`Docs/DiagnosticRuns/cheap2-2026-10-15.md`); four source-fact filters remove 163/191 judge
dismissals and 1/61 confirmations in sample (#139), and out of sample remove 0.45 and 0.33 of advisory volume with no
relevance labels (#213); the interpreter is byte-identical on the reference set for the rules that return rows there (not FF-P05, which
returns none on either engine and whose subquery form postdates the parity sweep) and 149 ms vs 728 ms
(`Docs/v1.3/cypher-interpreter.md`).

**Dependency on open PRs.** #139 and #213 are on hold; cited with `git show <sha>:<path>`, pinned to the branch
tips of 2026-10-16 (`afb44917`, `d5170b93`). The sentences that rest on them are provisional: see the submission gate
below.

**Still missing.** The unbiased follow-up (frozen proxies, seeds the proxy author never saw, construct-only twins,
human labels, held-out precision, a verification arm); the E1 re-run of the guard-unit projection; relevance labels for
the filtered rows.

**Honest rating: 2.5 / 5 as a new-ideas paper today** (up from 2: the cheap-relevance and cheap-rules results add a
second, less circular strand), **3 / 5 with the frozen-proxy follow-up.** Every positive catch is still circular or
tiny, and the strongest new number (0.85) is in-sample against one judge run.

---

## Submission gate (added 2026-10-16)

No paper is submitted, and no preprint is posted, until every line below holds for that paper. This is a gate, not
advice: a paper that fails a line is not ready, whatever its rating above.

1. **No provisional [hold] source.** Every `% src:` comment of the form `git show <sha>:<path>` points at a report on a
   pull request that was not merged into v1.3 when it was pinned. Before submitting, each must be either (a) merged,
   with the comment switched to the plain v1.3 path and the cited numbers re-checked against the merged file, or (b)
   removed together with the sentence it supports. Pinned on 2026-10-16:

   | Paper | PR | Branch tip pinned | Report |
   |---|---|---|---|
   | 1, 2 | #167 | `23adb369` | `Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md` |
   | 1, 2 | #198 | `ba1c6327` | `Docs/DiagnosticRuns/v1.3-known-groups-2026-10-16.md` |
   | 2 | #181 | `b1d05f7a` | `Docs/DiagnosticRuns/v1.3-external-set-2-2026-10-16.md` |
   | 4 | #139 | `afb44917` | `Docs/DiagnosticRuns/v1.3-advisory-noise-2026-10-16.md` |
   | 4 | #213 | `d5170b93` | `Docs/DiagnosticRuns/v1.3-advisory-filter-oos-2026-10-16.md` (and its criterion file) |

   Merged since they were first cited, and now cited by their v1.3 path: #165, #168, #179, #185, #190, #191, #215.
2. **Every source is public and in the tree.** `npm run lint:citations` passes: no citation of the internal
   communications removed from the public tree by #132 (the patterns are in `scripts/lint-citations.sh`) and no
   personal absolute path.
3. **Every claim the 2026-10-16 merge-wave review flagged as overstated is qualified** (interval wording, distinct
   findings vs snapshot rows, byte-identity scope, reproducibility caveats); re-read the `% src:` comment of each.

## Suggested order

1. Paper 1: verify citations; MSR 2027 (23 Oct 2026) is too close for a 16-page draft, so target EASE 2027
   (22 Jan 2027) or EMSE, and ESEM 2027 once its call appears.
2. Run the hold-out and the author audit; these unblock Papers 2, 3 and 4 together.
3. Paper 3 to LLM4Code 2027 (13 Nov 2026), cut to the workshop limit, once PRs #191, #165 and #179 are reviewed;
   AgentArch 2027 (20 Dec 2026) as the second choice.
4. Paper 2 to ECSA 2027 (abstract 12 Mar 2027, paper 19 Mar 2027, verified) with the hold-out numbers; a cut-down tool demo is an option before that.
5. Paper 4 to ICPC 2027 ERA (26 Nov 2026) or ICSA 2027 NEMI (20 Dec 2026) as a new-ideas paper; the full paper after
   the follow-up has at least its frozen proxies and independent seeds.
