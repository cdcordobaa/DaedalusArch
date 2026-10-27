import { DomainError } from "../../../domain/errors";

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  OPENING_CLOSED: 410,
  DUPLICATE_APPLICATION: 409,
  INVALID_EMAIL: 400,
  INVALID_TRANSITION: 409,
  INTERVIEW_IN_PAST: 422,
};

export function mapError(e: unknown): HttpResponse {
  if (e instanceof DomainError) {
    return { status: STATUS_BY_CODE[e.code] ?? 422, body: { code: e.code, message: e.message } };
  }
  return { status: 500, body: { code: "INTERNAL" } };
}
