#!/usr/bin/env python3
"""v1.3 drift, descriptive (lane G, part C5): zero calls, no Neo4j, no re-walk.

Reads only the committed fix-mining outputs:
  results/v1.3-fixes-mined/corpus.json
  results/v1.3-fixes-mined/repos/<id>/{walk.json, pairs.json.gz, lineages.json.gz}
Writes results/v1.3-drift-descriptive/{summary.json, per-repo.csv, series.csv, *.svg}.

Violation identity is the fix-mining one: the finding key of `scripts/v1.3/fixes-mined-run.ts`, and disappearance
causes RENAMED / FILE-DELETED / MASS-OR-BOT / RESOLVED-IN-PLACE / FIXED-BY-DEV / OTHER as classified by the walker.
FF-S02 rows at the 100-cycle cap are handled as `scripts/v1.3/fixes-mined-report.ts` does.

Size proxy (no per-snapshot file list or LOC is committed): the distinct file paths named by any lineage (finding of
any tier, or unflagged import edge) alive at a grid point. Checked against walk.json `atLastSample.files`.

Run: python3 -I scripts/v1.3/drift-descriptive.py
"""
import csv
import gzip
import json
import math
import os
import re
import statistics
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'results', 'v1.3-fixes-mined')
OUT = os.path.join(ROOT, 'results', 'v1.3-drift-descriptive')
S02_CAP = 100
BLOCKING = {'FF-S01', 'FF-S02', 'FF-S04', 'FF-P01', 'FF-P03', 'FF-P06', 'FF-DS01', 'FF-DS02',
            'FF-DT01', 'FF-DT02', 'FF-DT03', 'FF-DT04'}  # src/scoring-engine/rule-tiers.ts; FF-S03 only for layered
PATH_RE = re.compile(r'\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$')
CAUSES = ['RENAMED', 'FILE-DELETED', 'MASS-OR-BOT', 'RESOLVED-IN-PLACE', 'FIXED-BY-DEV', 'OTHER']


def is_blocking(rule, style):
    return rule in BLOCKING or (rule == 'FF-S03' and style.lower() == 'layered')


def paths_of(lin):
    if lin['kind'] == 'edge':
        return lin['key'].split('|')
    out = []
    for part in lin['key'].split('#'):
        for tok in part.split('>'):
            if PATH_RE.search(tok):
                out.append(tok)
    return out


def ts(d):
    return datetime.fromisoformat(d).timestamp() / 86400.0


def km(obs):
    """Kaplan-Meier from (t days, event bool). Returns (median or None, S(365), curve [(t, S)])."""
    obs = sorted(obs)
    n = len(obs)
    s = 1.0
    curve = [(0.0, 1.0)]
    med = None
    s365 = None
    i = 0
    while i < len(obs):
        t = obs[i][0]
        d = 0
        c = 0
        while i < len(obs) and obs[i][0] == t:
            d += 1 if obs[i][1] else 0
            c += 1
            i += 1
        if d > 0:
            if s365 is None and t > 365:
                s365 = s
            s *= 1 - d / n
            curve.append((t, s))
            if med is None and s <= 0.5:
                med = t
        n -= c
    if s365 is None:
        s365 = s if (obs and obs[-1][0] >= 365) else None
    return med, s365, curve


def load(rid):
    d = os.path.join(SRC, 'repos', rid)
    walk = json.load(open(os.path.join(d, 'walk.json')))
    pairs = json.load(gzip.open(os.path.join(d, 'pairs.json.gz')))
    lin = json.load(gzip.open(os.path.join(d, 'lineages.json.gz')))
    return walk, pairs, lin


