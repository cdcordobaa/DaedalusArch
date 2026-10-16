# Tool landscape: architecture conformance, graph analysis, smell research, AI reviewers and MCP servers (verified 2026-10-16)

Branch `v1.3-research-tools`, base `origin/v1.3`. **Documentation and research only.** No code changed, no tool installed or run on DaedalusArch code, no LLM-judge call.

## 0. How to read this page

- **Sources.** Each tool fact comes from the tool's official documentation, README, package registry or a peer-reviewed paper. The URL is given inline. **Every URL was accessed on 2026-10-16** unless another date is stated.
- **Marking.** Three labels are used:
  - *(unverified)*: the claim could not be confirmed from a primary source. A search snippet or a page that did not load does not count as confirmation.
  - *(inferred)*: my own reading of verified facts, for example "deterministic" for a rule engine that never calls itself deterministic.
  - "**unknown**" in a matrix cell: no evidence either way.
- **Prior internal material.** This page extends and supersedes the following:
  - the Notion pages *Code-graph tools landscape for AI agents vs DaedalusArch (2026-10)* and *DaedalusArch vs dependency-cruiser and real fix pairs (2026-10-10)*. The landscape page's section 1 on context graphs (graphify, GitNexus, codebase-memory-mcp and others) is not repeated here; this page covers *rule* tools;
  - *DaedalusArch long-term ideas and future work*;
  - `Docs/DiagnosticRuns/tool-comparison-real-pairs-2026-10-10.md` (ADR-030);
  - `Docs/v1.3/night-backlog-2026-10-16.md`;
  - the branch `v1.3-validity-convergent` (dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS harness, still WIP, no PR yet).
- **Corrections to the earlier Notion landscape page** (2026-10-10), found during this verification:
  - **Structure101.** Sonar acquired it on 2024-10-15 and no longer sells it (§1.9). The page had marked this "uncertain".
  - **Sonar Architecture.** It **does** support TypeScript (§1.10). The page had marked TS coverage "uncertain".
  - **Sonargraph MCP server.** Sonargraph now ships one ("Zügel") that checks proposed dependencies against its architecture DSL (§1.8). The page's claim that "an architecture verdict over MCP is not [commodity], except for Sonar's commercial claim" is now **wrong** for Java, Python and C#.
  - **dependency-cruiser version.** The current release is 18.6.0, published 2026-10-11. ADR-030 pinned 18.4.0, which is still correct for that experiment.
  - **Arcan tool paper venue.** It appeared at ICSA Workshops 2017, not SANER.

## 1. Tools, family by family

DaedalusArch is described here only through what the repository shows on `origin/v1.3`:

- **Specs and styles.** Five style presets: `presets/{clean-architecture,layered,nestjs,hexagonal,ddd}.yaml`. YAML specs are compiled to Cypher templates (`src/fitness-compiler`).
- **Graph.** APG v2 enrichments for type flow, components with Martin metrics, public API, async coupling and I/O. They are **off by default** (`apg2: false` in `src/apg-extractor/types.ts`; `Docs/v1.3/apg2-design.md`). Dynamic `import()`/`require()` extraction is on by default in v1.3 (`src/apg-extractor/edge-extractor.ts`).
- **Engines.** Neo4j 5.26 is the reference engine. `--engine cypher-interp` runs the same rules with no database server (`Docs/v1.3/cypher-interpreter.md`).
- **Neural layer.** An LLM judge (`src/llm-critic`).
- **Agent loop.** An MCP server with eleven tools (`TOOL_NAMES` in `src/mcp-server/server.ts`; `Docs/v1.3/mcp-v2.md` describes the first ten), plus two neural-arm tools (`review_unit`, `explain_and_fix`) registered only with `--neural`.

### (a) Architecture conformance and dependency checkers

