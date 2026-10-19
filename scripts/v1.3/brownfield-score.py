"""Brownfield zero-call baseline: score mined specs against the declared specs (A, results/v1.3-external/specs) and the
blind second author (B, results/v1.3-spec-author-b/specs). Docs/DiagnosticRuns/v1.3-brownfield-mined-baseline-2026-10-18.md.

Reads only committed outputs (no clone, no engine, no model):
  <dir>/labels/labels-{a,b,m}.json   scripts/v1.3/spec-author-agreement.ts labels (file -> layer | excluded | unmapped)
  <dir>/evaluate/{a,b,mined}/<id>.json  firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3
  <dir>/mined/<id>.json             scripts/v1.3/brownfield-mine.ts (mined rules with every exception)
Writes <dir>/score.json and <dir>/score.md.

Definitions (fixed in the report, section 2):
  mapping   universe = files under src/ that the reference spec does not exclude; a file is mapped by a spec when its
            label is a layer. Compared on the layer's kind (the K2 basis when layer names differ).
            recall = mapped by ref with the same kind under mined / mapped by ref;
            precision = mapped by mined with the same kind under ref / mapped by mined.
  rules     the blocking-tier rules each evaluation executed (tiers.blocking.rules, by functionId).
            recall = ref blocking rules the mined spec also executes as blocking / ref blocking rules;
            precision = the converse. Also over rules with >= 1 finding ("hit").
  findings  edge key of Docs ops/notes/g08 (rule id ignored): edge-shaped -> (file, target); package import ->
            (file, package); cycle -> its node list rotated to the smallest path. Distinct keys per repo.
  surfaced  a ref blocking finding is surfaced by the miner when some mined rule has an exception with the same
            (file, target), or, for a cycle, an exception edge between two of its nodes.
Intervals: Wilson 95% per repo and pooled (pooled treats units as independent: too narrow); repo-cluster percentile
bootstrap (10,000 resamples, seed 20261018) for pooled ratios and kappa.
"""
import json
import math
import random
import sys
from pathlib import Path

D = Path(sys.argv[1] if len(sys.argv) > 1 else 'results/v1.3-brownfield')
SEL = json.loads(Path('results/v1.3-external/selection.json').read_text())['entries']
IDS = [e['id'] for e in SEL]
STYLE = {e['id']: e['style'] for e in SEL}
OUTSIDE = ('excluded', 'unmapped')


def wilson(k, n, z=1.959964):
    if n == 0:
        return [None, None]
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [round(max(0.0, c - h), 3), round(min(1.0, c + h), 3)]


def kappa(a, b):
    n = len(a)
    if n == 0:
        return None
    po = sum(x == y for x, y in zip(a, b)) / n
    labs = set(a) | set(b)
    pe = sum((a.count(l) / n) * (b.count(l) / n) for l in labs)
    return None if pe >= 1 else (po - pe) / (1 - pe)


def boot_ratio(rows, num, den, B=10000, seed=20261018):
    rnd = random.Random(seed)
    vals = []
    for _ in range(B):
        s = [rows[rnd.randrange(len(rows))] for _ in rows]
        d = sum(r[den] for r in s)
        if d > 0:
            vals.append(sum(r[num] for r in s) / d)
    vals.sort()
    return [round(vals[int(0.025 * len(vals))], 3), round(vals[int(0.975 * len(vals)) - 1], 3)] if vals else [None, None]


def boot_kappa(pairs, B=10000, seed=20261018):
    rnd = random.Random(seed)
    vals = []
    for _ in range(B):
        s = [pairs[rnd.randrange(len(pairs))] for _ in pairs]
        k = kappa([x for x, _ in s], [y for _, y in s])
        if k is not None:
            vals.append(k)
    vals.sort()
    return [round(vals[int(0.025 * len(vals))], 3), round(vals[int(0.975 * len(vals)) - 1], 3)] if vals else [None, None]


labels = {s: {r['id']: r for r in json.loads((D / 'labels' / f'labels-{s}.json').read_text())} for s in 'abm'}
EV = {'a': 'a', 'b': 'b', 'm': 'mined'}


