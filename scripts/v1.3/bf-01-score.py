"""BF-01 scoring, step 2 (zero calls). Scores every pilot session's derived spec (raw) and scored spec (unsupported
units dropped) against the declared spec A and the blind second author B, with the brownfield baseline's OWN metric
functions: wilson, kappa, kind, mapping, blocking_rules, fkey, blocking_findings are taken from
scripts/v1.3/brownfield-score.py by parsing that file (ast) and executing only those definitions, so the definitions
cannot drift. `mapping()` reads the module-level `labels` dict; here labels['m'] is the session's labels.

Reads results/v1.3-brownfield/{labels/labels-{a,b}.json, evaluate/{a,b}/<id>.json, score.json} (baseline, unchanged)
and <pilot>/sessions/<sid>/{labels,evaluate}.{derived,scored}.json, <pilot>/verify-summary.json.
Writes <pilot>/score.json and <pilot>/score.md.

An invalid or missing spec scores as a failure: nothing mapped, no rule, no finding, verdict 'invalid'. So does a
session that failed the run-time evidence gate (v2).

References: A = the declared spec (intent); B = the blind second author; C = code reality, the deterministic
zero-call reading of the parser graph: ISE + rule miner (`daedalus mine-rules`, default emission), i.e. the baseline's
mined spec (results/v1.3-brownfield/{labels/labels-m.json, evaluate/mined/}). On both pilot repos ISE picks the
declared style, so C needs no --style override here; on the 15-repo set it must be mined with --style <declared>.

  python3 -I scripts/v1.3/bf-01-score.py [results/v1.3-brownfield/llm-pilot]
"""
import ast
import json
import math
import statistics
import sys
from pathlib import Path

PILOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'results/v1.3-brownfield/llm-pilot')
BASE = Path('results/v1.3-brownfield')
SRC = Path('scripts/v1.3/brownfield-score.py')
KEEP = {'wilson', 'kappa', 'kind', 'mapping', 'blocking_rules', 'fkey', 'blocking_findings'}

tree = ast.parse(SRC.read_text())
body = [n for n in tree.body if (isinstance(n, ast.FunctionDef) and n.name in KEEP)
        or (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'OUTSIDE' for t in n.targets))]
NS = {'math': math, 'json': json}
exec(compile(ast.Module(body=body, type_ignores=[]), str(SRC), 'exec'), NS)
wilson, kappa, mapping, blocking_rules, blocking_findings = NS['wilson'], NS['kappa'], NS['mapping'], NS['blocking_rules'], NS['blocking_findings']

LAB = {s: {r['id']: r for r in json.loads((BASE / 'labels' / f'labels-{s}.json').read_text())} for s in 'ab'}
LAB['c'] = {r['id']: r for r in json.loads((BASE / 'labels' / 'labels-m.json').read_text())}
NS['labels'] = {'a': LAB['a'], 'b': LAB['b'], 'c': LAB['c'], 'm': {}}
EV = {s: {} for s in 'abc'}
REFS = 'abc'
REPOS = ['luizomf-clean-api', 'zeldaplay-api']
for s, d in (('a', 'a'), ('b', 'b'), ('c', 'mined')):
    for rid in REPOS:
        EV[s][rid] = json.loads((BASE / 'evaluate' / d / f'{rid}.json').read_text())
EV_MINED = {rid: json.loads((BASE / 'evaluate' / 'mined' / f'{rid}.json').read_text()) for rid in REPOS}
LAB_MINED = {r['id']: r for r in json.loads((BASE / 'labels' / 'labels-m.json').read_text())}


