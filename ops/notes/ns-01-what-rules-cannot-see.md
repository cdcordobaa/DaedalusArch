# NS-01: What can't be a rule over the code graph, and why would a model see it?

**Thinking note, 2026-10-18. Zero model calls. Nothing has run.** It is for the author to read, then for discussion, then for the director *before* any design is frozen. Every figure cites a committed file or a null id (`Nxx`, from `Docs/v1.3/compendium/nulls-and-limits.md`). Comments go in `> AUTHOR:` lines.

---

## 1. The question underneath

The thesis says the instrument is **neuro-symbolic**: rules over a code graph, plus a model, beat either alone. The evidence so far (track 1, SO3):
- judge catch is 16/21 = 0.76 (N63);
- the judge catches 22/26 of the seeds the rules don't flag, or 8/12 on the fair cut (N91);
- the "combination beats both" claim is untested.

Those numbers answer *"did the judge fail the seeded file?"* They don't answer the question the chapter needs: **what kind of architectural problem is out of reach for rules over a graph, and what does a model know that lets it reach it?** Until we can say that, a catch rate is a number with no theory behind it.

## 2. What I believe, and why

**Claim A: knowledge levels.** Spotting a defect needs one of five kinds of knowledge. Only two of them call for a model.

| Level | Knowledge needed | Who should supply it | Example |
|---|---|---|---|
| **K0** | a fact the graph **already holds**; the rule is missing or scoped out | a rule (or a spec change) | a use case imports `express` |
| **K1** | a fact that can be **extracted deterministically** but isn't in the graph yet (calls to a library function, member use, type positions, transitive reach) | better extraction | a service calls `getRepository()` instead of its injected repository |
| **K2** | that two fragments **mean the same**. Copies and literal clones are deterministic (K2s). The same rule written in a different shape is semantic (K2m) | K2s: clone detection. K2m: a model | `total >= 50` vs `!(sum < 5000)` cents |
| **K3** | what a piece of code **is for**: a business rule or input checking? Which business concept is this class about? | **a model**, reading names, vocabulary and conventions | a discount computed inside a notification service |
| **K4** | knowledge **outside the code**: decisions, team intent, requirements, context boundaries | the spec, or a human | "Client and Buyer are separate on purpose: two bounded contexts" |

**Why.** Rules are exact over the facts they're given. They fail when a fact is missing (K1) or when the rule was never written (K0). A model brings what no extractor has: the *meaning of names and code shape* in the domain's language (K2m, K3). Neither can know a decision that was never written down (K4). An independent result supports that last point: LLMs did well on decisions that can be inferred from the code, and poorly on implicit or organisational ones [Su et al. 2026].

**Claim B: the model's job is to supply facts, not verdicts.** If Claim A holds, the right place for the model is to label K2m and K3 facts. Those labels become graph nodes, grounded in quoted evidence, and the rules do the reasoning over them. That is IRIS's shape (§5). Our judge does the opposite: it reads a unit and gives an end-to-end verdict. That may explain two of our weak results:
- it is noisy, failing 10/55 near-miss twins (N72);
- it changes nothing in the score: 0 of 65 E1 verdicts at its weight (N85).

Ontology v0, the semantic layer, already has Claim B's shape, and it has only ever run on a mock (N100).

## 3. The misses, one at a time

Every seed that the rules didn't flag (the 26 symbolic-blind seeds of `Docs/DiagnosticRuns/v1.3-complementarity-2026-10-16.md` §2), every blind-key miss, and the six semantic-layer cases. Each is classified by what knowledge it needs.