def ev(side, rid):
    return json.loads((D / 'evaluate' / EV[side] / f'{rid}.json').read_text())


def kind(lab, l):
    return l if l in OUTSIDE else lab['kinds'].get(l, l)


def mapping(ref, rid):
    R, M = labels[ref][rid], labels['m'][rid]
    files = [f for f in R['files'] if f.startswith('src/') and f in M['files'] and R['files'][f] != 'excluded']
    rk = {f: kind(R, R['files'][f]) for f in files}
    mk = {f: kind(M, M['files'][f]) for f in files}
    ref_mapped = [f for f in files if rk[f] not in OUTSIDE]
    min_mapped = [f for f in files if mk[f] not in OUTSIDE]
    same_r = sum(mk[f] == rk[f] for f in ref_mapped)
    same_m = sum(rk[f] == mk[f] for f in min_mapped)
    conf = {}
    for f in ref_mapped:
        key = f'{rk[f]}->{mk[f]}'
        conf[key] = conf.get(key, 0) + 1
    return {'files': len(files), 'refMapped': len(ref_mapped), 'minedMapped': len(min_mapped),
            'recallHits': same_r, 'precisionHits': same_m, 'kappaKind': kappa([rk[f] for f in files], [mk[f] for f in files]),
            'refKindToMinedKind': dict(sorted(conf.items(), key=lambda x: -x[1]))}


def blocking_rules(r):
    rules = r['tiers']['blocking']['rules']
    return ({x['functionId'] for x in rules}, {x['functionId'] for x in rules if x['violationCount'] > 0},
            {x['functionId']: x.get('name') for x in rules})


def fkey(v):
    if v.get('type') == 'CYCLIC_DEPENDENCY' or ',' in (v.get('filePath') or ''):
        try:
            nodes = json.loads(v['discriminator'][0])
        except Exception:
            nodes = v['filePath'].split(',')
        if len(nodes) > 1 and nodes[0] == nodes[-1]:
            nodes = nodes[:-1]
        i = nodes.index(min(nodes))
        return ('cycle',) + tuple(nodes[i:] + nodes[:i])
    t = v.get('target') or ''
    if t and not t.endswith(('.ts', '.tsx', '.js', '.json')):
        return ('pkg', v['filePath'], t)
    return ('edge', v['filePath'], t)


def blocking_findings(r):
    blk = {x['functionId'] for x in r['tiers']['blocking']['rules']}
    out = {}
    for v in r['violations']:
        if v['functionId'] in blk:
            out.setdefault(fkey(v), set()).add(v['functionId'])
    return out


def surfaced(key, exc_edges):
    if key[0] == 'cycle':
        nodes = set(key[1:])
        return any(f in nodes and t in nodes for f, t in exc_edges)
    return (key[1], key[2]) in exc_edges


rows = []
for rid in IDS:
    row = {'id': rid, 'declaredStyle': STYLE[rid]}
    mined = json.loads((D / 'mined' / f'{rid}.json').read_text())
    row['minedStyle'] = mined['style']
    row['styleMatch'] = mined['style'] == STYLE[rid] or (STYLE[rid] == 'clean' and mined['style'] == 'clean-architecture')
    exc_edges = {(e['file'], e.get('target') or '') for r in mined['rules'] for e in r['exceptions']}
    row['minedRules'] = mined['counts']['rules']
    row['minedExceptions'] = len(exc_edges)
    em = ev('m', rid)
    m_all, m_hit, m_names = blocking_rules(em)
    m_find = blocking_findings(em)
    row['verdict'] = {'m': em['tiers']['verdict']}
    for ref in 'ab':
        er = ev(ref, rid)
        r_all, r_hit, r_names = blocking_rules(er)
        r_find = blocking_findings(er)
        row['verdict'][ref] = er['tiers']['verdict']
        both = set(r_find) & set(m_find)
        row[ref] = {
            'mapping': mapping(ref, rid),
            'rules': {'ref': sorted(r_all), 'mined': sorted(m_all), 'both': sorted(r_all & m_all),
                      'refHit': sorted(r_hit), 'minedHit': sorted(m_hit), 'bothHit': sorted(r_hit & m_hit),
                      'sameTemplate': sorted(f for f in r_all & m_all if r_names.get(f) == m_names.get(f))},
            'findings': {'ref': len(r_find), 'mined': len(m_find), 'both': len(both),
                         'refByRule': {k: sum(1 for s in r_find.values() if k in s) for k in sorted({x for s in r_find.values() for x in s})},
                         'bothByRefRule': {k: sum(1 for key, s in r_find.items() if k in s and key in both) for k in sorted({x for s in r_find.values() for x in s})}},
            'surfaced': {'ref': len(r_find), 'hits': sum(surfaced(k, exc_edges) for k in r_find),
                         'byRefRule': {k: [sum(1 for key, s in r_find.items() if k in s and surfaced(key, exc_edges)), sum(1 for s in r_find.values() if k in s)] for k in sorted({x for s in r_find.values() for x in s})}},
        }
    if rid == IDS[0]:
        pass
    rows.append(row)


