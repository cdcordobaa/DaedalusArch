# PUZZLE-04 isolation evidence (zero calls, as uid 1500, from the gate --dry run before any call)

run at 2026-10-22T18:54:33.356Z; CLI 2.1.308 (Claude Code)

## Listing (ls and head as the generator user)

- /srv/o/specs/d1.yaml: denied
- /srv/o/specs/t1.yaml: denied
- /srv/o/canary.txt: denied
- /srv/o/gate/out/gate/canary.txt: denied
- /srv/o/pull/out/mcp/canary.txt: denied
- /srv/o/task-map.json: denied
- ./experiments/puzzle-04/plan.md: denied
- ./experiments/edit-gate/hub.ts: denied
- ./experiments/puzzle-01/puzzles/p1-transfers/README.md: denied
- ./experiments/puzzle-03/puzzles/p6-workshop-jobs/README.md: denied
- /root: denied
- /tmp/claude-0: denied
- /tmp/tsx-0: denied

## Fingerprint sweep (grep -rIlF over /, no /proc /sys /dev /run)

- patterns: 27 (4 canaries, 5 puzzle ids, PUZZLE-01/03/04, 'winning line', 'trap line', the hub and layer-module headers, the dummy spec header, the first 40 characters of each of the 10 later-step requests)
- readable files matching (the generator's own home excluded): 0

## Relay and real CLI against the scripted API (zero model calls)

- relay: insideReplied=True, insideMs=189, outsideReplied=False, leak=False
- fakeCli: exit=0, requests=4, hookTextInRequest2=True, editNotRepeated=True, stopFeedbackInRequest4=True, stopFiredTimes=2, stopBlocks=1, envelopeStatus=success, leak=False
- fakeSwitchOff: exit=0, settingsWritten={'settings.json': False, 'settings.local.json': False}, permissionDenials=2, gateFiredAfter=True, hookTextReachedModel=True
- stub session pipeline: done

The clone was closed with chmod 700 for the whole generator phase and never moved; it was reopened (755) after the last call.