def analyse(entry):
    rid, style = entry['id'], entry['style']
    walk, pairs, L = load(rid)
    grid, lins = L['grid'], L['lineages']
    assert len(grid) == len(pairs) and all(g['sha'] == p['sha'] for g, p in zip(grid, pairs)), rid
    n = len(grid)
    ok = [p['childOk'] for p in pairs]
    capped = [(p['childByRule'].get('FF-S02', 0) >= S02_CAP) for p in pairs]
    blk = lambda r: is_blocking(r, style)

    # --- series at grid points (child snapshots) ---
    series = []
    for i, p in enumerate(pairs):
        if not ok[i]:
            continue
        c = p['childByRule']
        b = sum(v for r, v in c.items() if blk(r))
        s02 = c.get('FF-S02', 0)
        series.append({'i': i, 'date': grid[i]['date'], 'blocking': b, 'blockingNoS02': b - s02, 's02': s02,
                       's02Capped': capped[i]})

    # alive sets from lineages (size proxy + cross-check of the blocking count)
    alive_files = [set() for _ in range(n)]
    alive_layered = [set() for _ in range(n)]
    unflagged = [0] * n
    blk_alive = [0] * n
    tier_mismatch = 0
    for l in lins:
        end = l['ended'] if l['ended'] is not None else n
        ps = paths_of(l)
        if l['kind'] == 'finding' and l.get('tier') is not None and (l['tier'] == 'blocking') != blk(l['functionId']):
            tier_mismatch += 1
        for i in range(l['born'], end):
            if not ok[i]:
                continue
            alive_files[i].update(ps)
            if l['kind'] == 'edge':
                unflagged[i] += 1
                if l.get('edgeKind') in ('layered', 'crossLayer'):
                    alive_layered[i].update(ps)
            elif blk(l['functionId']):
                blk_alive[i] += 1
    count_mismatch = 0
    for s in series:
        i = s['i']
        s['files'] = len(alive_files[i])
        s['layeredFiles'] = len(alive_layered[i])
        s['unflaggedEdges'] = unflagged[i]
        if blk_alive[i] != s['blocking']:
            count_mismatch += 1

    # --- pair level (one sampled commit P->C) ---
    pl = {'validPairs': 0, 'introduced': 0, 'introBotMass': 0, 'introRenameMatched': 0, 'introOther': 0,
          'removed': 0, 'removedBy': {c: 0 for c in CAUSES}, 'credited': 0, 'netFromPairs': 0,
          'pairsWithIntro': 0, 'pairsWithRemoval': 0, 'netCheckFail': 0}
    for p in pairs:
        if not (p['parentOk'] and p['childOk']):
            continue
        pl['validPairs'] += 1
        trunc = p['exposedByRule'].get('FF-S02', 0) >= S02_CAP or p['childByRule'].get('FF-S02', 0) >= S02_CAP
        keep = lambda r: blk(r) and not (r == 'FF-S02' and trunc)
        intro = [f for f in p['introduced'] if keep(f['functionId'])]
        gone = [f for f in p['disappeared'] if keep(f['functionId'])]
        botmass = p['bot'] or p['mass']
        ren_by_rule = {}
        for f in gone:
            if f.get('cause') == 'RENAMED':
                ren_by_rule[f['functionId']] = ren_by_rule.get(f['functionId'], 0) + 1
        for f in intro:
            pl['introduced'] += 1
            if botmass:
                pl['introBotMass'] += 1
            elif ren_by_rule.get(f['functionId'], 0) > 0:
                ren_by_rule[f['functionId']] -= 1
                pl['introRenameMatched'] += 1
            else:
                pl['introOther'] += 1
        for f in gone:
            c = f.get('cause') or 'OTHER'
            pl['removed'] += 1
            pl['removedBy'][c] = pl['removedBy'].get(c, 0) + 1
            if (f['edgeShaped'] and c == 'FIXED-BY-DEV') or (not f['edgeShaped'] and c == 'RESOLVED-IN-PLACE'):
                pl['credited'] += 1
        pl['pairsWithIntro'] += 1 if intro else 0
        pl['pairsWithRemoval'] += 1 if gone else 0
        net = len(intro) - len(gone)
        pl['netFromPairs'] += net
        before = sum(v for r, v in p['exposedByRule'].items() if keep(r))
        after = sum(v for r, v in p['childByRule'].items() if keep(r))
        if after - before != net:
            pl['netCheckFail'] += 1

    # --- grid windows (consecutive valid grid points; includes unsampled commits) ---
    gcap = lambda i: capped[i] or (i > 0 and capped[i - 1])
    gw = {'births': 0, 'endings': 0, 'endingsInPlace': 0, 'birthsNoS02': 0, 'endingsNoS02': 0,
          'edgeBirths': 0, 'edgeEndings': 0, 'xlBirths': 0, 'xlEndings': 0}
    surv = {'blockingAll': [], 'blockingEdge': [], 'blockingEdgeNoS02': [], 'blockingS02': [], 'blockingFile': [],
            'unflaggedCrossLayer': []}
    last = grid[-1]['date']
    for l in lins:
        if l['born'] == 0:
            born_counts = False
        else:
            born_counts = True
        if l['kind'] == 'finding':
            if not blk(l['functionId']):
                continue
            s02 = l['functionId'] == 'FF-S02'
            if s02 and (gcap(l['born']) or (l['ended'] is not None and gcap(l['ended']))):
                continue
            if born_counts:
                gw['births'] += 1
                gw['birthsNoS02'] += 0 if s02 else 1
            if l['ended'] is not None:
                gw['endings'] += 1
                gw['endingsNoS02'] += 0 if s02 else 1
                gw['endingsInPlace'] += 1 if l.get('filesStay') else 0
            if born_counts:
                t = ts(grid[l['ended']]['date'] if l['ended'] is not None else last) - ts(grid[l['born']]['date'])
                o = (max(0.0, t), l['ended'] is not None)
                surv['blockingAll'].append(o)
                if l['edgeShaped']:
                    surv['blockingEdge'].append(o)
                    surv['blockingS02' if s02 else 'blockingEdgeNoS02'].append(o)
                else:
                    surv['blockingFile'].append(o)
        else:
            xl = l.get('edgeKind') == 'crossLayer'
            if born_counts:
                gw['edgeBirths'] += 1
                gw['xlBirths'] += 1 if xl else 0
            if l['ended'] is not None:
                gw['edgeEndings'] += 1
                gw['xlEndings'] += 1 if xl else 0
            if born_counts and xl:
                t = ts(grid[l['ended']]['date'] if l['ended'] is not None else last) - ts(grid[l['born']]['date'])
                surv['unflaggedCrossLayer'].append((max(0.0, t), l['ended'] is not None))

    # --- growth decomposition, first -> last valid snapshot with files > 0 ---
    pts = [s for s in series if s['files'] > 0]
    growth = None
    if len(pts) >= 2:
        a, b = pts[0], pts[-1]

        def shift_share(ba, bb, fa, fb):
            if fa <= 0 or fb <= 0:
                return None
            da, db = ba / fa, bb / fb
            g = (da + db) / 2 * (fb - fa)
            dens = (fa + fb) / 2 * (db - da)
            return {'dB': bb - ba, 'growth': g, 'density': dens, 'densFirst': da, 'densLast': db}
        growth = {
            'first': {k: a[k] for k in ('date', 'blocking', 'blockingNoS02', 'files', 'layeredFiles', 'unflaggedEdges')},
            'last': {k: b[k] for k in ('date', 'blocking', 'blockingNoS02', 'files', 'layeredFiles', 'unflaggedEdges')},
            'years': (ts(b['date']) - ts(a['date'])) / 365.25,
            'noS02_perFile': shift_share(a['blockingNoS02'], b['blockingNoS02'], a['files'], b['files']),
            'noS02_perLayeredFile': shift_share(a['blockingNoS02'], b['blockingNoS02'], a['layeredFiles'], b['layeredFiles']),
            'all_perFile': (shift_share(a['blocking'], b['blocking'], a['files'], b['files'])
                            if not (a['s02Capped'] or b['s02Capped']) else None),
        }
        # sensitivity: start where the pin-time spec already maps at least half the files to a layer
        lay = [s for s in pts if s['layeredFiles'] >= 0.5 * s['files']]
        if len(lay) >= 2 and lay[0]['i'] < b['i']:
            a2 = lay[0]
            growth['layeredStart'] = {'date': a2['date'], 'files': a2['files'], 'blockingNoS02': a2['blockingNoS02']}
            growth['noS02_perFile_layeredStart'] = shift_share(a2['blockingNoS02'], b['blockingNoS02'], a2['files'], b['files'])
        else:
            growth['noS02_perFile_layeredStart'] = None
    # validation of the file proxy at the last grid point
    lastok = series[-1] if series else None
    proxy_check = None
    if lastok is not None and lastok['i'] == n - 1 and walk.get('atLastSample'):
        proxy_check = {'proxyFiles': lastok['files'], 'walkFiles': walk['atLastSample']['files'],
                       'walkImports': walk['atLastSample']['imports'], 'unflaggedEdges': lastok['unflaggedEdges']}
    return {'id': rid, 'style': style, 'commitsOnPath': walk['firstParentCommitsTouchingRoot'],
            'sampled': walk['sampled'], 'validSnapshots': len(series), 's02CappedSnapshots': sum(capped),
            'series': series, 'pairs': pl, 'windows': gw, 'surv': surv, 'growth': growth,
            'proxyCheck': proxy_check, 'tierMismatch': tier_mismatch, 'countMismatch': count_mismatch}


