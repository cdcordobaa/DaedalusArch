#!/usr/bin/env python3
"""Run MCP check_diff on a diff and summarise. usage: cdsum.py <spec> <project> <diff> [out.json]"""
import json, subprocess, sys
spec, proj, diff = sys.argv[1:4]
r = subprocess.run(['npx', 'tsx', '/tmp/claude-0/-home-user-DaedalusArch/5080b1a6-6525-54aa-a4ee-0d92d8ce6f28/scratchpad/tools/checkdiff.mts', spec, proj, diff],
                   cwd='/home/user/DaedalusArch', capture_output=True, text=True)
d = json.loads(r.stdout)
if not d.get('ok'):
    print('check_diff:', d); sys.exit(0)
data = d['data']
out = {'verdict': data['verdict'], 'summary': data['summary'], 'blocking': [], 'advisoryCount': 0, 'skipped': data.get('skipped', [])}
for f in data['files']:
    out['advisoryCount'] += f.get('advisoryCount', 0)
    for v in f.get('violations', []):
        item = {'file': f['path'], 'rule': v.get('ruleId'), 'tier': v.get('tier'), 'line': v.get('line'), 'target': v.get('target') or v.get('importPath'), 'reason': (v.get('reason') or v.get('message') or '')[:200], 'fix': (v.get('fix') or '')[:200]}
        (out['blocking'] if v.get('tier') == 'blocking' else out.setdefault('advisoryListed', [])).append(item)
print(f"check_diff: {out['verdict']} blocking={len(out['blocking'])} advisory={out['advisoryCount']}")
for b in out['blocking']:
    print(f"  {b['rule']} {b['file']}:{b['line']} -> {b['target']}")
for b in out.get('advisoryListed', []):
    print(f"  (advisory) {b['rule']} {b['file']}:{b['line']} :: {b['reason'][:100]}")
if len(sys.argv) > 4:
    json.dump(out, open(sys.argv[4], 'w'), indent=2)
