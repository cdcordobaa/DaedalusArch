"""analyze.py <runs-dir> N : summarise task N transcript and evaluation."""
import json, sys, datetime, collections
R, N = sys.argv[1], sys.argv[2]
def ts(x):
    return datetime.datetime.fromisoformat(x.replace('Z', '+00:00')) if x else None
calls, results, tools, init, final = {}, {}, collections.Counter(), None, None
order = []
for line in open(f'{R}/task{N}.jsonl'):
    try: d = json.loads(line)
    except Exception: continue
    t = d.get('type')
    if t == 'system' and d.get('subtype') == 'init': init = d
    if t == 'result': final = d
    msg = d.get('message') or {}
    for c in msg.get('content') or [] if isinstance(msg.get('content'), list) else []:
        if c.get('type') == 'tool_use':
            calls[c['id']] = (c['name'], c.get('input'), d.get('timestamp'))
            order.append(c['id']); tools[c['name']] += 1
        if c.get('type') == 'tool_result':
            txt = c.get('content')
            if isinstance(txt, list): txt = ' '.join(x.get('text', '') for x in txt if isinstance(x, dict))
            results[c['tool_use_id']] = (txt or '', c.get('is_error', False), d.get('timestamp'))
out = {'task': N}
if init: out['model'] = init.get('model'); out['mcp'] = init.get('mcp_servers'); out['claude_code'] = init.get('claude_code_version')
if final: out.update({k: final.get(k) for k in ('num_turns', 'duration_ms', 'total_cost_usd', 'is_error', 'subtype')})
out['tool_counts'] = dict(tools)
mcp = []
for cid in order:
    name, inp, t0 = calls[cid]
    if not name.startswith('mcp__daedalus__'): continue
    res, err, t1 = results.get(cid, ('', None, None))
    lat = (ts(t1) - ts(t0)).total_seconds() if t0 and t1 else None
    summ = ''
    try:
        j = json.loads(res)
        for k in ('blockingVerdict', 'verdict', 'violationCount', 'ahs'):
            if k in j: summ += f'{k}={j[k] if not isinstance(j[k], dict) else j[k].get("verdict", j[k])} '
        if 'tiers' in j: summ += f"tier={j['tiers'].get('verdict')} "
    except Exception:
        summ = res[:120].replace('\n', ' ')
    mcp.append({'tool': name.replace('mcp__daedalus__', ''), 'arg': (inp or {}).get('path') or (inp or {}).get('from') or '', 'latency_s': lat, 'error': err, 'summary': summ.strip()})
out['mcp_calls'] = mcp
denied = [results[c][0][:100] for c in order if c in results and results[c][1] and 'permission' in results[c][0].lower()]
out['denied'] = denied
try:
    e = json.load(open(f'{R}/eval{N}.json'))
    tiers = e.get('tiers') or {}
    rows = []
    for grp in ('blocking', 'advisory'):
        g = tiers.get(grp) or {}
        for r in g.get('rules', []):
            if r.get('violated'): rows.append((grp, r['functionId'], r['name'], r['violationCount']))
    out['eval'] = {'tierVerdict': tiers.get('verdict'), 'v12eVerdict': tiers.get('v12eVerdict'), 'ahs': e.get('ahsDeterministic'),
                   'blockingAhs': tiers.get('blockingAhs'), 'violated': rows, 'nViolations': len(e.get('violations', []))}
    out['eval_violations'] = [(v['functionId'], v.get('filePath'), (v.get('message') or '')[:140]) for v in e.get('violations', [])]
except Exception as ex:
    out['eval'] = f'unreadable: {ex}'
print(json.dumps(out, indent=1, default=str))
