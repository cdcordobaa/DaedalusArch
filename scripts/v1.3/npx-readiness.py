#!/usr/bin/env python3
"""v1.3 npx readiness run (Docs/v1.3/npx-readiness-2026-10-16.md).

Runs an *installed* daedalus-arch tarball through `npx --no-install` with an environment of PATH and HOME only
(no NEO4J_* variable, no repository on the path) against:
  - the clean-architecture reference variant (compared with the committed Neo4j reference run), and
  - every external-set project (waves 1 and 2, PRs #133 and #181), cloned at the pinned commits of their
    selection.json, compared with the committed findings/<id>.json.
For each project: `daedalus evaluate --engine cypher-interp --symbolic-only --format json` (wall time, peak RSS
of the process tree via wait4, number of findings), then `daedalus-mcp` over stdio: initialize + tools/list.

  python3 -I scripts/v1.3/npx-readiness.py --app <dir with the tarball installed> --repo <this repository> \
      --external <dir holding results/v1.3-external*/> --clones <dir of clones named by id> --out <out.json> \
      [--timeout 600]
"""
import argparse, json, os, resource, select, subprocess, sys, time


def run_measured(argv, env, cwd, timeout, stdout_path, stderr_path):
    """Run argv; return (exit, wall ms, peak RSS KB of the tree, timed_out)."""
    with open(stdout_path, 'wb') as out, open(stderr_path, 'wb') as err:
        t0 = time.monotonic()
        p = subprocess.Popen(argv, env=env, cwd=cwd, stdout=out, stderr=err, start_new_session=True)
        timed_out = False
        while True:
            pid, status, ru = os.wait4(p.pid, os.WNOHANG)
            if pid:
                break
            if time.monotonic() - t0 > timeout:
                timed_out = True
                os.killpg(p.pid, 15)
                pid, status, ru = os.wait4(p.pid, 0)
                break
            time.sleep(0.05)
        wall = int((time.monotonic() - t0) * 1000)
        p.returncode = os.waitstatus_to_exitcode(status)
    # Linux: wait4's ru_maxrss is max(child, its waited-for descendants), in KB.
    return p.returncode, wall, ru.ru_maxrss, timed_out


