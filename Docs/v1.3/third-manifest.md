# v1.3 third manifest: a non-Claude blind key writer (K-G)

**2026-10-16. Status: tooling. No live call has been made.** This is the harness that `Docs/v1.3/role-separation-plan.md` §4.1 asks for (branch `origin/v1.3-threats`, PR #130). It lets a model from outside the Claude family write a blind expected-findings manifest for a reference variant. The inputs are restricted in code. The manifest comes out in the format `scripts/v1.3/ue-score.ts --blind` reads. It answers threat V10 (same vendor) and the provenance note of `Docs/v1.3/sealed-hashes.md` only once the author runs it with a Gemini login or key. This document and the prompt module were committed before any adapter code existed (see §7).

It is not a pre-registration. It changes no protocol. Adopting K-G for the 48 new seed variants or for the hold-out is the author's decision. For the hold-out it goes into the frozen prespec before `<FREEZE_SHA>` (role-separation plan §6, step 7).

## 1. Input allow-list (enforced by `scripts/v1.3/lib/third-manifest/bundle.ts`)

The bundle builder reads files only through one guarded reader. Any path outside this list throws `TM_INPUT_REFUSED`, and the run does not start. So does any path with a `daedalus-sealed` segment, wherever it appears. This harness never reads the hold-out (§6).

| # | Input | What the model sees | What is cut |
|---|---|---|---|
| A1 | `Docs/v1.3/style-rule-sources.md` | The rows for the case's style (the labeller's `styleDefinition`): rule, constraint, source | Rule ids and template names in parentheses |
| A2 | `Docs/v1.3/rule-tiers.md` | Both tier tables: rule (id or name), template name, v1.3 tier, construct reason | The v1.2E severity column, and every paragraph outside the two tables |
| A3 | The case's spec (`spec.yaml`, or `presets/ddd.yaml` for DDD) | Only `architecture.style`, the layers (`name`, `kind`, `directories`, `roles`), `architecture.allowed_dependencies` and `architecture.ddd` (contexts, outside-context paths, aggregates, value-object, repository, domain-event and application-service declarations), re-serialised from the parsed YAML | `fitness_functions`, `scoring`, `confidence_thresholds`, `default_exclude_paths`, and every YAML comment (they name rule ids and templates) |
| A4 | The project source | Every `.ts` file of the materialised variant, with every comment removed (`stripComments`, `scripts/v1.3/lib/labelling/excerpt-scrub.ts`; line numbers stay stable), and paths relative to the project root | Every other file (`package.json`, `tsconfig.json`, the manifests, patches, overlays, `variant.json`); `node_modules`, `dist` and `.git` |
| A5 | The output schema | `OUTPUT_SCHEMA_TEXT` of `prompt.ts` (also sent as the response schema) | — |

Opaque cases: the model sees `case-NN` and the style. It never sees the variant id. The case numbers are a seeded shuffle (seed `20261016`), and the key from case to variant is written only to `blind-key.json`. The model never sees that file. File paths inside a project are left as they are, because the manifest must name them. A planted file whose name hints at its plant is a known leak. It is the same leak the Claude blind writer had.

The model never gets the Cypher, the preset's rule list, the author manifest, the tool's output, or any other repository file.

## 2. Prompt (`scripts/v1.3/lib/third-manifest/prompt.ts`, version `tm-1`)

System prompt (sent as `systemInstruction` on the API route; on agy, which has no system channel, it is put first in the prompt):

> You are a software architect writing an expected-findings key for a TypeScript project. Judge only from the material in the message: the style rules and their sources, the rule tiers, the layer and context declarations, and the source files. You have no tools. Reply with one JSON object that matches the response schema, and nothing else.

The task text comes first in every case prompt. The per-case sections follow it, in this order: case, style rules, rule tiers, declarations, source files, response schema.

> ## Task
>
> Write the expected findings for this project, before any checking tool has run on it.
>
> 1. Give every source file its layer, and for DDD its bounded context, from the declarations. A file that no declaration covers gets layer null.
> 2. List every internal import edge between the source files (from, to, kind "import" or "re-export"). An import of a package outside the project is not an edge. Mark an edge `typeOnly` when it imports types only, and `viaReExport` when it reaches the file through a barrel (an index file that re-exports it); then list the barrel files in `through`.
> 3. List every place where the project breaks one of the rules in the tier table. One finding per rule, file and target:
>    - `ruleId`: the rule exactly as the tier table names it (the Rule column, for example `FF-S01`, or the rule name of the second table, for example `core-isolation` or `DDD aggregate boundary`). A problem that no listed rule states is named `OTHER: <the construct in a few words>`.
>    - `file`: the project-relative path of the file that holds the problem.
>    - `target`: for an import rule, the imported project file (or the package name for a framework import); for a class rule, null.
>    - `tier`: the tier the table gives the rule for this style (`blocking` or `advisory`).
>    - `reason`: one or two sentences: which declaration or source statement the code breaks, and how.
>    - `confidence`: `high`, `medium` or `low`.
>    - `alsoMatches`: other rule names from the table that the same problem also breaks (may be empty).
> 4. List near misses in `nearMissOk`: files (or globs) that look like a break of a rule but are not, with the reason.
> 5. `verdict` is `fail` when at least one finding is on a blocking rule, otherwise `pass`.
>
> Do not guess what a checking tool would report. Write what an architect following the sources would expect. A clean project has no findings.

