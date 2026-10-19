#!/usr/bin/env python3
"""MEAN-01: stratified sample of external blocking findings for the meaning labels (C3m).

Light, local, deterministic. No model, no API, no Neo4j, no git.
Only the `fetch` step uses the network: it downloads the pinned source files
from raw.githubusercontent.com (plain HTTP GET of public files) into a cache dir,
so the packet can show a code excerpt. Without the cache the packet still builds,
showing the checker's import evidence instead of an excerpt.

  python3 -I scripts/v1.3/meaning/mean01.py draw            # writes results/v1.3-meaning/mean-01-sample.{csv,json}
  python3 -I scripts/v1.3/meaning/mean01.py fetch --cache <dir>
  python3 -I scripts/v1.3/meaning/mean01.py packet --cache <dir>   # writes the rater packet + answer sheet
  python3 -I scripts/v1.3/meaning/mean01.py show --cache <dir> <findingId>...

Run from the repo root. Seed and quotas are fixed below and in ops/notes/mean-01-codebook-and-sample.md.
"""
import csv, json, os, re, sys, urllib.request
from collections import defaultdict, Counter

SEED = 20261018
WAVES = [
    ("1", "results/v1.3-external", "results/v1.3-external-correctness"),
    ("2", "results/v1.3-external-2", "results/v1.3-external-3/correctness-wave2"),
    ("3", "results/v1.3-external-3", "results/v1.3-external-3/correctness"),
]
OUT_DIR = "results/v1.3-meaning"
PACKET = "audit/view/mean-01-rater-packet.md"
ANSWERS = "audit/view/mean-01-answers.csv"
CALIB_PACKET = "audit/view/mean-01-calibration.md"

# Quotas per stratum (rule id; FF-S01 and FF-S02 split by style). Sum = 60. Fixed before the draw (codebook §6).
QUOTA = {
    # the two big rules span styles, so they are split by style (sub-strata)
    "FF-S01/ddd": 4, "FF-S01/clean-architecture": 3, "FF-S01/nestjs": 2, "FF-S01/hexagonal": 2, "FF-S01/layered": 2,
    "FF-S02/nestjs": 5, "FF-S02/layered": 2, "FF-S02/clean-architecture": 2, "FF-S02/hexagonal": 2,
    "FF-DS02": 6, "FF-S03": 6, "FF-P01": 5,
    "FF-P03": 4, "FF-DT04": 4, "FF-DT01": 4, "FF-S04": 4, "FF-DT02": 2, "FF-DS01": 1,
}
SPLIT_BY_STYLE = {"FF-S01", "FF-S02"}


def stratum_of(p):
    return f'{p["ruleId"]}/{p["style"]}' if p["ruleId"] in SPLIT_BY_STYLE else p["ruleId"]


CAP_PER_PROJECT_IN_STRATUM = 2
CAP_PER_PROJECT_TOTAL = 4

# Calibration items: chosen by hand (purposive), removed from the population before the draw.
CALIBRATION = [
    "v-53da459dc13c665d",  # C1 dlydiard-ddd-cqrs-es FF-S01: application service imports a concrete DynamoDB publisher
    "v-21d495d9c7b37d10",  # C2 ddd-forum FF-DS02: forum Member imports users' UserId
    "v-5413e5fea9c9ecb3",  # C3 pallavi-twitter-backend FF-S03: controller imports asyncHandler
    "v-759e90d4bece46b9",  # C4 q00-api-server FF-S02: TypeORM entity cycle inside model/
    "v-cd46d00fa387c228",  # C5 finance-project-ddd FF-DT04: @nestjs/common Inject in a domain service
]
CAL_RESOLVE = {}


def mulberry32(seed):
    a = seed & 0xFFFFFFFF
    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd


def shuffled(items, rnd):
    xs = list(items)
    for i in range(len(xs) - 1, 0, -1):
        j = int(rnd() * (i + 1))
        xs[i], xs[j] = xs[j], xs[i]
    return xs