def pooled(ref):
    flat = []
    for r in rows:
        x = r[ref]
        flat.append({'mapR': x['mapping']['recallHits'], 'mapRn': x['mapping']['refMapped'],
                     'mapP': x['mapping']['precisionHits'], 'mapPn': x['mapping']['minedMapped'],
                     'rulR': len(x['rules']['both']), 'rulRn': len(x['rules']['ref']), 'rulPn': len(x['rules']['mined']),
                     'hitR': len(x['rules']['bothHit']), 'hitRn': len(x['rules']['refHit']), 'hitPn': len(x['rules']['minedHit']),
                     'fR': x['findings']['both'], 'fRn': x['findings']['ref'], 'fPn': x['findings']['mined'],
                     'sR': x['surfaced']['hits'], 'sRn': x['surfaced']['ref'],
                     'verdictSame': int(r['verdict'][ref] == r['verdict']['m']), 'one': 1})
    out = {}
    for name, num, den in [('mappingRecall', 'mapR', 'mapRn'), ('mappingPrecision', 'mapP', 'mapPn'),
                           ('ruleRecall', 'rulR', 'rulRn'), ('rulePrecision', 'rulR', 'rulPn'),
                           ('hitRuleRecall', 'hitR', 'hitRn'), ('hitRulePrecision', 'hitR', 'hitPn'),
                           ('findingRecall', 'fR', 'fRn'), ('findingPrecision', 'fR', 'fPn'),
                           ('surfacedRecall', 'sR', 'sRn'), ('verdictSame', 'verdictSame', 'one')]:
        k = sum(f[num] for f in flat)
        n = sum(f[den] for f in flat)
        out[name] = {'k': k, 'n': n, 'value': round(k / n, 3) if n else None, 'wilson': wilson(k, n), 'clusterBoot': boot_ratio(flat, num, den)}
    pairs = [(r['verdict'][ref], r['verdict']['m']) for r in rows]
    kv = kappa([p for p, _ in pairs], [q for _, q in pairs])
    out['verdictKappa'] = {'value': None if kv is None else round(kv, 3), 'boot': boot_kappa(pairs)}
    # file-level kind kappa pooled with repo-qualified labels (as K2)
    pa, pm = [], []
    for rid in IDS:
        R, M = labels[ref][rid], labels['m'][rid]
        for f in R['files']:
            if f.startswith('src/') and f in M['files'] and R['files'][f] != 'excluded':
                pa.append(f'{rid}:{kind(R, R["files"][f])}')
                pm.append(f'{rid}:{kind(M, M["files"][f])}')
    out['mappingKappaKindPooled'] = round(kappa(pa, pm), 3)
    return out


def ab_findings():
    tot = {'a': 0, 'b': 0, 'both': 0}
    per = []
    for rid in IDS:
        fa, fb = blocking_findings(ev('a', rid)), blocking_findings(ev('b', rid))
        both = len(set(fa) & set(fb))
        tot['a'] += len(fa); tot['b'] += len(fb); tot['both'] += both
        per.append({'id': rid, 'a': len(fa), 'b': len(fb), 'both': both})
    return {'total': tot, 'perRepo': per,
            'recallOfA': {'value': round(tot['both'] / tot['a'], 3), 'wilson': wilson(tot['both'], tot['a'])},
            'precisionVsA': {'value': round(tot['both'] / tot['b'], 3), 'wilson': wilson(tot['both'], tot['b'])}}


