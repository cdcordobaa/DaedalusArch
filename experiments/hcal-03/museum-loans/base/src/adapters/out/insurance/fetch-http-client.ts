import { HttpClient } from './http-client';

export class FetchHttpClient implements HttpClient {
  async post(url: string, body: unknown): Promise<{ status: number; json: unknown }> {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  }
}