Rule names follow the tier table, as the Claude blind writer's did. `ue-score.ts` maps them with `blind-rule-mapping.json`: an `FF-` id is used as it is, and a name goes through a mapping row. A name with no mapping row makes `ue-score.ts` stop. The comparison script (§4) keeps such a name as `unmapped:<name>` instead, so the table shows it.

## 3. Output schema

`OUTPUT_SCHEMA` in `prompt.ts`. The top-level fields are `verdict`, `expectedGraph` (`files`, `edges`), `findings` and `nearMissOk`. It is the `BlindCase` shape of `ue-score.ts` without `style` and `case`, which the harness adds. The schema uses only the JSON-Schema subset Gemini accepts. After each call the harness parses the answer strictly: unknown enum values, missing required fields and non-JSON all fail the parse. A failed parse is re-asked once, then recorded as invalid. An invalid case is written as `invalid`, never as `pass`.

Each written case also carries `provenance`, which `ue-score.ts` ignores:
- the writer's vendor, adapter and served model;
- the prompt and schema hashes;
- the sha256 of the case's prompt;
- the cassette key.

## 4. Pass criterion and analysis (fixed before any number is computed)

**Harness pass (engineering, checked by `tests/unit/scripts/v1.3/third-manifest/`):**

- **H-P1.** `build` throws `TM_INPUT_REFUSED` for each of the following, before any provider is constructed:
  - a path outside A1–A5;
  - a `daedalus-sealed` path;
  - a spec or project directory given through a symlink that leaves the allowed root.
- **H-P2.** The prompt and schema hashes below were committed before any adapter file existed (git order on this branch). `run` recomputes both and refuses (`TM_HASH_DRIFT`) if either differs from this document.
- **H-P3.** A fake dry run on 3 development-set variants writes, for each case:
  - `blind-key.json`;
  - `blind-out/<style>/case-NN.json`, in the `BlindCase` shape;
  - every finding name either an `FF-` id or a name that `blind-rule-mapping.json` (`results/v1.3-reference/after-member-facts`) maps, or an `OTHER:` name.
- **H-P4.** `compare` reports agreement between two manifests by finding identity, per style.

**Comparison analysis (`compare`):**
- **Identity.** A finding is identified by its mapped rule id, its file and its target.
  - The mapping is the one `ue-score.ts` uses. Names it cannot map stay `unmapped:<name>`.
  - A ` (via …)` suffix is stripped from the target.
  - An `FF-S02` cycle is normalised as in `ue-score.ts` (`canon`).
- **Matching.** Matching is one to one, as in `ue-score.ts` `match`. Exact target pairs are matched first. Then rule and file match when one side has no target.
- **Per style and overall**, both for all rules and for the blocking rules (`ruleTier(ruleId, style) === 'blocking'`):
  - `both`, `onlyA` and `onlyB`;
  - finding agreement, `both / (both + onlyA + onlyB)`, which is 1 when both sides are empty;
  - case-verdict agreement, as a count.
- **Cohen's κ** on case verdicts is reported only when a style has at least 10 cases with valid verdicts on both sides. Otherwise it shows `n/a (n<10)`.
- **No adjudication.** The script reports and resolves nothing (role-separation plan, P-R5).

**Dry-run check (known answer).** The fake writer is given the author manifest of each case as an oracle, which a real vendor never has. It applies a seeded, logged perturbation: it drops some findings, adds one decoy, and names one rule by its template name instead of its id. The dry run passes when the `compare` table against the author manifests equals the counts implied by the logged perturbation. Its agreement figure is not a result. It is labelled **"dry run, not a result"**.

## 5. Adapters (`scripts/v1.3/lib/third-manifest/adapters.ts`)

