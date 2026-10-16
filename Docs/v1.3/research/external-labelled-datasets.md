# External human-labelled datasets for anchoring DaedalusArch's AI-generated labels (2026-10-16)

Branch `v1.3-external-datasets`, cut from `origin/v1.3` at `270be387`. This is an exploratory research unit, like the convergent and wild units. It adds no AI-DLC workflow and no pre-registration, and it leaves `aidlc-docs/` and `src/` untouched. No LLM labelled anything: no LLM was called by the pilot code, and every dataset claim below was checked against a primary source.

**Why.** Many of our labels are AI-generated: the blind manifests, the spec writers (the second spec author in #186 was Claude), the judge verdicts and the check labels. The author and the director do not code, so human labelling is weak. This note looks for **external, human-labelled** data that can anchor or calibrate those labels. It also tests one concrete idea: public TypeScript repositories that already carry **human-written architecture rules** in their own tooling.

## 0. Results in one screen

- **No public, human-labelled TypeScript architecture-conformance dataset exists.**
  - I searched dataset archives, papers and GitHub (§1, §6) and found no dataset of TS module rules paired with confirmed violations.
  - The labelled architecture data that does exist is Java, C/C++, C# or Python, or is natural-language text: issues, review comments and ADRs.
- **Human-written TS architecture rules do exist, in the wild.**
  - GitHub code search found **35 public TS repositories whose own tooling declares layer rules**, through dependency-cruiser, eslint-plugin-boundaries or ArchUnitTS (§3).
  - **14 of them predate 2025 and show no AI-assistant traces.** Of those:
    - 4 have rule files committed before 2023;
    - 6 also carry an OSI licence file (MIT or GPL-3.0).
- **The pilot works.** On 3 of those repos I translated the developers' own dependency-cruiser layer rules into DaedalusArch specs and ran `--engine cypher-interp` against dependency-cruiser 18.4.0 (the #166 pin) under the developers' unchanged config (§4).
  - **At the pinned HEAD, and at every one of the 112 historical commits that carry the rule file, the human rules are never violated.** Both tools agree on 0 violations; the projects enforce the rules (CI, `npm test`, or a script).
  - **On seeded violations, the mechanical translation agrees exactly.** I seeded 44 imports that a human rule forbids and 44 controls that no rule forbids, with dependency-cruiser under the human config as the oracle. With the mechanical "resolved" translation our verdicts agree **44/44 on positives and 44/44 on controls**: κ = 1.00, 1.00 and 0.97.
    - The single extra finding (faao) is a real domain → store import that dependency-cruiser cannot see. The project's own config sets `tsPreCompilationDeps: false`, so type-erased imports are invisible to it.
  - **Translation is the weak point, not checking.** When a spec author translates the human rules by hand into idiomatic globs (here, the AI agent that wrote this note), agreement drops to **κ = 0.73** on the regex-heavy repository (domain-driven-hexagon). Every disagreement there traces to a recorded translation judgement call.
  - This gives a human-anchored version of the #186 spec-author reliability limit (κ 0.21): **given the human's rules, our checker reproduces the human's tool; the loss is in turning rules into a spec.**
- **Recommendation** (§5): before Study 2, adopt **(1) the human-rules TS corpus**, which grows the 3-repo pilot into about 10 repos (≈2–3 agent-days, no LLM). Optionally add **(2) the TS subset of the Su et al. ADR-violation package** as a small, disclosed judge sanity check (≈0.5 day). Everything else is cross-language future work.

## 1. Method and verification rules

- **What counts as verified.** A claim is listed as verified only if I, or a subagent of this run, opened the source:
  - the DOI resolved through `api.crossref.org/works/<doi>` (the title quoted is Crossref's);
  - the artifact opened through the Zenodo API, a `git clone`/`git ls-remote`, or the file itself;
  - licence, labeller and size read from the artifact or its README, with counts parsed from the data files where possible.
- **Unverified claims.** "U" marks a field that was not confirmed in a primary source. A dataset that could not be opened is listed under "not opened", never as usable.
- **Datasets.** Two subagents covered disjoint candidate lists in parallel: architecture and decision datasets, and smell and technical-debt datasets. I re-checked every DOI in the inventory below against Crossref myself, on 2026-10-16.
- **Human-rule repos.** GitHub code search (the GitHub MCP `search_code`; `gh` had no valid token and the REST API is blocked by the proxy) for:
  - `.dependency-cruiser.*` files naming domain, application and infrastructure;
  - eslint configs with `boundaries/element-types`;
  - `@nx/enforce-module-boundaries` with `depConstraints`;
  - ArchUnitTS tests (`from 'archunit'` … `projectFiles` … `shouldNot`).

  Each hit was blobless-cloned, and the rule files, licence and history were read with git (`scripts/v1.3/human-rules-pilot/candidates.json`).

## 2. Verified dataset inventory and usability matrix

Axes: **(a)** human-declared architecture rules that could anchor the spec writer for TS repos; **(b)** human-confirmed violations, to anchor finding correctness; **(c)** material to anchor or calibrate the LLM judge; **(d)** cross-language only, so future work. ✔ = yes, ~ = partial or weak, ✗ = no.

### 2.1 Architecture, conformance and decision datasets

| Dataset | Paper (Crossref title, DOI) | Artifact opened | Licence | What is labelled, by whom | Size, language | a | b | c | d | Effort |
|---|---|---|---|---|---|---|---|---|---|---|
| **SAEroCon repository** | "To automatically map source code entities to architectural modules with Naive Bayes", JSS 2022, 10.1016/j.jss.2021.111095 (uses the repo) | github.com/sebastianherold/SAEroConRepo @ `e3696ab1` (2020-05-05) | none stated at repo root | Intended modules, **allowed dependencies**, class-to-module mappings and violation reports, supplied by system experts at the SAEroCon workshops. Example: `jabref-generic.txt`, "Allowed Dependencies: gui -> model, logic". TEAMMATES carries a HUSACCT violation report with notes from a system expert. | 3 systems (JabRef 3.7, TEAMMATES 5.110, ProM 6.9), Java | ✔ (format) | ✔ | ~ | ✔ | Medium. The rule format maps 1:1 to our `allowed_dependencies`, but we have no Java extractor. |
| Garcia / Lutellier ground-truth architectures | "Obtaining ground-truth software architectures", ICSE 2013, 10.1109/icse.2013.6606639; "Measuring the Impact of Code Dependencies on Software Architecture Recovery Techniques", TSE 2018, 10.1109/tse.2017.2671865 | cs.purdue.edu/homes/lintan/ArchRecovery (`gt/*.rsf`) | "educational and research purposes only" disclaimer | Module membership, recovered and then certified by the projects' developers | 5 systems (Bash, ITK, Chromium, Hadoop, ArchStudio), C/C++/Java | ✗ (no rules) | ✗ | ✗ | ✔ | Low, but low value |
| Architecture-violation symptoms in code review (Li, Liang, Avgeriou) | "Warnings: Violation symptoms indicating architecture erosion", IST 2023, 10.1016/j.infsof.2023.107319; "Symptoms of Architecture Erosion in Code Reviews: A Study of Two OpenStack Projects", ICSA 2022, 10.1109/icsa53651.2022.00011 | Zenodo 7054371 (CC-BY-4.0, 2022-09-06); `Violation symptoms.xlsx` | CC-BY-4.0 | Real reviewer comments that state a violation, categorised by the researchers (e.g. "violation of architecture pattern", "structural inconsistency") | 606 comments (Neutron 158, Nova 235, qtbase 155, qtcreator 58), Python/C++ | ✗ | ~ (text, not code-located) | ✔ (rubric wording, few-shot) | ✔ | Low |
| ADR-violation package (Su et al.) | "Evaluating Large Language Models for Detecting Architectural Decision Violations", arXiv 2602.07609 (Crossref not checked: U) | Zenodo 18621369 (CC-BY-4.0 data, MIT scripts, 2026-02-12); `Results/llms/human_validation.csv` | CC-BY-4.0 / MIT | ADR rule → **LLM** verdict (Compliant / Not Compliant / Insufficient); a human recorded which LLM verdicts they agreed with | 316 rows over 44 repos. TS repos in the sample: io-backend, alfa, abracadabra, hmpps-interventions-ui, TruBudget, about 41 rows | ~ (ADR prose rules) | ~ | ~ (**not independent**: humans confirmed LLM output) | ✗ | Low–medium |
| Buchgeher ADR dataset | "Using Architecture Decision Records in Open Source Projects—An MSR Study on GitHub", IEEE Access 2023, 10.1109/access.2023.3287654 | Metadata included in the Su et al. package (921 repo JSONs, `adr_selected_projects.csv`, 1,837 ADR rows) | CC-BY-4.0 (as redistributed) | ADR locations, templates and status, mined and curated; the ADR texts themselves are not included | 921 repos, mixed languages | ~ | ✗ | ~ | ✗ | Medium |
| ArchAI_ADR (Dhar et al.) | "Can LLMs Generate Architectural Design Decisions? - An Exploratory Empirical Study", ICSA 2024, 10.1109/icsa59870.2024.00016 | github.com/sa4s-serc/ArchAI_ADR | no LICENSE file | Real ADR context/decision pairs; no violation labels | zipped ADR collections | ~ | ✗ | ~ (generation, not judging) | ✗ | Low |
| Architectural-smell evolution (Sas, Avgeriou, Arcelli Fontana) | "Investigating Instability Architectural Smells Evolution: An Exploratory Case Study", ICSME 2019, 10.1109/icsme.2019.00090 | Zenodo 3378337, `smells.csv` | CC-BY-4.0 | **Tool output** (Arcan): hub-like, cyclic and unstable dependencies; not human labels | 14 systems, 524 versions, Java | ✗ | ✗ | ✗ | ✔ | Low, low value |
| Designite validation sheet | — (no paper DOI found) | Zenodo 2538655, `designite-validation.xlsx` | CC-BY-4.0 | Designite output checked by two manual raters, with a κ sheet | 1 C# project, about 28 architecture-smell rows | ✗ | ~ | ~ | ✔ | Low |
| QScored / Designite smell corpus | "QScored: A Large Dataset of Code Smells and Quality Metrics", MSR 2021, 10.1109/msr52588.2021.00080 | Zenodo 3596299 (link to this paper U) | CC-BY-4.0 | Tool-detected | 3,073 C# projects | ✗ | ✗ | ✗ | ✔ | Medium |
| SATD-I (Xavier et al.) | "On the documentation of self-admitted technical debt in issues", EMSE 2022, 10.1007/s10664-022-10203-9 | Zenodo 6522054 | CC-BY-4.0 | Debt issues categorised by hand (rater details U); 36 VS Code (TS) issues categorised "Design / Architecture" | 286 issues, 5 projects | ✗ | ~ (text) | ~ | partly TS | Low |
| ADRMiner | ECSA 2026 (Crossref returned no match: U) | Zenodo 20787585, github.com/tommantonela/ADRminer | CC-BY-4.0 (Zenodo), Apache-2.0 (README) | ADR classification with ground-truth CSVs (e.g. `kruchten_gt.csv`, 383 rows, `human` column); annotators U | 4,316 ADRs, 547 projects | ~ | ✗ | ~ | ✗ | Low–medium |
| Qualitas Corpus | "The Qualitas Corpus: A Curated Collection of Java Code for Empirical Studies", APSEC 2010, 10.1109/APSEC.2010.46 | qualitascorpus.com (release 20130901; "available by contacting Ewan Tempero") | per-system OSS licences | **No architecture labels**, system metadata only | 112 systems, 754 versions, Java | ✗ | ✗ | ✗ | ✔ | High (by request) |

### 2.2 Code-smell and technical-debt datasets

| Dataset | Paper (Crossref title, DOI) | Artifact opened | Licence | What is labelled, by whom | Size, language | a | b | c | d | Effort |
|---|---|---|---|---|---|---|---|---|---|---|
| **MLCQ** | "MLCQ" (Industry-Relevant Code Smell Data Set), EASE 2020, 10.1145/3383219.3383264 | Zenodo 3666840 | CC-BY-4.0 | Blob, data class, long method and feature envy, with a severity scale; reviewed by **26 professional developers** (reviewer IDs in the CSV) | 14,739 reviews / 4,770 samples / 522 repos, pinned to commit and line, Java | ✗ | ✗ | ✔ (severity-calibrated, multi-rater) | ✔ | Low |
| **DACOS** | "DACOS—A Manually Annotated Dataset of Code Smells", MSR 2023, 10.1109/msr59073.2023.00067 | Zenodo 7570428 | CC-BY-4.0 | Multifaceted abstraction, complex method and long parameter list; 16 annotators with more than 50 annotations each (no per-annotator column) | 10,267 annotations / 5,115 samples, Java | ✗ | ✗ | ✔ | ✔ | Medium (MySQL import) |
| Landfill | "Landfill: An Open Dataset of Code Smells with Public Evaluation", MSR 2015, 10.1109/msr.2015.69 | Zenodo 6080422 (the original site is unreachable) | CC-BY-4.0 | Manual oracle plus public thumbs-up/down ratings (annotators U) | 1,770 instances in the SQL (243 core per the record text), Java | ✗ | ✗ | ~ | ✔ | Medium |
| **JS smells (Sarafim, Delgado, Cordeiro)** | "Detecting Code Smells in JavaScript: An Annotated Dataset for Software Quality Analysis", SBES 2024, 10.5753/sbes.2024.3432 | github.com/d-sarafim/js-code-smells-dataset @ `985184f2` | MIT | God Class and Long Method; **13 trained evaluators, 3 per instance** | 420 classes + 420 methods, 8 projects, **JavaScript**. No commit per row; the CSV positive counts (154/165) differ from the paper's (140) | ✗ | ✗ | ✔ (closest language to TS) | partly | Low–medium |
| Technical Debt Dataset v2 | "The Technical Debt Dataset", PROMISE 2019, 10.1145/3345629.3345630 | GitHub README (clowee/The-Technical-Debt-Dataset); Zenodo 5502684 | README CC BY-NC-SA 4.0, Zenodo "other-open" (conflict) | **Tool output** (SonarQube, PyDriller, SZZ, …), not human | 31 projects, Java | ✗ | ✗ | ✗ | ✔ | Medium |
| SATD (Maldonado, Shihab, Tsantalis) | "Using Natural Language Processing to Automatically Detect Self-Admitted Technical Debt", TSE 2017, 10.1109/tse.2017.2654244 | github.com/maldonado/tse.satd.data | none stated | Code comments labelled by hand (design, implementation, defect, …) | 62,275 comments, 4,071 SATD, 10 projects, Java | ✗ | ✗ | ~ | ✔ | Low |
| SATD in issues (Li, Soliman, Avgeriou) | "Identifying self-admitted technical debt in issue tracking systems using machine learning", EMSE 2022, 10.1007/s10664-022-10128-3 | github.com/yikun-li/satd-issue-tracker-data | none stated | Issue sections labelled by the first author plus 4 researchers (κ > 0.7); **87 architecture_debt** | 23,180 sections, 7 projects | ✗ | ~ (text) | ✔ | ✔ | Low |
| SATD from four sources (Li et al.) | "Automatic identification of self-admitted technical debt from four different sources", EMSE 2023, 10.1007/s10664-023-10297-9 | github.com/yikun-li/satd-different-sources-data | MIT | Commits, PRs and issues labelled by hand (second-author κ sample); architecture_debt: 13 commits + 10 PRs + 93 issues | 5k commits + 5k PR sections + issues + comments | ✗ | ~ (text) | ✔ | ✔ | Low |
| React/TSX smells (Ferreira and Valente) | "Detecting code smells in React-based Web apps", IST 2023, 10.1016/j.infsof.2022.107111 | Zenodo 6985604 | CC-BY-4.0 | ReactSniffer **tool** output on `.tsx` files | 11 sheets (grafana, superset, …), TS/TSX | ✗ | ✗ | ~ | — | Medium |

**Not opened, so not usable as cited:**
- Fontana, Mäntylä, Zanoni, Marino, "Comparing and experimenting machine learning techniques for code smell detection" (EMSE, 10.1007/s10664-015-9378-4). The dataset host returned HTTP 503, and the Wayback Machine is blocked here.
- Saboury et al. JS smells (10.1109/saner.2017.7884630). The repository asked for authentication, and the labels are tool output by the thesis anyway.
- SniffTSX (IST 2025). No artifact URL found.
- Maldonado and Shihab MTD 2015 (10.1109/mtd.2015.7332619). No separate artifact; it is superseded by the TSE 2017 data.
- Arcan Hub-Like-Dependency and microservice sets (Zenodo 15488631, 18031881). Metadata only; the labels appear to be tool output.
- ArchLintor (SBES 2025). A TS tool with a demo video, no dataset; DOI U.

### 2.3 What the matrix says

- **Axis (a), human-declared rules for TS: no dataset.**
  - The only external human-declared rule sets are SAEroCon's (Java). Their *format* is our format.
  - The live source of human TS rules is the developers' own tooling (§3).
- **Axis (b), human-confirmed violations that are code-located: SAEroCon only** (Java, about 1k TEAMMATES violations with expert notes). Everything else is natural-language evidence: review comments, issues, SATD.
- **Axis (c), the judge.** The best human-graded material is text:
  - the 606 violation-symptom review comments;
  - the architecture-debt SATD items;
  - multi-rater smell sets (MLCQ, DACOS, Sarafim JS) for calibrating *severity and agreement behaviour*, not architecture verdicts.

  The one TS-touching judge set (Su et al.) has human labels that *confirm LLM verdicts*. That is anchoring-biased and must not be presented as independent ground truth.

## 3. Human-rule repos: candidate list

All 35 repositories whose own tooling declares layer rules beyond the dependency-cruiser recommended preset are listed below. The HEAD SHA is pinned, and the rule file is read at that SHA. "First added (n)" is the first commit date of the rule file and the number of commits that touched it.

**Provenance tier.** Copilot-style completion leaves no trace, so tiers A and B are evidence of human authorship, not proof.
- **A:** rule file committed before 2023, with no AI-assistant files and no AI co-author trailers.
- **B:** committed 2023–2024, AI checks clean.
- **C:** committed in 2025 or later, or AI-assistant files (`CLAUDE.md`, `AGENTS.md`, `.cursor`, `.claude`) or trailers present. Human authorship is not assured.

Machine-readable: `scripts/v1.3/human-rules-pilot/candidates.json`. Two further hits declared only package allow-lists, not layers, and are excluded: newjersey/navigator.business.nj.gov and GameKnight-server.

| # | Repository | HEAD (date) | Rule file (tool, custom rules) | First added (n) | TS files | Licence | AI traces | Tier |
|---|---|---|---|---|---|---|---|---|
| 1 | `AlbertHernandez/dependency-cruiser-example` | `f61b42f7c7` (2022-10-23) | .dependency-cruiser.js (dependency-cruiser, 2) | 2022-09-06 (1) | 13 | MIT (LICENSE file) | — | **A** |
| 2 | `azu/faao` | `9574fc4961` (2021-08-04) | .dependency-cruiser.json (dependency-cruiser, 4) | 2017-07-03 (1) | 165 | MIT (LICENSE file) | — | **A** |
| 3 | `TalanLabs/bookadesk` | `d362aadba4` (2022-09-14) | back/.dependency-cruiser.js (dependency-cruiser, 2) | 2021-03-23 (1) | 61 | GPL-3.0 (LICENSE file) | — | **A** |
| 4 | `joaovqm1/backend-clean-nodejs` | `019ee75e49` (2021-06-20) | .dependency-cruiser.js (dependency-cruiser, 4) | 2021-03-13 (1) | 488 | MIT (package.json only) | — | **A** |
| 5 | `benedya/nodejs-layered-architecture` | `ce29e596ef` (2025-05-04) | .eslintrc.js (eslint-plugin-boundaries, 5) | 2023-07-22 (1) | 7 | MIT (LICENSE file) | — | **B** |
| 6 | `jdconrado/msvox-rooms` | `23203f15b8` (2024-12-27) | .eslintrc.js (eslint-plugin-boundaries, 3) | 2024-04-17 (3) | 341 | MIT (LICENSE file) | — | **B** |
| 7 | `Sairyss/domain-driven-hexagon` | `5c2d15a7e2` (2024-05-14) | .dependency-cruiser.js (dependency-cruiser, 5) | 2023-03-01 (4) | 95 | MIT (LICENSE file) | — | **B** |
| 8 | `benedya/nestjs-serverless-layered-architecture` | `59f9cee90a` (2025-02-08) | .eslintrc.js (eslint-plugin-boundaries, 5) | 2023-10-07 (1) | 48 | MIT (package.json only) | — | **B** |
| 9 | `DonatoCalvillo/api-typescript-express-template` | `0e15ce3afd` (2024-06-28) | .dependency-cruiser.js (dependency-cruiser, 2) | 2024-06-27 (1) | 16 | MIT (package.json only) | — | **B** |
| 10 | `Drag0s98/nestjs_hex-skeleton` | `683179beb7` (2024-11-23) | .dependency-cruiser.js (dependency-cruiser, 2) | 2024-09-13 (1) | 10 | UNLICENSED (package.json) | — | **B** |
| 11 | `Evyweb/millionaire-clone-exercise` | `41c2513fef` (2024-12-15) | .dependency-cruiser.js (dependency-cruiser, 5) | 2024-12-10 (1) | 31 | none stated | — | **B** |
| 12 | `guillermors39/daily-trends` | `ff640755c3` (2024-03-08) | .dependency-cruiser.js (dependency-cruiser, 2) | 2024-03-01 (1) | 116 | ISC (package.json only) | — | **B** |
| 13 | `ignaciocaff/hexagonal-template` | `97d41c9a76` (2023-06-27) | .dependency-cruiser.js (dependency-cruiser, 2) | 2023-06-27 (1) | 44 | none stated | — | **B** |
| 14 | `jterrazz/learning-clean-architecture` | `780c2a9068` (2025-08-18) | .dependency-cruiser.js (dependency-cruiser, 2) | 2023-06-25 (1) | 79 | all rights reserved (LICENCE file) | — | **B** |
| 15 | `gbourgeat/nestjs-ddd-clean-architecture-example` | `a108ade60b` (2026-09-22) | .dependency-cruiser.js (dependency-cruiser, 6) | 2026-02-02 (1) | 147 | MIT (LICENSE file) | .claude .cursor CLAUDE.md …, 37 AI-trailer commits | **C** |
| 16 | `raouf-b-dev/ecommerce-store-api` | `2cb64018b6` (2026-10-16) | test/architecture/hexagonal-architecture.spec.ts (ArchUnitTS) | 2026-05-30 (8) | 1123 | MIT (LICENSE file) | AGENTS.md CLAUDE.md …, 20 AI-trailer commits | **C** |
| 17 | `sazardev/nest-js-clean-architecture-template` | `acbde2d16c` (2025-11-24) | eslint.config.mjs (eslint-plugin-boundaries, 2) | 2025-11-24 (2) | 34 | MIT (LICENSE file) | — | **C** |
| 18 | `UnicornMusic/backend` | `a2c4a7613d` (2025-06-01) | .dependency-cruiser.js (dependency-cruiser, 5) | 2025-06-01 (1) | 66 | MIT (LICENSE file) | — | **C** |
| 19 | `5ESGI-IW-Software-architecture/ecoeats-backend` | `9bf8dd12ce` (2026-05-15) | .dependency-cruiser.js (dependency-cruiser, 2) | 2026-04-24 (5) | 257 | ISC (package.json only) | CLAUDE.md | **C** |
| 20 | `Cahmoraes/clean-arch-solid-ddd` | `75fb96cceb` (2026-10-13) | apps/backend/.dependency-cruiser.js (dependency-cruiser, 5) | 2026-05-02 (2) | 1054 | none stated | CLAUDE.md …, 584 AI-trailer commits | **C** |
| 21 | `chollak/finance-tracker-backend` | `64e2726eb1` (2026-09-07) | .dependency-cruiser.js (dependency-cruiser, 2) | 2025-08-12 (1) | 336 | ISC (package.json only) | CLAUDE.md, 276 AI-trailer commits | **C** |
| 22 | `couckedev/monorepo-modulith-template` | `d8146ac724` (2026-04-11) | eslint.config.js (eslint-plugin-boundaries, 5) | 2026-04-11 (2) | 8 | none stated | — | **C** |
| 23 | `heitorrsdev/reservation-core` | `fb1b7a78e5` (2026-04-25) | eslint.config.mjs (eslint-plugin-boundaries, 2) | 2025-12-20 (8) | 153 | BUSL-1.1 (not open source) | AGENTS.md | **C** |
| 24 | `jfleury-kolecto/boilerplate-api` | `704ecbce0f` (2026-05-19) | .dependency-cruiser.json (dependency-cruiser, 10) | 2026-05-19 (1) | 108 | none stated | .claude CLAUDE.md | **C** |
| 25 | `matheusmaximianomv/smaug` | `5acca275a5` (2026-09-30) | .dependency-cruiser.js (dependency-cruiser, 6) | 2026-04-23 (3) | 360 | none stated | CLAUDE.md …, 7 AI-trailer commits | **C** |
| 26 | `Maximuson/ddd-store-example` | `f8807e8686` (2026-07-16) | .eslintrc.cjs (eslint-plugin-boundaries, 3) | 2026-07-16 (1) | 143 | none stated | — | **C** |
| 27 | `nawatt-works/nestjs-starter` | `414fb6893b` (2026-04-17) | .dependency-cruiser.js (dependency-cruiser, 7) | 2025-11-23 (2) | 113 | UNLICENSED (package.json) | — | **C** |
| 28 | `Rbourree/NEST-CleanArchitecture` | `12c85752fb` (2025-05-23) | eslint.config.mjs (eslint-plugin-boundaries, 2) | 2025-05-22 (3) | 21 | UNLICENSED (package.json) | — | **C** |
| 29 | `shouya31/pair-tracker` | `aa56f972ad` (2025-07-25) | .dependency-cruiser.js (dependency-cruiser, 7) | 2025-06-15 (2) | 63 | none stated | — | **C** |
| 30 | `sisques-labs/gardenia-api` | `3b5a4ec225` (2026-10-05) | .eslintrc.js (eslint-plugin-boundaries, 3) | 2026-05-23 (4) | 1962 | custom (Gardenia Community License 1.0) | CLAUDE.md …, 97 AI-trailer commits | **C** |
| 31 | `svo/typescript-sprint-zero` | `15a1968da3` (2026-05-26) | .dependency-cruiser.js (12) + .eslintrc.js (eslint-plugin-boundaries, 3) | 2025-07-05 (2) | 58 | MIT (package.json only) | .claude | **C** |
| 32 | `SylvainRomiguier/hexa_architecture` | `e0970fe9e9` (2025-09-14) | .dependency-cruiser.js (dependency-cruiser, 3) | 2025-05-28 (2) | 22 | ISC (package.json only) | — | **C** |
| 33 | `tatemz/es-ts-example` | `99bcf5b135` (2026-08-15) | .dependency-cruiser.js (dependency-cruiser, 31) | 2026-07-23 (2) | 152 | none stated | AGENTS.md, 9 AI-trailer commits | **C** |
| 34 | `thomasprade/thro-sqs-2026` | `4939de6b13` (2026-06-16) | backend/src/architecture.spec.ts (ArchUnitTS) | 2026-04-28 (3) | 66 | none stated | 4 AI-trailer commits | **C** |
| 35 | `wajdihh/timeboxing-microservices` | `c20759e331` (2025-06-08) | .eslintrc.js (eslint-plugin-boundaries, 4) | 2025-03-26 (10) | 121 | none stated | — | **C** |

**Observations.**
- **AI-written rules dominate recent hits.** About 60% of the hits are tier C: rule files from 2025–2026, often in repos with `CLAUDE.md` or hundreds of AI co-authored commits. In 2026, a `.dependency-cruiser.js` is often itself AI-written. **Only tiers A and B can anchor a human-authored spec**, so date and AI-trace filtering is a required selection criterion, not a nicety.
- **Usable core.** Six tier A/B repos have an OSI licence file: AlbertHernandez, faao, bookadesk, benedya/nodejs-layered, msvox-rooms and domain-driven-hexagon. Four more (joaovqm1, benedya/nestjs-serverless, DonatoCalvillo, guillermors39) carry MIT or ISC in `package.json` only, which is usable with a recorded caveat.
- **Nx.** `@nx/enforce-module-boundaries` hits were almost all front-end (Angular/React) workspaces or AI-skill documents, so none entered the list. Backend Nx monorepos with tag constraints exist but were not found by code search within this run.
- **Overlap with our wild corpus.** domain-driven-hexagon is already in it at the same SHA (`results/v1.3-wild/selection.json`). Its committed ISE spec, inferred by our tool, puts `src/libs/**` in *domain* and `wallet/domain/*` in *application*, while the developers' own rules put those files elsewhere. The pilot's human-rule spec is therefore a direct external check on ISE for that repository.

## 4. Pilot: human-authored rules → DaedalusArch spec → agreement

### 4.1 Setup

| | domain-driven-hexagon | bookadesk (`back/`) | faao |
|---|---|---|---|
| Repository @ SHA | Sairyss/domain-driven-hexagon @ `5c2d15a7e2d6…` | TalanLabs/bookadesk @ `d362aadba4b8…` | azu/faao @ `9574fc49616f…` |
| Licence | MIT | GPL-3.0 | MIT |
| Kind | NestJS DDD/hexagonal backend | Express clean-architecture backend | Electron/React client (layered, Almin) |
| Human layer rules | 5: no-domain-to-api, no-domain-to-app, no-domain-to-infra, no-infra-to-api, no-command-query-to-api (overlapping regex layers, with two `pathNot` exemptions) | 2: no-dep-from-domain, no-dep-from-usecase | 4: domain-not-to-{infra,store,component}, store-not-to-depend-on-component |
| How they enforce it | npm script `deps:validate` (manual) | CI: `.github/workflows/check.yml` runs `npm run check-architecture` | `npm test` → `lint` → `lint:depcruise --validate` |
| Their dependency-cruiser | ^12.10.0 | ^9.9.1 | ^2.2.3 |

- **Oracle.** dependency-cruiser **18.4.0**, the pin of #166 (`experiments/tool-comparison/depcruise`), run with the project's **own rule file unchanged** (`depcruise src --config <their file> --output-type json`).
  - Only the human-written layer rules are compared. The recommended-preset rules they kept (orphans, unresolvable, …) are excluded by name.
  - The translated rules use only `path`/`pathNot` regexes, which mean the same in their declared versions and in 18.4.0.
  - I did not re-run their old declared versions.
- **Ours.** `firewall evaluate --format json --symbolic-only --engine cypher-interp`, FF-S01 (`dependency-direction-graph`) and FF-S03 (`layer-skip-graph`) of the hexagonal library. Every other built-in function is disabled.
- **Scope and κ.** The comparison scope is the `.ts`/`.tsx` files both tools analyse: dependency-cruiser's local modules minus our extractor's default excludes (specs, tests, `.d.ts`). Our File-node counts match the scope on bookadesk (47) and faao (197). On DDH our extractor reads 95 files, 13 more than dependency-cruiser's `src` target (the repo's tsconfig program also reaches files outside `src/`); keys on those files are out of scope. κ is computed over all local import edges in scope; a key is `from|to`.
- **Two translations.**
  - **Resolved** (`lib.ts: translate`), mechanical. Each human rule's `from`/`to` regexes are resolved against the file list. Files are grouped by their position on every rule into atoms (8, 3 and 4 atoms). Each atom is one layer that lists its files. An atom pair is forbidden iff some rule has the first atom on its `from` side and the second on its `to` side. `allowed_dependencies` is every other ordered pair, so FF-S01 ∪ FF-S03 flags exactly the forbidden pairs. This is the translation a careful tool would do; it isolates the *checker*.
  - **Idiomatic** (`specs/<id>.idiomatic.yaml`), written by hand as a spec author would: named layers, directory and file-name globs. **The author is the AI agent that ran this unit**, so this measures *an AI spec author given human rules*, not a human spec author. It was written before any idiomatic run and not tuned afterwards.

**Judgement calls**, each recorded in the spec headers:

| Id | Translation | Call |
|---|---|---|
| R1 | resolved | Recommended-preset rules (not-to-spec, not-to-test, no-circular, …) are not architecture the developers declared, so they are not translated. |
| R2 | resolved | Same-atom forbidden imports are inexpressible because our layer rules skip same-layer imports. They are counted (`translation.inexpressibleEdges`): 0 edges in all three pilots. One DDH atom is on both sides of no-domain-to-app-deps, because `…domain-event-handler.ts` under `application/` matches both regexes, but no import falls inside it. |
| R3 | resolved | The hexagonal binder needs one layer of each kind, so four empty placeholder layers (matching no file, with no edges) are added. Kinds are otherwise irrelevant to FF-S01/S03. |
| R4 | both | Where the project's config has `tsPreCompilationDeps: false` (faao), dependency-cruiser cannot see type-erased imports. We would drop our syntactically type-only imports for like-for-like comparison, but none were flagged, so 0 were dropped. |
| B1–B4 | bookadesk idiomatic | Unanchored `src/domain` becomes `src/domain/**`. "Everything else in src" becomes a catch-all `src/**` layer listed last. The spec/.d.ts `pathNot` is dropped. Kinds are nominal. |
| F1–F4 | faao idiomatic | Anchored `^src/x` becomes `src/x/**`. Unnamed directories (use-case, bootstrap) are left unlayered. The deny-list becomes an allow-list of every other pair. |
| D1–D6 | DDH idiomatic | Substring regexes become globs, with first-match precedence api > domain > infrastructure > application. `*.port.ts` goes to domain. AppRequestContext stays in application. The command/query rule is folded into "application may not import api". **Erratum:** the header comment of D1/D2 assumes file-name globs win over directories. Our annotator gives directory matches priority over file-name patterns, so `database/*.repository.port.ts` lands in infrastructure, not domain. No pilot verdict depends on it. |

### 4.2 Results

**(i) Pinned HEAD, unseeded.**

| Pilot | Scope files / edges | dependency-cruiser layer violations | Resolved: both / ours / theirs, κ | Idiomatic: both / ours / theirs, κ |
|---|---|---|---|---|
| domain-driven-hexagon | 82 / 180 | 0 | 0 / 0 / 0, κ undefined (no positives) | 0 / 1 / 0, κ = 0 |
| bookadesk | 47 / 126 | 0 | 0 / 0 / 0, undefined | 0 / 0 / 0, undefined |
| faao | 197 / 514 | 0 | 0 / 1 / 0, κ = 0 | 0 / 1 / 0, κ = 0 |

- **faao, ours only (both translations).** `src/domain/App/Activity/GitHubActiveItemService.ts` imports `GitHubSearchStreamStateItem` from `src/store/…`, a domain → store import that the human rule `domain-not-to-depend-on-store` forbids.
  - The import is used only as a type, so TypeScript erases it.
  - With the project's `tsPreCompilationDeps: false`, dependency-cruiser analyses the emitted JS and never sees it. Running the project's own config on that one file lists only `./GitHubActiveItem` and `../../Entity` as dependencies.
  - **Class: their configuration.** It is a real violation of the rule as written, invisible to the developers' enforcement.
- **DDH idiomatic, ours only.** `exception.interceptor.ts` → `api-error.response.ts`. Our call D6 (application may not import api) is stricter than the human rule, which constrains only command/query/service files. **Class: translation judgement.**

**(ii) Enforcement history.** `history.ts` ran dependency-cruiser with the rule file as of each commit, on every first-parent commit that touched the source or the rule file.

| Pilot | Commits with the rule file | Span | Commits with a layer violation |
|---|---|---|---|
| bookadesk | 24 | 2021-03-23 … 2022-06-24 | **0** |
| faao | 77 | 2017-07-03 … 2019-12-09 | **0** |
| domain-driven-hexagon | 11 | 2023-03-01 … 2024-05-14 | **0** |

- **The rules were never broken in committed history.** The developers' enforcement works; at the least, nothing broken was ever committed on the main line. This history therefore gives no natural positives.
- **Natural positives would have to come from elsewhere:** PR branches or CI-failure logs, not reachable without the GitHub API here, or tier-C repositories. That is a reportable property of human-rule repos.

**(iii) Seeded violations, with dependency-cruiser under the human config as oracle.**
- **How seeds were chosen.** For each human layer rule, `run.ts --seed 4` appends up to 4 imports (`import '<relative path>';`) that the rule forbids, picked deterministically and evenly spread over the sorted candidate pairs. It also adds as many **controls**: imports between constrained files in different directories that no rule forbids. Existing imports are never reused. After the run the tree is restored with `git checkout --force`.
- **Seed count.** 44 positives (DDH 20, bookadesk 8, faao 16) and 44 controls.

| Pilot | Positives flagged: theirs / resolved / idiomatic | Controls flagged: theirs / resolved / idiomatic | Resolved κ (edges) | Idiomatic κ (edges) |
|---|---|---|---|---|
| domain-driven-hexagon | 20 / **20** / 14 | 0 / **0** / 2 | **1.000** (20/0/0 of 220) | **0.735** (14/3/6) |
| bookadesk | 8 / **8** / 8 | 0 / **0** / 0 | **1.000** (8/0/0 of 142) | 1.000 |
| faao | 16 / **16** / 16 | 0 / **0** / 0 | **0.969** (16/1/0 of 546) | 0.969 |
| **Total** | **44 / 44 / 38** | **0 / 0 / 2** | | |

- **The resolved translation reproduces the human-configured tool on every seed.** Its only edge-level disagreement is the faao type-erased import above, which is ours-only and correct per the rule's text.
- **The idiomatic translation loses 6 positives and adds 3 extra findings, all on DDH, all traced to judgement calls.**
  - **Misses (6).** The human regex `'domain'` is a substring match. It puts `src/libs/ddd/domain-event.base.ts` and `…/create-wallet-when-user-is-created.domain-event-handler.ts` (under `application/`!) in the domain layer, and `'database'` puts `src/configs/database.config.ts` in infrastructure. Our globs (D1/D4) do not match those files.
  - **Extras (3).** D6 folds every application file under the command/query rule (2 controls plus the HEAD finding above).
- **Rule cost.** 22 human regex fragments (plus 2 `pathNot` exemptions), written by the developers for their own tool, need 6 judgement calls to become first-match globs. On this repository, 9 of 23 positive-or-flagged edges move.

### 4.3 What the pilot shows, and what it does not

- **Shows: the checker.** Given a human-authored rule set, DaedalusArch's FF-S01/S03 on cypher-interp agree with the human-configured dependency-cruiser on 44/44 seeded violations and 44/44 controls, on three independent repositories whose rules predate this project. This is **human-authored-spec agreement**, the external anchor the AI-written manifests lack.
- **Shows: the translator is the reliability bottleneck.** A spec author (here, an AI) translating the same human rules into idiomatic globs drops to κ 0.73 where the human rules are regex-heavy. This is consistent with, and narrower than, #186's κ 0.21 between two spec authors writing from scratch. Disagreement concentrates where rules are implicit (substring matches) or must be generalised.
- **Does not show: natural violations.** The positives are seeded imports, and every seed is a side-effect import. The human rules were never violated in 112 historical commits.
- **Does not show: anything beyond direction rules.** Only layer-direction rules were tested. None of the three projects declares a rule for anything else we check (purity, ports, aggregates, …).
- **Does not show: a human spec author.** The idiomatic translator is an AI. A human-authored idiomatic translation, or several, is the obvious next measurement.

## 5. Recommendation: what to adopt before Study 2

1. **Adopt the human-rules TS corpus (primary).** Grow the pilot to the tier-A/B, licence-clean core of §3:
   - **Repos:** AlbertHernandez, faao, bookadesk, domain-driven-hexagon, benedya/nodejs-layered and msvox-rooms; plus the package.json-licensed joaovqm1, benedya/nestjs-serverless and guillermors39 with a recorded caveat. That is 9–10 repos.
   - **Code needed:** an eslint-plugin-boundaries reader (element-types → the same atom translation; the #166 pins already exist).
   - **What it gives Study 2:**
     - (a) an external, human-authored spec per repo, for spec-writer evaluation: the spec writer's output against the developers' own rules, scored as layer-assignment agreement and as seeded-verdict agreement;
     - (b) human-oracle positives through the seeding protocol;
     - a third independent check on ISE (DDH already shows divergence).
   - **Effort:** ≈2–3 agent-days. No LLM, no human labelling, all scripts here.
   - **Risk:** small, lab-like projects. Mitigate by reporting per-repo results and keeping DDH (95 files) and msvox-rooms (341 files) as the larger cases.
2. **Optional, for the judge: the TS subset of the Su et al. ADR-violation package.**
   - **What it is:** about 41 rows over 5 TS repos, CC-BY-4.0, plus the 606 code-review violation comments as rubric-wording material.
   - **Use it only as a disclosed sanity check.** Its "human" labels confirm LLM verdicts, so it cannot serve as independent ground truth.
   - **Effort:** ≈0.5 day.
   - **Not adopted for the judge:** MLCQ, DACOS and Sarafim JS. They calibrate smell severity, not architecture verdicts, and only Sarafim is in the JS family. They are listed as future work for a judge-calibration appendix.

**Future work (cross-language):**
- SAEroCon (Java). It is the best external human architecture-conformance set, and its rule format maps 1:1 to our `allowed_dependencies`, but it needs a Java front end.
- Garcia ground truth (module membership).
- The SATD sets (architecture-debt text).
- Qualitas (no labels).

## 6. Related-work paragraph (draft for the thesis)

> Public, human-labelled datasets for architecture conformance exist only for other languages or as natural-language evidence. The SAEroCon repository provides expert-defined intended architectures, source-to-module mappings and violation reports for three Java systems (JabRef, TEAMMATES, ProM; used e.g. by Olsson et al., JSS 2022). Garcia et al. (ICSE 2013) and Lutellier et al. (TSE 2018) provide developer-certified module decompositions for C/C++ and Java systems. Smell datasets with human labels (MLCQ, DACOS, Landfill) are Java, and the only human-annotated JavaScript set (Sarafim et al., SBES 2024) covers class- and method-level smells. Architecture violations are otherwise labelled in text: in code-review comments (Li et al., IST 2023), in issues and commits as self-admitted architecture debt (Li et al., EMSE 2022, 2023), and in ADR compliance judgements whose human labels confirm LLM verdicts (Su et al., 2026). As of October 2026, we found **no public dataset that pairs human-declared architecture rules for TypeScript projects with confirmed violations**. A systematic search of Zenodo, the cited papers' artifacts and GitHub found none. The closest material is the developers' own enforcement configuration (dependency-cruiser, eslint-plugin-boundaries, ArchUnitTS) in public repositories. We therefore assemble such a set from the configurations of repositories whose rules demonstrably predate LLM-assisted authoring. It consists of pinned commits, the developers' rule files, a mechanical translation into specifications, and oracle verdicts from the developers' own tool. We offer it as a candidate dataset contribution.

## 7. Reproduce

```bash
npm ci && (cd experiments/tool-comparison/depcruise && npm ci)
W=$(mktemp -d)
npx tsx scripts/v1.3/human-rules-pilot/run.ts --work "$W"                        # HEAD: results/v1.3-human-rules-pilot/<id>.json
npx tsx scripts/v1.3/human-rules-pilot/run.ts --work "$W" --seed 4 --tag seeded  # seeded: <id>@seeded.json
for id in domain-driven-hexagon bookadesk-back faao; do
  npx tsx scripts/v1.3/human-rules-pilot/history.ts --work "$W" --id "$id"       # history/<id>.json
done
npx jest --maxWorkers=2 tests/unit/scripts/v1.3/human-rules-pilot.test.ts
```

**Files:**
- `scripts/v1.3/human-rules-pilot/`:
  - `lib.ts`: rule selection, atom translation, seeds, κ;
  - `run.ts` and `history.ts`;
  - `pilots.json`;
  - `candidates.json`: the 37 scanned repos;
  - `specs/*.idiomatic.yaml`.
- `results/v1.3-human-rules-pilot/`:
  - per-pilot JSON;
  - the generated specs (`specs/`);
  - `history/`.
- Clones go to `--work` and are never committed.
