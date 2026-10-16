#!/usr/bin/env bash
# Reproduces the hint-audit calibration of Docs/v1.3/study2-task-design.md §4.2 (run from the repository root).
set -u
A=Docs/v1.3/study2-task-design/hint-audit.mjs; C=Docs/v1.3/study2-task-design/calibration
F=fixtures/v1.3-rehearsal-tasks/hint-audit/frame-repair-cafe.txt   # the probe's hexagonal frame, same text
for p in hexagonal clean-architecture ddd layered; do
  node $A --preset presets/$p.yaml $C/pilot-tasks.json > $C/pilot.$p.txt
  node $A --preset presets/$p.yaml results/v1.3-floor-probe/tasks.json > $C/probe.$p.txt
done
node $A --preset presets/hexagonal.yaml --frame $F --frame-may-name-layout > $C/hex-frame.layout-arm.txt
node $A --preset presets/hexagonal.yaml --frame $F > $C/hex-frame.as-no-hint.txt
node $A --preset presets/hexagonal.yaml $C/planted-hint.txt > $C/planted-hint.out.txt
grep -H '^total' $C/*.txt
