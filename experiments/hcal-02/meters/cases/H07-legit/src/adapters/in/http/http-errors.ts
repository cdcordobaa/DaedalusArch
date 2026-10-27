import { DomainError } from "../../../domain/errors";

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  METER_NOT_FOUND: 404,
  TARIFF_NOT_FOUND: 404,
  INVALID_READING: 422,
};

export function toHttp(error: unknown): HttpResponse {
  if (error instanceof DomainError) {
    const status = STATUS_BY_CODE[error.code] ?? 400;
    return { status, body: { error: error.code, message: error.message } };
  }
  return { status: 500, body: { error: "INTERNAL" } };
}
