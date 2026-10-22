/**
 * A scripted stand-in for the Messages API (zero model calls). The real Claude Code CLI is pointed at it with
 * `ANTHROPIC_BASE_URL`, so the edit gate's hooks run inside the real CLI while every "model" turn is canned. Each
 * `POST /v1/messages` gets the next scripted reply (a tool use, then text); every request body is kept so the test
 * can check that the hook's text reached what the model would read. Other paths get an empty 200 JSON.
 */
import * as http from 'node:http';

export type Block = { readonly type: 'text'; readonly text: string } | { readonly type: 'tool_use'; readonly name: string; readonly input: Record<string, unknown> };

export interface FakeApi {
  readonly url: string;
  readonly requests: Record<string, unknown>[];
  close(): Promise<void>;
}

function sse(res: http.ServerResponse, id: string, model: string, blocks: readonly Block[], stop: string): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const usage = { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  send('message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage } });
  blocks.forEach((b, i) => {
    if (b.type === 'text') {
      send('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      send('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: b.text } });
    } else {
      send('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: `toolu_${id}_${String(i)}`, name: b.name, input: {} } });
      send('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    send('content_block_stop', { type: 'content_block_stop', index: i });
  });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 10 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

/** `script(n, body)` gives the blocks of the n-th (0-based) messages request. */
export async function startFakeApi(script: (n: number, body: Record<string, unknown>) => readonly Block[]): Promise<FakeApi> {
  const requests: Record<string, unknown>[] = [];
  let n = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const url = req.url ?? '';
      if (req.method !== 'POST' || !/^\/v1\/messages(\?|$)/.test(url)) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      } catch {
        // keep {}
      }
      requests.push(body);
      const blocks = script(n++, body);
      const model = typeof body.model === 'string' ? body.model : 'fake';
      const stop = blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
      const id = `msg_fake_${String(n)}`;
      if (body.stream === true) {
        sse(res, id, model, blocks, stop);
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id, type: 'message', role: 'assistant', model, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 }, content: blocks.map((b, i) => (b.type === 'text' ? b : { type: 'tool_use', id: `toolu_${id}_${String(i)}`, name: b.name, input: b.input })) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  return { url: `http://127.0.0.1:${String(addr.port)}`, requests, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

/** Every string in a request body's `messages` (tool results, system reminders, text), for "did the text arrive". */
export function messageText(body: Record<string, unknown>): string {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object' && v !== null) Object.values(v).forEach(walk);
  };
  walk(body.messages);
  return out.join('\n');
}