def spec_layers(path):
    """Tiny reader for the `architecture.layers` block: [(name, kind, [globs])], plus contexts if any."""
    layers, cur, in_layers, in_dirs = [], None, False, False
    contexts = []
    for line in open(path):
        s = line.rstrip("\n")
        if s.startswith("fitness_functions:"):
            break
        if re.match(r"^  layers:\s*$", s):
            in_layers = True; continue
        if in_layers and re.match(r"^  [a-z_]+:", s):
            in_layers = False
        if not in_layers:
            m = re.match(r"^\s+- name:\s*(\S+)", s)
            if m and "context" in s.lower():
                contexts.append(m.group(1))
            continue
        m = re.match(r"^    - name:\s*(\S+)", s)
        if m:
            cur = [m.group(1), "", []]; layers.append(cur); in_dirs = False; continue
        m = re.match(r"^      kind:\s*(\S+)", s)
        if m and cur:
            cur[1] = m.group(1); continue
        if re.match(r"^      directories:", s):
            in_dirs = True; continue
        if re.match(r"^      [a-z_]+:", s):
            in_dirs = False; continue
        m = re.match(r"^        - (.+)$", s)
        if m and in_dirs and cur:
            cur[2].append(m.group(1).strip().strip("'\""))
    return layers


def population():
    sel, rows, checks = {}, [], {}
    for wave, d, cdir in WAVES:
        for e in json.load(open(f"{d}/selection.json"))["entries"]:
            sel[e["id"]] = dict(e, wave=wave, dir=d)
        items = json.load(open(f"{cdir}/blocking.json"))["items"]
        res = {r["key"]: r for r in json.load(open(f"{cdir}/blocking/correctness.json"))["results"]}
        for it in items:
            r = res.get(it["key"])
            checks[it["violationId"]] = r
        for r in csv.DictReader(open(f"{d}/labelling-sheet.csv")):
            if r["tier"] != "blocking":
                continue
            r["wave"] = r.get("wave") or wave
            rows.append(r)
    out = []
    for r in rows:
        c = checks.get(r["findingId"])
        assert c and c["verdict"] == "correct", r["findingId"]
        files = r["file"].split(",")
        e = sel[r["project"]]
        layers_line = next((x for x in c["checks"] if x.startswith("layers by spec globs") or x.startswith("layer by spec globs") or x.startswith("contexts by root")), "")
        out.append({
            "findingId": r["findingId"], "wave": r["wave"], "project": r["project"], "repo": e["repo"],
            "sha": e["sha"], "root": e["root"], "style": r["style"], "ruleId": r["ruleId"], "template": r["ruleName"],
            "file": r["file"], "line": r["line"], "target": r["target"], "message": r["message"],
            "isCycle": r["ruleId"] == "FF-S02", "cycleViaBarrel": r["ruleId"] == "FF-S02" and any(f.endswith("/index.ts") for f in files),
            "testOrMock": bool(re.search(r"(\.test\.|\.spec\.|/tests?/|__tests__|/mocks?/|fixture)", r["file"] + " " + r["target"])),
            "checkerReason": c["reason"], "checkerChecks": c["checks"], "layersEvidence": layers_line,
            "edgeKey": f'{r["project"]}|{files[0]}|{r["line"]}|{r["target"]}',
        })
    out.sort(key=lambda x: x["findingId"])
    return out, sel


def resolve_calibration(pop):
    ids = []
    for c in CALIBRATION:
        ids.append(CAL_RESOLVE.get(c, c))
    have = {p["findingId"] for p in pop}
    missing = [i for i in ids if i not in have]
    assert not missing, f"calibration ids not in population: {missing}"
    return ids


