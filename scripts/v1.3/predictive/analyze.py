"""v1.3-validity-predictive: the pre-specified models (Docs/v1.3/predictive-validity-prespec.md).

    <venv with requirements.txt>/bin/python scripts/v1.3/predictive/analyze.py

Reads exposure/<id>.<label>.csv and history/<id>.<label>.csv, writes analysis/results.json and analysis/tables.md.
"""
import json
import math
import pathlib
import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats
from statsmodels.discrete.discrete_model import NegativeBinomial
from statsmodels.genmod.bayes_mixed_glm import PoissonBayesMixedGLM
from statsmodels.stats.multitest import multipletests

warnings.filterwarnings('ignore')
REPO = pathlib.Path(__file__).resolve().parents[3]
OUT = REPO / 'results/v1.3-validity-predictive'
SEED = 20261016
X = ['l_loc', 'l_prior_churn', 'l_fan_in', 'l_fan_out', 'l_age']
SESOI = 1.2


def load(label: str) -> pd.DataFrame:
    sel = json.loads((OUT / 'selection.json').read_text())
    frames = []
    for e in sel['entries']:
        ex = OUT / 'exposure' / f'{e["id"]}.{label}.csv'
        hi = OUT / 'history' / f'{e["id"]}.{label}.csv'
        if not ex.exists() or not hi.exists():
            continue
        d = pd.read_csv(ex).merge(pd.read_csv(hi), on='file', how='inner', validate='1:1')
        lay = OUT / 'exposure' / f'{e["id"]}.{label}.layers.csv'
        d = d.merge(pd.read_csv(lay, keep_default_na=False), on='file', how='left', validate='1:1')
        d.insert(0, 'project', e['id'])
        frames.append(d)
    d = pd.concat(frames, ignore_index=True).fillna(0)
    d['E1'] = (d.e1n > 0).astype(int)
    d['E1t'] = (d.e1t > 0).astype(int)
    d['E2'] = (d.e2n > 0).astype(int)
    d['l_e1n'] = np.log1p(d.e1n)
    for c, s in (('l_loc', 'loc'), ('l_prior_churn', 'prior_churn'), ('l_fan_in', 'fan_in'), ('l_fan_out', 'fan_out'),
                 ('l_prior_bug', 'prior_bug_h1')):
        d[c] = np.log1p(d[s])
    d['l_age'] = np.log1p(d.age_days)
    d['any_bug'] = (d.y_bug_h1 > 0).astype(int)
    return d


def design(d: pd.DataFrame, expo: list, covs: list, fe: bool) -> pd.DataFrame:
    Xm = d[expo + covs].astype(float)
    if fe:
        Xm = pd.concat([Xm, pd.get_dummies(d.project, prefix='p', drop_first=True, dtype=float)], axis=1)
    return sm.add_constant(Xm, has_constant='add')


def nb(d, y, expo, covs=X, fe=True, offset='exposure_years', cluster=True):
    Xm = design(d, expo, covs, fe)
    off = np.log(d[offset].clip(lower=1e-4)) if offset else None
    m = NegativeBinomial(d[y].astype(float), Xm, offset=off, loglike_method='nb2')
    kw = dict(cov_type='cluster', cov_kwds={'groups': pd.factorize(d.project)[0]}) if cluster else dict(cov_type='HC1')
    res, how = None, 'nb2'
    for method in ('newton', 'bfgs', 'nm'):
        try:
            r = m.fit(method=method, maxiter=5000, disp=0, **kw)
            if np.all(np.isfinite(r.bse)) and r.mle_retvals.get('converged', True):
                res = r
                break
        except Exception:
            continue
    if res is None:  # prespec fallback: Poisson with robust SEs
        how = 'poisson-fallback'
        res = sm.GLM(d[y].astype(float), Xm, family=sm.families.Poisson(), offset=off).fit(**kw)
    out = {}
    for e in expo:
        b, se = res.params[e], res.bse[e]
        out[e] = dict(irr=math.exp(b), lo=math.exp(b - 1.96 * se), hi=math.exp(b + 1.96 * se), p=float(res.pvalues[e]), beta=b, se=se)
    alpha = float(res.params.get('alpha', float('nan')))
    return dict(est=out, n=int(len(d)), events=int(d[y].sum()), model=how, alpha=alpha)


def verdict(r):
    lo, hi = r['lo'], r['hi']
    if lo > 1:
        return 'supported'
    if hi < 1:
        return 'contrary'
    if lo > 1 / SESOI and hi < SESOI:
        return 'null: no meaningful effect'
    return 'null: inconclusive'


