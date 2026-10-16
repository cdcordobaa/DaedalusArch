#!/usr/bin/env python3
"""Tool-arm recorder. Evaluates the working tree of a tool-arm repo after a step (pre-fix) or after the fix (post-fix).
usage: toolrec.py <repo> <spec> <outdir> <step> <pre|post>
- runs MCP check_diff on `git diff HEAD` (the step's change for pre, the fix for post) and the full
  `evaluate --symbolic-only --engine cypher-interp`;
- writes <outdir>/step-NN.<phase>.json, commits ("step N pre-fix" / "step N"), and for post also writes
  the snapshot to <outdir>/snapshots/step-NN/src."""
import json, os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from evalsnap import evaluate, summary
repo, spec, outdir, step, phase = sys.argv[1:6]
step = int(step)
T = os.path.dirname(os.path.abspath(__file__))
def git(*a, check=True):
    return subprocess.run(['git', *a], cwd=repo, capture_output=True, text=True, check=check).stdout
os.makedirs(outdir, exist_ok=True)
subprocess.run(['git', 'add', '-A', 'src'], cwd=repo, check=True)
diff = git('diff', '--cached', 'HEAD', '--', 'src')
touched = git('diff', '--cached', '--name-status', 'HEAD', '--', 'src').strip().replace('\t', ' ').splitlines()
cd = None
if diff.strip():
    dfile = os.path.join(outdir, f'step-{step:02d}.{phase}.diff')
    open(dfile, 'w').write(diff)
    cdj = os.path.join(outdir, f'step-{step:02d}.{phase}.check_diff.json')
    r = subprocess.run(['python3', os.path.join(T, 'cdsum.py'), spec, repo, dfile, cdj], capture_output=True, text=True)
    print(r.stdout.strip())
    cd = json.load(open(cdj)) if os.path.exists(cdj) else None
snap = os.path.join(outdir, 'snapshots', f'step-{step:02d}' + ('' if phase == 'post' else '-pre'))
shutil.rmtree(snap, ignore_errors=True); os.makedirs(snap)
shutil.copytree(os.path.join(repo, 'src'), os.path.join(snap, 'src'))
rec = evaluate(snap, spec)
for f in ('node_modules', 'tsconfig.json'):
    p = os.path.join(snap, f)
    if os.path.islink(p) or os.path.isfile(p): os.remove(p)
if phase == 'pre':
    shutil.rmtree(snap)  # pre-fix trees are kept as the .diff only
rec.update({'arm': 'tool', 'step': step, 'phase': phase, 'filesTouched': touched,
            'checkDiff': {'blocking': len(cd['blocking']), 'advisory': cd['advisoryCount'], 'findings': cd['blocking'], 'advisoryListed': cd.get('advisoryListed', [])} if cd else None})
with open(os.path.join(outdir, f'step-{step:02d}.{phase}.json'), 'w') as fh:
    json.dump(rec, fh, indent=2); fh.write('\n')
git('commit', '-q', '--allow-empty', '-m', f'step {step} pre-fix' if phase == 'pre' else f'step {step}')
print(f'[tool] step {step} {phase}: ' + summary(rec))
