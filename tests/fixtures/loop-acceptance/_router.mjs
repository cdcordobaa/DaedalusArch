// Tiny JSON router shared by the demo reference services (test fixtures of the acceptance runner; not agent code).
import { createServer } from 'node:http';

export function serve(routes) {
  const table = routes.map(([method, pattern, fn]) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_m, k) => (keys.push(k), '([^/]+)'))}$`);
    return { method, re, keys, fn };
  });
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let raw = '';
    for await (const c of req) raw += c;
    let body = null;
    try { body = raw === '' ? null : JSON.parse(raw); } catch { body = null; }
    const send = (status, data) => {
      res.statusCode = status;
      if (data === undefined) return res.end();
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
    };
    for (const r of table) {
      const m = r.method === req.method ? r.re.exec(url.pathname) : null;
      if (m === null) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        const [status, data] = await r.fn({ params, query: url.searchParams, body: body ?? {}, headers: req.headers });
        return send(status, data);
      } catch (e) {
        return send(500, { error: String(e) });
      }
    }
    send(url.pathname === '/' ? 200 : 404, url.pathname === '/' ? { ok: true } : { error: 'not found' });
  });
  srv.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
  for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => srv.close(() => process.exit(0)));
  return srv;
}

let n = 0;
export const newId = (p) => `${p}-${(++n).toString(36)}`;