def score(rid, lab, ev):
    """One spec (labels + evaluation; None = invalid) against A and B, with the baseline functions."""
    out = {}
    for ref in REFS:
        er = EV[ref][rid]
        r_all, r_hit, _ = blocking_rules(er)
        r_find = blocking_findings(er)
        if lab is None or ev is None:
            ref_mapped = sum(1 for f, l in LAB[ref][rid]['files'].items() if f.startswith('src/') and l not in ('excluded', 'unmapped'))
            out[ref] = {'mapping': {'recallHits': 0, 'refMapped': ref_mapped, 'precisionHits': 0, 'minedMapped': 0, 'kappaKind': None},
                        'rules': {'both': 0, 'ref': len(r_all), 'mined': 0, 'bothHit': 0, 'refHit': len(r_hit), 'minedHit': 0},
                        'findings': {'both': 0, 'ref': len(r_find), 'mined': 0}, 'verdict': [er['tiers']['verdict'], 'invalid']}
            continue
        NS['labels']['m'] = {rid: lab}
        m = mapping(ref, rid)
        m_all, m_hit, _ = blocking_rules(ev)
        m_find = blocking_findings(ev)
        out[ref] = {'mapping': {k: m[k] for k in ('recallHits', 'refMapped', 'precisionHits', 'minedMapped', 'kappaKind', 'refKindToMinedKind')},
                    'rules': {'both': len(r_all & m_all), 'ref': len(r_all), 'mined': len(m_all), 'bothHit': len(r_hit & m_hit), 'refHit': len(r_hit), 'minedHit': len(m_hit),
                              'refIds': sorted(r_all), 'minedIds': sorted(m_all)},
                    'findings': {'both': len(set(r_find) & set(m_find)), 'ref': len(r_find), 'mined': len(m_find)},
                    'verdict': [er['tiers']['verdict'], ev['tiers']['verdict']]}
    return out


verify = {r['sid']: r for r in json.loads((PILOT / 'verify-summary.json').read_text())} if (PILOT / 'verify-summary.json').exists() else {}
rows = []
for d in sorted((PILOT / 'sessions').iterdir()):
    if '.failed-attempt' in d.name or not (d / 'meta.json').exists():
        continue
    meta = json.loads((d / 'meta.json').read_text())
    row = {'sid': meta['sid'], 'repo': meta['repo'], 'arm': meta['arm'], 'run': meta['run'], 'status': meta['status'],
           'modelValid': meta['modelValid'], 'capFlags': meta['capFlags'], 'confinementViolations': meta['confinementViolations'],
           'turns': meta['usage'].get('numTurns'), 'processedTokens': meta['processedTokens'], 'wallS': round(meta['wallMs'] / 1000),
           'toolCalls': meta['toolCalls'], 'specValid': meta['output']['specValid'], 'verify': verify.get(meta['sid']),
           'evidenceGate': meta.get('evidenceGate')}
    valid_session = meta['status'] == 'completed' and meta['modelValid'] and not meta['confinementViolations']
    row['validSession'] = valid_session
    for variant in ('derived', 'scored'):
        lab_f, ev_f = d / f'labels.{variant}.json', d / f'evaluate.{variant}.json'
        lab = json.loads(lab_f.read_text())[0] if lab_f.exists() else None
        ev = json.loads(ev_f.read_text()) if ev_f.exists() else None
        if variant == 'scored' and verify.get(meta['sid'], {}).get('scoredValid') is False:
            lab, ev = None, None
        if variant == 'derived' and meta['output']['specValid'] is not True:
            lab, ev = None, None
        if not valid_session or (meta.get('evidenceGate') is not None and not meta['evidenceGate']['pass']):
            lab, ev = None, None
        row[variant] = score(meta['repo'], lab, ev)
    rows.append(row)

baseline = {rid: {'mined': score(rid, LAB_MINED[rid], EV_MINED[rid]), 'B': score(rid, LAB['b'][rid], EV['b'][rid])} for rid in REPOS}


def pool(items, ref):
    """k/n sums over a list of score dicts (one per session or repo)."""
    acc = {'mapR': [0, 0], 'mapP': [0, 0], 'rulR': [0, 0], 'rulP': [0, 0], 'finR': [0, 0], 'finP': [0, 0], 'verdictSame': [0, 0]}
    kap = []
    for s in items:
        x = s[ref]
        acc['mapR'][0] += x['mapping']['recallHits']; acc['mapR'][1] += x['mapping']['refMapped']
        acc['mapP'][0] += x['mapping']['precisionHits']; acc['mapP'][1] += x['mapping']['minedMapped']
        acc['rulR'][0] += x['rules']['both']; acc['rulR'][1] += x['rules']['ref']
        acc['rulP'][0] += x['rules']['both']; acc['rulP'][1] += x['rules']['mined']
        acc['finR'][0] += x['findings']['both']; acc['finR'][1] += x['findings']['ref']
        acc['finP'][0] += x['findings']['both']; acc['finP'][1] += x['findings']['mined']
        acc['verdictSame'][0] += int(x['verdict'][0] == x['verdict'][1]); acc['verdictSame'][1] += 1
        kap.append(x['mapping']['kappaKind'])
    out = {k: {'k': v[0], 'n': v[1], 'value': round(v[0] / v[1], 3) if v[1] else None, 'wilson': wilson(v[0], v[1])} for k, v in acc.items()}
    ks = [k for k in kap if k is not None]
    out['kappaKind'] = {'median': round(statistics.median(ks), 3) if ks else None, 'min': round(min(ks), 3) if ks else None, 'max': round(max(ks), 3) if ks else None, 'invalid': sum(k is None for k in kap)}
    return out


