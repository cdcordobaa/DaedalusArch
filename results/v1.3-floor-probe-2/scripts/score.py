#!/usr/bin/env python3
"""Floor probe 2: score every step snapshot of the six trajectories (run only after all 24 steps were committed).

usage: score.py <scratch> <results dir>
- <scratch>/store/<task>-<cond>.git holds the step commits ("step N"); <scratch>/skel the pinned skeleton.
- For each step: the tree is exported to <scratch>/score/<task>/<cond>/step-NN (src + harness tsconfig), type-checked,
  and scored with `bin/firewall.ts evaluate --symbolic-only --engine cypher-interp --scoring v1.3` against the task's
  pilot spec (the same spec for all three conditions). The full report stays in scratch; the step record and the src
  snapshot go to <results>/<task>/<cond>/.
- Writes <scratch>/jobs.json for scripts/v1.3/check-correct.ts --tiers blocking.
"""
import json, os, shutil, subprocess, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SPEC = {'shelter-adoptions': 'presets/hexagonal.yaml', 'market-vendors': 'specs/clean-arch.yaml'}
CONDS = ('C1', 'C2', 'C3')


def sh(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def identity(v):
    """Pilot memo §3: rule id, template, file, target; a cycle is the set of its files. Lines ignored."""
    fid = v.get('functionId')
    if fid == 'FF-S02':
        files = sorted(set([v.get('filePath')] + [e for e in (v.get('evidence') or []) if isinstance(e, str) and e.endswith('.ts')]))
        return [fid, v.get('template') or v.get('type'), '|'.join(f for f in files if f), None]
    return [fid, v.get('template') or v.get('type'), v.get('filePath'), v.get('target')]


def evaluate(snap, spec):
    os.symlink(os.path.join(SCRATCH, 'skel', 'node_modules'), os.path.join(snap, 'node_modules'))
    sh(['sh', os.path.join(REPO, 'results/v1.3-floor-probe-2/scripts/mktsconfig.sh'), snap])
    tc = sh([os.path.join(snap, 'node_modules/.bin/tsc'), '-p', os.path.join(snap, 'tsconfig.json')], cwd=snap)
    tc_errors = [l for l in tc.stdout.splitlines() if ': error TS' in l]
    ev = sh(['npx', 'tsx', 'bin/firewall.ts', 'evaluate', '--project', snap, '--spec', spec, '--symbolic-only', '--engine',
             'cypher-interp', '--scoring', 'v1.3', '--format', 'json', '--tsconfig', os.path.join(snap, 'tsconfig.json')], cwd=REPO)
    if not ev.stdout.strip():
        raise RuntimeError(ev.stderr)
    return json.loads(ev.stdout), tc_errors


def loc_of(src):
    n = loc = 0
    for root, _, files in os.walk(src):
        for f in files:
            if f.endswith('.ts'):
                n += 1
                with open(os.path.join(root, f)) as fh:
                    loc += sum(1 for l in fh if l.strip())
    return n, loc


def main():
    jobs = []
    for task, spec_rel in SPEC.items():
        spec = os.path.join(REPO, spec_rel)
        for cond in CONDS:
            git = os.path.join(SCRATCH, 'store', f'{task}-{cond}.git')
            log = sh(['git', '--git-dir', git, 'log', '--reverse', '--format=%H %s']).stdout.split('\n')
            steps = [l.split(' ', 1)[0] for l in log if l.endswith(tuple(f' step {i}' for i in range(1, 10)))]
            outdir = os.path.join(RESULTS, task, cond)
            for i, h in enumerate(steps, 1):
                snap = os.path.join(SCRATCH, 'score', task, cond, f'step-{i:02d}')
                shutil.rmtree(snap, ignore_errors=True)
                os.makedirs(snap)
                subprocess.run(f'git --git-dir={git} archive {h} src | tar -x -C {snap}', shell=True, check=True)
                rep, tc_errors = evaluate(snap, spec)
                rep_path = os.path.join(SCRATCH, 'score', task, cond, f'step-{i:02d}.report.json')
                with open(rep_path, 'w') as fh:
                    json.dump(rep, fh)
                t = rep['tiers']
                blocking = {r['functionId']: r['violationCount'] for r in t['blocking']['rules']}
                advisory = {r['functionId']: r['violationCount'] for r in t['advisory']['rules']}
                findings = [{'rule': v.get('functionId'), 'type': v.get('type'), 'file': v.get('filePath'), 'line': v.get('line'),
                             'target': v.get('target'), 'message': v.get('message'), 'evidence': v.get('evidence'),
                             'identity': identity(v)}
                            for v in rep['violations'] if v.get('functionId') in blocking]
                diff = sh(['git', '--git-dir', git, 'diff', '--name-status', f'{h}~1', h]).stdout.strip().replace('\t', ' ').splitlines()
                nfiles, loc = loc_of(os.path.join(snap, 'src'))
                la = rep.get('layerAnnotation') or {}
                rec = {
                    'task': task, 'condition': cond, 'step': i, 'spec': spec_rel, 'engine': 'cypher-interp', 'scoringMode': 'v1.3',
                    'instrumentVersion': rep.get('instrumentVersion'), 'typecheckErrors': len(tc_errors), 'typecheckSample': tc_errors[:5],
                    'verdict': t['verdict'], 'blockingViolationCount': t['blocking']['violationCount'],
                    'advisoryViolationCount': t['advisory']['violationCount'], 'blockingByRule': blocking, 'advisoryByRule': advisory,
                    'blockingFindings': findings, 'srcFiles': nfiles, 'loc': loc, 'filesTouched': diff,
                    'layerMapped': la.get('mapped'), 'layerUnmapped': la.get('unmapped'), 'unmappedFiles': la.get('unmappedFiles'),
                }
                os.makedirs(outdir, exist_ok=True)
                with open(os.path.join(outdir, f'step-{i:02d}.json'), 'w') as fh:
                    json.dump(rec, fh, indent=2)
                    fh.write('\n')
                dst = os.path.join(outdir, 'snapshots', f'step-{i:02d}', 'src')
                shutil.rmtree(dst, ignore_errors=True)
                shutil.copytree(os.path.join(snap, 'src'), dst)
                jobs.append({'projectId': f'{task}/{cond}/step-{i:02d}', 'projectRoot': snap, 'spec': spec, 'report': rep_path})
                print(f'{task}/{cond} step {i}: tsc={len(tc_errors)} blocking={rec["blockingViolationCount"]} '
                      f'advisory={rec["advisoryViolationCount"]} unmapped={rec["layerUnmapped"]}/{nfiles} loc={loc}')
                for f in findings:
                    print(f'  BLOCK {f["rule"]} {f["file"]}:{f["line"]} -> {f["target"]} :: {(f["message"] or "")[:140]}')
    with open(os.path.join(SCRATCH, 'jobs.json'), 'w') as fh:
        json.dump({'schemaVersion': 1, 'kind': 'custom', 'jobs': jobs}, fh, indent=1)


if __name__ == '__main__':
    SCRATCH, RESULTS = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    main()