| `--adapter` | Route | Credential | Isolation | Cost guard |
|---|---|---|---|---|
| `fake` | Deterministic stub with an oracle (tests, dry run) | none | n/a | n/a |
| `gemini` | Gemini API, U4's `GeminiProvider`: no tools, temperature 0, `OUTPUT_SCHEMA` as `responseSchema`, the system prompt as `systemInstruction` | With `--env-file <path>`, the `GEMINI_API_KEY` line of that file (`readEnvVar` scans the file and keeps only that line); otherwise `GEMINI_API_KEY` from the process environment. It is scrubbed from every error and cassette. | API call, no tool field | `--max-usd` (default 5) with the author's `--usd-per-mtok-in` and `--usd-per-mtok-out`. Before each call the worst case is `(prompt chars / 3) × in + max output tokens × out`. A call that would push the ledger past the cap is not made (`TM_BUDGET`, a stop). The ledger is written next to the cassettes. |
| `agy` | Antigravity CLI headless, the v1.2 labeller route's pieces (`src/llm-critic/agy-cli-provider.ts`): stream-json, `--json-schema`, `--sandbox`, `--disable-slash-commands`, prompt on stdin, a fresh empty cwd outside any repository, `env -i`-style child env with `HOME` = the dedicated home and no API key passed | The subscription login in `HOME=~/.firewall/labeller-agy-home` | The labeller's home check (`settings.json` strict, deny rules, no rules, skills, plugins or MCP) plus `agy mcp list` and `agy plugin list` empty. A completed tool step is invalid (`LLM_CLI_TOOL_USE`, retried once). The init event's model must equal `--agy-served-model` (default: the `--model` value). | Counted in invocations (`--max-calls`, default 20); no dollars on the subscription |
| `openai` | Chat Completions, non-strict `json_schema` (`strict: false`: strict mode needs every property required), no `tools` field; the strict parse after the call is the check | With `--env-file <path>`, the `OPENAI_API_KEY` line of that file; otherwise `OPENAI_API_KEY` from the process environment | API call | `--max-usd` as for `gemini` |

**What the harness reads that is secret, and when.** Nothing on `build`, `compare`, `export-author` or `--adapter fake`: no adapter is constructed. `--adapter` has no default. `gemini` and `openai` read one key, from `--env-file` if given, else from the process environment. `agy` passes no key to its child (`buildAgyChildEnv` allow-list); like the v1.2 labeller it holds the values of the parent's secret-named variables (`knownSecretsFrom(process.env)`) in memory, only to scrub them from errors and output. This is opt-in per run and needs the author's sign-off.

The agy version pin defaults to the labeller's `AGY_PINNED_VERSION` (1.3.2). A newer local agy stops the pre-flight with `LLM_CLI_VERSION_DRIFT`, unless the author pins the version they run with `--agy-version <x.y.z>`. That version is then written into every case's provenance. The v1.2 labeller module is not edited.

## 6. What this harness must never do

- It never reads, lists, hashes or copies anything under `../daedalus-sealed/`. `build` refuses such a path. The hold-out run of the role-separation plan (§6, step 8) needs an explicit, author-added switch, after `<FREEZE_SHA>` is filled and the prespec names K-G. That switch is **not** written here.
- It never sees the tool. The bundle is built before the tool runs, and it has no tool output in it.
- It never merges a K-G finding into a Claude manifest. Each is scored on its own.

## 7. Frozen hashes

| Item | sha256 | Committed |
|---|---|---|
| Prompt text `tm-1` (`PROMPT_TEXT`: version, system prompt, task text) | `4d0d1525d84f1fed4883829987d4b5b134f4f6a234eca904af835c3acb729f96` | 2026-10-16, before any adapter |
| Output schema (`OUTPUT_SCHEMA_TEXT`, canonical JSON) | `756f3f41c603c471d2604f5eb5f71377103e5f180822e9051da1487932f001f8` | 2026-10-16, before any adapter |
| Input A1 `Docs/v1.3/style-rule-sources.md` at this commit (read only, not edited) | `7ce49c630178bad9effd27ae4acce6286effcffd2099b6d353023fca23715c28` | recorded |
| Input A2 `Docs/v1.3/rule-tiers.md` at this commit (read only, not edited) | `290794e0bf8edc0d02b631b576b1181cb3e9fb603af3b4fd110a61b60543f27a` | recorded |

Each case's bundle sha256 and prompt sha256 are written into its provenance and into `run.json`. Before running on new seeds, the author commits `run.json` and `blind-key.json` with the bundle hashes, and only then runs the tool (§8).

## 8. The author's local run (not done here; no login or key exists in the cloud)

Order of work, for any new set (for example the 48 seed variants of `Docs/v1.3/seed-floor-plan.md`):