| Case | What was planted | Rules | Judge | Knowledge level | Why |
|---|---|---|---|---|---|
| **AP-FRAMEWORK-LEAK**, 12 blind seeds (fixture and E1) | `import { Request } from 'express'` plus an optional `request?: Request` parameter on a public method of an **application-layer** service | blind | 8/12 | **K0** | the import edge is already in the graph. FF-P01 (`presets/clean-architecture.yaml:71`) forbids `express` only in the **domain**. The operator plants **only** into application layers, and its header says "here no template reads the edit and no key is expected" (`scripts/lib/mutation/antipatterns/ap-framework-leak.ts:1-17`). These seeds are **blind by design, not by necessity** |
| ↳ the **4 that both arms missed** | the same edit (`antipattern-nest` FRAMEWORK-LEAK 0 and 1; two E1 use cases) | blind | missed | **K0** | the one defect class that a single-line rule scope would catch is the one the model missed. An unused optional parameter has low salience for a reader |
| **AP-REPO-BYPASS**, 4 blind | the service drops its injected repository and calls `getRepository(InvoiceEntity)` from `typeorm` | blind | 4/4 | **K1** | `typeorm` is an allowed import in that layer, so the defect is the *call*, not the import. The APG has `CALLS` edges. **To check:** whether they reach external package functions. Either way a rule could read it once the fact exists |
| **AP-DUP-RULE**, 9 blind | an existing validation, copied into a second method (e.g. `quantity <= 0 → BadRequestException`, or `isOrderState` → `DomainError`) | blind | 9/9 | **K2s** | literal copies. The cheap clone proxy caught only 1/9 (N93), which is a proxy-threshold problem, not a limit of the facts. Confound: the twin is distinguishable by a foreign-method cue (N68, N69) |
| **AP-FAT-CONTROLLER**, 1 blind | the `quantity <= 0` check moves from `OrderService.create` into `OrderController.create` | blind | 1/1 | **K3** | the same code in a DTO validator is fine. What decides it is whether `quantity > 0` is a **business invariant** or **input checking**. That is a fact about meaning, and people can argue about it |
| LOGIC-IN-CONTROLLER (CHECK-2), 10 | business logic in controllers | 0/10 visible | not run | **K3**, mostly | as above (complementarity §5) |
| PERSIST-IN-DOMAIN | ORM import in the domain | visible (FF-P01) | 4/4 | K0, already covered | — |
| Blind-key misses on the reference set | 14 of 64 (N105) | missed | — | **K0** (construct reading) | "No single consistent set of construct answers fits the blind key" (N106). These are disagreements about what a rule means |
| FF-P01 transitive domain purity (N107) | the domain reaches a framework through an intermediate file | missed | — | **K1** | a path query over IMPORTS |
| FF-P05 entity used only in a method body (N108) | the entity is selected by name suffix | missed | — | **K1** | member facts |
| Ontology **case-01** rule-dup-shapes | "free from 50" written as `total >= 50` and as `!(sum < FREE_SHIPPING_MIN_CENTS)` with 5000 cents | proxies 0/1 | not run | **K2m** | needs units and an equivalence of meaning |
| Ontology **case-02** misplaced pricing | a 10 % discount computed inside `OrderNotificationService.sendConfirmation` | proxies 0/1 | not run | **K3** | the structure is clean. Only the *responsibility* is wrong |
| Ontology **case-03** concept fragmentation | `Client` (sales), `Buyer` (billing), `AccountHolder` (accounts) | proxies 0/1 | not run | **K3, or K4** | see the DDD problem below |

**Tally of the 26 symbolic-blind seeds behind the complementarity headline:** K0 12, K1 4, K2s 9, **K3 1**.

> **What this says.** Almost all of our complementarity evidence is about **rules we didn't write and facts we didn't extract**, not about knowledge only a model has. The case for a neural part does not yet rest on K3 or K2m data. It rests on 1 planted seed, plus 3 ontology cases that have never met a real model.
>
> This doesn't sink the thesis claim. It moves the claim to where it belongs. **The experiments so far tested the wrong level.**

### The DDD problem with case-03
In DDD, *different* models of the customer in sales and in billing are often **correct**. That is the point of bounded contexts: each context has its own model, and they are translated at the boundary. So "fragmentation" is a defect only *inside* one context. Seeing it needs the context map, which is K4 and lives in the spec. For your greenfield DDD focus, case-03 should become "the same concept under two names **inside one declared context**". The model supplies the concept identity (K3), and the rule checks it against the declared contexts (K4 from the spec). That is Claim B in its clearest form.

## 4. Worked examples, by hand

**(a) K0: framework leak into a use case.** The seed adds `import { Request } from 'express'` to `src/application/CancelOrderUseCase.ts`. The graph already has `(:File {layer:'application'})-[:IMPORTS]->(:Package {name:'express'})`. A rule saying "application must not import HTTP framework packages" is one Cypher pattern, the FF-P01 template with the application layer added. It costs no model call and never false-fails the DTO twin (`context?: IssueContextDto`). **But the tiers are sealed.** So this can't be a quiet fix. It is a construct question, a candidate *Q26: application purity*, for you to decide as a declared post-seal addition or a stated limit. Martin's dependency rule puts frameworks in the outermost ring, which supports adding it.

