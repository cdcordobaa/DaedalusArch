#!/usr/bin/env python3
"""Evaluate one snapshot directory (holding src/) and return its record. Adapted from #161 scripts/evalsnap.py.
Env: PROBE_SKEL = directory with the pinned skeleton's node_modules (typescript 5.9.3, express 5.2.1).
usage (CLI): evalsnap.py <snapdir> <spec> [report.json]  -> prints the record as JSON."""
import json, os, subprocess, sys
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))

def sh(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

def evaluate(snap, spec, report_out=None):
    snap = os.path.abspath(snap)
    nm = os.path.join(snap, 'node_modules')
    if not os.path.exists(nm):
        os.symlink(os.path.join(os.environ['PROBE_SKEL'], 'node_modules'), nm)
    sh([os.path.join(HERE, 'mktsconfig.sh'), snap])
    tc = sh([os.path.join(snap, 'node_modules/.bin/tsc'), '-p', os.path.join(snap, 'tsconfig.json')], cwd=snap)
    tc_errors = [l for l in tc.stdout.splitlines() if ': error TS' in l]
    ev = sh(['npx', 'tsx', 'bin/firewall.ts', 'evaluate', '--project', snap, '--spec', spec, '--symbolic-only',
             '--engine', 'cypher-interp', '--scoring', 'v1.3', '--format', 'json', '--tsconfig', os.path.join(snap, 'tsconfig.json')], cwd=REPO)
    if not ev.stdout.strip():
        raise RuntimeError(ev.stderr)
    rep = json.loads(ev.stdout)
    if report_out:
        with open(report_out, 'w') as fh:
            json.dump(rep, fh, indent=2); fh.write('\n')
    t = rep['tiers']
    blocking = {r['functionId']: r['violationCount'] for r in t['blocking']['rules']}
    advisory = {r['functionId']: r['violationCount'] for r in t['advisory']['rules']}
    findings = []
    for v in rep['violations']:
        fid = v.get('functionId') or v.get('ruleId')
        if fid in blocking:
            findings.append({'rule': fid, 'template': (v.get('type') or '').replace('CUSTOM_', ''),
                             'file': v.get('filePath') or v.get('file'), 'line': v.get('line'),
                             'target': v.get('target'), 'message': v.get('message')})
    loc = 0; nfiles = 0
    for root, _, files in os.walk(os.path.join(snap, 'src')):
        for f in files:
            if f.endswith('.ts'):
                nfiles += 1
                with open(os.path.join(root, f)) as fh:
                    loc += sum(1 for l in fh if l.strip())
    for f in ('node_modules', 'tsconfig.json'):
        p = os.path.join(snap, f)
        if os.path.islink(p) or os.path.isfile(p): os.remove(p)
    return {
        'spec': spec, 'engine': 'cypher-interp', 'scoringMode': 'v1.3', 'instrumentVersion': rep.get('instrumentVersion'),
        'typecheckErrors': len(tc_errors), 'typecheckSample': tc_errors[:5],
        'verdict': t['verdict'], 'blockingViolationCount': t['blocking']['violationCount'],
        'advisoryViolationCount': t['advisory']['violationCount'],
        'blockingByRule': {k: v for k, v in blocking.items() if v}, 'advisoryByRule': {k: v for k, v in advisory.items() if v},
        'blockingFindings': findings, 'srcFiles': nfiles, 'loc': loc,
    }

if __name__ == '__main__':
    print(json.dumps(evaluate(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None), indent=2))