def draw(pop):
    cal = set(resolve_calibration(pop))
    cal_items = [p for p in pop if p["findingId"] in cal]
    cal_edges = {p["edgeKey"] for p in cal_items}
    # siblings of a calibration item (same project and same target, or a shared file) leave the frame too,
    # so the calibration discussion cannot settle a sampled item
    def sibling(p):
        fs = set(p["file"].split(","))
        return any(p["project"] == c["project"] and (p["target"] == c["target"] or fs & set(c["file"].split(",")))
                   for c in cal_items)
    frame = [p for p in pop if p["findingId"] not in cal and not sibling(p)]
    N = Counter(stratum_of(p) for p in frame)
    rnd = mulberry32(SEED)
    # small strata first so the per-project cap does not starve them; ties by rule id
    order = sorted(QUOTA, key=lambda h: (N[h], h))
    taken, per_proj, edges, log = [], Counter(), set(cal_edges), []
    for h in order:
        byp = defaultdict(list)
        for p in frame:
            if stratum_of(p) == h:
                byp[p["project"]].append(p)
        projs = shuffled(sorted(byp), rnd)
        for k in projs:
            byp[k] = shuffled(byp[k], rnd)
        got, in_h = [], Counter()
        for rnd_i in range(CAP_PER_PROJECT_IN_STRATUM):
            for k in projs:
                if len(got) >= QUOTA[h]:
                    break
                if in_h[k] > rnd_i or per_proj[k] >= CAP_PER_PROJECT_TOTAL:
                    continue
                for p in byp[k]:
                    if p["edgeKey"] in edges or p in got:
                        continue
                    got.append(p); in_h[k] += 1; per_proj[k] += 1; edges.add(p["edgeKey"])
                    break
        if len(got) < QUOTA[h]:
            log.append(f"{h}: quota {QUOTA[h]} not reachable under caps, took {len(got)}")
        for p in got:
            taken.append(dict(p, stratum=h, N_h=N[h], n_h=None))
    nh = Counter(t["stratum"] for t in taken)
    for t in taken:
        t["n_h"] = nh[t["stratum"]]
        t["weight"] = round(t["N_h"] / t["n_h"], 4)
    taken = shuffled(taken, rnd)
    for i, t in enumerate(taken, 1):
        t["itemId"] = f"M{i:02d}"
    return taken, frame, log


def raw_url(e, path):
    root = "" if e["root"] in (".", "") else e["root"].strip("/") + "/"
    return f'https://raw.githubusercontent.com/{e["repo"]}/{e["sha"]}/{root}{path}'


def blob_url(e, path, line=None):
    root = "" if e["root"] in (".", "") else e["root"].strip("/") + "/"
    u = f'https://github.com/{e["repo"]}/blob/{e["sha"]}/{root}{path}'
    return u + (f"#L{line}" if line else "")


def cache_path(cache, e, path):
    return os.path.join(cache, e["id"], path)


def files_needed(item):
    fs = item["file"].split(",")
    if item["isCycle"]:
        return sorted(set(fs))
    return [fs[0]]


def fetch(items, sel, cache):
    n = 0
    for it in items:
        e = sel[it["project"]]
        for f in files_needed(it):
            p = cache_path(cache, e, f)
            if os.path.exists(p):
                continue
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with urllib.request.urlopen(raw_url(e, f), timeout=30) as r:
                data = r.read()
            open(p, "wb").write(data); n += 1
    print(f"fetched {n} files into {cache}")


def read_lines(cache, e, f):
    p = cache_path(cache, e, f) if cache else None
    if p and os.path.exists(p):
        return open(p, encoding="utf-8", errors="replace").read().split("\n")
    return None


def excerpt(lines, center, before=5, after=5):
    lo, hi = max(1, center - before), min(len(lines), center + after)
    w = len(str(hi))
    return "\n".join(f'{">>" if i == center else "  "} {str(i).rjust(w)} | {lines[i-1]}' for i in range(lo, hi + 1))


