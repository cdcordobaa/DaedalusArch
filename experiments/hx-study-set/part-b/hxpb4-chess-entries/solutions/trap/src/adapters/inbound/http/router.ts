import type { EnterTournament } from '../../../application/ports/in/EnterTournament';
import { json, refusal, type HttpResponse } from './replies';

export interface HttpRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: Record<string, unknown>;
}

/** POST /entries and GET /sections/:section/entries for the congress entry form. */
export function makeRouter(congress: EnterTournament): (req: HttpRequest) => Promise<HttpResponse> {
  return async (req) => {
    try {
      if (req.method === 'POST' && req.path === '/entries') {
        return json(201, await congress.enter(String(req.body?.federationId ?? ''), String(req.body?.section ?? '')));
      }
      const m = /^\/sections\/([a-z]+)\/entries$/.exec(req.path);
      if (req.method === 'GET' && m !== null) return json(200, await congress.roster(m[1]!));
      return json(404, { error: 'no such page' });
    } catch (e) {
      return refusal(e);
    }
  };
}
