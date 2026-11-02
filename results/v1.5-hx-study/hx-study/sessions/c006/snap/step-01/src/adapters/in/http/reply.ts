import { LockerError } from '../../../domain/LockerError';

export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

/** 200 with the result, or 400 { error } for a refused request. */
export function reply(run: () => unknown): Reply {
  try {
    return { status: 200, body: run() };
  } catch (e) {
    if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}
