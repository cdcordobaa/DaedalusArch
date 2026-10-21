"""Writes a puzzle's DDD spec: presets/ddd.yaml verbatim except the `architecture.ddd` block, which declares the
puzzle tree's contexts and aggregates (a spec parameter, not a rule change). Usage:
  python3 experiments/puzzle-01/tools/make-ddd-spec.py <ddd-block.yaml> <out spec.yaml> <puzzle id>"""
import hashlib, sys
preset = open('presets/ddd.yaml').read()
block = open(sys.argv[1]).read().rstrip('\n') + '\n'
start = preset.index('\n  ddd:\n') + 1
end = preset.index('\nfitness_functions:')
head = ('# PUZZLE-01 %s (DEV split): evaluator spec. presets/ddd.yaml at the build commit, verbatim, except the\n'
        '# architecture.ddd block, which declares this puzzle tree. presets/ddd.yaml sha256 %s\n'
        % (sys.argv[3], hashlib.sha256(preset.encode()).hexdigest()))
open(sys.argv[2], 'w').write(head + preset[:start] + block + '\n' + preset[end + 1:])