def mcp_tools_list(argv, env, cwd, timeout=120):
    t0 = time.monotonic()
    p = subprocess.Popen(argv, env=env, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, start_new_session=True)
    buf = b''

    def send(msg):
        p.stdin.write((json.dumps(msg) + '\n').encode()); p.stdin.flush()

    def recv(want_id):
        nonlocal buf
        while time.monotonic() - t0 < timeout:
            while b'\n' in buf:
                line, buf = buf.split(b'\n', 1)
                try:
                    m = json.loads(line)
                except ValueError:
                    continue
                if m.get('id') == want_id:
                    return m
            r, _, _ = select.select([p.stdout], [], [], 0.5)
            if r:
                chunk = os.read(p.stdout.fileno(), 65536)
                if not chunk:
                    return None
                buf += chunk
        return None

    res = {'ok': False}
    try:
        send({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
            'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'npx-readiness', 'version': '1'}}})
        init = recv(1)
        res['initializeMs'] = int((time.monotonic() - t0) * 1000)
        if not init or 'result' not in init:
            res['error'] = 'no initialize result'
            return res
        send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        send({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})
        tl = recv(2)
        res['toolsListMs'] = int((time.monotonic() - t0) * 1000)
        if not tl or 'result' not in tl:
            res['error'] = 'no tools/list result'
            return res
        res['tools'] = sorted(t['name'] for t in tl['result']['tools'])
        res['ok'] = True
        return res
    finally:
        try:
            os.killpg(p.pid, 15)
        except ProcessLookupError:
            pass
        p.wait()
        err = p.stderr.read().decode(errors='replace')
        res['engineLine'] = next((l for l in err.splitlines() if l.startswith('daedalus: graph engine')), None)


def key_set(violations, root):
    rel = lambda s: (s or '').replace(root.rstrip('/') + '/', '')
    return sorted((v['functionId'], rel(v.get('filePath')), rel(v.get('target')), v.get('line') or 0,
                   v.get('message', '').replace(root.rstrip('/') + '/', '')) for v in violations)


def main():
    a = argparse.ArgumentParser()
    for f in ('--app', '--repo', '--external', '--clones', '--out'):
        a.add_argument(f, required=True)
    a.add_argument('--timeout', type=int, default=600)
    a.add_argument('--only')
    o = a.parse_args()
    node_dir = os.path.dirname(subprocess.check_output(['which', 'node']).decode().strip())
    home = os.path.join(os.path.dirname(o.out), 'home'); os.makedirs(home, exist_ok=True)
    env = {'PATH': f'{node_dir}:/usr/bin:/bin', 'HOME': home}
    logs = os.path.join(os.path.dirname(o.out), 'logs'); os.makedirs(logs, exist_ok=True)
    npx = ['npx', '--no-install']

    projects = []
    ref = os.path.join(o.repo, 'tests/fixtures/v1.3-reference/clean-architecture')
    projects.append({'id': 'ref:clean-architecture', 'wave': 'reference', 'root': os.path.join(ref, 'project'),
                     'spec': os.path.join(ref, 'spec.yaml'),
                     'committed': os.path.join(o.repo, 'results/v1.3-reference/after-member-facts/raw/clean-architecture/clean.json'),
                     'committedKind': 'reference'})
    for wave in ('v1.3-external', 'v1.3-external-2'):
        wd = os.path.join(o.external, 'results', wave)
        prov = json.load(open(os.path.join(wd, 'run-provenance.json')))
        for e in json.load(open(os.path.join(wd, 'selection.json')))['entries']:
            runs = [r for r in prov.get('runs', []) if r.get('id') == e['id']]
            projects.append({'id': e['id'], 'wave': wave, 'sha': e['sha'],
                             'root': os.path.join(o.clones, e['id'], e['root']),
                             'spec': os.path.join(wd, 'specs', e['id'] + '.yaml'),
                             'committed': os.path.join(wd, 'findings', e['id'] + '.json'),
                             'committedKind': 'report', 'committedRuns': runs})
    if o.only:
        projects = [p for p in projects if p['id'] in o.only.split(',')]

    results = []
    t0 = time.monotonic()
    code, ms, _, _ = run_measured(npx + ['daedalus', '--version'], env, o.app, 60, f'{logs}/version.out', f'{logs}/version.err')
    version_ms = ms
    for p in projects:
        sid = p['id'].replace(':', '_')
        r = {k: p[k] for k in ('id', 'wave') if k in p}
        if p.get('sha'): r['sha'] = p['sha']
        out, err = f'{logs}/{sid}.json', f'{logs}/{sid}.err'
        code, ms, rss, to = run_measured(npx + ['daedalus', 'evaluate', p['root'], '--spec', p['spec'], '--symbolic-only',
                                                '--engine', 'cypher-interp', '--format', 'json'],
                                         env, o.app, o.timeout, out, err)
        r.update({'exit': code, 'wallMs': ms, 'peakRssKB': rss, 'timedOut': to})
        try:
            rep = json.load(open(out))
            r['ok'] = code in (0, 1) and not to
            r['findings'] = len(rep['violations'])
            r['verdict'] = rep.get('verdict')
            mine = key_set(rep['violations'], p['root'])
        except Exception as ex:  # noqa: BLE001
            r['ok'] = False
            r['error'] = (open(err).read().strip().splitlines() or [repr(ex)])[-1][:400]
            mine = None
        try:
            c = json.load(open(p['committed']))
            if p['committedKind'] == 'reference':
                theirs = sorted((f['ruleId'], f['file'], f.get('target', '')) for f in c['findings'])
                r['committedFindings'] = len(theirs)
                if mine is not None:
                    r['identical'] = sorted(k[:3] for k in mine) == theirs
            else:
                croot = c['projectPath']
                theirs = key_set(c['violations'], croot)
                r['committedFindings'] = len(theirs)
                r['committedVerdict'] = c.get('verdict')
                if mine is not None:
                    r['identical'] = mine == theirs and r['verdict'] == r['committedVerdict']
                    if not r['identical']:
                        ms_, ts_ = set(mine), set(theirs)
                        r['diff'] = {'onlyNow': len(ms_ - ts_), 'onlyCommitted': len(ts_ - ms_),
                                     'onlyNowRules': sorted({k[0] for k in ms_ - ts_}),
                                     'onlyCommittedRules': sorted({k[0] for k in ts_ - ms_})}
        except FileNotFoundError:
            r['committedFindings'] = None
        r['mcp'] = mcp_tools_list(npx + ['daedalus-mcp', '--spec', p['spec'], '--project', p['root'],
                                         '--engine', 'cypher-interp'], env, o.app)
        results.append(r)
        print(json.dumps({k: r.get(k) for k in ('id', 'ok', 'wallMs', 'peakRssKB', 'findings', 'committedFindings',
                                                 'identical', 'error')}), flush=True)
    report = {'node': subprocess.check_output(['node', '--version']).decode().strip(),
              'coldStartVersionMs': version_ms, 'timeoutS': o.timeout, 'totalMs': int((time.monotonic() - t0) * 1000),
              'projects': results}
    json.dump(report, open(o.out, 'w'), indent=1)
    open(o.out, 'a').write('\n')


if __name__ == '__main__':
    sys.exit(main())
