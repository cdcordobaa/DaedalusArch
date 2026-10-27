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
};

const LOG_LEVEL_BY_STATUS: Record<number, "info" | "warn"> = { 404: "info", 409: "warn", 410: "info" };

export function statusFor(code: string): number {
  return STATUS_BY_CODE[code] ?? 422;
}

export function levelFor(status: number): "info" | "warn" {
  return LOG_LEVEL_BY_STATUS[status] ?? "warn";
}

export function mapError(e: unknown): HttpResponse {
  if (e instanceof DomainError) {
    return { status: statusFor(e.code), body: { code: e.code, message: e.message } };
  }
  return { status: 500, body: { code: "INTERNAL" } };
}