def per_project(d, y='y_bug_h1'):
    rows = []
    for p, g in d.groupby('project'):
        nf, nu, ne = int(g.E1.sum()), int((1 - g.E1).sum()), int((g[y] > 0).sum())
        under = nf < 10 or nu < 10 or ne < 10
        try:
            r = nb(g, y, ['E1'], fe=False, cluster=False)
            e = r['est']['E1']
            rows.append(dict(project=p, files=len(g), flagged=nf, files_with_event=ne, irr=e['irr'], lo=e['lo'], hi=e['hi'], p=e['p'],
                             beta=e['beta'], se=e['se'], model=r['model'], underpowered=under))
        except Exception as ex:
            rows.append(dict(project=p, files=len(g), flagged=nf, files_with_event=ne, error=str(ex)[:80], underpowered=True))
    return rows


def meta(rows):
    r = [x for x in rows if not x['underpowered'] and 'beta' in x and np.isfinite(x['se']) and x['se'] > 0]
    b = np.array([x['beta'] for x in r])
    v = np.array([x['se'] ** 2 for x in r])
    w = 1 / v
    bf = (w * b).sum() / w.sum()
    q = (w * (b - bf) ** 2).sum()
    k = len(b)
    tau2 = max(0.0, (q - (k - 1)) / (w.sum() - (w ** 2).sum() / w.sum()))
    ws = 1 / (v + tau2)
    br = (ws * b).sum() / ws.sum()
    se = math.sqrt(1 / ws.sum())
    i2 = max(0.0, (q - (k - 1)) / q) if q > 0 else 0.0
    return dict(k=k, irr=math.exp(br), lo=math.exp(br - 1.96 * se), hi=math.exp(br + 1.96 * se), tau2=tau2, i2=i2,
                p=float(2 * stats.norm.sf(abs(br / se))))


def matched(d, y='y_bug_h1', exact_layer=False):
    rng = np.random.default_rng(SEED)
    cols = ['l_loc', 'l_prior_churn']
    sd = d[cols].std().values
    pairs = []
    dropped = 0
    keys = ['project', 'layer'] if exact_layer else ['project']
    for _, g in d.groupby(keys):
        f = g[g.E1 == 1].sort_values(['loc', 'file'], ascending=[False, True])
        u = g[g.E1 == 0].copy()
        if len(u):
            cov = np.cov(u[cols].values.T) if len(u) > 2 else np.diag(sd ** 2)
            try:
                vi = np.linalg.inv(cov)
            except np.linalg.LinAlgError:
                vi = np.linalg.pinv(cov)
        used = set()
        for _, r in f.iterrows():
            if not len(u):
                dropped += 1
                continue
            cand = u[~u.index.isin(used)]
            ok = cand[(abs(cand.l_loc - r.l_loc) <= 0.25 * sd[0]) & (abs(cand.l_prior_churn - r.l_prior_churn) <= 0.25 * sd[1])]
            if not len(ok):
                dropped += 1
                continue
            diff = ok[cols].values - r[cols].values.astype(float)
            dist = np.einsum('ij,jk,ik->i', diff, vi, diff)
            j = ok.index[int(np.argmin(dist))]
            used.add(j)
            pairs.append((r[y], d.loc[j, y]))
    a = np.array(pairs, dtype=float)
    if not len(a):
        return dict(pairs=0, dropped=dropped)
    diff = a[:, 0] - a[:, 1]
    boots = [diff[rng.integers(0, len(diff), len(diff))].mean() for _ in range(2000)]
    w = stats.wilcoxon(diff) if np.any(diff != 0) else None
    return dict(pairs=len(a), dropped=dropped, mean_flagged=a[:, 0].mean(), mean_unflagged=a[:, 1].mean(), mean_diff=diff.mean(),
                ci=[float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))],
                wilcoxon_p=float(w.pvalue) if w else 1.0, flagged_more=int((diff > 0).sum()), flagged_less=int((diff < 0).sum()),
                equal=int((diff == 0).sum()))


def glmm(d, y='y_bug_h1'):
    dd = d[[y, 'E1', *X, 'project', 'exposure_years']].copy()
    dd['l_expo'] = np.log(dd.exposure_years.clip(lower=1e-4))
    m = PoissonBayesMixedGLM.from_formula(f'{y} ~ E1 + ' + ' + '.join(X) + ' + l_expo', {'project': '0 + C(project)'}, dd)
    i = list(m.exog_names).index('E1')
    r = m.fit_vb()
    how = 'variational Bayes'
    if not (np.all(np.isfinite(r.fe_sd)) and np.all(r.fe_sd > 0) and abs(r.fe_mean[i]) < 50):
        r = m.fit_map()  # prespec addendum 2: VB diverges on this data; posterior mode with Laplace SDs
        how = 'posterior mode (fit_map), VB diverged'
    b, s = r.fe_mean[i], r.fe_sd[i]
    return dict(irr=math.exp(b), lo=math.exp(b - 1.96 * s), hi=math.exp(b + 1.96 * s), note=f'{how}; log exposure as a covariate (no offset support)')