#### 1.1 ArchUnit (TNG, Java)
- **Version and licence.** 1.5.1, released 2026-09-25 per Maven Central `lastUpdated` ([maven-metadata](https://repo1.maven.org/maven2/com/tngtech/archunit/archunit/maven-metadata.xml), [releases](https://github.com/TNG/ArchUnit/releases)). Apache-2.0 ([repo](https://github.com/TNG/ArchUnit)).
- **Specification.** Rules are Java code in JUnit tests: "specify and assert architecture rules in plain Java". One declarative path exists: "ArchUnit can derive rules straight from PlantUML diagrams" via `adhereToPlantUmlDiagram(..)` ([User Guide §8.5](https://www.archunit.org/userguide/html/000_Index.html)).
- **Facts.**
  - It imports bytecode. Dependencies include field access, calls, member types ("type of a field … type of a method parameter"), supertypes, annotations and generic signature types (User Guide §6.2). Constructor-parameter *types* are therefore visible; runtime DI wiring is not modelled *(inferred)*.
  - Metrics: Lakos (CCD/ACD/RACD/NCCD), and component dependency metrics `getInstability`, `getAbstractness` and `getNormalizedDistanceFromMainSequence` (§8.7).
  - No async channels and no I/O.
- **Styles.** `layeredArchitecture()` (§4.6) and `onionArchitecture()` with domain models, domain services, application services and adapters; "No adapter may depend on another adapter" (§8.1.2). `slices()…beFreeOfCycles()`. There is no hexagonal or DDD preset; onion is the closest.
- **Audit.** `FreezingArchRule.freeze(rule)` keeps a violation baseline in plain text files (§8.6).
- **LLM, MCP, IDE.** None found.
- **TypeScript.** No (JVM bytecode).
- **Validation evidence.** No peer-reviewed evaluation of ArchUnit itself was found in three searches *(unverified negative; ACM/IEEE not searched directly)*. Canedo 2026 (§1.21) uses "ArchUnit-style rules" as one spec format; that claim comes from a snippet only *(unverified)*.

#### 1.2 ArchUnitTS (npm `archunit`)
- **Version and licence.** 2.5.4, published 2026-09-13 (npm registry). MIT ([repo](https://github.com/LukasNiessen/ArchUnitTS)). The convergent run pins exactly 2.5.4 (`experiments/validity-convergent/archunit/package.json` on `v1.3-validity-convergent`).
- **Specification.** Fluent TypeScript rules inside any test runner. Declarative path: "ArchUnitTS can validate your architecture against PlantUML diagrams". It can also read the Nx project graph.
- **Facts.**
  - Imports and cycles.
  - Metrics: LCOM, plus `metrics().distance().abstractness()/.instability()/.distanceFromMainSequence()`. Instability is per folder or project, not per file; see the convergent harness note in `scripts/v1.3/lib/convergent.ts` on that branch.
  - Type-only imports, DI, async and I/O: **unknown** (not stated).
- **Styles.** Example projects only: "Clean Architecture implementation using NestJS", "Hexagonal Architecture using Express", layered Fastify. These are not presets.
- **LLM.** None. The README says "we are planning to develop an LLM-based architecture testing library".
- **MCP or IDE.** None stated.
- **Validation evidence.** None found.

#### 1.3 ts-arch (npm `tsarch`)
- **Version and licence.** 5.4.1, published 2024-12-23. MIT. No GitHub releases are listed, so activity looks low ([repo](https://github.com/ts-arch/ts-arch)).
- **Specification.** Fluent rules (`filesOfProject().inFolder("business").shouldNot().dependOnFiles()…`). It checks slices against "an architecture diagram (Plant Uml)" and supports Nx.
- **Facts.** Imports and cycles. No metrics stated.
- **LLM, MCP.** None.
- **Validation evidence.** None found.

#### 1.4 dependency-cruiser
- **Version and licence.** 18.6.0, published 2026-10-11. MIT ([repo](https://github.com/sverweij/dependency-cruiser)). ADR-030 pinned 18.4.0.
- **Specification.** A declarative JS/JSON config with `forbidden`, `allowed` and `required` rules. Conditions on the module graph include `path`/`pathNot`, `reachable`, `dependencyTypes`, `via`/`viaOnly` for cycles, and `moreUnstable` ("a higher Instability than the module that depends on it") ([rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)).
- **Facts.**
  - ES/CJS/AMD imports, `type-only` and `dynamic-import` dependency types.
  - tsconfig path aliases (`aliased-tsconfig*`, the `tsConfig` option, [cli.md](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md)).
  - `--metrics` gives Ca, Ce and instability. No abstractness or LCOM found.
  - No DI, async or I/O.
- **Audit.** `--baseline` and `--ignore-known` ("As of 18.3.0 `--baseline` is the recommended way"). Many reporters: err, html, dot, mermaid, json, markdown, teamcity, azure-devops and more.
- **Styles.** Generic rules, no presets.
- **LLM, MCP.** None found.
- **Validation evidence.** None peer-reviewed found. The only head-to-head we know of is ours (ADR-030).

#### 1.5 eslint-plugin-boundaries
- **Version and licence.** 7.2.0, published 2026-08-09. MIT.
- **Specification.** Declarative ESLint settings:
  - `boundaries/elements` descriptors (`{ type, pattern }` with captured values) and `boundaries/files`;
  - rules `boundaries/dependencies`, `no-unknown-files`, `no-unknown-dependencies` and `no-ignored-dependencies`;
  - `element-types` is now a deprecated alias ([docs](https://www.jsboundaries.dev/docs/rules/), [overview](https://www.jsboundaries.dev/docs/overview/)).
- **Facts.** Import dependencies with kind `value`, `type` or `typeof` ("a TypeScript `import type` is a `type`", [classification](https://www.jsboundaries.dev/docs/classification/dependency/)). Dynamic imports **unknown**. No metrics, DI or async.
- **Integration.** IDE through ESLint. No MCP server.
- **Audit.** Deterministic lint *(inferred)*. No baseline feature found.
- **Validation evidence.** None found.
- The convergent run pins 7.2.0 on ESLint 10.11.0.

#### 1.6 Nx `@nx/enforce-module-boundaries`
- **Version and licence.** `@nx/eslint-plugin` 23.3.0, published 2026-10-07. MIT.
- **Specification.**
  - Project tags plus `depConstraints` with `sourceTag`/`allSourceTags`, `onlyDependOnLibsWithTags`, `notDependOnLibsWithTags`, `allowedExternalImports` and `bannedExternalImports`.
  - Options `banTransitiveDependencies`, `checkDynamicDependenciesExceptions` and `allowCircularSelfDependency`. These were read from the published rule schema in the 23.3.0 tarball ([docs](https://nx.dev/docs/features/enforce-module-boundaries)).
- **Facts.** Project-level imports and external packages, including dynamic `import()`. The granularity is the *project*, not the file or class.
- **Integration.**
  - ESLint/Oxlint in the editor and Nx Console.
  - An **official Nx MCP server** that "gives LLMs deep access to your monorepo's structure" ([nx-mcp](https://nx.dev/docs/reference/nx-mcp)). It exposes the workspace graph; whether it returns boundary verdicts is **unknown**.
- **LLM.** None in the rule.
- **Validation evidence.** None found.

#### 1.7 madge
- **Version and licence.** 8.0.0, published 2024-08-05. MIT ([repo](https://github.com/pahen/madge)).
- **What it is.** A graph and cycle tool, **not a rule checker**: `--circular`, `--orphans`, `--leaves`. No constraint config. The dependency-cruiser maintainer says its "primary goal is visualisation" ([issue 203](https://github.com/sverweij/dependency-cruiser/issues/203)).
- **Facts.** TS supported via detective-typescript; aliases via `tsConfig`.

#### 1.8 Sonargraph (hello2morrow)
- **Specification.** Its own architecture DSL in `.arc` files, "a DSL (domain specific language) to describe and enforce software architecture rules", plus Groovy scripting ([product](https://www.hello2morrow.com/products/sonargraph)).
  - Keywords include `artifact`, `include "**/controller/**"`, `connect to … transitively`, `interface` and `export` ([blog tag](https://blog.hello2morrow.com/tag/software-architecture-dsl/)).
  - Architect "checks every dependency in the code against it, in the IDE and in the CI build" ([Architect](https://www.hello2morrow.com/products/sonargraph/architect9)).
- **Facts.** Compiler-resolved dependencies, cycle groups, "hundreds of metrics". Martin metrics specifically *(unverified)*. No DI, async or I/O evidence.
- **Languages.** "C#, C/C++, Java/Kotlin, TypeScript, Go and Python 3" (Architect page).
- **Agent loop.** **Zügel**, an MCP server that "understands our architecture DSL and guides any coding agent with MCP support".
  - 26 tools, including `check_proposed_dependency`, `list_violations`, `query_dependencies`, `list_cycles`, `create_baseline` and `explain_architecture_dsl`.
  - Violations are "computed by the server from real compiler bindings" ([post, 2026-07-22](https://blog.hello2morrow.com/2026/07/sonargraph-mcp-2/)).
  - It currently supports Java, Python and C#, **not TypeScript** per that post, and needs a licence ([first steps](https://blog.hello2morrow.com/2026/09/first-steps-with-zugel/)).
- **Styles.** Layering examples; "architecture templates" blog posts. No named hexagonal or DDD template *(unverified)*.
- **Validation evidence.** A 2019 TechDebt paper describes architects describing their "blueprint using a custom DSL" ([IEEE CSDL](https://computer.org/csdl/proceedings-article/techdebt/2019/337100a066/1cdP6SlPtDy)); authors and title *(unverified, page did not render)*.
- **Licence.** Commercial; Sonargraph-Explorer is free.

#### 1.9 Structure101
- **Ownership.** Sonar acquired it ("GENEVA, October 15, 2024", [press release](https://www.sonarsource.com/company/press-releases/sonar-acquires-structure101-to-strengthen-code-quality-offering/)). "Will Structure101 products still be available for sale? No." ([sonarsource.com/structure101](https://sonarsource.com/structure101/)).
- **Specification.** A visual "Structure Spec" "to specify grouping, layering, and visibility" ([docs](https://www.sonarsource.com/structure101/docs/java/studio/Content/perspectives/Structure%20Spec%20Tab.htm)). A headless check-spec breaks the build on new violations ([docs](https://www.sonarsource.com/structure101/docs/cpa/studio/Content/cli/headless-checkspec.html)).
- **Languages.** Java and C/C++ doc sets. TS **unknown**.
- **Relevance.** Historical prior art; its capabilities live on in SonarQube Architecture (§1.10).

#### 1.10 SonarQube Architecture and Sonar Vortex
- **Specification.** An "intended architecture" drawn in a visual editor (Architecture > Intended architecture). It is an allow-list: undefined dependencies between siblings are forbidden. "Generate draft" proposes a start ([docs](https://docs.sonarsource.com/sonarqube-server/architecture)). No DSL or file format is documented.
- **Facts.** A dependency graph "extracted from source code" with "No manual steps". Issue kinds:
  - flaws: tangles, oversize;
  - smells;
  - deviations: "wrong dependencies and wrong locations".
- **Languages.** "Java, C#, JavaScript, TypeScript, Python". Server commercial editions from 2026.4 ([community announcement](https://community.sonarsource.com/t/architecture-analysis-in-sonarqube-server-2026-4/186120)); Cloud since 2025-12-16 ([blog](https://www.sonarsource.com/blog/introducing-architecture-in-sonarqube/)).
- **AI.**
  - AI CodeFix is LLM-based ([docs](https://docs.sonarsource.com/sonarqube-server/2025.1/ai-capabilities/ai-codefix)).
  - AI Code Assurance applies gates to AI-generated code ([docs](https://docs.sonarsource.com/sonarqube-server/2026.3/project-administration/ai-features/overview.md)).
  - Sonar Vortex "Exposes the current architecture graph and user-defined architectural constraints" to agents ([Vortex context](https://docs.sonarsource.com/agent-centric-development-cycle/inside-your-agent-the-agentic-loop/sonar-vortex-context)).
- **MCP.** The SonarQube MCP server ([repo](https://github.com/SonarSource/sonarqube-mcp-server), [tools](https://docs.sonarsource.com/sonarqube-mcp-server/reference/tools)) exposes `get_current_architecture` and `get_intended_architecture` (a Vortex subscription is needed), plus analysis, issue and quality-gate tools.
  - The architecture tools **read** the model. No MCP tool documents an on-demand architecture verdict; deviations surface as issues after analysis.
  - JS/TS architecture support over MCP is "partial" (tools reference).
- **Validation evidence.** Vendor figures only: "up to 36% fewer tokens, 92% fewer issues, 3.2% false positives" ([Vortex launch, 2026-06-30](https://sonarsource.com/blog/introducing-sonar-vortex/)). No independent evaluation found.

#### 1.11 Lattix
- **Specification.** A DSM plus design rules "Cannot Use", "Can Use" and "Must Use", attached to cells and inherited down the hierarchy. The LDC command line runs in CI ([docs](https://docs.lattix.com/lattix/userGuide/Monitoring_and_Enforcing_Architecture.html)). Groovy scripting.
- **Ownership.** Acquired by CodeClinic in 2021 *(unverified: snippet; page 403)*.
- **Languages.** A JavaScript module exists. TypeScript *(unverified)*.
- **MCP.** "Lattix 2026.0 introduces … the Lattix MCP Server" *(unverified: snippet; page 403)*.
- **Validation evidence.** Sangal, Jordan, Sinha, Jackson, "Using Dependency Models to Manage Complex Software Architecture", OOPSLA 2005 ([PDF](https://groups.csail.mit.edu/sdg/pubs/2005/oopsla05-dsm.pdf)).

#### 1.12 NDepend (.NET; design reference only)
- **Specification.** CQLinq, "the C# Linq subset to query the NDepend model". A rule is a query with `warnif`; about 200 default rules ship ([CQLinq](https://ndepend.com/features/cqlinq)).
- **Facts.** Dependency matrix and graph, Abstractness vs Instability (Martin). Rule ND1412 enforces "Clean Architecture"; DDD rules are community examples only.
- **MCP.** NDepend.MCP.Server ([repo](https://github.com/ndepend/NDepend.MCP.Server)): 14 tools, including `ndepend-run-analysis`, `ndepend-gen-code-query-and-rule` and `ndepend-run-code-query-or-rule`. It "guides the LLM to generate non-trivial code queries and rules from natural language" ([what's new](https://www.ndepend.com/whatsnew)).
- **Design lesson for DaedalusArch.** NDepend is the closest *design* analogue of DaedalusArch's MCP arm:
  - a query language over a code model;
  - default rules;
  - an MCP tool that turns natural language into a rule.
  - The difference: NDepend's LLM *writes rules*, while DaedalusArch's judge *evaluates code* that the rules cannot decide.
- **TypeScript.** None.
- **Validation evidence.** None peer-reviewed found.

### (b) Graph- or query-based code analysis

#### 1.13 jQAssistant: the closest prior art

Sources: manual [M](https://jqassistant.github.io/jqassistant/current/); jMolecules plugin [JM](https://github.com/jqassistant-plugin/jqassistant-jmolecules-plugin); TS plugin [TS](https://jqassistant-plugin.github.io/jqassistant-typescript-plugin/current/) and its [repo](https://github.com/jqassistant-plugin/jqassistant-typescript-plugin).

- **What it is.** "a QA tool which allows the definition and validation of project specific rules on a structural level. It is built upon the graph database Neo4j" (M).
  - Neo4j is embedded ("file" URI) or remote ("bolt"). The JDK 17 distribution "includes Neo4j v5.x"; the 2.10.0 milestones update to Neo4j 5.26.x ([releases](https://github.com/jQAssistant/jqassistant/releases)).
  - Latest stable is 2.9.1 (tag dated 2026-02-17); 2.10.0-M4 is a pre-release. Licence GPL-3.0.
- **Rules.**
  - "Rules are expressed as Cypher queries and are specified in XML files". AsciiDoc rule files are also supported, and JavaScript, Ruby or Groovy may replace Cypher.
  - *Concepts* enrich the graph; *constraints* report violations; `requiresConcept`/`providesConcept` order them; *groups* bundle them.
  - Severities run INFO to BLOCKER with `warn-on-severity`/`fail-on-severity`. A checked-in `jqassistant-baseline.xml` holds the baseline.
  - Reports: XML, HTML (AsciiDoc), CSV and JUnit XML; plugins add SARIF, CodeClimate and PlantUML.
  - Integration: Maven plugin and CLI (M).
  - **YAML is configuration only (`.jqassistant.yml`), not a rule format.**
- **Declarative architecture input.** Every rule inspected is hand-written Cypher. The two closest things to a spec:
  - **jMolecules plugin** (JM, 5 stars, no releases listed). Architecture is declared **in the code** with jMolecules annotations and marker types. The plugin ships fixed Cypher rule packs for `jmolecules-ddd`, `jmolecules-hexagonal`, `jmolecules-layered`, `jmolecules-onion-classical`/`-simplified` (Default and Strict variants), `jmolecules-cqrs` and `jmolecules-event`.
    - Example constraints: `jmolecules-hexagonal:PortMustBePartOfApplicationCore`, `jmolecules-ddd:IllegalDependenciesBetweenBoundedContexts`, `jmolecules-onion-classical:IllegalRingDependency`.
    - The allowed-layer matrix is a **hard-coded Cypher list literal** inside a concept (`jmolecules-layered-strict.xml`):
      ```
      WITH [ ["Interface", "Application"], ["Interface", "Domain"], ["Interface", "Infrastructure"],
             ["Application", "Domain"], ["Application", "Infrastructure"], ["Domain", "Infrastructure"]
           ] AS allowedDependencies
      UNWIND allowedDependencies AS allowedDependency ... MERGE (dependentLayer)-[:DEFINES_DEPENDENCY]->(dependencyLayer)
      ```
      and the constraint `jmolecules-layered:IllegalLayerDependency` matches `(t1)-[:DEPENDS_ON]->(t2)` across layers with no `DEFINES_DEPENDENCY`.
    - **This is the strongest prior art for DaedalusArch's style libraries**, and it must be cited in Ch2.
  - **C4 plugin** (2 stars). It scans C4-PlantUML diagrams into the graph to "validate the as-is architecture … against the to-be architecture". The model is imported as *data*; users still write the comparison constraints in Cypher. Whether shipped C4 conformance constraints exist is *(unverified)*.
- **TypeScript.**
  - How it works: a Node tool (`jqa-ts-lce`, npm `@jqassistant/ts-lce` 1.4.4, published 2026-03-23) writes `.reports/jqa/ts-output.json`, which the jQA scanner imports.
  - Nodes: modules, classes, interfaces, type aliases, enums, functions, variables, methods, properties, parameters, decorators, constructors and a detailed `Type` sub-model, plus a React extension.
  - Dependencies: `DEPENDS_ON` with a `cardinality`, aggregated from statements up to modules; re-exports resolve to the original declaration.
  - Limits: "only supports projects using ECMAScript modules" and is tested on TS 5.x. No DI, route or messaging extraction found.
  - Maturity: 4 stars, empty releases section, last commit on main 2026-04-14.
- **Java facts, for scale.** The model includes:
  - relations `DEPENDS_ON` (weighted), `INVOKES`, `READS`/`WRITES`, `RETURNS` and generics;
  - method metrics (`cyclomaticComplexity`, `effectiveLineCount`) and `java:AvoidCyclicPackageDependencies`;
  - plugins for Spring (DI and component rules such as `spring-component:ControllerMustOnlyDependOnServicesRepositories`), JPA and Maven POMs, and an AsyncAPI *contract-file* scanner ("no public release available yet").
- **LLM, MCP.** None in the official jQAssistant organisation. Third parties propose a generic Neo4j MCP server ([mcp-neo4j](https://github.com/neo4j-contrib/mcp-neo4j)) over a jQA graph ([GuardBench issue](https://github.com/GuardBench/guardbench-backend/issues/282)).
- **Validation evidence.** No peer-reviewed evaluation found (arXiv/IEEE/ACM web search; Scholar not queried directly). Found: a 2018 Ulm University bachelor thesis ([announcement](https://www.uni-ulm.de/en/in/iui-dbis/single-news/article/jqassistant-a-qa-tool-for-definition-and-validation-of-software-architecture-rules/)) and practitioner talks. Long industrial use is plausible but not documented as evidence.

#### 1.14 CodeQL
- **Rules.** QL, "a declarative, object-oriented query language … based on Datalog" ([about QL](https://codeql.github.com/docs/ql-language-reference/about-the-ql-language/)). No architecture-spec layer exists.
- **Facts.**
  - JS/TS `Import` covers ES imports and `require`; global data flow and taint ([JS library](https://codeql.github.com/docs/codeql-language-guides/codeql-library-for-javascript/), [data flow](https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-javascript-and-typescript/)).
  - Martin package metrics exist **only for Java** (`MetricPackage`: instability, abstractness, distance) ([library](https://codeql.github.com/codeql-standard-libraries/java/semmle/code/java/metrics/MetricPackage.qll/type.MetricPackage$MetricPackage.html)).
  - No shipped layering query found *(unverified negative)*.
- **TypeScript.** Versions 2.6–7.0 via the JavaScript extractor ([languages](https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/)).
- **LLM.** Copilot Autofix "uses a generative model that is non-deterministic" ([docs](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/responsible-use-autofix-code-scanning)).
- **MCP.** The GitHub MCP server reads existing alerts (`list_code_scanning_alerts`, `get_code_scanning_alert`) ([repo](https://github.com/github/github-mcp-server)).
- **Audit.** SARIF 2.1.0.
- **Licence.** Libraries MIT; CLI proprietary, free for research and OSS.
- **Validation evidence.** Avgustinov et al., "QL: Object-oriented Queries on Relational Data", ECOOP 2016, DOI [10.4230/LIPIcs.ECOOP.2016.2](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ECOOP.2016.2). Security benchmarks exist; nothing on architecture conformance.

#### 1.15 Joern and code property graphs
- **Rules.** CPGQL, "a Scala-based domain-specific query language" ([docs](https://docs.joern.io/)). joern-scan queries are Scala `Query.make` entries ([scan](https://docs.joern.io/scan/)).
- **Facts.** The CPG "merges … abstract syntax trees, control flow graphs and program dependence graphs". Yamaguchi, Golde, Arp, Rieck, IEEE S&P 2014, DOI 10.1109/SP.2014.44 ([PDF](https://mlsec.tu-berlin.de/docs/2014-ieeesp.pdf)). No import, DI, metric or layering examples in the docs.
- **TypeScript.** Via `jssrc2cpg` ([frontends](https://docs.joern.io/frontends/javascript/)). Specific TS maturity *(unverified)*.
- **MCP.** CodeBadger, a "containerized Model Context Protocol (MCP) server" over Joern, GPL-3.0 ([repo](https://github.com/lekssays/codebadger)). Paper: Lekssays, arXiv [2603.24837](https://arxiv.org/abs/2603.24837) (security case studies).
- **Licence.** Apache-2.0. Native SARIF output *(unverified)*.

#### 1.16 Semgrep
- **Rules.** YAML pattern rules (`patterns`, `pattern-not-inside`, `paths: include/exclude`) ([rule syntax](https://docs.semgrep.dev/writing-rules/rule-syntax)). `import $X` patterns plus path scoping make hand-written layer rules possible *(inferred; no official layering example)*.
- **Facts.**
  - Taint mode; "Interprocedural taint analysis is a Semgrep Pro feature" ([taint](https://docs.semgrep.dev/writing-rules/data-flow/taint-mode/overview)).
  - Community Edition is limited to a single function or file ([repo](https://github.com/semgrep/semgrep)).
  - No metrics, DI or channels.
- **LLM.** Semgrep Assistant ("Multimodal") does autotriage and autofix, using OpenAI with a Bedrock fallback ([overview](https://docs.semgrep.dev/semgrep-assistant/overview)).
- **MCP.** The standalone repo is archived and the server now lives in the `semgrep` binary. Tools: `semgrep_scan`, `semgrep_scan_with_custom_rule`, `security_check`, `get_abstract_syntax_tree`, `semgrep_findings` ([repo](https://github.com/semgrep/mcp)).
- **Audit.** SARIF (`--sarif`); metrics are sent by default unless `--metrics=off` ([CLI](https://docs.semgrep.dev/cli-reference)).
- **TypeScript.** GA ([languages](https://docs.semgrep.dev/supported-languages)).
- **Licence.** CE LGPL-2.1; the rules licence is internal-use only ([licensing](https://docs.semgrep.dev/licensing)).
- **Validation evidence.** Semgrep and CodeQL appear among the seven SAST tools in Li et al., ESEC/FSE 2023, DOI 10.1145/3611643.3616262 (tool list via a secondary citation, *partly verified*). No architecture evidence.

### (c) Architecture-smell and recovery research tools

None of the four tools below takes a declared intended architecture. All detect from code (and history). None has an MCP server or TypeScript support *(none found)*.

#### 1.17 Arcan
- **Paper.** Arcelli Fontana, Pigazzini, Roveda, Tamburri, Zanoni, Di Nitto, "Arcan: A Tool for Architectural Smells Detection", ICSA Workshops 2017, pp. 282–285, DOI 10.1109/ICSAW.2017.16 ([PDF](https://boa.unimib.it/bitstream/10281/155470/1/PID4705339.pdf)).
- **Engine.** "Apache Tinkerpop"; "the queries are written in Gremlin-Java"; the graph is stored in memory or in Neo4j. So it is a **graph-database smell detector**: an older relative of the APG idea, with hard-coded detectors and thresholds.
- **Smells (2017).** Cyclic, Unstable and Hub-Like Dependency. God Component *(unverified; wiki 503)*.
- **Languages.** Java (2017); C/C++ added in Biaggi et al., SEAA 2018, DOI 10.1109/SEAA.2018.00074.
- **LLM research around it.** Tessa, Bochicchio, Arcelli Fontana, "Exploring Architectural Smells Detection Through LLMs", ECSA 2025, DOI 10.1007/978-3-032-02138-0_6. Pandini et al., "An Exploratory Study on Architectural Smell Refactoring Using Large Language Models", ICSA-C 2025, DOI 10.1109/ICSA-C65153.2025.00070.
- **Commercial.** arcan.tech is "AI-powered" and sold as a subscription ([site](https://www.arcan.tech/)). Its identity with the UniMiB tool is *(unverified)*.

#### 1.18 Designite / DesigniteJava
- **What it is.** "a code quality assessment tool for C# and Java". It "Detects 7 architecture smells", 20 design smells and 11 implementation smells, with trend and multi-commit analysis ([lab page](https://web.cs.dal.ca/~tushar/smart/pages/artifacts.html)).
- **Papers.** Sharma, Mishra, Tiwari, BRIDGE '16, DOI 10.1145/2896935.2896938. Sharma, "Multi-faceted Code Smell Detection at Scale using DesigniteJava 2.0", MSR 2024, DOI 10.1145/3643991.3644881.
- **TypeScript.** None.

#### 1.19 ARCADE
- **Paper.** Schmitt Laser, Medvidovic, Le, Garcia, "ARCADE: An Extensible Workbench for Architecture Recovery, Change, and Decay Evaluation", ESEC/FSE 2020 demo, DOI 10.1145/3368089.3417941 ([PDF](https://jgarcia.ics.uci.edu/wp-content/uploads/arcade_fse20demo.pdf)).
- **Scope.** Recovery (ACDC, ARC, WCA, Bunch, ZBR, …), "11 different architectural smells", and metrics MoJoFM, a2a, cvg and c2c.
  - Concern smells use topic modelling, which is probabilistic *(inferred: not deterministic)*.
  - Languages: C/C++ and Java; subsets for C# and Python.
- **Evidence.** Le et al., MSR 2015, DOI 10.1109/MSR.2015.29. Behnamghader et al., EMSE 2016, DOI 10.1007/s10664-016-9466-0.

#### 1.20 DV8 / Design Rule Spaces
- **Paper.** Cai, Kazman, "DV8: Automated Architecture Analysis Tool Suites", TechDebt 2019, DOI 10.1109/TechDebt.2019.00015 ([PDF](https://par.nsf.gov/servlets/purl/10194572)).
- **Scope.** Decoupling Level and Propagation Cost, plus six anti-patterns: Unstable Interface, Modularity Violation, Unhealthy Inheritance, Crossing, Clique, Package Cycle. It uses source code **and revision history** (co-change).
- **Spec.** "Design rules" are *derived* by the tool, not declared by the user.
- **Evidence.** Xiao, Cai, Kazman, ICSE 2014, DOI 10.1145/2568225.2568241. Xiao et al., "Identifying and Quantifying Architectural Debt", ICSE 2016, DOI 10.1145/2884781.2884822. Mo et al., WICSA 2015, DOI 10.1109/WICSA.2015.12.
- **Languages.** *(unverified)*. The ArchDia commercial site returned 503.

**Related LLM-era recovery work (verified):**
- ArchAgent, arXiv [2601.13007](https://arxiv.org/abs/2601.13007): static analysis plus LLM synthesis for recovery.
- SemRef, ICSE 2026 ([page](https://conf.researchr.org/details/icse-2026/icse-2026-research-track/72/Semantic-Enhanced-Automatic-Refinement-of-Architecture-Recovery-Results-Using-LLMs)): LLM refinement of recovery results.
- Schmid et al., "Software Architecture Meets LLMs: A Systematic Literature Review", arXiv [2505.16697](https://arxiv.org/abs/2505.16697). Per the abstract, conformance checking remains "underexplored". The exact wording comes from a snippet *(verify before quoting)*.

### (d) AI code reviewers, agent guardrails and spec-driven development

**Common pattern.** In every tool below, architecture intent is **natural language read by an LLM**. Deterministic parts are generic linters/SAST, syntax-level ast-grep, or structural validation of the spec files themselves. None compiles an architecture spec into deterministic checks on code.

#### 1.21 AI code reviewers

**CodeRabbit**
- **Rules.** Path instructions are glob-scoped natural language in `.coderabbit.yaml` ([path instructions](https://docs.coderabbit.ai/configuration/path-instructions)). It also auto-reads guideline files (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursorrules` and others) ([code guidelines](https://docs.coderabbit.ai/knowledge-base/code-guidelines)). ast-grep YAML rules are available on paid tiers ([ast-grep](https://docs.coderabbit.ai/configuration/ast-grep-instructions)).
- **Facts.** "Code Graph Analysis" covers definitions, references and co-change ([docs](https://docs.coderabbit.ai/integrations/code-graph-analysis)).
- **Deterministic tools.** About 50 third-party tools run beside the LLM, including ESLint, Biome, Semgrep and ast-grep ([tool list](https://docs.coderabbit.ai/tools/list)).
- **Agent loop.** A CLI for coding agents (`coderabbit review --plain`, [CLI](https://coderabbit.ai/cli)). It *consumes* MCP servers as context; serving MCP itself is *(unverified)*.
- **Independent evidence.** Lin et al., arXiv [2607.03316](https://arxiv.org/abs/2607.03316): across 31,073 review–feedback pairs, "36.4% were accepted … 56.3% were rejected".

**GitHub Copilot code review**
- **Rules.** Natural-language `.github/copilot-instructions.md`, path-scoped `*.instructions.md` and `AGENTS.md` ([docs](https://docs.github.com/en/copilot/concepts/agents/code-review)).
- **Architecture.** Agentic since 2026-03-05 ([changelog](https://github.blog/changelog/2026-03-05-copilot-code-review-now-runs-on-an-agentic-architecture/)). Blends CodeQL, ESLint and PMD detections since 2025-11-20 (preview, [changelog](https://github.blog/changelog/2025-11-20-linter-integration-with-copilot-code-review-now-in-public-preview/)). "Copilot is not guaranteed to spot all problems."
- **MCP.** `request_copilot_review` in the GitHub MCP server.
- **Evidence.** No independent study specific to Copilot code review found. Aggregate MSR '26 study of 13 review agents, arXiv [2604.03196](https://arxiv.org/abs/2604.03196): PRs reviewed only by agents merge at 45.20% vs 68.37% for human-only.

**Qodo (formerly CodiumAI; Qodo Merge / PR-Agent)**
- **Rules.** `best_practices.md` ([docs](https://docs.qodo.ai/v1/features/best-practices)). A beta "Rules System" creates rules from natural language or mines them from PR history ([docs](https://docs.qodo.ai/governance/rule-enforcement)).
- **Determinism.** LLM-based; no deterministic compilation found.
- **Evidence.**
  - Vendor benchmark: F1 60.1% on 580 injected issues ([blog](https://qodo.ai/blog/how-we-built-a-real-world-benchmark-for-ai-code-review)).
  - Independent industrial study of a PR-Agent-based tool: Cihan et al., arXiv [2412.18531](https://arxiv.org/abs/2412.18531): 73.8% of comments resolved, PR closure time up from 5h52m to 8h20m.
  - MCP server details *(partly unverified)*. PR-Agent is OSS ([repo](https://github.com/qodo-ai/pr-agent)).

**Sourcegraph Cody**
- **Status.** Cody Free and Pro closed on 2025-07-23: "Amp is the best path forward" ([blog](https://sourcegraph.com/blog/changes-to-cody-free-pro-and-enterprise-starter-plans)). Enterprise only now.
- **Architecture rules.** None found. **Drop it from the comparison except as a historical note.**

#### 1.22 Spec-driven development tools
- **GitHub Spec Kit** ([repo](https://github.com/github/spec-kit), MIT).
  - Commands `/speckit-constitution`, `-specify`, `-plan`, `-tasks`, `-implement`.
  - The constitution is `memory/constitution.md`. "Phase -1 gates" are checklists in the plan template that the agent works through ([spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)).
  - Not compiled into checks; no style templates.
- **OpenSpec** ([repo](https://github.com/Fission-AI/OpenSpec)).
  - Specs are "Plain Markdown — requirements with concrete scenarios" (SHALL / WHEN-THEN); changes are delta specs.
  - `openspec validate` is deterministic but checks the **spec files' structure** only ([CLI](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md)), never code.
  - PR #154 already chains OpenSpec into DaedalusArch's spec.
- **AWS AI-DLC** ([repo](https://github.com/awslabs/aidlc-workflows), MIT-0; [AWS blog](https://aws.amazon.com/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/)).
  - Markdown workflow rules with phases, approval gates and an audit trail. This repository uses it (`CLAUDE.md`, `aidlc-docs/`).
  - The current README describes "5 phases, 33 stages, 14 agents" and a "deterministic engine" for the **workflow**. This differs from the 2025 three-phase release that this repository vendored, so cite the commit used.
  - Nothing checks the produced code against an architecture.
- **Kiro specs.** EARS requirements plus `design.md` and `tasks.md`, and steering Markdown ([docs](https://kiro.dev/docs/specs/concepts)). Natural language only.

#### 1.23 Architecture-aware agent papers (verified)
- **Slater, arXiv [2512.04273](https://arxiv.org/abs/2512.04273).** A hexagonal pilot: "Llama 3 demonstrated an 80% Architectural Violation Rate" vs 0% for GPT-5.1. Small, single scenario.
- **Canedo, "Architecture as Capability Equalizer for Coding Agents", arXiv [2608.21747](https://arxiv.org/abs/2608.21747).** Five spec formats, including TS contracts with ArchUnit-style rules; 6 models, 90 trials; structured specs narrow the gap for weaker models. **Directly relevant to SO5 (spec level).** Its measurement method (static imports plus an LLM judge) *(unverified: snippet)*. Read in full before citing.
- **Madatha, arXiv [2606.26924](https://arxiv.org/abs/2606.26924).** Argues governance of coding agents "must be deterministic … not delegated to further LLM orchestration". It targets agent configuration drift, not generated code. Useful framing for the "symbolic gate first" design.
- **Not opened** *(unverified)*: SBES 2025 "Language Models as Architectural Gatekeepers" ([link](https://sol.sbc.org.br/index.php/sbes/article/view/37049)); MDE4SA 2025 LLM recommenders for architectural-violation resolution ([link](https://www.ipr.mdu.se/publications/7131-LLM_Based_Recommender_Systems_for_Violation_Resolutions_in_Continuous_Architectural_Conformance)). **Both are possible direct competitors on the "LLM plus conformance" claim and must be read before Ch2 is final.**

### (e) MCP servers for code quality and architecture

| Server | Owner | Returns | Architecture rules? | TS | Maturity (2026-10-16) |
|---|---|---|---|---|---|
| [SonarQube MCP](https://github.com/SonarSource/sonarqube-mcp-server) | SonarSource | analyser issues, quality gate; `get_intended_architecture` / `get_current_architecture` read the model | reads the intended model; **no on-demand verdict tool documented** | yes (architecture "partial") | 665★, 1.29.0 |
| [Zügel](https://blog.hello2morrow.com/2026/07/sonargraph-mcp-2/) | hello2morrow | DSL-based violations, `check_proposed_dependency` | **yes, against the Sonargraph DSL** | **no** (Java, Python, C#) | commercial, v26.6.1 |
| [NDepend MCP](https://github.com/ndepend/NDepend.MCP.Server) | NDepend | CQLinq results; NL → rule generation | yes, via CQLinq rules | no (.NET) | MIT server, licensed engine |
| Lattix MCP | Lattix | *(unverified)* | *(unverified)* | *(unverified)* | 2026.0 release *(snippet)* |
| [Nx MCP](https://nx.dev/docs/reference/nx-mcp) | Nx | workspace and project graph | boundary verdicts **unknown** | yes | official |
| [Semgrep MCP](https://github.com/semgrep/mcp) | Semgrep | rule-engine findings | only via hand-written custom rules | yes | inside `semgrep` |
| [GitHub MCP](https://github.com/github/github-mcp-server) | GitHub | existing CodeQL/Dependabot alerts | no | via CodeQL | 33.7k★ |
| [ESLint MCP](https://eslint.org/docs/latest/use/mcp) | ESLint | lint results | only via configured plugins (e.g. boundaries) *(inferred)* | yes | `npx @eslint/mcp` |
| [Snyk Studio MCP](https://github.com/snyk/studio-mcp), [Codacy MCP](https://github.com/codacy/codacy-mcp-server), [DeepSource MCP](https://deepsource.com/blog/mcp-server), [CodeScene MCP](https://github.com/codescene-oss/codescene-mcp-server) | vendors | security, quality, code health | no | yes / unknown | various; CodeScene in beta |
| [trace-mcp](https://github.com/nikolai-vysotskyi/trace-mcp) | community | `check_architecture`: forbidden imports between layers, presets clean-architecture and hexagonal (description from a third-party listing) | yes (layers) | yes | 194★ |
| [dependency-mcp](https://github.com/mkearl/dependency-mcp) | community | glob allow/forbid rules → score (100 minus 5 per violation) | yes, glob level | yes | 20★ |
| [ArchRad](https://github.com/archradhq/arch-deterministic) | community | validates a declarative IR plus YAML policy packs, "no LLM"; reads TS by regex | yes, but over an IR, not code | regex only | 1★ |
| [archprint](https://github.com/Tommkruix/archprint) | community | rules **mined from code**; emits ESLint, dependency-cruiser and ts-arch config | inferred rules | yes | 7★ |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) `check` | community | "read-only structural checks" | not documented | yes | 47.9k★ |
| [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | DeusData | architecture overview, ADR management | no rule checking | **unknown** | 46.7k★, arXiv 2603.27277 |
| [CodeBadger](https://github.com/lekssays/codebadger) | QCRI (per GitHub owner) | Joern CPG queries | no | JS listed | 174★ |
| ArchUnit, jQAssistant, dependency-cruiser, Qodana | — | no official MCP server found | — | — | — |

**Conclusion for (e).** For **TypeScript**, no mature or official MCP server evaluates code against a declarative, style-level architecture spec and returns a verdict. The candidates fall short as follows:

- SonarQube MCP reads the intended model but documents no verdict tool.
- Zügel does check proposed dependencies, but not for TS.
- trace-mcp has layer presets; it is a small community project and its spec format is undocumented.
- dependency-mcp returns a score, not a verdict.
- archprint mines its rules instead of reading a declared spec.

For **Java, Python and C#**, Zügel is a real counterexample to "no in-loop architecture verdict exists".

## 2. Capability matrix

**Facts column codes:**
- **I**: imports (dyn = dynamic `import()`, ty = type-only);
- **T**: type flow through signatures or members;
- **D**: dependency injection or constructor wiring;
- **C**: components or packages with metrics (M = Martin instability/abstractness/distance);
- **A**: async or message channels;
- **O**: I/O or side effects.

"—" means no, per the cited docs; "unknown" means not verifiable. "Validation evidence" means a peer-reviewed or independent evaluation **of the tool itself**.

| Tool | Specification language | Rule representation | Architectural facts | Semantic / LLM layer | Agent-loop integration | Determinism and auditability | Styles | TypeScript | Published validation evidence |
|---|---|---|---|---|---|---|---|---|---|
| **DaedalusArch** | **YAML architecture spec per style, compiled to rules** | **Cypher** (generated; one text, two engines) | I (dyn, ty, re-exports), T, D, C (M), A, O. T/C/A/O are APG v2 and **off by default** | **LLM judge** for non-structural rules | **MCP server, 11 tools** (`check_file`, `check_diff`, `blockingVerdict`), +2 neural tools with `--neural`; no IDE plugin | deterministic symbolic layer, Neo4j vs interpreter parity; judge is not deterministic | clean, layered, nestjs, hexagonal, ddd | native, **only** | own studies only: SO4 seeded held-out (37/37 in coverage), ADR-030 vs dependency-cruiser, 5 real pairs (2/5), 71-case dev set; sealed hold-out pending; **no peer-reviewed publication yet** |
| ArchUnit | code; PlantUML import | Java fluent API in tests | I, T (member/param types), D (types only), C (M, Lakos) | — | — (JUnit) | deterministic *(inferred)*; freeze baseline | layered, onion presets | — | none found |
| ArchUnitTS | code; PlantUML; Nx graph | TS fluent API in tests | I, C (M per folder, LCOM); T/D unknown | — (LLM planned) | — | deterministic *(inferred)* | examples only (clean, hexagonal) | native | none found |
| ts-arch | code; PlantUML | TS fluent API in tests | I, cycles | — | — | deterministic *(inferred)* | — | native | none found |
| dependency-cruiser | **declarative config** | JS/JSON rule objects | I (dyn, ty, aliases), C (instability only) | — | — | deterministic; `--baseline`; many reporters | generic | native | none found (ours: ADR-030) |
| eslint-plugin-boundaries | **declarative ESLint settings** | element descriptors plus rules | I (value/type) | — | IDE via ESLint | deterministic *(inferred)*; no baseline found | generic | via TS parser | none found |
| Nx module boundaries | **tags plus depConstraints** | ESLint rule options | I (project level, dyn) | — | IDE; Nx MCP (graph) | deterministic *(inferred)* | tag layering | native | none found |
| madge | — | — (graph tool) | I, cycles, orphans | — | — | deterministic | — | yes | none |
| Sonargraph | **architecture DSL** (`.arc`) | DSL plus Groovy | I (compiler-resolved), cycles, metrics; T/D/A/O unknown | — | **Zügel MCP** (not TS); IDE | deterministic *(inferred)*; baselines | layering, templates; hexagonal/DDD unknown | yes (Architect); not in Zügel | 2019 TechDebt paper *(authors unverified)* |
| Structure101 | visual structure spec | diagram model | I (class level) | — | — | headless check-spec | layered | unknown | none found; product discontinued |
| SonarQube Architecture / Vortex | **visual intended architecture** (allow-list) | model in UI | I (graph), tangles, size | AI CodeFix (LLM) | **SonarQube MCP** (reads model), IDE | analysis issues plus quality gates | none named | yes (Server 2026.4+, Cloud) | vendor figures only |
| Lattix | DSM plus Can/Cannot/Must-Use rules | model plus scripts | I, metrics | unknown | MCP *(unverified)* | LDC reports new/resolved | layered (DSM) | JS yes; TS unverified | Sangal et al. OOPSLA 2005 |
| NDepend (.NET) | CQLinq rules | LINQ query | I, T, C (M) | LLM writes rules over MCP | **NDepend MCP**, IDE | deterministic queries *(inferred)* | clean (ND1412) | — | none found |
| **jQAssistant** | **none** (raw rules); jMolecules: annotations in code; C4: imported diagram data | **Cypher** in XML/AsciiDoc (or JS/Groovy) | Java: I, T, D (Spring plugin), metrics (complexity); TS plugin: I (aggregated DEPENDS_ON), detailed types; A: contract files only | — | — (generic Neo4j MCP possible) | deterministic *(inferred)*; severities, baselines, SARIF/JUnit reports | jMolecules: layered, hexagonal, onion, DDD, CQRS (Java only) | ESM-only plugin, low maturity | none peer-reviewed; 2018 BSc thesis |
| CodeQL | — | QL (Datalog-like) | I, data flow/taint; M (Java only) | Copilot Autofix (non-deterministic) | GitHub MCP (alerts); VS Code | deterministic analysis *(inferred)*; SARIF | — | yes | ECOOP 2016 (language); SAST benchmarks |
| Joern | — | CPGQL (Scala) | AST + CFG + PDG | — | CodeBadger MCP | deterministic *(inferred)* | — | via jssrc2cpg | S&P 2014 |
| Semgrep | — | YAML patterns | I (patterns), taint (Pro interprocedural) | Assistant (LLM) | Semgrep MCP; IDE | SARIF | — | GA | none found for the engine |
| Arcan | — (detection) | hard-coded Gremlin detectors plus thresholds | I (class/package), smells | separate LLM studies (ECSA 2025, ICSA-C 2025) | — | deterministic *(inferred)* | — | — | ICSAW 2017 and follow-ups |
| Designite | — (detection) | hard-coded detectors | I, OO metrics, history | — | — | deterministic *(inferred)* | — | — | BRIDGE 2016, MSR 2024 |
| ARCADE | — (recovery) | recovery algorithms, smell detectors | I, concerns (topic models), history | — | — | partly probabilistic (topic models) | — | — | MSR 2015, EMSE 2016, FSE 2020 demo |
| DV8 | — (derived design rules) | fixed anti-patterns | I, co-change, churn | — | — | deterministic *(inferred)* | — | unknown | ICSE 2014, ICSE 2016, WICSA 2015 |
| CodeRabbit | NL instructions, guideline files; ast-grep | NL plus ast-grep YAML | code graph (defs/refs, co-change) | **LLM review** | CLI for agents; consumes MCP | LLM non-deterministic; ~50 linters alongside | — | yes | arXiv 2607.03316 (56.3% rejected) |
| Copilot code review | NL instructions | NL Markdown | agentic context | **LLM review** | GitHub MCP `request_copilot_review`; IDEs | not guaranteed; CodeQL/ESLint blended | — | yes | aggregate arXiv 2604.03196 |
| Qodo | NL best practices; Rules System (beta) | NL plus metadata | context engine | **LLM review** | MCP *(partly unverified)* | LLM | — | yes | vendor F1; arXiv 2412.18531 (PR-Agent based) |
| Sourcegraph Cody | — | — | code search | LLM | discontinued for Free/Pro | — | — | yes | — |
| GitHub Spec Kit | constitution plus specs (Markdown) | NL gates | — | the agent itself | slash commands in agents | none for code | — | agnostic | none |
| OpenSpec | Markdown specs (SHALL, WHEN/THEN) | NL; structural validator | — | the agent itself | slash commands, 30+ assistants | `validate` checks spec structure only | — | agnostic | none |
| AWS AI-DLC | Markdown workflow rules | NL | — | the agent itself | Claude Code, Kiro, Codex, Cursor … | audit trail of workflow; no code checks | — | agnostic | none |
| trace-mcp | presets or custom layers | unknown | I | — | MCP | deterministic | clean, hexagonal presets | yes | none |
| dependency-mcp | glob allow/forbid | JSON globs | I | — | MCP | score, not verdict | — | yes | none |

## 3. Positioning

### 3.1 What DaedalusArch does that none of the surveyed tools does (as of 2026-10-16)

Each statement is scoped to the evidence above; "none" means none of the tools surveyed here, plus the context-graph tools in the earlier Notion landscape.

1. **A declarative, style-level architecture spec compiled into graph queries.**
   - dependency-cruiser, boundaries and Nx have declarative configs, but at the level of path patterns and tags; their rules *are* the config.
   - Sonargraph has a DSL and Sonar a visual model, but they compile to proprietary checkers, not to an open query text.
   - jQAssistant runs Cypher, but users write it by hand, and its style packs (jMolecules) hard-code the layer matrix in Cypher.
   - DaedalusArch is the only surveyed tool where one external YAML spec, parameterised by a style library, *generates* the query text, and that text is the single rule definition.
2. **One rule text, two engines.** The same Cypher runs on Neo4j and on the in-process interpreter. The parity record in `Docs/v1.3/cypher-interpreter.md` covers 65,254 statements with 0 content differences. No surveyed graph tool documents a second engine checked for parity.
3. **Architectural facts beyond imports, for TypeScript.**
   - Constructor injection, type flow through signatures, components with Martin metrics, async coupling and I/O, all in one queryable graph.
   - In TS: dependency-cruiser and ArchUnitTS give instability or Martin metrics, and the jQA TS plugin gives a fine type model, but none models DI wiring, async channels or I/O.
   - **Caveat:** APG v2 (T, C, A, O) is off by default; the claim holds for the instrument with `apg2: true`.
4. **A hybrid symbolic plus neural verdict.**
   - The deterministic layer decides what is structurally decidable, and an LLM judge covers the rest.
   - AI reviewers are LLM-first with linters alongside, and never use an architecture spec as the decision basis.
   - Sonar and NDepend use LLMs to *fix* issues or *write* rules, not to judge non-structural architecture rules.
5. **A spec-level architecture verdict inside the agent loop for TypeScript.**
   - `check_file`/`check_diff` return a `blockingVerdict` with tier, construct, source and fix per finding.
   - Zügel (not TS), SonarQube MCP (reads the model, no verdict tool) and the small community servers are the closest.
   - **This is narrower than "the only in-loop architecture checker"**, which is no longer true.
6. **Pre-registered evaluation of a conformance tool.**
   - None of the conformance tools has a published accuracy evaluation of the tool itself. Lattix (2005) is a design/case paper; the smell tools have empirical studies of smells, not of conformance accuracy.
   - DaedalusArch's registered SO4 runs, the tool comparison and the sealed hold-out are, as far as found here, unique for this tool category.
   - Phrase this as "no published evaluation found", not "none exists".

### 3.2 What they do that DaedalusArch does not (honest list)

- **Languages.**
  - DaedalusArch is TypeScript only.
  - jQAssistant covers Java plus Maven, XML, JSON, JUnit and more; Sonargraph six languages; Sonar five for architecture; CodeQL, Semgrep and Joern many.
  - The approach's language independence is an argument, not a result.
- **Maturity and adoption.**
  - DaedalusArch is a single-author research prototype.
  - dependency-cruiser and Nx have large npm download counts (Notion landscape, 2026-10-10). ArchUnit, jQAssistant and Sonar have years of industrial use.
  - Their bug surface is exercised by thousands of projects; ours by the 71-case dev set, the Study 1 corpus, the 15-repo external set and the 14-repo wild set.
- **IDE and developer experience.**
  - ESLint-based tools (boundaries, Nx) give in-editor squiggles. Sonargraph, Sonar, Lattix and NDepend have IDE plugins and dashboards.
  - DaedalusArch has a CLI, an MCP server, an HTML report (PR #140, open) and a CI action (PR #138, open); no editor integration.
- **Baselines and incremental adoption.**
  - ArchUnit `freeze`, dependency-cruiser `--baseline`, jQAssistant `jqassistant-baseline.xml` and Sonargraph/Zügel `create_baseline` let teams adopt on legacy code.
  - DaedalusArch has the same basic mechanism: `firewall baseline` and `evaluate --baseline`, keyed on rule, file and violation type (`src/baseline/baseline-manager.ts`). Diff-aware CI is in PR #138 (open).
  - It has never been evaluated or documented for adoption on legacy code, so this is parity on paper, not in practice.
- **Visual architecture modelling.** Sonar, Structure101, Lattix (DSM) and Sonargraph let architects draw or edit the intended architecture and see violations on it. DaedalusArch's spec is text only.
- **History-based analysis.** DV8 and ARCADE use co-change and revision history. DaedalusArch has a co-change cheap proxy (`Docs/DiagnosticRuns/cheap2-2026-10-15.md`) but no history-based rule.
- **Rule ecosystem and extensibility.** jQAssistant's concept/constraint dependencies and plugin ecosystem (Spring, JPA, jMolecules), CodeQL's query packs and NDepend's ~200 default rules exceed our catalogue in breadth. DaedalusArch does accept hand-written Cypher, through an ADR file's optional `cypher_rule` block (`src/spec-parser/adr-parsers.ts`, "Optional handcrafted Cypher rule (v1)"). It has no rule dependency mechanism like jQA's `requiresConcept`, and no plugin ecosystem.
- **Speed.** ADR-030 measured DaedalusArch about 3× slower than dependency-cruiser on the Neo4j lane. The interpreter changes this, but no head-to-head timing with the interpreter exists.
- **Report formats.** SARIF, JUnit XML and CodeClimate outputs (jQAssistant plugins, CodeQL, Semgrep) plug into existing CI dashboards. DaedalusArch emits its own JSON/Markdown/HTML.

### 3.3 jQAssistant vs DaedalusArch: the precise differences

| Dimension | jQAssistant (2.9.1; TS plugin ts-lce 1.4.4; jMolecules plugin) | DaedalusArch (v1.3 branch) |
|---|---|---|
| **Substrate** | Neo4j (embedded or remote, 5.x), JVM required | Neo4j 5.26 as reference; in-process Cypher interpreter, no JVM or database |
| **Spec → Cypher** | No compiler. Rules are hand-written Cypher in XML/AsciiDoc. Intent comes from hand-written concepts, **annotations in the code** (jMolecules) or **imported diagram data** (C4 plugin), which still needs hand-written constraints | YAML spec (layers, directories, kinds, forbidden imports, style) is **compiled** to Cypher fitness functions; the generated text is the single rule definition. Hand-written Cypher is also possible (ADR `cypher_rule`), as in jQA |
| **Style libraries** | jMolecules packs: layered, hexagonal, onion (classical, simplified), DDD, CQRS, events; Default and Strict variants; **Java only**; layer matrix hard-coded as a Cypher list; membership by annotation | Five presets (clean, layered, nestjs, hexagonal, ddd); membership by path/kind in an **external** spec, no code annotations; TS only; tiers (blocking/advisory) with a literature source per rule |
| **TypeScript facts** | Rich syntax-level model (types, values, decorators, React), weighted `DEPENDS_ON`; ESM only; no DI, routes, async or I/O | Architecture-level: imports (incl. dynamic, re-export views), constructor injection, type flow, components with Martin metrics, async coupling, I/O; coarser on syntax |
| **Neural layer** | None | LLM judge for rules the graph cannot decide |
| **Agent loop** | None official; a generic Neo4j MCP server could expose raw graph queries | MCP server with verdict-returning tools (`check_file`, `check_diff`, `explain_finding`, `infer_spec`) |
| **Validation** | No peer-reviewed evaluation found; long practitioner use | Registered SO4 seeded runs, ADR-030 comparison, real pairs, dev-set precision/recall, sealed hold-out pending; not yet peer reviewed |
| **Where jQA is ahead** | Multi-language scanners; rule dependency resolution; severities and baselines; SARIF/JUnit/CodeClimate reports; Maven/CLI integration; interactive Neo4j browser; mature plugin ecosystem | — |

**Framing for Ch2.**
- Say: *"DaedalusArch lifts jQAssistant-style Cypher constraints to a spec language: the style packs that jMolecules hard-codes per annotation become libraries parameterised by an external spec, and the result is extended with neural judgment and an agent-loop verdict, for TypeScript."*
- Do **not** say jQAssistant lacks style rules: jMolecules ships hexagonal and DDD rules.

## 4. Comparison experiments the thesis can still run cheaply

All are symbolic-only unless stated, and none touches the sealed hold-out. Mapping uses the job ids of `Docs/v1.3/night-backlog-2026-10-16.md`; "NEW" marks a job not in the backlog.

| # | Experiment | What it answers | Cost | Backlog mapping |
|---|---|---|---|---|
| X-1 | **Convergent validity with dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS** on the reference, external and wild sets: per-rule agreement on the shared key (rule, file, target) after a registered translation | Do independent checkers agree on rules they can express? | running | **existing:** branch `v1.3-validity-convergent` (WIP, no PR yet; pins depcruise 18.4.0, boundaries 7.2.0, archunit 2.5.4). Its `translation-table.json` doubles as the expressibility evidence for §2 |
| X-2 | **jQAssistant-equivalent rule set on the reference set.** (1) Scan the 5 reference projects with `@jqassistant/ts-lce` 1.4.4 plus jQA 2.9.1. (2) Hand-port the blocking rules of one or two styles (clean, layered) into jQA XML constraints in jMolecules style, with layer membership as a concept over module paths, since the TS plugin has no annotations. (3) Compare findings on the shared key. Measure: rules expressible on the jQA TS graph, recall/agreement on the dev set, rule lines written by hand vs YAML lines, runtime | The nearest prior art, run for real; quantifies the "spec compilation" contribution as authoring effort, plus the graph gap (DI, type flow) | 1–2 sessions; JVM plus Neo4j 5.x (one instance, per rule 8); risk: ESM-only plugin may fail on CommonJS reference projects, **which is itself a finding** | **NEW: J2** "jQAssistant arm". Write its pass criterion first (rule 11); add it to the convergent harness as a fourth tool if the translation is mechanical |
| X-3 | **Expressibility matrix (paper exercise, zero compute).** For every v1.3 rule id × tool (dependency-cruiser, boundaries, Nx, ArchUnitTS, jQA-TS, jQA jMolecules, Sonar Architecture, Semgrep, CodeQL), mark expressible / partly / not, citing the doc clause | Makes "breadth" claims auditable; feeds Ch9's table | half a session | **NEW: J3**; extends the `translation-table.json` of X-1 |
| X-4 | **Generic graph-MCP baseline in the loop.** Expose the APG through the generic Neo4j MCP server (raw Cypher, no verdict) as an extra arm of the scripted loop replay. Measure tool calls and blocking violations at the end | Does a verdict tool beat raw graph access? Mirrors what jQA users could do today | 1 session with the scripted agent; no LLM | **existing:** #142 loop replay and S4 (#22 full-grid stub replay); arm only in the **replay**, never in Study 2 unless registered |
| X-5 | **Community architecture MCP servers on the dev set.** Run trace-mcp `check_architecture` (clean and hexagonal presets) and dependency-mcp on the hexagonal and clean reference projects; score against the manifests | Is the "TS spec-level verdict over MCP" gap real in practice, beyond documentation? | half a session; npm installs only | **NEW: J4**; small, descriptive, dev-set only |
| X-6 | **Metric convergence.** DaedalusArch component instability (APG v2) vs dependency-cruiser `--metrics` instability vs ArchUnitTS folder instability on the reference and external sets; rank correlation per project | Convergent validity of the C facts, not only the I facts | half a session | **existing:** fold into X-1 (`v1.3-validity-convergent`) as a secondary table, or K1 (#12) |
| X-7 | **Sonar Architecture comparison** on the 15-repo external set (SonarQube Cloud free tier for public repos, if architecture is enabled there *(unverified)*): intended architecture drawn from our spec, deviations vs our blocking findings | The only commercial TS architecture checker with an intended model | needs an account; **author decision** (publishing repos to a vendor) | **NEW: J5**, listed under backlog §3 "Jobs only the author can unblock" |
| X-8 | **LLM reviewer baseline, cross-vendor.** Already piloted (ADR, `results/llm-review/`, 25 of 42 reviews) | "Why not just ask an AI reviewer?" | needs LLM calls: **not tonight** (no-LLM rule) | **existing:** llm-review pilot; complete later under its prereg |
| X-9 | **Semgrep/CodeQL import-rule translation** for FF-S01/FF-P01 on the reference set | Shows that general query engines *can* express layer rules, at what authoring cost, and that they cannot express DI or type-flow rules | half a session (Semgrep CE only; CodeQL CLI licence allows research use) | **NEW: J6**, optional; lower value than X-2 |

**Recommended order.** X-1 (running), then X-3 (free; makes every positioning claim checkable), then X-2 (closest prior art; the one reviewers will ask about), then X-5 and X-6 (cheap). X-7 and X-8 wait for author decisions.

## 5. Statements to avoid in the thesis

- "No tool checks architecture inside the agent loop." **False** (Zügel; SonarQube MCP reads the intended model). Use the scoped claim of §3.1 item 5.
- "jQAssistant has no notion of architectural styles." **False** (jMolecules plugin).
- "DaedalusArch detects layer violations better than dependency-cruiser." Not supported (ADR-030: parity on shared rules after the translation fix).
- "Sonar does not support TypeScript architecture." **False** since 2025-12 (Cloud) and 2026.4 (Server).
- Any claim that rests on APG v2 facts without saying APG v2 is off by default.
- Any claim citing the SBES 2025 or MDE4SA 2025 papers, or Canedo 2026's method, before reading them in full.

## 6. Not done

- No tool was installed or run; every fact is from documentation.
- Google Scholar, ACM DL and IEEE Xplore were not queried directly. The "no published validation" cells are web-search negatives.
- Pages that did not load: the Arcan wiki (503), ArchDia (503), lattix.com (403) and designite-tools.com (no content). Facts depending on them are marked unverified.
- GitHub star counts are from web pages on 2026-10-16 and change daily.