summary = {'arms': {}, 'baselineSameRepos': {}, 'stability': {}, 'evidence': {}}
ARMS = sorted({r['arm'] for r in rows})
for variant in ('scored', 'derived'):
    for arm in ARMS:
        sub = [r for r in rows if r['arm'] == arm]
        for ref in REFS:
            summary['arms'][f'{arm}.{variant}.vs{ref.upper()}'] = {'pooled': pool([r[variant] for r in sub], ref),
                                                                    'perRepo': {rid: pool([r[variant] for r in sub if r['repo'] == rid], ref) for rid in REPOS}}
for name in ('mined', 'B'):
    for ref in ('ab' if name == 'mined' else 'ac'):
        summary['baselineSameRepos'][f'{name}.vs{ref.upper()}'] = {'pooled': pool([baseline[rid][name] for rid in REPOS], ref),
                                                                    'perRepo': {rid: pool([baseline[rid][name]], ref) for rid in REPOS}}
for arm in ARMS:
    for rid in REPOS:
        vs = [r['scored']['a']['verdict'][1] for r in rows if r['arm'] == arm and r['repo'] == rid]
        summary['stability'][f'{arm}.{rid}'] = {'verdicts': vs, 'flips': len(set(vs)) > 1}
    vr = [r['verify'] for r in rows if r['arm'] == arm and r['verify'] is not None and r['verify'].get('derived')]
    ct = {}
    for v in vr:
        for t, (k, n) in v['citations']['byType'].items():
            c = ct.setdefault(t, [0, 0]); c[0] += k; c[1] += n
    ck = sum(v['citations']['verified'] for v in vr); cn = sum(v['citations']['total'] for v in vr)
    uk = sum(v['requiredUnits']['supported'] for v in vr); un = sum(v['requiredUnits']['total'] for v in vr)
    summary['evidence'][arm] = {'sessionsWithOutput': len(vr), 'citationsVerified': [ck, cn, round(ck / cn, 3) if cn else None, wilson(ck, cn)],
                                'byType': ct, 'requiredUnitsSupported': [uk, un, round(uk / un, 3) if un else None, wilson(uk, un)],
                                'docOnlyUnits': sum(len(v['requiredUnits']['docOnly']) for v in vr),
                                'unsupported': [u for v in vr for u in v['requiredUnits']['unsupported']]}
summary['sessions'] = {'scored': len(rows), 'valid': sum(r['validSession'] for r in rows)}
(PILOT / 'score.json').write_text(json.dumps({'summary': summary, 'rows': rows, 'baselineSameRepos': baseline}, indent=1) + '\n')


def f(x):
    return '-' if x['n'] == 0 else f"{x['value']:.2f} ({x['k']}/{x['n']})"


md = ['# BF-01 pilot scores (generated by scripts/v1.3/bf-01-score.py)', '',
      'Metric functions executed from scripts/v1.3/brownfield-score.py (ast extraction). "scored" = unsupported units dropped; "derived" = as written.', '',
      '## Pooled over the 2 pilot repos, against A', '',
      '| arm | variant | mapping R | mapping P | kappa kind median [min, max] | rules R | rules P | blocking findings R | findings P | verdict = A |', '|---|---|---|---|---|---|---|---|---|---|']
for key, v in summary['arms'].items():
    if not key.endswith('vsA'):
        continue
    p = v['pooled']; arm, variant, _ = key.split('.')
    md.append(f"| {arm} | {variant} | {f(p['mapR'])} | {f(p['mapP'])} | {p['kappaKind']['median']} [{p['kappaKind']['min']}, {p['kappaKind']['max']}] | {f(p['rulR'])} | {f(p['rulP'])} | {f(p['finR'])} | {f(p['finP'])} | {f(p['verdictSame'])} |")
for key, v in summary['baselineSameRepos'].items():
    if not key.endswith('vsA'):
        continue
    p = v['pooled']
    md.append(f"| {key.split('.')[0]} (baseline) | - | {f(p['mapR'])} | {f(p['mapP'])} | {p['kappaKind']['median']} [{p['kappaKind']['min']}, {p['kappaKind']['max']}] | {f(p['rulR'])} | {f(p['rulP'])} | {f(p['finR'])} | {f(p['finP'])} | {f(p['verdictSame'])} |")