# ---------------- SVG helpers (static; <title> gives a native hover tooltip) ----------------
INK, INK2, MUTED, SURF, GRID = '#0b0b0b', '#52514e', '#898781', '#fcfcfb', '#e4e3df'
C1, C2, C3, C4 = '#2a78d6', '#eb6834', '#1baf7a', '#eda100'


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def svg_doc(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'font-family="system-ui, -apple-system, Segoe UI, sans-serif" role="img" aria-label="{esc(title)}">'
            f'<title>{esc(title)}</title><rect width="{w}" height="{h}" fill="{SURF}"/>{body}</svg>\n')


def nice_max(v):
    if v <= 0:
        return 1
    e = 10 ** math.floor(math.log10(v))
    for m in (1, 2, 2.5, 5, 10):
        if v <= m * e:
            return m * e
    return 10 * e


def plot_small_multiples(repos, path):
    rs = [r for r in repos if len(r['series']) >= 2]
    cols, pw, ph, pad = 6, 190, 120, 14
    rows = math.ceil(len(rs) / cols)
    W, H = cols * (pw + pad) + pad, rows * (ph + 34) + 70
    body = [f'<text x="{pad}" y="24" font-size="15" fill="{INK}" font-weight="600">Blocking findings at each sampled commit, per repository</text>',
            f'<text x="{pad}" y="44" font-size="11" fill="{INK2}">Blue: blocking without FF-S02. Orange: FF-S02 cycles (dashed segments = at the 100-cycle cap, a floor). Each panel has its own y-scale; x = commit date.</text>']
    for k, r in enumerate(rs):
        cx = pad + (k % cols) * (pw + pad)
        cy = 60 + (k // cols) * (ph + 34)
        s = r['series']
        t0, t1 = ts(s[0]['date']), ts(s[-1]['date'])
        ymax = nice_max(max(max(x['blockingNoS02'], x['s02']) for x in s))
        X = lambda t: cx + 30 + (t - t0) / max(1e-9, t1 - t0) * (pw - 36)
        Y = lambda v: cy + 16 + (1 - v / ymax) * (ph - 30)
        body.append(f'<text x="{cx}" y="{cy + 10}" font-size="11" fill="{INK}" font-weight="600">{esc(r["id"])}</text>')
        body.append(f'<line x1="{cx + 30}" x2="{cx + pw - 6}" y1="{Y(0):.1f}" y2="{Y(0):.1f}" stroke="{MUTED}" stroke-width="1"/>')
        body.append(f'<line x1="{cx + 30}" x2="{cx + pw - 6}" y1="{Y(ymax):.1f}" y2="{Y(ymax):.1f}" stroke="{GRID}" stroke-width="1"/>')
        body.append(f'<text x="{cx + 26}" y="{Y(ymax) + 4:.1f}" font-size="9" fill="{MUTED}" text-anchor="end">{ymax:g}</text>')
        body.append(f'<text x="{cx + 26}" y="{Y(0) + 3:.1f}" font-size="9" fill="{MUTED}" text-anchor="end">0</text>')
        body.append(f'<text x="{cx + 30}" y="{cy + ph + 2}" font-size="9" fill="{MUTED}">{s[0]["date"][:4]}</text>')
        body.append(f'<text x="{cx + pw - 6}" y="{cy + ph + 2}" font-size="9" fill="{MUTED}" text-anchor="end">{s[-1]["date"][:4]}</text>')
        pts = ' '.join(f'{X(ts(x["date"])):.1f},{Y(x["blockingNoS02"]):.1f}' for x in s)
        body.append(f'<polyline points="{pts}" fill="none" stroke="{C1}" stroke-width="2" stroke-linejoin="round">'
                    f'<title>{esc(r["id"])}: blocking without FF-S02, {s[0]["blockingNoS02"]} to {s[-1]["blockingNoS02"]}</title></polyline>')
        for a, b in zip(s, s[1:]):
            dash = ' stroke-dasharray="3 2"' if (a['s02Capped'] or b['s02Capped']) else ''
            body.append(f'<line x1="{X(ts(a["date"])):.1f}" y1="{Y(a["s02"]):.1f}" x2="{X(ts(b["date"])):.1f}" y2="{Y(b["s02"]):.1f}" stroke="{C2}" stroke-width="1.5"{dash}/>')
    return open(path, 'w').write(svg_doc(W, H, ''.join(body), 'Blocking findings over time per repository'))


def plot_flows(pooled_pl, pooled_gw, path):
    rows = [('introduced: new', pooled_pl['introOther'], C2),
            ('introduced: rename-matched', pooled_pl['introRenameMatched'], C2),
            ('introduced: in bot/mass commit', pooled_pl['introBotMass'], C2)]
    rows += [(f'removed: {c}', pooled_pl['removedBy'].get(c, 0), C1) for c in CAUSES]
    W, H, lx, bw = 720, 70 + 26 * len(rows) + 30, 230, 400
    vmax = nice_max(max(v for _, v, _ in rows))
    body = [f'<text x="16" y="24" font-size="15" fill="{INK}" font-weight="600">Blocking findings introduced and removed at the sampled commits (pooled, 36 histories)</text>',
            f'<text x="16" y="44" font-size="11" fill="{INK2}">One sampled commit P→C each; removals by the fix-mining cause taxonomy. FF-S02 rows at the cap excluded.</text>']
    for k, (lab, v, col) in enumerate(rows):
        y = 62 + k * 26
        w = v / vmax * bw
        body.append(f'<text x="{lx - 8}" y="{y + 13}" font-size="11" fill="{INK}" text-anchor="end">{esc(lab)}</text>')
        body.append(f'<rect x="{lx}" y="{y + 2}" width="{max(w, 1):.1f}" height="16" rx="3" fill="{col}"><title>{esc(lab)}: {v}</title></rect>')
        body.append(f'<text x="{lx + max(w, 1) + 6:.1f}" y="{y + 14}" font-size="11" fill="{INK2}">{v}</text>')
    body.append(f'<text x="16" y="{H - 12}" font-size="10" fill="{MUTED}">Source: results/v1.3-fixes-mined/repos/*/pairs.json.gz. Orange = introduced, blue = removed.</text>')
    return open(path, 'w').write(svg_doc(W, H, ''.join(body), 'Blocking findings introduced and removed'))


def plot_km(curves, path):
    W, H, x0, y0, pw, ph = 720, 400, 60, 60, 600, 280
    tmax = 2000.0
    X = lambda t: x0 + min(t, tmax) / tmax * pw
    Y = lambda s: y0 + (1 - s) * ph
    body = [f'<text x="16" y="24" font-size="15" fill="{INK}" font-weight="600">Kaplan-Meier survival of lineages born after the first sampled commit (pooled)</text>',
            f'<text x="16" y="44" font-size="11" fill="{INK2}">Time in committer-date days from the grid point a lineage appears to the first grid point it is absent.</text>']
    for v in (0, 0.25, 0.5, 0.75, 1):
        body.append(f'<line x1="{x0}" x2="{x0 + pw}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{GRID if v else MUTED}"/>'
                    f'<text x="{x0 - 6}" y="{Y(v) + 4:.1f}" font-size="10" fill="{MUTED}" text-anchor="end">{v:g}</text>')
    for t in range(0, 2001, 500):
        body.append(f'<text x="{X(t):.1f}" y="{y0 + ph + 16}" font-size="10" fill="{MUTED}" text-anchor="middle">{t}</text>')
    body.append(f'<text x="{x0 + pw / 2}" y="{y0 + ph + 34}" font-size="11" fill="{INK2}" text-anchor="middle">days</text>')
    for k, (lab, col, cur) in enumerate(curves):
        d = f'M{X(0):.1f},{Y(1):.1f}'
        prev = 1.0
        for t, s in cur[1:]:
            if t > tmax:
                break
            d += f' H{X(t):.1f} V{Y(s):.1f}'
            prev = s
        d += f' H{X(tmax):.1f}'
        body.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2"><title>{esc(lab)}</title></path>')
        body.append(f'<rect x="{x0 + 330}" y="{y0 + 14 + k * 18}" width="14" height="4" fill="{col}"/>'
                    f'<text x="{x0 + 350}" y="{y0 + 20 + k * 18}" font-size="11" fill="{INK}">{esc(lab)}</text>')
    return open(path, 'w').write(svg_doc(W, H, ''.join(body), 'Survival of blocking findings'))


def plot_growth(repos, path):
    rs = [r for r in repos if r['growth'] and r['growth']['noS02_perFile'] and r['growth']['noS02_perFile']['dB'] != 0]
    rs.sort(key=lambda r: r['growth']['noS02_perFile']['dB'])
    W, H, lx, cw = 900, 80 + 22 * len(rs) + 30, 230, 620
    vmax = nice_max(max(max(abs(r['growth']['noS02_perFile']['growth']), abs(r['growth']['noS02_perFile']['density'])) for r in rs))
    zx = lx + cw / 2
    S = lambda v: v / vmax * (cw / 2)
    body = [f'<text x="16" y="24" font-size="15" fill="{INK}" font-weight="600">Change in blocking findings (without FF-S02), first to last sampled snapshot</text>',
            f'<text x="16" y="44" font-size="11" fill="{INK2}">Blue = growth term (mean density × Δ files), orange = density term (mean files × Δ findings per file); they sum to the change.</text>',
            f'<line x1="{zx}" x2="{zx}" y1="56" y2="{H - 34}" stroke="{MUTED}"/>',
            f'<text x="{lx}" y="{H - 18}" font-size="10" fill="{MUTED}">−{vmax:g}</text><text x="{lx + cw}" y="{H - 18}" font-size="10" fill="{MUTED}" text-anchor="end">+{vmax:g}</text>']
    for k, r in enumerate(rs):
        g = r['growth']['noS02_perFile']
        y = 60 + k * 22
        body.append(f'<text x="{lx - 8}" y="{y + 12}" font-size="10.5" fill="{INK}" text-anchor="end">{esc(r["id"])} (Δ{g["dB"]:+d})</text>')
        for off, v, col, lab in ((0, g['growth'], C1, 'growth'), (9, g['density'], C2, 'density')):
            x = zx + min(0, S(v))
            body.append(f'<rect x="{x:.1f}" y="{y + off}" width="{max(abs(S(v)), 0.8):.1f}" height="8" rx="2" fill="{col}">'
                        f'<title>{esc(r["id"])} {lab} term: {v:+.1f}</title></rect>')
    return open(path, 'w').write(svg_doc(W, H, ''.join(body), 'Growth versus density decomposition'))


def main():
    os.makedirs(OUT, exist_ok=True)
    corpus = json.load(open(os.path.join(SRC, 'corpus.json')))['entries']
    repos = [analyse(e) for e in corpus if os.path.exists(os.path.join(SRC, 'repos', e['id'], 'walk.json'))]

    pooled_pl = {'validPairs': 0, 'introduced': 0, 'introBotMass': 0, 'introRenameMatched': 0, 'introOther': 0,
                 'removed': 0, 'removedBy': {c: 0 for c in CAUSES}, 'credited': 0, 'netFromPairs': 0,
                 'pairsWithIntro': 0, 'pairsWithRemoval': 0, 'netCheckFail': 0}
    pooled_gw = {k: 0 for k in repos[0]['windows']}
    pooled_surv = {k: [] for k in repos[0]['surv']}
    for r in repos:
        for k, v in r['pairs'].items():
            if k == 'removedBy':
                for c, n in v.items():
                    pooled_pl['removedBy'][c] = pooled_pl['removedBy'].get(c, 0) + n
            else:
                pooled_pl[k] += v
        for k, v in r['windows'].items():
            pooled_gw[k] += v
        for k, v in r['surv'].items():
            pooled_surv[k] += v
    surv_summary = {}
    curves = {}
    for k, obs in pooled_surv.items():
        med, s365, cur = km(obs)
        surv_summary[k] = {'lineages': len(obs), 'ended': sum(1 for _, e in obs if e), 'kmMedianDays': med,
                           'S365': None if s365 is None else round(s365, 3)}
        curves[k] = cur

    # growth pooled
    def pool_growth(key):
        gs = [r['growth'][key] for r in repos if r['growth'] and r['growth'].get(key)]
        return {'repos': len(gs), 'dB': sum(g['dB'] for g in gs), 'growth': round(sum(g['growth'] for g in gs), 1),
                'density': round(sum(g['density'] for g in gs), 1),
                'reposDensityUp': sum(1 for g in gs if g['densLast'] > g['densFirst']),
                'reposDensityDown': sum(1 for g in gs if g['densLast'] < g['densFirst']),
                'reposFirstZero': sum(1 for g in gs if g['densFirst'] == 0),
                'medianDensFirst': round(statistics.median(g['densFirst'] for g in gs), 4),
                'medianDensLast': round(statistics.median(g['densLast'] for g in gs), 4)}
    pooled_growth = {k: pool_growth(k) for k in ('noS02_perFile', 'noS02_perLayeredFile', 'all_perFile', 'noS02_perFile_layeredStart')}

    checks = [r['proxyCheck'] for r in repos if r['proxyCheck']]
    ratios = [c['proxyFiles'] / c['walkFiles'] for c in checks if c['walkFiles']]
    first = [r['series'][0] for r in repos if r['series']]
    last = [r['series'][-1] for r in repos if r['series']]
    summary = {
        'source': 'results/v1.3-fixes-mined/repos/*/{walk.json,pairs.json.gz,lineages.json.gz}',
        'repos': len(repos),
        'validSnapshots': sum(r['validSnapshots'] for r in repos),
        'blockingAtFirstValid': sum(x['blocking'] for x in first), 'blockingAtLastValid': sum(x['blocking'] for x in last),
        'blockingNoS02AtFirstValid': sum(x['blockingNoS02'] for x in first),
        'blockingNoS02AtLastValid': sum(x['blockingNoS02'] for x in last),
        'reposBlockingNoS02Up': sum(1 for r in repos if len(r['series']) >= 2 and r['series'][-1]['blockingNoS02'] > r['series'][0]['blockingNoS02']),
        'reposBlockingNoS02Down': sum(1 for r in repos if len(r['series']) >= 2 and r['series'][-1]['blockingNoS02'] < r['series'][0]['blockingNoS02']),
        'reposBlockingNoS02Flat': sum(1 for r in repos if len(r['series']) >= 2 and r['series'][-1]['blockingNoS02'] == r['series'][0]['blockingNoS02']),
        'reposZeroAtFirst': sum(1 for x in first if x['blockingNoS02'] == 0),
        'reposNoLayeredAtFirst': sum(1 for x in first if x['layeredFiles'] == 0),
        'filesProxyFirst': sum(x['files'] for x in first), 'filesProxyLast': sum(x['files'] for x in last),
        'gridYears': round(sum(r['growth']['years'] for r in repos if r['growth']), 1),
        's02CappedSnapshots': sum(r['s02CappedSnapshots'] for r in repos),
        'pairs': pooled_pl, 'windows': pooled_gw, 'survival': surv_summary, 'growth': pooled_growth,
        'fileProxyCheck': {'repos': len(checks), 'medianRatio': round(statistics.median(ratios), 3),
                           'minRatio': round(min(ratios), 3), 'maxRatio': round(max(ratios), 3)},
        'consistency': {'tierMismatchLineages': sum(r['tierMismatch'] for r in repos),
                        'gridCountMismatchSnapshots': sum(r['countMismatch'] for r in repos),
                        'pairNetCheckFailures': pooled_pl['netCheckFail']},
        'perRepo': [{k: r[k] for k in ('id', 'style', 'commitsOnPath', 'sampled', 'validSnapshots', 's02CappedSnapshots',
                                       'pairs', 'windows', 'growth', 'proxyCheck')} |
                    {'first': r['series'][0] if r['series'] else None, 'last': r['series'][-1] if r['series'] else None,
                     'max': max((x['blockingNoS02'] for x in r['series']), default=None),
                     'survivalBlockingAll': dict(zip(('kmMedianDays', 'S365'), km(r['surv']['blockingAll'])[:2])) |
                     {'lineages': len(r['surv']['blockingAll']), 'ended': sum(1 for _, e in r['surv']['blockingAll'] if e)}}
                    for r in repos],
    }
    json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1, default=str)

    with open(os.path.join(OUT, 'series.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'grid', 'date', 'blocking', 'blockingNoS02', 's02', 's02Capped', 'filesProxy', 'layeredFilesProxy', 'unflaggedEdges'])
        for r in repos:
            for s in r['series']:
                w.writerow([r['id'], s['i'], s['date'], s['blocking'], s['blockingNoS02'], s['s02'], int(s['s02Capped']),
                            s['files'], s['layeredFiles'], s['unflaggedEdges']])
    with open(os.path.join(OUT, 'per-repo.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'style', 'commitsOnPath', 'validSnapshots', 'firstDate', 'lastDate', 'years',
                    'blkNoS02First', 'blkNoS02Last', 'blkNoS02Max', 'filesFirst', 'filesLast', 'densFirst', 'densLast',
                    'growthTerm', 'densityTerm', 'pairIntro', 'pairIntroNew', 'pairRemoved', 'pairRenamed', 'pairFileDeleted',
                    'pairMassOrBot', 'pairResolvedInPlace', 'pairFixedByDev', 'pairOther', 'gridBirths', 'gridEndings',
                    'gridEndingsInPlace', 'kmLineages', 'kmEnded', 'kmMedianDays', 'S365'])
        for r in repos:
            g = r['growth']
            gp = g['noS02_perFile'] if g else None
            pl = r['pairs']
            med, s365, _ = km(r['surv']['blockingAll'])
            sr = r['series']
            w.writerow([r['id'], r['style'], r['commitsOnPath'], r['validSnapshots'],
                        g['first']['date'][:10] if g else '', g['last']['date'][:10] if g else '',
                        round(g['years'], 2) if g else '',
                        sr[0]['blockingNoS02'] if sr else '', sr[-1]['blockingNoS02'] if sr else '',
                        max((x['blockingNoS02'] for x in sr), default=''),
                        g['first']['files'] if g else '', g['last']['files'] if g else '',
                        round(gp['densFirst'], 4) if gp else '', round(gp['densLast'], 4) if gp else '',
                        round(gp['growth'], 1) if gp else '', round(gp['density'], 1) if gp else '',
                        pl['introduced'], pl['introOther'], pl['removed'], pl['removedBy']['RENAMED'],
                        pl['removedBy']['FILE-DELETED'], pl['removedBy']['MASS-OR-BOT'], pl['removedBy']['RESOLVED-IN-PLACE'],
                        pl['removedBy']['FIXED-BY-DEV'], pl['removedBy'].get('OTHER', 0),
                        r['windows']['births'], r['windows']['endings'], r['windows']['endingsInPlace'],
                        len(r['surv']['blockingAll']), sum(1 for _, e in r['surv']['blockingAll'] if e),
                        '' if med is None else round(med), '' if s365 is None else round(s365, 3)])

    plot_small_multiples(repos, os.path.join(OUT, 'blocking-over-time.svg'))
    plot_flows(pooled_pl, pooled_gw, os.path.join(OUT, 'introduced-removed.svg'))
    plot_km([('blocking, edge-shaped, without FF-S02', C1, curves['blockingEdgeNoS02']),
             ('blocking FF-S02 cycles', C2, curves['blockingS02']),
             ('blocking, file-level', C4, curves['blockingFile']),
             ('unflagged cross-layer import edges', C3, curves['unflaggedCrossLayer'])],
            os.path.join(OUT, 'survival-km.svg'))
    plot_growth(repos, os.path.join(OUT, 'growth-vs-density.svg'))
    print(json.dumps({k: v for k, v in summary.items() if k != 'perRepo'}, indent=1, default=str))


if __name__ == '__main__':
    main()
