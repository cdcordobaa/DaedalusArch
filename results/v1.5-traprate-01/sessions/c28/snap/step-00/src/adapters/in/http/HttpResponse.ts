import { ShelterError } from '../../../domain/errors/ShelterError';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** 200 with the result, or 400 with { error } when the shelter refuses the request. */
export function respond(handler: () => unknown): HttpResponse {
  try {
    return { status: 200, body: handler() };
  } catch (e) {
    if (e instanceof ShelterError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}