PLAIN = {
    "dependency-direction": "Dependencies between layers must point only in the allowed direction (in this style: toward the inner / lower layers). This import points the other way.",
    "dependency-direction-graph": "Dependencies between layers must follow the allowed edges of this style (toward the core). This import is not one of the allowed edges.",
    "no-cyclic-deps": "No dependency cycles: these files import each other in a loop.",
    "no-layer-skip": "Strict layering: a layer may use only the layer directly below it. This import skips a layer.",
    "no-domain-outward-dep": "The domain must not depend on any outer layer (application, infrastructure, presentation). This domain file imports one.",
    "core-isolation": "The core (domain) must not depend on the layers around it. This domain file imports one.",
    "domain-purity": "Domain code must stay free of frameworks and infrastructure libraries. This domain file imports such a package.",
    "repository-pattern": "A repository implementation must implement a repository interface (a contract owned by an inner layer). This repository class implements none.",
    "port-adapter-pattern": "An adapter must implement a port (an interface declared in the domain or application). This adapter class implements none.",
    "context-isolation": "A bounded context may use another context only through that context's public API or an anti-corruption layer. This import reaches inside another context.",
    "aggregate-boundary": "Code outside an aggregate may reference only the aggregate root, never its inner entities. This file references an inner entity.",
    "repository-aggregate-root": "Repositories exist only for aggregate roots. This repository handles an inner entity of an aggregate.",
    "bounded-context-modules": "Every module must belong to a declared bounded context (or a declared shared area). This file belongs to none.",
}
STYLE_NAME = {"clean-architecture": "Clean Architecture", "layered": "Layered", "nestjs": "NestJS (Clean rules + module encapsulation)", "hexagonal": "Hexagonal (ports and adapters)", "ddd": "Domain-Driven Design"}


def claim_text(it):
    """The edge, in neutral words, without rule ids."""
    ev = it["layersEvidence"]
    if it["isCycle"]:
        fs = it["file"].split(",")
        return "Cycle: " + " → ".join(f"`{f}`" for f in fs)
    lay = {}
    m = re.match(r"layers by spec globs: (.+?) -> (\S+); (.+?) -> (\S+)$", ev)
    if m:
        lay = {m.group(1): m.group(2), m.group(3): m.group(4)}
    m1 = re.match(r"layer by spec globs: (.+?) -> (\S+)$", ev)
    if m1:
        lay = {m1.group(1): m1.group(2)}
    m2 = re.match(r"contexts by root: (.+?) -> (\S+); (.+?) -> (\S+)$", ev)
    src = it["file"]
    if it["template"] in ("repository-pattern", "port-adapter-pattern"):
        return f'`{src}`: {it["checkerReason"]}.'
    if it["template"] == "bounded-context-modules":
        return f'`{src}` lies in no declared bounded context and in no declared shared area.'
    if m2:
        return f'`{src}` (context **{m2.group(2)}**) imports `{m2.group(3)}` (context **{m2.group(4)}**), which is not in the public API of {m2.group(4)}.'
    t = it["target"]
    sl = f' (layer **{lay[src]}**)' if src in lay else ""
    tl = f' (layer **{lay[t]}**)' if t in lay else (" (package)" if not t.startswith("src/") and "/" not in t.split("@")[-1][:1] and not t.endswith(".ts") else "")
    if it["template"] in ("aggregate-boundary", "repository-aggregate-root"):
        return f'`{src}`{sl}: {it["checkerReason"]}.'
    return f'`{src}`{sl} imports `{t}`{tl} at line {it["line"]}.'