**(b) K1: repository bypass.** The question is "does a service-layer method call a persistence API directly, when the class has a repository injected?" That is `CONSTRUCTOR_INJECTS` (present) plus a `CALLS` to `typeorm.getRepository` (to check). There is no meaning involved. If the extractor gives the call edge, a rule reads it. A model catching it (4/4) shows it is *easy to see*, not that it *needs* a model.

**(c) K3: fat controller vs a legitimate guard.** Compare two cases:
- **The seed:** the controller checks `dto.quantity <= 0` and the service no longer does. The business invariant now lives only at one entry point. A second entry point (a queue consumer, say) would create bad orders.
- **A legitimate variant**, not in our set: the controller checks `dto.quantity` is an integer and the service still checks it is positive. That is input checking, which is fine.

The code shapes are almost identical. What decides it: *is this condition a rule of the business?* If the answer is yes, a rule can finish the job: "a `SemBusinessRule` enforced only in a presentation-layer method" is a graph query. So the model's contribution is **one label** (`this condition is a business rule`), not the verdict. This is the case the neural part exists for.

**(d) K2m: the shipping threshold.** `total >= 50` (euros) and `!(sum < 5000)` (cents) are the same rule. A clone detector can't see it, because the shapes and constants differ. A model can say "both express *free shipping from 50 €*". Ontology v0 then checks the claim deterministically: it normalises the comparison and the units (the mock already verified `x >= 5000 ~ x >= 50`, §9 of the design). The model proposes and the code verifies.

## 5. How others frame it

| Work | What the analyzer does | What the model does | The lesson for us |
|---|---|---|---|
| **IRIS** (Li, Dutta, Naik, ICLR 2025) | CodeQL runs whole-repo taint analysis | infers the **taint specifications** (which library APIs are sources or sinks), and does contextual analysis of the alerts | the model supplies **facts and labels**, and the analyzer reasons. On 120 Java vulnerabilities: CodeQL 27, IRIS with GPT-4 55, and a false discovery rate 5 points better. That is Claim B's shape |
| **LLift** (Li, Hao, Zhai, Qian, OOPSLA 2024) | a static analyzer flags use-before-initialisation candidates in the Linux kernel | decides the hard part of each candidate (cross-function reasoning) with constrained prompts | **the analyzer narrows, the model resolves**. About 50 % precision on about 1,000 candidates, and 13 new bugs. The model is never asked an open question about the whole codebase |
| **Su et al. 2026** (arXiv 2602.07609) | none. The LLMs check 980 ADRs in 109 repos | screening and validation | good on code-inferable decisions, poor on implicit or organisational ones. That is our **K4 boundary** |
| *Language Models as Architectural Gatekeepers* (SBES 2025) | the generated design tests run | **turns natural-language design rules into executable tests** (30 tests: 96.67 % run, 76.67 % match the intent) | a third role: the model as **rule author**, which fits K0 |

Three roles for a model emerge: **rule author** (K0), **fact provider** (K2m, K3), and **triage on narrowed candidates** (LLift). Our judge plays a fourth role, open-ended reviewer, and none of these works uses it as the main mechanism.

*Read so far: abstracts and summaries only. Before the chapter cites them, the agent reads IRIS §3 and LLift §3–4 in full. An MDPI 2026 Clean Architecture hybrid paper was found but blocked (HTTP 403), so it is unread.*

## 6. A candidate framing for the chapter

> **Architectural conformance needs knowledge at five levels (K0–K4).** Rules over a code graph cover K0 and K1 completely and cheaply. A language model is needed exactly for K2m and K3, where the needed fact is about the *meaning* of names and code. Its proper role there is to **supply grounded, checkable facts** to the graph, not to issue verdicts. K4 belongs to the declared specification. The instrument's neuro-symbolic claim is then specific and testable: *on K3 and K2m defects, rules over (graph + model-supplied facts) beat both rules alone and the model alone, at a stated cost.*

This framing would also explain our past nulls, rather than just report them. The judge was tested mostly on K0, K1 and K2s seeds, where a model is not the right tool.

## 7. What would convince us we're wrong

1. **A dumb heuristic does as well.** If a name-and-vocabulary heuristic labels K3 cases ("business rule here?") as well as the model on the same cases, the neural part is not needed for K3 either.
2. **K3 is rare in practice.** If, on the 15 external projects and on agent code, almost all real findings are K0 or K1, the neural part is a footnote. The floor effect (track 2) makes this a live risk.
3. **The model's facts are unstable.** If repeated runs disagree on a label more than they agree, the labels can't be facts. Ontology v0 already records `agreement`.
4. **A verdict beats a fact.** If the end-to-end judge outperforms facts-plus-rules on the same K3 cases at equal cost, Claim B is wrong, even if Claim A holds.
5. **The K levels can't be assigned reliably.** If you and I (or the classmate rater) put the same cases into different levels, the taxonomy is not a usable instrument.