def logit_fe(d):
    Xm = design(d, ['E1'], X, True)
    r = sm.GLM(d.any_bug, Xm, family=sm.families.Binomial()).fit(cov_type='cluster', cov_kwds={'groups': pd.factorize(d.project)[0]})
    b, s = r.params['E1'], r.bse['E1']
    return dict(or_=math.exp(b), lo=math.exp(b - 1.96 * s), hi=math.exp(b + 1.96 * s), p=float(r.pvalues['E1']))


def main():
    res = {}
    full = load('T')
    d = full[full.mapped == 1].copy()
    res['sample'] = dict(projects=int(d.project.nunique()), files=len(d), flagged=int(d.E1.sum()), files_all=len(full),
                         bugfix_events=int(d.y_bug_h1.sum()), files_with_bugfix=int((d.y_bug_h1 > 0).sum()))
    res['descriptives'] = {g: d[d.E1 == g][['loc', 'prior_churn', 'fan_in', 'fan_out', 'age_days', 'y_bug_h1', 'y_churn', 'y_cochange']]
                           .agg(['mean', 'median']).round(2).to_dict() for g in (0, 1)}
    m1 = nb(d, 'y_bug_h1', ['E1'])
    m1['verdict'] = verdict(m1['est']['E1'])
    res['M1'] = m1
    res['M1_unadjusted'] = nb(d, 'y_bug_h1', ['E1'], covs=[])
    pp = per_project(d)
    res['M2'] = pp
    res['M2_meta'] = meta(pp)
    res['M3_churn'] = nb(d, 'y_churn', ['E1'])
    res['M3_cochange'] = nb(d, 'y_cochange', ['E1'])
    res['M4_e1n'] = nb(d, 'y_bug_h1', ['l_e1n'])
    res['M4_e2'] = nb(d, 'y_bug_h1', ['E2'])
    res['M4_e1_e2'] = nb(d, 'y_bug_h1', ['E1', 'E2'])
    blocking = sorted({r for p in d.project.unique() for r in json.loads((OUT / 'exposure' / f'{p}.T.meta.json').read_text())['blockingRules']})
    rule_cols = []
    for r in blocking:
        c = f'n_{r}'
        if c in d and (d[c] > 0).sum() >= 20:
            d[f'R_{r}'] = (d[c] > 0).astype(int)
            rule_cols.append(f'R_{r}')
    if rule_cols:
        m4r = nb(d, 'y_bug_h1', rule_cols)
        ps = [m4r['est'][c]['p'] for c in rule_cols]
        holm = multipletests(ps, method='holm')[1]
        for c, h in zip(rule_cols, holm):
            m4r['est'][c]['p_holm'] = float(h)
            m4r['est'][c]['files'] = int(d[c].sum())
        res['M4_rules'] = m4r
    res['matched'] = matched(d)
    res['matched_churn'] = matched(d, 'y_churn')
    res['matched_exact_layer'] = matched(d, exact_layer=True)
    # robustness
    rob = {}
    alt = load('T_alt')
    da = alt[alt.mapped == 1]
    rob['R1_T_alt'] = nb(da, 'y_bug_h1', ['E1']) | dict(files=len(da), flagged=int(da.E1.sum()))
    rob['R1_T_alt_matched'] = matched(da)
    rob['R2_6m'] = nb(d, 'y_bug_h1_6m', ['E1'], offset='exposure_years_6m')
    rob['R3_H2'] = nb(d[d.project.isin(d.groupby('project').y_bug_h2.sum().pipe(lambda s: s[s > 0]).index)], 'y_bug_h2', ['E1'])
    rob['R3_H3'] = nb(d, 'y_bug_h3', ['E1'])
    rob['R4_E1t'] = nb(d, 'y_bug_h1', ['E1t'])
    rob['R5_all_files'] = nb(full, 'y_bug_h1', ['E1'])
    rob['R6_prior_bug'] = nb(d, 'y_bug_h1', ['E1'], covs=X + ['l_prior_bug'])
    lopo = [nb(d[d.project != p], 'y_bug_h1', ['E1'])['est']['E1']['irr'] for p in sorted(d.project.unique())]
    rob['R7_lopo'] = dict(min=min(lopo), max=max(lopo))
    try:
        rob['R8_glmm'] = glmm(d)
    except Exception as ex:
        rob['R8_glmm'] = dict(error=str(ex)[:200])
    rob['R9_logit'] = logit_fe(d)
    rob['commits_any_kind'] = nb(d, 'y_commits', ['E1'])
    res['robustness'] = rob
    (OUT / 'analysis').mkdir(exist_ok=True)
    (OUT / 'analysis' / 'results.json').write_text(json.dumps(res, indent=1, default=float) + '\n')
    print(json.dumps(res['sample']), json.dumps(res['M1'], default=float))


if __name__ == '__main__':
    main()