summary = {'vsA': pooled('a'), 'vsB': pooled('b'), 'blindAuthorBvsA_findings': ab_findings(),
           'styleMatch': sum(r['styleMatch'] for r in rows)}
by_style = {}
for st in sorted(set(STYLE.values())):
    sub = [r for r in rows if r['declaredStyle'] == st]
    by_style[st] = {
        'mappingRecall': [sum(r['a']['mapping']['recallHits'] for r in sub), sum(r['a']['mapping']['refMapped'] for r in sub)],
        'mappingPrecision': [sum(r['a']['mapping']['precisionHits'] for r in sub), sum(r['a']['mapping']['minedMapped'] for r in sub)],
        'ruleRecall': [sum(len(r['a']['rules']['both']) for r in sub), sum(len(r['a']['rules']['ref']) for r in sub)],
        'rulePrecision': [sum(len(r['a']['rules']['both']) for r in sub), sum(len(r['a']['rules']['mined']) for r in sub)],
        'findingRecall': [sum(r['a']['findings']['both'] for r in sub), sum(r['a']['findings']['ref'] for r in sub)],
        'findingPrecision': [sum(r['a']['findings']['both'] for r in sub), sum(r['a']['findings']['mined'] for r in sub)],
        'surfaced': [sum(r['a']['surfaced']['hits'] for r in sub), sum(r['a']['surfaced']['ref'] for r in sub)],
        'verdictSame': [sum(r['verdict']['a'] == r['verdict']['m'] for r in sub), len(sub)],
    }
summary['byDeclaredStyleVsA'] = by_style
rule_tab = {}
for r in rows:
    for k, (h, n) in r['a']['surfaced']['byRefRule'].items():
        t = rule_tab.setdefault(k, {'refFindings': 0, 'surfacedByMiner': 0, 'reportedUnderMined': 0})
        t['refFindings'] += n
        t['surfacedByMiner'] += h
        t['reportedUnderMined'] += r['a']['findings']['bothByRefRule'].get(k, 0)
summary['byDeclaredRuleVsA'] = rule_tab

# Oracle arm (miner over the declared layer map, scripts/v1.3/brownfield-mine.ts --oracle-specs): allowed layer graph
# against the declared allowed graph, forbidding-rule precision, and declared findings surfaced as exceptions.
orc_rows = []
for rid in IDS:
    o = json.loads((D / 'oracle' / f'{rid}.json').read_text())
    exc = {(e['file'], e.get('target') or '') for r in o['rules'] for e in r['exceptions']}
    a_find = blocking_findings(ev('a', rid))
    by = {}
    for key, rs in a_find.items():
        for k in rs:
            t = by.setdefault(k, [0, 0]); t[1] += 1; t[0] += int(surfaced(key, exc))
    row = {'id': rid, 'style': o['style']}
    for st in ('observed', 'strict', 'full'):
        g = o['graphs'][st]
        row[st] = {'tp': g['tp'], 'fp': g['fp'], 'fn': g['fn'], 'P': g['tp'], 'Pn': g['tp'] + g['fp'], 'R': g['tp'], 'Rn': g['tp'] + g['fn']}
    fb = o['forbidding']
    row['forbid'] = {k: [sum(1 for x in fb if x['kind'] == k and x['declaredForbids']), sum(1 for x in fb if x['kind'] == k)] for k in ('layer-direction', 'layer-rare-edge', 'layer-unobserved')}
    row['surfaced'] = {'hits': sum(surfaced(k, exc) for k in a_find), 'n': len(a_find), 'byRule': by}
    row['exceptions'] = len(exc)
    orc_rows.append(row)
