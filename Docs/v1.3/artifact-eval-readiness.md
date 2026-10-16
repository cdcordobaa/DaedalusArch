# v1.3 artifact-evaluation readiness

Branch `v1.3-artifact-eval` (cut from `origin/v1.3` at `f66564ef`), 2026-10-16. This document audits the repository
as a reviewer would meet it on a clean machine. It measures it against the ACM artifact badges and against one
current SE artifact-track call. It gives the status of each badge, the blockers, and an estimate of the effort to
close each one. The reviewer-facing guide is [`ARTIFACT.md`](../../ARTIFACT.md).

This branch changes docs and scripts only. No `src/` behaviour and no rule template changed.

## 1. Criteria used (checked online 2026-10-16)

**ACM Artifact Review and Badging, Version 1.1** (current since badges issued after 15 May 2020):
<https://www.acm.org/publications/policies/artifact-review-and-badging-current>. The ACM site returned HTTP 403 to
automated fetches on 2026-10-16. The wording below is therefore taken from the ICSE 2027 call, which adopts v1.1 and
restates it. ACM's own page should be re-checked by hand before submission. The badges are independent of each
other, except that Reusable includes Functional.

| badge | criterion (ACM v1.1 as restated by ICSE 2027) |
|---|---|
| **Artifacts Available** | Placed on a publicly accessible archival repository with a DOI or other stable identifier. The artifact need not be evaluated. Personal web pages do not qualify. |
| **Artifacts Evaluated – Functional** | An independent audit finds the artifact **documented, consistent** (with the paper's claims), **complete** (reasonably), and **exercisable** (the included scripts and software run and produce the results). Proprietary parts may be omitted if proxies are given. |
| **Artifacts Evaluated – Reusable** | All Functional criteria, plus very careful documentation and structure so that reuse and repurposing are facilitated, following the norms of the community. |
| **Results Reproduced** | The main results were obtained in a subsequent study by a person or team other than the authors, using, in part, artifacts provided by the authors. ACM swapped the meanings of "Reproduced" and "Replicated" in v1.1 to follow NISO; "Replicated" means without the authors' artifacts. |

**Current SE artifact track: ICSE 2027 Artifact Evaluation**,
<https://conf.researchr.org/track/icse-2027/icse-2027-artifact-evaluation>, adds these requirements:

- a `LICENSE` file and a `README` covering purpose, the badges claimed, provenance, data, setup and usage;
- archiving with a DOI (Zenodo, Figshare or similar; Software Heritage is suggested for code). GitHub alone generally
  does not qualify, though a release archived with a DOI (for example GitHub to Zenodo) may;
- installation and configuration in **no more than about 30 minutes**;
- the full installation tested on a clean machine;
- containers or VMs strongly encouraged, and required for non-trivial dependencies;
- offline use where possible;
- optional `CITATION.cff`, CodeMeta or DataCite metadata;
- a 2-page abstract via HotCRP;
- dates: registration 22 Jan 2027, submission 29 Jan 2027, notification 26 Feb 2027.

Results Validated badges are for papers already published at ICSE (with a peer-reviewed report of the
reproduction), not for ICSE 2027 papers.

FSE uses the same three evaluated or available badges (Functional, Reusable, Available):
<https://conf.researchr.org/track/fse-2025/fse-2025-artifacts>. The FSE 2026 call was not found online at the time of
writing.

## 2. What a clean clone sees (measured)

The setup was a fresh `git clone` of the branch into an empty directory, with `NEO4J_*` unset, no Docker, Node
v22.22.0 and npm 10.9.4 on Linux. The npm cache was warm (`~/.npm/_cacache` 86 MB), so cold `npm ci` times will be
higher. The clone was shallow and had only the `v1.3` branch, because the sandbox's source checkout is shallow.

| step | command | time | result |
|---|---|---:|---|
| install + build | `npm ci` (runs `prepare` → `build`) | 24.1 s | OK, 861 packages |
| rebuild | `npm run build` | 10.9 s | OK; **before the fix, it left `dist/cli/bin.js` without the exec bit** (B2) |
| first result, in checkout | `npx daedalus evaluate <ref project> --spec … --symbolic-only --format json` | 14.2 s | OK (`pass`, AHS 0.954, engine line `cypher-interp`) |
| same, 2nd call onwards | same | 12 s | **`sh: 1: daedalus: Permission denied`, exit 127** before the fix (B2) |
| first result, direct | `node dist/cli/bin.js evaluate …` | 1.8–3.4 s | OK |
| pack | `npm pack` | 12.9 s | `daedalus-arch-0.1.0.tgz`, 780 KB |
| install tarball in empty dir | `npm install ./daedalus-arch-0.1.0.tgz` | 7.6 s | OK, 180 packages |
| `npx` on a sample project | `npx daedalus evaluate proj --spec spec.yaml --symbolic-only` | 2.8–3.3 s | OK (`hard-block`, AHS 0.438, exit 1) |
| kick-the-tires | `npm run artifact:kick -- --parity` (new) | 30 s | 7/7 OK, 22/22 queries parse, parity 5/5 |
| offline replication | `replication/smoke.sh` | 253 s | **exit 1**: 132 IDENTICAL, 4 KNOWN, **28 DIFF** (B4) |
| offline replication, reproducing steps | `replication/smoke.sh --only gf,gfagg,apg2,judge` | 126 s | exit 0: 69 IDENTICAL, 4 KNOWN |
| unit tests | `env -i … npx jest --testPathPattern=tests/unit` | 559 s | 5,140 passed, 40 skipped, **4 failed** (§2.1) |

**Time to first result from a clean clone: about 30 s** (`npm ci` plus one evaluation). This is well inside the
30-minute limit of the ICSE call.

### 2.1 Unit tests

`env -i HOME=$HOME PATH=$PATH npx jest --testPathPattern=tests/unit --forceExit` on the fresh clone took 559 s. **Result:
5,140 passed, 40 skipped, 4 failed** (375 of 381 suites passed, 2 skipped). Only one of the four failures is in the
code:

| failing test | cause | depends on the reviewer's environment? |
|---|---|---|
| `tests/unit/scripts/mutation/expected.test.ts`, static call form (BR-U5a-19) | `scripts/v1.3/lib/construct-rescore.ts` calls `compileFunctions(` without `compilerInputFromSpec(`. This is a real red test at the `v1.3` head. It is a script-guard test; it does not touch the evaluator | no: it fails everywhere (B11) |
| `tests/unit/scripts/generators/skeleton.test.ts`, read-only skeleton (BR-U5a-45) | Run as root, where a read-only `chmod` does not stop writes | yes: it passes as a normal user |
| `tests/unit/scripts/u5b/guards.test.ts`, results guard | Needs the remote branch `origin/v1.2e` | yes: a full `git clone` from GitHub has it; a `git archive` or Zenodo tarball does not (B12) |
| `tests/unit/scripts/u5b/score-golden-acceptance.test.ts`, git-history check | Needs a non-shallow clone (`--is-shallow-repository` must be `false`) | yes: it fails on `--depth` clones and tarballs (B12) |

The evaluator, interpreter, MCP and scoring suites all pass.

### 2.2 Audit items

| item | finding |
|---|---|
| README | Present and accurate for the no-database path ("Quick start without a database (npx)"). It is long and research-oriented: no badge claims, no single "start here" for a reviewer, and no expected outputs. **Fixed on this branch:** `ARTIFACT.md` gives both paths with expected outputs, and the README links to it. |
| Licence | `package.json` declares `"license": "MIT"`, but **no `LICENSE` file exists** and the `files` list does not ship one (B1). |
| Install path | `npm ci` works from the lockfile. `engines: node >=22` is declared and `replication/setup.sh` checks it. No container is needed for the offline path. Neo4j has a digest-pinned `docker-compose.yml`. |
| `npx` with `--engine cypher-interp`, no Neo4j or Docker | Works from a packed tarball (§2). In the checkout, the second and later `npx daedalus` calls failed (B2, fixed). |
| Time to first result | ≈30 s, as measured above. |
| Replication runner | `npm run replicate:v1.3` is **not on `v1.3`**. It is in open PR #215 (B5). `replication/smoke.sh` is on `v1.3` and exits 1 (B4). |
| Archival / DOI | No release tag, no Zenodo DOI, no `CITATION.cff` (B3). |
| Portability | Tracked folder `Docs/DiagnosticRuns /` (trailing space) cannot be checked out on Windows. It was kept on purpose (decision D-U2-5) because documents cite it (B7). No path in the tree differs from another only by case. |
| Secrets | `.env` is git-ignored. `.env.example` has placeholders only. The kick-the-tires script, the smoke script and the CLI on `cypher-interp` read no credential. |

## 3. Badge-by-badge status

| badge | status | why |
|---|---|---|
| **Available** | **Not met** | No `LICENSE` file (B1). No DOI-bearing archive (B3). The public GitHub repository alone does not satisfy ACM or ICSE. |
| **Functional** | **Nearly met** | Documented (`ARTIFACT.md`, `replication/README.md`, `Docs/v1.3/npx-mode.md`) and exercisable (30-second automated check, `npx` from a tarball). Consistency with the committed results is shown by the interpreter parity test and the reproducing smoke steps. Open: the full smoke run exits 1 (B4), and part of the data depends on inputs that are not distributed (B6, acceptable if the paper states it). |
| **Reusable** | **Partial** | MIT declared, packable npm module, documented spec format, presets, MCP server, and an engine that needs no infrastructure. Missing: a licence file (B1), a published or archived package (B3), and a shorter user-facing "write a spec for your project" walkthrough (B8). Windows checkout fails (B7). |
| **Results Reproduced** | **Cannot be claimed by the authors.** Readiness: **good for the offline results** | The badge needs an independent team, and at ICSE only papers already published there are eligible. What a reproducing team needs is largely in place: deterministic regeneration, cassette replay of every model answer, and the number-level runner in PR #215 (4,587 of 5,154 numbers reproduce; the 58 that differ are explained). The reference-engine numbers need Neo4j (documented and pinned). Live model re-runs need the reader's own subscription. |

## 4. Blockers and effort

| id | blocker | badge | fix | effort | status |
|---|---|---|---|---|---|
| B1 | No `LICENSE` file although `package.json` says MIT | Available, Reusable | Add the MIT text with the copyright holder's name. Add `LICENSE` to `files` in `package.json` (npm ships it anyway). The author must choose the holder name, so this branch does not add it. | 10 min | open (author decision) |
| B2 | `npm run build` re-created `dist/cli/bin.js` and `dist/mcp-server/main.js` without the exec bit. `npx daedalus` in the checkout (which re-runs `prepare` on every call) then failed with `Permission denied` from the second call on | Functional | The `build` script now `chmod 755`s both bin files after `tsc`. This is a script change, not a `src` change. Verified: three consecutive `npx daedalus` calls in the checkout all ran. The docs also point reviewers to `node dist/cli/bin.js` in the checkout, which avoids the per-call rebuild | done | **fixed here** |
| B3 | No archival release: no tag, no DOI, no `CITATION.cff` | Available | Tag a release (for example `v1.3-artifact`). Enable the GitHub–Zenodo integration, or upload the `git archive` plus the packed tarball to Zenodo. Add `CITATION.cff` with the DOI. Optionally deposit in Software Heritage | 1–2 h (plus a Zenodo account) | open |
| B4 | `replication/smoke.sh` exits 1 at the v1.3 head: ISE measure 11 DIFF (since `08c6cd8c`), cheap proxies 17 DIFF (cheap-fix options now on by default). The evaluator is not involved | Functional (consistency) | Choose per step: (a) regenerate and commit the current outputs, and update the write-ups' numbers if they move; (b) pin the smoke step to the producing commit, as `apg2@72fa9203` already is; or (c) add the divergences to `known-divergences.json`, each with a narrower check. (b) is the cheapest and keeps the published numbers. This is a results decision, so it is not made here | (b) 1–2 h; (a) half a day with doc checks | open; see PR #215 |
| B5 | `npm run replicate:v1.3` is not on `v1.3` | Functional, Reproduced | Review and merge PR #215, re-run it after the merge (its scope note says docs after `a6723c34` are not covered), and register the newer docs | review 1–2 h; full rerun 80 min; new docs about half a day | open (PR #215) |
| B6 | Some results depend on inputs that are not distributed (`../daedalus-e1-outcomes`, the SO4 bases) or are sealed (blind manifests) | Functional (completeness) | Archive the 72 E1 projects and the SO4 bases with the DOI release if their licences allow, or state in the paper and `ARTIFACT.md` §3.4 that only derived outputs are provided (proxies, which ACM allows). The sealed manifests stay sealed by design | 2–4 h (licence check of generated and corpus code) | documented |
| B7 | `Docs/DiagnosticRuns /` (trailing space) breaks checkout on Windows | Reusable | Move its 14 files into `Docs/DiagnosticRuns/` (no name collides) and update the documents that cite the old path (`git grep -n 'DiagnosticRuns /'`). That reverses decision D-U2-5, so it needs the author. Until then, `ARTIFACT.md` says to use WSL | 30 min | open (author decision) |
| B8 | No short "apply it to your own project" walkthrough with a spec written from scratch | Reusable | One page: `daedalus init` on a sample, edit the inferred spec, evaluate, read the report. Uses existing commands only | 2 h | open |
| B9 | One unit test (`replay-no-binary.test.ts`) depends on the environment: it fails under an inherited agent session environment and passes under `env -i` (PR #215) | Functional | `ARTIFACT.md` §2.5 runs the suite under `env -i`. A test-side fix is outside this branch's docs-and-scripts scope | 30 min | documented |
| B11 | Red unit test at the `v1.3` head: `scripts/v1.3/lib/construct-rescore.ts` breaks the BR-U5a-19 static call form checked by `tests/unit/scripts/mutation/expected.test.ts` | Functional | Make the script call `compileFunctions(compilerInputFromSpec(...))`, or record a reviewed exemption in the guard. It touches a study script, so it belongs in its own PR | 30 min | open |
| B12 | Three script-guard tests assume a full git clone run by a non-root user (`origin/v1.2e`, non-shallow history, read-only files) | Functional | Document this (done in `ARTIFACT.md` §2.5). Optionally make the guards skip, with a printed reason, when there is no git history. That is a test change, outside this branch | doc done; guard skip 1 h | documented |
| B10 | No container image | Functional (ICSE "strongly encouraged") | Not needed for the offline path (Node only). For the Neo4j path, the compose file already pins the image. A `Dockerfile` with Node 22 + `npm ci` would let reviewers skip the Node install | 1 h | optional |

**To reach Available + Functional:** B1, B3 and B4 (option b), plus merging B5 and fixing B11. That is about one working day.
**To reach Reusable:** also B7 and B8, about half a day more.

## 5. Changes on this branch

- `ARTIFACT.md`: reviewer guide, with kick-the-tires (≈15 min) and full-reproduction paths and their expected outputs.
- `replication/kick-the-tires.sh` and `npm run artifact:kick`: evaluates 7 projects on `cypher-interp` and compares
  verdict, AHS and exit code with the recorded values; checks that every query parses; with `--parity`, runs the
  interpreter golden-parity test.
- `package.json` `build`: makes the two bin files executable after `tsc` (B2).
- `README.md`: a pointer to `ARTIFACT.md`.
- This document.
