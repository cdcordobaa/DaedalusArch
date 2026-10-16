"""v1.3-validity-predictive: per-file history controls and outcomes from git (Docs/v1.3/predictive-validity-prespec.md).

    python3 scripts/v1.3/predictive/history.py --id <id> --label T|T_alt --git-dir <bare clone>

Reads selection.json, walks the default branch with `git log --no-merges -M --numstat -z` over the project's source
directory, follows renames, and writes results/v1.3-validity-predictive/history/<id>.<label>.csv (one row per file
of exposure/<id>.<label>.csv) and history/<id>.<label>.commits.csv (every window commit that touches a source file,
with the three heuristic labels; the input of the validation sample). Standard library only.
"""
import argparse
import csv
import datetime as dt
import json
import pathlib
import re
import subprocess

REPO = pathlib.Path(__file__).resolve().parents[3]
OUT = REPO / 'results/v1.3-validity-predictive'

BOT = re.compile(r'bot\]|renovate|dependabot|github-actions|\[bot\]|-bot@', re.I)
KW = r'\b(fix|fixes|fixed|fixing|bug|bugs|bugfix|hotfix|defect|regression|crash|crashes|crashed|broken|repair)\b'
H_KW = re.compile(KW)
H_CC_FIX = re.compile(r'^fix(\(.*?\))?!?:')
H_CC_OTHER = re.compile(r'^(chore|docs|test|tests|ci|build|style)(\(.*?\))?!?:')
H_EXCL = re.compile(r'\b(typo|typos|lint|linter|linting|eslint|prettier|formatting|deps|dependency|dependencies|bump)\b')
CO_CHANGE_MAX = 50


def h1(subject: str) -> bool:
    s = subject.lower()
    return bool((H_KW.search(s) or H_CC_FIX.search(s)) and not H_CC_OTHER.search(s) and not H_EXCL.search(s))


def h2(subject: str) -> bool:
    s = subject.lower()
    return bool(H_CC_FIX.search(s) and not H_EXCL.search(s))


def h3(subject: str, body: str) -> bool:
    return bool(H_KW.search((subject + '\n' + body).lower()))


def git(gd: str, *args: str) -> str:
    return subprocess.run(['git', '--git-dir', gd, *args], capture_output=True, text=True, check=True,
                          errors='replace').stdout


def ts(iso: str) -> int:
    return int(dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).timestamp())