orc = {}
for st in ('observed', 'strict', 'full'):
    flat = [r[st] for r in orc_rows]
    for nm, num, den in (('precision', 'P', 'Pn'), ('recall', 'R', 'Rn')):
        k = sum(f[num] for f in flat); n = sum(f[den] for f in flat)
        orc[f'{st}Edge{nm.capitalize()}'] = {'k': k, 'n': n, 'value': round(k / n, 3), 'wilson': wilson(k, n), 'clusterBoot': boot_ratio(flat, num, den)}
flat = [{'h': r['surfaced']['hits'], 'n': r['surfaced']['n']} for r in orc_rows]
k = sum(f['h'] for f in flat); n = sum(f['n'] for f in flat)
orc['surfacedRecall'] = {'k': k, 'n': n, 'value': round(k / n, 3), 'wilson': wilson(k, n), 'clusterBoot': boot_ratio(flat, 'h', 'n')}
orc['forbidPrecision'] = {kk: [sum(r['forbid'][kk][0] for r in orc_rows), sum(r['forbid'][kk][1] for r in orc_rows)] for kk in ('layer-direction', 'layer-rare-edge', 'layer-unobserved')}
orc['surfacedByRule'] = {}
for r in orc_rows:
    for kk, (h, nn) in r['surfaced']['byRule'].items():
        t = orc['surfacedByRule'].setdefault(kk, [0, 0]); t[0] += h; t[1] += nn
orc['exceptions'] = sum(r['exceptions'] for r in orc_rows)
summary['oracle'] = orc
DEP = {'FF-S01', 'FF-S02', 'FF-S03', 'FF-S04'}
dk = {'keys': 0, 'reportedUnderMined': 0, 'surfacedIse': 0, 'surfacedOracle': 0}
for rid in IDS:
    fa, fm = blocking_findings(ev('a', rid)), blocking_findings(ev('m', rid))
    mj = json.loads((D / 'mined' / f'{rid}.json').read_text())
    oj = json.loads((D / 'oracle' / f'{rid}.json').read_text())
    ee = {(e['file'], e.get('target') or '') for r in mj['rules'] for e in r['exceptions']}
    eo = {(e['file'], e.get('target') or '') for r in oj['rules'] for e in r['exceptions']}
    for k, rs in fa.items():
        if rs & DEP:
            dk['keys'] += 1; dk['reportedUnderMined'] += int(k in fm); dk['surfacedIse'] += int(surfaced(k, ee)); dk['surfacedOracle'] += int(surfaced(k, eo))
dk['surfacedOracleWilson'] = wilson(dk['surfacedOracle'], dk['keys'])
summary['dependencyKeysVsA'] = dk
(D / 'score.json').write_text(json.dumps({'summary': summary, 'rows': rows, 'oracleRows': orc_rows}, indent=1) + '\n')


def pct(x):
    return '-' if x['n'] == 0 else f"{x['value']:.3f} ({x['k']}/{x['n']}) W[{x['wilson'][0]}, {x['wilson'][1]}] B[{x['clusterBoot'][0]}, {x['clusterBoot'][1]}]"


md = ['# Brownfield mined baseline: scores (generated by scripts/v1.3/brownfield-score.py)', '',
      'W = Wilson 95% (units independent; too narrow when pooled). B = repo-cluster percentile bootstrap 95%, 10,000 resamples, seed 20261018.', '',
      '## Pooled', '', '| measure | mined vs A (declared) | mined vs B (blind second author) |', '|---|---|---|']
for k in ['mappingRecall', 'mappingPrecision', 'ruleRecall', 'rulePrecision', 'hitRuleRecall', 'hitRulePrecision', 'findingRecall', 'findingPrecision', 'surfacedRecall', 'verdictSame']:
    md.append(f"| {k} | {pct(summary['vsA'][k])} | {pct(summary['vsB'][k])} |")