1. **Build first, commit the hashes.** `build` writes `bundles.json` (each case's bundle and prompt sha256, the input list, the dropped spec keys) and the rendered prompts. Commit `bundles.json` before any call is made.
2. **Run K-G.** Commit `blind-key.json`, `blind-out/`, `run.json`, the cassettes and `ledger.json`, unread, in one commit. Use the same seed and the same case list as the build. The case ids must match, and `run` rebuilds the bundles and records their hashes again.
3. **Run the tool.** Only after step 2 is pushed. The commit order is the evidence that the key came before the tool.
4. **Score and compare.**
   - `ue-score.ts --blind <dir>` scores each K-G manifest on its own. It needs every reference variant and a mapping row for every name K-G used. `compare` lists the names that have no row.
   - `compare` against the author manifests (`export-author`) and against the Claude blind manifests, where those exist outside the sealed directory.

Subscription route (agy, no dollars). The home is the v1.2 labeller's dedicated home. `--model` is the name agy takes. `--agy-served-model` is the id its stream-json `init` event prints: run one `build`, then check `agy models` once and set it.

```bash
npx tsx scripts/v1.3/third-manifest.ts build --variants <style/variant,...> --out results/v1.3-third-manifest/<set>/k-g-agy
git add results/v1.3-third-manifest/<set>/k-g-agy/bundles.json && git commit -m "v1.3: third-manifest bundle hashes (<set>)"
HOME=~/.firewall/labeller-agy-home agy --version   # set --agy-version to this if it is not 1.3.2
npx tsx scripts/v1.3/third-manifest.ts run --adapter agy \
  --model "Gemini 4 Argon (High)" --agy-served-model <init model id> --agy-version <x.y.z> \
  --agy-home ~/.firewall/labeller-agy-home --max-calls 20 \
  --variants <style/variant,...> --out results/v1.3-third-manifest/<set>/k-g-agy \
  --cassettes results/v1.3-third-manifest/<set>/cassettes
```

API route (Gemini, $5 cap). With `--env-file .env`, the file is scanned and only its `GEMINI_API_KEY` line is kept; without `--env-file`, the key comes from the process environment. The prices are the author's, from the current Gemini price page, in USD per million tokens. Without them the adapter does not start.

```bash
npx tsx scripts/v1.3/third-manifest.ts run --adapter gemini --model <pinned gemini model id> --thinking high \
  --env-file .env --max-usd 5 --usd-per-mtok-in <in> --usd-per-mtok-out <out> --max-output-tokens 32768 \
  --variants <style/variant,...> --out results/v1.3-third-manifest/<set>/k-g-api \
  --cassettes results/v1.3-third-manifest/<set>/cassettes
```

New projects that are not in the reference loader use `--cases cases.json` in place of `--variants` (`[{ "label", "style", "project", "spec" }]`). The label goes only into `blind-key.json`.

Comparison:

```bash
npx tsx scripts/v1.3/third-manifest.ts export-author --key results/v1.3-third-manifest/<set>/k-g-agy/blind-key.json --out results/v1.3-third-manifest/<set>/author
npx tsx scripts/v1.3/third-manifest.ts compare --a results/v1.3-third-manifest/<set>/author --b results/v1.3-third-manifest/<set>/k-g-agy \
  --label-a author-manifest --label-b "K-G (agy)" --banner "Development set; exploratory; nothing adjudicated." --out results/v1.3-third-manifest/<set>/compare-author-vs-k-g.md
```

Size: a reference case's prompt is about 27–31k characters, roughly 8–10k input tokens. A 71-case development pass is 71 calls, plus re-asks.

**The two routes are kept apart.** The agy route cannot set the temperature, and agy 1.3.2 could not deny `search_web` (`Docs/labeller-route.md` §7). A completed tool step makes that call invalid, and it is retried once. Report agy and API manifests as separate writers, never pooled. As the role-separation plan notes (§7), K-G and the Gemini *meaningful* labeller R3 are the same vendor.

## 9. Dry run (2026-10-16, cloud, fake adapter): dry run, not a result

`results/v1.3-third-manifest/dry-run/` holds:
- the fake writer's manifests, `k-g-fake/`;
- the author manifests of the same cases, `author/`;
- the comparison, `compare.md` and `compare.json`.

The three cases are `layered/clean`, `hexagonal/v03-use-case-injects-concrete-adapter` and `ddd/v08-cross-context-internal-import`. The fake was given the author manifest as an oracle. It dropped one finding (FF-P02 in hexagonal), renamed one (FF-S01 written as `dependency-direction-graph`) and added three advisory decoys. The comparison shows exactly that: both 2, only-author 1, only-fake 3, verdicts 3 of 3. The rename mapped back. That is the known-answer check of §4, and it passed. The numbers say nothing about any vendor.
