# Paper 4 (short): How Much Architectural Semantics Is Cheaply Computable?

*Deterministic Proxies vs an LLM Judge.* Extended abstract of 2026-10-15, written from the committed files on
branch `v1.3`; refreshed on 2026-10-16 (branch `v1.3-paper1-4-refresh`). Plain `article` class, 10 pt, A4; 3 pages
with references. Compiles with pdflatex + bibtex, no undefined references.

**v1.3 refresh.** A new section, "Further v1.3 results": the batch-2 proxies (PR #110: 29/29 planted, 0/3
independent analogues), the guard-unit fix for duplicated rules (projected 9/9, not measured; 8 new clean flags),
the advisory post-filters as cheap relevance (PR #139 in sample, PR #213 out of sample; both on hold), the
blind-miss classification (PR #134: 0 extractor gaps, 14 definition gaps) and the in-process Cypher interpreter
(byte-identical, 149 ms vs 728 ms; fuzz 0 mismatches). #139 and #213 are on hold; their `% src:` comments use
`git show origin/<branch>:<path>`.

```
pdflatex main && bibtex main && pdflatex main && pdflatex main
```

**Every number is a v1.3 development-set number** (marked `[dev]` in the PDF). Nothing is pre-registered. The 11/11
headline is circular by construction and is never quoted without that caveat.

## Files

- `main.tex`: the extended abstract. Every number carries a `% src:` comment.
- `refs.bib`: copied from Papers 2 and 3 plus four new entries; all written from general knowledge, all
  `\citeneeded{}`.

## Outline of the full paper

1. **Introduction.** LLM judges in architecture gates; cost, variance and same-vendor blind spots. Question: which
   architectural anti-patterns can a deterministic proxy compute, and where is a judge needed?
2. **Background.** Clone detection (Roy and Cordy 2007; CCFinder), cohesion (LCOM4), code smells (Fowler 1999),
   DDD invariants (Evans 2003), LLM-as-judge, neuro-symbolic layering.
3. **The proxies.** The ten detectors of `Docs/v1.3/cheap-semantics-design.md`, their facts, flags and limits;
   package identification through the type checker.
4. **Study design.** Frozen operators and twins (`Docs/v1.3/judge-catch-frozen.md`), the hand-written analogues, the
   DUP-RULE v2 pair, the clean reference projects as a precision proxy; the frozen judge.
5. **Results (development data).**
   - (a) operator seeds, circular: proxies 11/11, judge 9/11, rules 0/11 (`cheap-semantics-2026-10-15.md` §2);
   - (b) hand-written analogues: proxies 6/6, judge and rules 6/6 derived (§4; `v1.3-judge-catch-round2` §1b, §3);
   - (c) duplicated rules: proxies 1–2/9, judge 9/9, rules 0/9 (`v1.3-duprule-v2-2026-10-15.md` §5);
   - cost (71–99 ms vs 261 judge calls) and precision on clean projects (14 flags, tuned on dev; 101 before).
6. **Analysis.** What is cheaply computable (type, decorator, call-receiver facts) and what is not (responsibility,
   short or local duplication); the catalogue-coverage limit; the confound on the judge's duplication catch.
7. **Unbiased follow-up** (the main contribution of the full paper if the data are not yet in): freeze before
   positives; seeds the proxy author never saw; construct-only twins; human labels; held-out precision; a
   verification arm in which the judge sees proxy candidates.
8. **Threats.** Circularity, one fixture for 10 of 11 round-1 seeds, tuned-on-dev precision, the same-vendor judge,
   no human labels.

## Missing evidence before a full paper

- The follow-up of Section 5 of `main.tex` (frozen proxies, independent seeds, human labels, held-out corpus).
- Proxy precision on real projects (the corpus), where every `*.entity.ts` may be a persistence-mapping candidate.
- The verification arm (judge given proxy candidates vs blind).

## Open items

1. Verify every `\citeneeded{}` entry.
2. Authors, affiliations, data availability.
3. Decide the venue (see `papers/STATUS.md`) and convert the class.
4. Decide whether to name model identifiers (Papers 2 and 3 differ on this).