md += ['', '## Per repo, scored variant, against A (3 runs pooled per arm)', '', '| repo | arm | mapping R | mapping P | kappa median [min, max] | rules R | rules P | findings R | findings P | verdicts (A / runs) |', '|---|---|---|---|---|---|---|---|---|---|']
for rid in REPOS:
    for arm in ARMS:
        p = summary['arms'][f'{arm}.scored.vsA']['perRepo'][rid]
        vs = summary['stability'][f'{arm}.{rid}']['verdicts']
        md.append(f"| {rid} | {arm} | {f(p['mapR'])} | {f(p['mapP'])} | {p['kappaKind']['median']} [{p['kappaKind']['min']}, {p['kappaKind']['max']}] | {f(p['rulR'])} | {f(p['rulP'])} | {f(p['finR'])} | {f(p['finP'])} | {EV['a'][rid]['tiers']['verdict']} / {', '.join(vs)} |")
    for name in ('mined', 'B'):
        p = summary['baselineSameRepos'][f'{name}.vsA']['perRepo'][rid]
        md.append(f"| {rid} | {name} | {f(p['mapR'])} | {f(p['mapP'])} | {p['kappaKind']['median']} | {f(p['rulR'])} | {f(p['rulP'])} | {f(p['finR'])} | {f(p['finP'])} | {EV['a'][rid]['tiers']['verdict']} / {baseline[rid][name]['a']['verdict'][1]} |")
md += ['', '## Against C, code reality (scored; C = the deterministic ISE + miner spec)', '', '| arm | mapping R | mapping P | kappa median | rules R | rules P | findings R | verdict = C |', '|---|---|---|---|---|---|---|---|']
for arm in ARMS:
    p = summary['arms'][f'{arm}.scored.vsC']['pooled']
    md.append(f"| {arm} | {f(p['mapR'])} | {f(p['mapP'])} | {p['kappaKind']['median']} | {f(p['rulR'])} | {f(p['rulP'])} | {f(p['finR'])} | {f(p['verdictSame'])} |")
p = summary['baselineSameRepos']['B.vsC']['pooled']
md.append(f"| B (baseline) | {f(p['mapR'])} | {f(p['mapP'])} | {p['kappaKind']['median']} | {f(p['rulR'])} | {f(p['rulP'])} | {f(p['finR'])} | {f(p['verdictSame'])} |")
md += ['', '## Against B (scored)', '', '| arm | mapping R | mapping P | rules R | findings R | verdict = B |', '|---|---|---|---|---|---|']
for arm in ARMS:
    p = summary['arms'][f'{arm}.scored.vsB']['pooled']
    md.append(f"| {arm} | {f(p['mapR'])} | {f(p['mapP'])} | {f(p['rulR'])} | {f(p['finR'])} | {f(p['verdictSame'])} |")
p = summary['baselineSameRepos']['mined.vsB']['pooled']
md.append(f"| mined | {f(p['mapR'])} | {f(p['mapP'])} | {f(p['rulR'])} | {f(p['finR'])} | {f(p['verdictSame'])} |")
md += ['', '## Evidence check', '', '| arm | sessions with output | citations verified | by type | required units supported | doc-only units |', '|---|---|---|---|---|---|']
for arm, e in summary['evidence'].items():
    md.append(f"| {arm} | {e['sessionsWithOutput']} | {e['citationsVerified'][2]} ({e['citationsVerified'][0]}/{e['citationsVerified'][1]}) | {', '.join(f'{t} {k}/{n}' for t, (k, n) in sorted(e['byType'].items()))} | {e['requiredUnitsSupported'][2]} ({e['requiredUnitsSupported'][0]}/{e['requiredUnitsSupported'][1]}) | {e['docOnlyUnits']} |")
md += ['', '## Sessions', '', '| sid | status | valid | turns | processed tokens | wall s | spec valid | scored valid | tool calls | cap flags |', '|---|---|---|---|---|---|---|---|---|---|']
for r in rows:
    md.append(f"| {r['sid']} | {r['status']} | {r['validSession']} | {r['turns']} | {r['processedTokens']} | {r['wallS']} | {r['specValid']} | {None if r['verify'] is None else r['verify'].get('scoredValid')} | {sum(r['toolCalls'].values())} | {'; '.join(r['capFlags']) or '-'} |")
(PILOT / 'score.md').write_text('\n'.join(md) + '\n')
print('\n'.join(md))