def item_block(it, sel, cache, hdr):
    e = sel[it["project"]]
    out = [hdr, ""]
    out.append(f'- **Style claimed by the repo:** {STYLE_NAME.get(it["style"], it["style"])}')
    out.append(f'- **Repository:** `{e["repo"]}` at `{e["sha"][:8]}` (layer map: §L, `{it["project"]}`)')
    out.append(f'- **Rule, in plain words:** {PLAIN[it["template"]]}')
    out.append(f'- **The finding:** {claim_text(it)}')
    fs = it["file"].split(",")
    if it["isCycle"]:
        steps = [c for c in it["checkerChecks"] if re.match(r"^\S+:\d+ ", c)]
        out.append("- **Excerpt** (each step of the cycle; `>>` marks the import):")
        out.append("")
        out.append("```ts")
        for c in steps:
            m = re.match(r"^(\S+):(\d+) (.+) -> (\S+)$", c)
            f, ln = m.group(1), int(m.group(2))
            L = read_lines(cache, e, f)
            out.append(f"// {f}")
            out.append(excerpt(L, ln, 1, 1) if L else f">> {ln} | import … {m.group(3)}  (resolves to {m.group(4)})")
        out.append("```")
    else:
        f = fs[0]
        L = read_lines(cache, e, f)
        ln = int(it["line"]) if it["line"] else 1
        if it["template"] in ("repository-pattern", "port-adapter-pattern"):
            m = re.search(r":(\d+)$", next((c for c in it["checkerChecks"] if c.startswith("class ")), ":1"))
            ln = int(m.group(1)) if m else ln
        out.append(f"- **Excerpt** (`{f}`; `>>` marks the flagged line):")
        out.append("")
        out.append("```ts")
        if L:
            out.append(excerpt(L, ln, 6, 6) if it["template"] != "bounded-context-modules" else excerpt(L, 1, 0, 11))
        else:
            for c in it["checkerChecks"]:
                out.append(f"// {c}")
        out.append("```")
    out.append(f'- **Open the full file:** {blob_url(e, fs[0], it["line"] if not it["isCycle"] else None)}')
    return out


ANSWER_BOX = [
    "",
    "| Field | Your answer |",
    "|---|---|",
    "| **A.** Would a competent developer of this style ask for this to be changed in code review? (`yes` / `no` / `unsure`) | |",
    "| **B.** Does it break a principle the style's literature states, not only this repo's folder convention? (`yes` / `no` / `unsure`) | |",
    "| Why not? (only if A or B is `no`; one code from §3: `T` `W` `F` `M` `C` `X`) | |",
    "| Note (optional, one line) | |",
    "",
]