md.append(f"| verdict kappa | {summary['vsA']['verdictKappa']['value']} B{summary['vsA']['verdictKappa']['boot']} | {summary['vsB']['verdictKappa']['value']} B{summary['vsB']['verdictKappa']['boot']} |")
md.append(f"| mapping kappa (kind, pooled, repo-qualified) | {summary['vsA']['mappingKappaKindPooled']} | {summary['vsB']['mappingKappaKindPooled']} |")
abf = summary['blindAuthorBvsA_findings']
md += ['', f"Reference ceiling, B vs A blocking findings (same key): {abf['total']['both']} shared of A {abf['total']['a']} / B {abf['total']['b']}; recall of A {abf['recallOfA']['value']} W{abf['recallOfA']['wilson']}, precision {abf['precisionVsA']['value']} W{abf['precisionVsA']['wilson']}.", '',
       f"ISE style = declared style on {summary['styleMatch']}/15.", '',
       '## Per repo (mined vs A)', '',
       '| repo | declared / mined style | mapping R | mapping P | kappa kind | rules R | rules P | findings A / mined / both | surfaced by miner | verdict A / B / mined |',
       '|---|---|---|---|---|---|---|---|---|---|']
for r in rows:
    a = r['a']
    m = a['mapping']
    md.append(f"| {r['id']} | {r['declaredStyle']} / {r['minedStyle']} | {m['recallHits']}/{m['refMapped']} | {m['precisionHits']}/{m['minedMapped']} | "
              f"{'n/a' if m['kappaKind'] is None else round(m['kappaKind'], 2)} | {len(a['rules']['both'])}/{len(a['rules']['ref'])} | {len(a['rules']['both'])}/{len(a['rules']['mined'])} | "
              f"{a['findings']['ref']} / {a['findings']['mined']} / {a['findings']['both']} | {a['surfaced']['hits']}/{a['surfaced']['ref']} | {r['verdict']['a']} / {r['verdict']['b']} / {r['verdict']['m']} |")
md += ['', '## By declared style (mined vs A; k/n)', '', '| style | mapping R | mapping P | rules R | rules P | findings R | findings P | surfaced | verdict same |', '|---|---|---|---|---|---|---|---|---|']
for st, v in by_style.items():
    md.append(f"| {st} | " + ' | '.join(f"{v[k][0]}/{v[k][1]}" for k in ['mappingRecall', 'mappingPrecision', 'ruleRecall', 'rulePrecision', 'findingRecall', 'findingPrecision', 'surfaced', 'verdictSame']) + ' |')
md += ['', '## By declared blocking rule (A findings)', '', '| rule | A findings | reported under the mined spec | surfaced as a miner exception |', '|---|---|---|---|']
for k, v in sorted(rule_tab.items()):
    md.append(f"| {k} | {v['refFindings']} | {v['reportedUnderMined']} | {v['surfacedByMiner']} |")
md += ['', '## Oracle arm: the miner over the declared (A) layer map', '', '| measure | value |', '|---|---|']
for k in ['observedEdgePrecision', 'observedEdgeRecall', 'strictEdgePrecision', 'strictEdgeRecall', 'fullEdgePrecision', 'fullEdgeRecall', 'surfacedRecall']:
    md.append(f"| {k} | {pct(orc[k])} |")
md.append(f"| forbidding rules the declared spec also forbids | {', '.join(f'{kk} {v[0]}/{v[1]}' for kk, v in orc['forbidPrecision'].items())} |")
md.append(f"| exceptions (distinct file, target) | {orc['exceptions']} |")
md.append(f"| A dependency keys (FF-S01-S04): reported under mined / surfaced ISE / surfaced oracle | {dk['reportedUnderMined']} / {dk['surfacedIse']} / {dk['surfacedOracle']} of {dk['keys']}, oracle W{dk['surfacedOracleWilson']} |")
md += ['', '| repo | full edges tp / fp / fn | observed tp / fp / fn | A findings surfaced (oracle) |', '|---|---|---|---|']
for r in orc_rows:
    md.append(f"| {r['id']} | {r['full']['tp']} / {r['full']['fp']} / {r['full']['fn']} | {r['observed']['tp']} / {r['observed']['fp']} / {r['observed']['fn']} | {r['surfaced']['hits']}/{r['surfaced']['n']} |")
md += ['', '| declared rule | surfaced (oracle) |', '|---|---|'] + [f"| {kk} | {v[0]}/{v[1]} |" for kk, v in sorted(orc['surfacedByRule'].items())]
(D / 'score.md').write_text('\n'.join(md) + '\n')
print('\n'.join(md))