def add_months(iso: str, months: int) -> str:
    d = dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
    m = d.month - 1 + months
    return d.replace(year=d.year + m // 12, month=m % 12 + 1).strftime('%Y-%m-%dT%H:%M:%SZ')


def commits(gd: str, rev: str, path: str):
    """Yield (sha, author, email, ctime, subject, body, [(added, deleted, old, new)]) oldest first."""
    raw = git(gd, 'log', '--reverse', '--no-merges', '-M', '--numstat', '-z',
              '--format=%x02%H%x1f%aN%x1f%aE%x1f%ct%x1f%s%x1f%b%x03', rev, '--', path)
    for chunk in raw.split('\x02')[1:]:
        head, _, stat = chunk.partition('\x03')
        sha, an, ae, ct, subj, body = head.split('\x1f', 5)
        toks = stat.lstrip('\n\x00').split('\x00')
        files = []
        i = 0
        while i < len(toks):
            t = toks[i].lstrip('\n')
            if not t:
                i += 1
                continue
            a, d, p = t.split('\t', 2)
            a = 0 if a == '-' else int(a)
            d = 0 if d == '-' else int(d)
            if p == '':  # rename: old and new follow
                files.append((a, d, toks[i + 1], toks[i + 2]))
                i += 3
            else:
                files.append((a, d, p, p))
                i += 1
        yield sha, an, ae, int(ct), subj, body, files


def deletions(gd: str, rev: str, path: str) -> dict:
    """sha -> paths deleted by that commit (renames are not deletions under -M)."""
    raw = git(gd, 'log', '--no-merges', '-M', '--diff-filter=D', '--name-only', '-z', '--format=%x02%H', rev, '--', path)
    out = {}
    for chunk in raw.split('\x02')[1:]:
        toks = [t.strip('\n') for t in chunk.split('\x00')]
        sha = toks[0].split('\n')[0]
        rest = [t for t in toks[1:] if t] + ([toks[0].split('\n', 1)[1]] if '\n' in toks[0] and toks[0].split('\n', 1)[1] else [])
        out[sha] = set(rest)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True)
    ap.add_argument('--label', required=True)
    ap.add_argument('--git-dir', required=True)
    a = ap.parse_args()
    sel = json.loads((OUT / 'selection.json').read_text())
    e = next(x for x in sel['entries'] if x['id'] == a.id)
    gd = a.git_dir
    br = e['defaultBranch']
    T = sel[a.label]
    t0 = ts(T)
    p0 = ts(add_months(T, -12))
    t6 = ts(add_months(T, 6))
    t12 = add_months(T, 12)
    sha_t = e[a.label]['sha']
    sha_end = git(gd, 'rev-list', '-1', '--first-parent', f'--before={t12}', br).strip()
    sha_end6 = git(gd, 'rev-list', '-1', '--first-parent', f'--before={add_months(T, 6)}', br).strip()
    in6 = set(git(gd, 'rev-list', f'{sha_t}..{sha_end6}').split())
    src = e['sourceDir']
    root = e['root']
    prefix = '' if root == '.' else root + '/'

    exp = list(csv.DictReader(open(OUT / 'exposure' / f'{a.id}.{a.label}.csv')))
    files_at_t = [prefix + r['file'] for r in exp]

    # ── before T: lineage, age, prior churn ─────────────────────────────────
    lin_of: dict[str, int] = {}
    birth: dict[int, int] = {}
    prior = {}
    nxt = 0
    deleted_p = deletions(gd, sha_t, src)
    deleted_w = deletions(gd, f'{sha_t}..{sha_end}', src)
    for sha, an, ae, ct, subj, body, files in commits(gd, sha_t, src):
        human = not BOT.search(an) and not BOT.search(ae)
        fix = h1(subj)
        for ad, de, old, new in files:
            if old != new and old in lin_of:
                lin = lin_of.pop(old)
            elif new in lin_of:
                lin = lin_of[new]
            else:
                lin = nxt
                nxt += 1
                birth[lin] = ct
            lin_of[new] = lin
            if human and ct >= p0:
                s = prior.setdefault(lin, [0, 0, 0])
                s[0] += ad + de
                s[1] += 1
                s[2] += 1 if fix else 0
        for p in deleted_p.get(sha, ()):
            lin_of.pop(p, None)
    # ── after T: outcomes, following renames forward ───────────────────────
    cur = {f: f for f in files_at_t}  # current path -> path at T
    alive_until: dict[str, int] = {}
    out = {f: dict(b1=0, b2=0, b3=0, b1_6=0, churn=0, churn6=0, commits=0, co=set()) for f in files_at_t}
    commit_rows = []
    t_end = ts(t12)
    for sha, an, ae, ct, subj, body, files in commits(gd, f'{sha_t}..{sha_end}', src):
        if BOT.search(an) or BOT.search(ae):
            continue
        l1, l2, l3 = h1(subj), h2(subj), h3(subj, body)
        early = sha in in6
        touched = []
        for ad, de, old, new in files:
            f0 = cur.pop(old, None) if old != new else cur.get(new)
            if f0 is None:
                continue
            if old != new:
                cur[new] = f0
            touched.append((f0, ad + de))
        src_paths = {new for _, _, _, new in files}
        commit_rows.append([a.id, sha, an, ct, subj.replace('\n', ' ')[:300], int(l1), int(l2), int(l3), len(src_paths), len(touched)])
        for f0, ch in touched:
            o = out[f0]
            o['commits'] += 1
            o['churn'] += ch
            o['b1'] += l1
            o['b2'] += l2
            o['b3'] += l3
            if early:
                o['b1_6'] += l1
                o['churn6'] += ch
            if len(src_paths) <= CO_CHANGE_MAX:
                o['co'] |= {p for p in src_paths if p not in (f0,)}
        for p in deleted_w.get(sha, ()):
            if p in cur:
                alive_until.setdefault(cur.pop(p), ct)
    # co-change: other files named by their current path; the file's own later names are excluded
    names = {}
    for p, f0 in cur.items():
        names.setdefault(f0, set()).add(p)

    rows = []
    for r, f in zip(exp, files_at_t):
        lin = lin_of.get(f)
        age = (t0 - birth[lin]) / 86400 if lin is not None else 0.0
        pc, pn, pb = prior.get(lin, [0, 0, 0]) if lin is not None else [0, 0, 0]
        o = out[f]
        end = alive_until.get(f, t_end)
        ey = max(end - t0, 86400) / (t_end - t0)  # share of the 12-month window alive
        ey6 = max(min(end, t6) - t0, 86400) / (t6 - t0) / 2  # in years of a 12-month window
        co = {p for p in o['co'] if p not in names.get(f, set()) and p != f}
        rows.append([r['file'], round(max(age, 0.0), 1), pc, pn, pb, o['b1'], o['b2'], o['b3'], o['b1_6'], o['churn'], o['churn6'],
                     len(co), o['commits'], round(min(ey, 1.0), 4), round(min(ey6, 0.5), 4), int(f in alive_until), int(lin is None)])
    (OUT / 'history').mkdir(parents=True, exist_ok=True)
    with open(OUT / 'history' / f'{a.id}.{a.label}.csv', 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['file', 'age_days', 'prior_churn', 'prior_commits', 'prior_bug_h1', 'y_bug_h1', 'y_bug_h2', 'y_bug_h3', 'y_bug_h1_6m',
                    'y_churn', 'y_churn_6m', 'y_cochange', 'y_commits', 'exposure_years', 'exposure_years_6m', 'deleted_in_window', 'no_lineage'])
        w.writerows(rows)
    with open(OUT / 'history' / f'{a.id}.{a.label}.commits.csv', 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['project', 'sha', 'author', 'ctime', 'subject', 'h1', 'h2', 'h3', 'source_files_changed', 'sample_files_touched'])
        w.writerows(commit_rows)
    meta = dict(id=a.id, label=a.label, sha_t=sha_t, sha_end=sha_end, sha_end6=sha_end6, files=len(rows),
                window_commits_human=len(commit_rows), no_lineage=sum(r[-1] for r in rows), deleted=sum(r[-2] for r in rows))
    (OUT / 'history' / f'{a.id}.{a.label}.meta.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
