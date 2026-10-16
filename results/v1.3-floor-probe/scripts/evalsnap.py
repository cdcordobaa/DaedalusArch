#!/usr/bin/env python3
"""Evaluate one snapshot directory (holding src/) and return the step record.
usage (module): evaluate(snapdir, spec) -> dict"""
import json, os, subprocess
REPO = '/home/user/DaedalusArch'
SKEL = '/tmp/claude-0/-home-user-DaedalusArch/5080b1a6-6525-54aa-a4ee-0d92d8ce6f28/scratchpad/skel'
MKTS = '/tmp/claude-0/-home-user-DaedalusArch/5080b1a6-6525-54aa-a4ee-0d92d8ce6f28/scratchpad/mktsconfig.sh'

def sh(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

def evaluate(snap, spec):
    snap = os.path.abspath(snap)
    if not os.path.exists(os.path.join(snap, 'node_modules')):
        os.symlink(os.path.join(SKEL, 'node_modules'), os.path.join(snap, 'node_modules'))
    sh([MKTS, snap])
    tc = sh([os.path.join(snap, 'node_modules/.bin/tsc'), '-p', os.path.join(snap, 'tsconfig.json')], cwd=snap)
    tc_errors = [l for l in tc.stdout.splitlines() if ': error TS' in l]
    ev = sh(['npx', 'tsx', 'bin/firewall.ts', 'evaluate', '--project', snap, '--spec', spec, '--symbolic-only',
             '--engine', 'cypher-interp', '--scoring', 'v1.3', '--format', 'json', '--tsconfig', os.path.join(snap, 'tsconfig.json')], cwd=REPO)
    if not ev.stdout.strip():
        raise RuntimeError(ev.stderr)
    rep = json.loads(ev.stdout)
    t = rep['tiers']
    blocking = {r['functionId']: r['violationCount'] for r in t['blocking']['rules']}
    advisory = {r['functionId']: r['violationCount'] for r in t['advisory']['rules']}
    findings = []
    for v in rep['violations']:
        fid = v.get('functionId') or v.get('ruleId')
        if fid in blocking:
            findings.append({'rule': fid, 'file': v.get('filePath') or v.get('file'), 'line': v.get('line'),
                             'target': v.get('target'), 'message': v.get('message')})
    loc = 0; nfiles = 0
    for root, _, files in os.walk(os.path.join(snap, 'src')):
        for f in files:
            if f.endswith('.ts'):
                nfiles += 1
                with open(os.path.join(root, f)) as fh:
                    loc += sum(1 for l in fh if l.strip())
    return {
        'spec': spec, 'engine': 'cypher-interp', 'scoringMode': 'v1.3', 'instrumentVersion': rep.get('instrumentVersion'),
        'typecheckErrors': len(tc_errors), 'typecheckSample': tc_errors[:5],
        'verdict': t['verdict'], 'blockingAhs': t['blockingAhs'], 'ahsV12e': rep.get('ahsDeterministic'),
        'blockingViolationCount': t['blocking']['violationCount'], 'advisoryViolationCount': t['advisory']['violationCount'],
        'blockingByRule': blocking, 'advisoryByRule': advisory, 'blockingFindings': findings,
        'srcFiles': nfiles, 'loc': loc,
        'layerAnnotation': rep.get('layerAnnotation'),
    }

def summary(rec):
    adv = ' '.join(f'{k}={v}' for k, v in rec['advisoryByRule'].items() if v)
    out = [f"tsc={rec['typecheckErrors']} blocking={rec['blockingViolationCount']} advisory={rec['advisoryViolationCount']} [{adv}] files={rec['srcFiles']} loc={rec['loc']}"]
    for f in rec['blockingFindings']:
        out.append(f"  BLOCK {f['rule']} {f['file']}:{f['line']} -> {f['target']} :: {(f['message'] or '')[:150]}")
    return '\n'.join(out)
