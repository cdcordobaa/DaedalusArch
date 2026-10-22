# COMPREHEND-01 revisions

Every change to the bank, the tools, the runner or the plan after the build (`Docs/DiagnosticRuns/comprehend-01-build-2026-10-23.md`)
is recorded here with its date and whether it was made before or after any model call. The bank is frozen by its
SHA-256; no question, key or tool is tuned after an answer has been seen.

## R1 (2026-10-22, before any call): the pilot's cap and the isolated layout

**Why.** The author approved the pilot as the design note specifies (§10: calibration 1 per arm, 30 questions × 2 arms
× 1 run), with a **hard cap of 64 calls** including the two calibration smokes and every re-run, so the re-run
allowance is 2, not 4. The agent must not be able to read the answer files or the bank (isolation as in the puzzle
baselines). The build's live path ran sessions from the trees in the repository, where `questions/bank.json`,
`results/graph-check.json` and the puzzle READMEs are one directory walk away.

**What changed** (runner only; the bank, the conventions, the frame, the four tools and the scorer are unchanged):
- `run.ts --hard-cap <n>` lowers the hard cap (never above the build's 66). The pilot runs with 64.
- `run.ts --isolation <json>`: each session's cwd is a copy of its tree under `/srv/t/tNN` (neutral names), and an FG
  session's MCP config names only a neutral id `sNN` and the root-owned launcher `/srv/bin/gserver`, run through
  `sudo -n` (a sudoers rule allows exactly that path for the generator user). The launcher reads the real server
  config (the build's `graphMcpConfig`, unchanged, pointing at the copy) from a root-only directory and starts the
  server as root from the repository root. The call log stays root-only.
- `run.ts --harness <dir>` puts transcripts, configs and call logs in a chosen root-only directory.
- `setup-sandbox.sh`: the generator user (uid 1500), the baseline wrapper `gclaude.sh` byte for byte, a pre-step
  `cclaude` that empties the generator's HOME before every session, the tree copies, the launcher, and the clone
  closed with `chmod 700`. **Lesson of 2026-10-22 applied:** the clone and the session's working directory are never
  moved or removed; they are only closed with chmod and reopened at the end.
- A failed calibration smoke (no clean exit, no result envelope, or the wall cap) stops the pilot before any question,
  so a broken setup cannot spend the other calls.
- `setup-sandbox.sh`'s wrapper comment carries no experiment name (the first fingerprint sweep found it).
- One unit test for R1 (12 runner tests).

**Checks before any call.** Unit tests (12 runner, 15 tools) and the dry run green on the R1 commit; as the generator
user: listing denials on the repository, the clones, the out root and the real configs; a fingerprint sweep of the
readable file system for strings that occur only in the bank's keys, the graph check and the design note; a zero-call
MCP handshake through `sudo -n /srv/bin/gserver` as the generator user. Results: every listing denied; the sweep's
only hit after the wrapper fix was its own pattern file; the handshake listed the four tools and answered
`context_map` on the P2 copy; the isolated dry run spawned 63 fake sessions under the cap of 64. Frozen bank SHA-256:
`4669be26c4952e37b9a8408aecdb31e689d864e96c1c35bf250610407adb9e33` (the build's commit aa5b1af4; text, keys, classes
and scoring are identical to the hand-checked keys of 07ce2918, which `results/graph-check.json` names).