def layer_maps(projects, sel):
    out = ["## L. Layer maps of the repositories (how the study mapped each repo's folders)", "",
           "The study wrote one layer map per repository from its README and folders, before running the tool. "
           "Order is as declared (Clean, Hexagonal, DDD: inner first; Layered: lowest first). "
           "If a map puts a file in a layer its real role does not fit, that is reason code `M`.", ""]
    for k in sorted(projects):
        e = sel[k]
        L = spec_layers(f'{e["dir"]}/specs/{k}.yaml')
        out.append(f'### `{k}`: {e["repo"]} ({e["style"]})')
        out.append("")
        out.append("| Layer | Kind | Folders (globs) |")
        out.append("|---|---|---|")
        for name, kind, globs in L:
            out.append(f'| {name} | {kind} | {", ".join("`"+g.replace("|", "\\|")+"`" for g in globs)} |')
        out.append("")
    return out


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "draw"
    args = sys.argv[2:]
    cache = None
    if "--cache" in args:
        i = args.index("--cache"); cache = args[i + 1]; args = args[:i] + args[i + 2:]
    pop, sel = population()
    if cmd == "show":
        want = [p for p in pop if p["findingId"] in args]
        if cache:
            fetch(want, sel, cache)
        for it in want:
            print("\n".join(item_block(it, sel, cache, f'### {it["findingId"]} {it["project"]} {it["ruleId"]}')))
            print(it["checkerReason"], it["checkerChecks"])
        return
    if cmd == "find":
        for p in pop:
            if all(a in json.dumps(p) for a in args):
                print(p["findingId"], p["project"], p["ruleId"], p["file"], p["line"], p["target"])
        return
    items, frame, log = draw(pop)
    cal_ids = resolve_calibration(pop)
    cal = [p for p in pop if p["findingId"] in cal_ids]
    cal.sort(key=lambda p: cal_ids.index(p["findingId"]))
    if cmd == "draw":
        os.makedirs(OUT_DIR, exist_ok=True)
        cols = ["itemId", "findingId", "stratum", "N_h", "n_h", "weight", "wave", "project", "repo", "sha", "root", "style",
                "ruleId", "template", "file", "line", "target", "cycleViaBarrel", "testOrMock", "message", "checkerReason"]
        items_sorted = sorted(items, key=lambda t: t["itemId"])
        with open(f"{OUT_DIR}/mean-01-sample.csv", "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(items_sorted)
        meta = {
            "id": "MEAN-01", "seed": SEED, "prng": "mulberry32 (as scripts/v1.3/lib/graph-fidelity.ts)",
            "population": {"blocking": len(pop), "calibration_and_siblings_removed": len(pop) - len(frame), "frame": len(frame), "projects_with_blocking": len({p["project"] for p in pop})},
            "N_h": dict(Counter(stratum_of(p) for p in frame)), "quota": QUOTA, "n_h": dict(Counter(t["stratum"] for t in items)),
            "caps": {"perProjectInStratum": CAP_PER_PROJECT_IN_STRATUM, "perProjectTotal": CAP_PER_PROJECT_TOTAL, "oneItemPerEdge": True},
            "calibration": cal_ids, "drawLog": log,
            "projects": dict(Counter(t["project"] for t in items)), "styles": dict(Counter(t["style"] for t in items)),
            "items": [{k: t[k] for k in cols} for t in items_sorted],
        }
        json.dump(meta, open(f"{OUT_DIR}/mean-01-sample.json", "w"), indent=1)
        print(json.dumps({k: meta[k] for k in ("population", "N_h", "n_h", "drawLog", "styles")}, indent=1))
        print("projects:", len(meta["projects"]), meta["projects"])
        return
    if cmd == "fetch":
        fetch(items + cal, sel, cache)
        return
    if cmd == "packet":
        write_packet(sorted(items, key=lambda t: t["itemId"]), cal, sel, cache)
        return


def write_packet(items, cal, sel, cache):
    head = open("scripts/v1.3/meaning/packet-head.md").read()
    out = [head.rstrip(), ""]
    out.append("## 5. The 60 items")
    out.append("")
    for it in items:
        out += item_block(it, sel, cache, f'### {it["itemId"]}')
        out += ANSWER_BOX
        out.append("---")
        out.append("")
    out += layer_maps({it["project"] for it in items} | {c["project"] for c in cal}, sel)
    out.append("## Licences")
    out.append("")
    out.append("Excerpts are short quotations from public repositories under permissive licences (MIT, ISC, BSD, Apache-2.0), "
               "at the pinned commits listed above, for research review. Attribution and licence per repository: "
               "`results/v1.3-external*/NOTICE.md` and `selection.json`.")
    open(PACKET, "w").write("\n".join(out) + "\n")
    with open(ANSWERS, "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["itemId", "rater", "A_practitioner", "B_style_fidelity", "why_not", "note"])
        for it in items:
            w.writerow([it["itemId"], "", "", "", "", ""])
    cl = ["# MEAN-01 calibration items (5): answer these first, then open the worked answers", "",
          "Read §0–§4 of the rater packet (`mean-01-rater-packet.md`) first; the layer maps (§L) are at its end. "
          "Answer each item on your own. Then the author shows you the worked answers and you discuss them together (about 20 minutes). "
          "Calibration answers are never counted, and the discussion settles how the codebook is read, never an answer to one of the 60 items.", ""]
    for i, it in enumerate(cal, 1):
        cl += item_block(it, sel, cache, f"### C{i}")
        cl += ANSWER_BOX
        cl.append("---"); cl.append("")
    open(CALIB_PACKET, "w").write("\n".join(cl) + "\n")
    print(f"wrote {PACKET}, {ANSWERS}, {CALIB_PACKET}")


if __name__ == "__main__":
    main()
