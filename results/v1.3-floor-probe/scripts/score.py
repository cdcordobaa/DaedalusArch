#!/usr/bin/env python3
"""Score one step of a floor-probe project and record it.

usage: score.py <projdir> <spec> <record.json> <label>
- type-checks with the pinned skeleton tsc and the harness options;
- runs `evaluate --symbolic-only --engine cypher-interp --scoring v1.3`;
- commits the tree in the project's own git repo with <label>, and records files touched vs the previous commit.
Prints a one-line summary and the blocking findings.
"""
import json, os, subprocess, sys
proj, spec, out, label = sys.argv[1:5]
REPO = '/home/user/DaedalusArch'
proj = os.path.abspath(proj)
def sh(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
tc = sh([os.path.join(proj, 'node_modules/.bin/tsc'), '-p', os.path.join(proj, 'tsconfig.json')], cwd=proj)
tc_errors = [l for l in tc.stdout.splitlines() if ': error TS' in l]
ev = sh(['npx', 'tsx', 'bin/firewall.ts', 'evaluate', '--project', proj, '--spec', spec, '--symbolic-only',
         '--engine', 'cypher-interp', '--scoring', 'v1.3', '--format', 'json', '--tsconfig', os.path.join(proj, 'tsconfig.json')], cwd=REPO)
if not ev.stdout.strip():
    print(ev.stderr); sys.exit(2)
rep = json.loads(ev.stdout)
t = rep['tiers']
blocking = {r['functionId']: r['violationCount'] for r in t['blocking']['rules']}
advisory = {r['functionId']: r['violationCount'] for r in t['advisory']['rules']}
bids = set(blocking)
findings = []
for v in rep['violations']:
    fid = v.get('functionId') or v.get('ruleId')
    if fid in bids:
        findings.append({'rule': fid, 'file': v.get('filePath') or v.get('file'), 'line': v.get('line'),
                         'target': v.get('target'), 'message': v.get('message')})
# files touched
sh(['git', 'add', '-A', 'src'], cwd=proj)
st = sh(['git', 'diff', '--cached', '--name-status'], cwd=proj).stdout.strip().splitlines()
sh(['git', 'commit', '-q', '--allow-empty', '-m', label], cwd=proj)
loc = 0; nfiles = 0
for root, _, files in os.walk(os.path.join(proj, 'src')):
    for f in files:
        if f.endswith('.ts'):
            nfiles += 1
            with open(os.path.join(root, f)) as fh:
                loc += sum(1 for l in fh if l.strip())
rec = {
    'label': label, 'spec': spec, 'engine': 'cypher-interp', 'scoringMode': 'v1.3',
    'typecheckErrors': len(tc_errors), 'typecheckSample': tc_errors[:5],
    'verdict': t['verdict'], 'blockingAhs': t['blockingAhs'], 'ahsV12e': rep.get('ahsDeterministic'),
    'blockingViolationCount': t['blocking']['violationCount'],
    'advisoryViolationCount': t['advisory']['violationCount'],
    'blockingByRule': blocking, 'advisoryByRule': advisory, 'blockingFindings': findings,
    'filesTouched': [l.replace('\t', ' ') for l in st], 'srcFiles': nfiles, 'loc': loc,
    'parseCoverage': rep.get('parseCoverage'), 'importResolution': rep.get('importResolution'),
}
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as fh:
    json.dump(rec, fh, indent=2); fh.write('\n')
adv = ' '.join(f'{k}={v}' for k, v in advisory.items() if v)
print(f"{label}: tsc={len(tc_errors)} blocking={rec['blockingViolationCount']} advisory={rec['advisoryViolationCount']} [{adv}] files={nfiles} loc={loc} touched={len(st)}")
for f in findings:
    print(f"  BLOCK {f['rule']} {f['file']}:{f['line']} -> {f['target']} :: {(f['message'] or '')[:160]}")
for e in tc_errors[:5]:
    print('  TSC', e)
