#!/usr/bin/env python3
"""Score every step commit of a project repo. usage: history.py <projrepo> <spec> <outdir> <arm>
Writes <outdir>/step-NN.json and copies the snapshot's src to <outdir>/snapshots/step-NN/src."""
import json, os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from evalsnap import evaluate, summary
proj, spec, outdir, arm = sys.argv[1:5]
def git(*a):
    return subprocess.run(['git', *a], cwd=proj, capture_output=True, text=True, check=True).stdout
commits = [l.split(' ', 1) for l in git('log', '--reverse', '--format=%H %s').strip().splitlines()]
steps = [(h, s) for h, s in commits if s.startswith('step ')]
os.makedirs(outdir, exist_ok=True)
for i, (h, subj) in enumerate(steps, 1):
    snap = os.path.join(outdir, 'snapshots', f'step-{i:02d}')
    shutil.rmtree(snap, ignore_errors=True); os.makedirs(snap)
    subprocess.run(f'git archive {h} src | tar -x -C {snap}', shell=True, cwd=proj, check=True)
    rec = evaluate(snap, spec)
    rec.update({'arm': arm, 'step': i, 'commit': subj, 'filesTouched': git('diff', '--name-status', f'{h}~1', h).strip().replace('\t', ' ').splitlines()})
    for f in ('node_modules', 'tsconfig.json'):
        p = os.path.join(snap, f)
        if os.path.islink(p) or os.path.isfile(p): os.remove(p)
    with open(os.path.join(outdir, f'step-{i:02d}.json'), 'w') as fh:
        json.dump(rec, fh, indent=2); fh.write('\n')
    print(f'[{arm}] step {i} ({subj}): ' + summary(rec))