## 8. Pre-mortem: it failed, so what was the likely cause?

- **Same-vendor legibility.** Claude wrote the planted cases and Claude reads them. Recall would look good for the wrong reason. *Mitigation:* the Gemini arm, and cases written by hand or by a non-Claude model.
- **The K3 construct is contestable.** The fat-controller case is arguable even for people, and we have no labels (Link 4). *Mitigation:* this is where the classmate rater (D3) earns their keep. Rate the K3 cases first.
- **Too few K3 cases.** We have 1 planted seed plus 2–3 fixtures. *Mitigation:* write a small K3 and K2m set by hand, with twins, **before** any run, as the ontology manifests were.
- **We fit the levels to the results.** *Mitigation:* this note fixes the levels of every existing case **now**, before any new model output.
- **Bounded contexts.** Case-03 as written would punish correct DDD. *Mitigation:* redefine it within one context (§3).
- **Cost.** Labelling every class costs calls on every project. *Mitigation:* the LLift lesson. Ask the model only about candidates that a proxy or a rule has narrowed.

## 9. Proposed next steps, for discussion (none approved yet)

| # | Step | Model calls | Why |
|---|---|---|---|
| 1 | You read this note; we discuss §2, §3 and §6 | 0 | the framing comes first |
| 2 | Agent reads IRIS and LLift in full, adds 2–3 more hybrids, and writes the related-work paragraph | 0 | ground the framing |
| 3 | Hand-write a small K3/K2m set: about 6 cases plus twins, DDD-first, with case-03 redefined within one context. Expected answers committed before anything runs | 0 | today we have 1 seed |
| 4 | Director review of §6 and of the case set, **at the design stage** | 0 | the director shapes the design, rather than seeing only the results |
| 5 | **Pilot: the semantic layer on 2 cases** (case-02 misplaced pricing and its control case-04b), Claude route, `runs = 1`. We read every output together | count from a dry run first. The mock profile is 110 calls for 6 cases at `runs = 2`, so roughly 10–20 | look before scaling |
| 6 | Only then: decide whether NS3 or NS1/NS2 is worth running, and at what size | per design | — |

**Zero-call side result to decide separately:** candidate **Q26, application purity** (§4a). Add it as a declared post-seal construct, or state it as a limit. It would turn 12 "complementarity" seeds into ordinary rule hits. That is honest, and it shrinks the neural claim to its real size.

## 10. Questions for you, and for the director

1. Is the K0–K4 framing, with "the model supplies facts, not verdicts", the conceptual core you want for the chapter?
2. Do you accept that the 22/26 complementarity figure mostly measures missing rules (K0, K1) and copy detection (K2s), and should be reported that way?
3. Q26: add application purity (declared, post-seal), or state it as a limit?
4. Should the semantic layer's fragmentation check be redefined *within one declared context*, to stay true to DDD?
5. Director: what evidence for K3 would they accept without paid labels? One free human rater on the K3 set, plus cross-vendor model agreement?

## Sources
- [IRIS: LLM-Assisted Static Analysis for Detecting Security Vulnerabilities (ICLR 2025)](https://proceedings.iclr.cc/paper_files/paper/2025/hash/582d4e27fa24168f3af1f4582655034b-Abstract-Conference.html); [arXiv 2405.17238](https://arxiv.org/abs/2405.17238v3)
- [LLift: Enhancing Static Analysis for Practical Bug Detection: An LLM-Integrated Approach (OOPSLA 2024)](https://2024.splashcon.org/details/splash-2024-oopsla/18/Enhancing-Static-Analysis-for-Practical-Bug-Detection-An-LLM-Integrated-Approach); [arXiv 2308.00245](https://arxiv.org/abs/2308.00245)
- [Su et al., Evaluating Large Language Models for Detecting Architectural Decision Violations (arXiv 2602.07609, 2026)](https://arxiv.org/abs/2602.07609)
- [Language Models as Architectural Gatekeepers (SBES 2025)](https://sol.sbc.org.br/index.php/sbes/article/view/37049)

## Changelog
- 2026-10-18: first version.
