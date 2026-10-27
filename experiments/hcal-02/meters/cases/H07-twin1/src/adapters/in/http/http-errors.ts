import { DomainError } from "../../../domain/errors";

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export function toHttp(error: unknown): HttpResponse {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "METER_NOT_FOUND":
      case "TARIFF_NOT_FOUND":
        return { status: 404, body: { error: error.code, message: error.message } };
      case "READING_OUT_OF_ORDER":
        return { status: 409, body: { error: error.code, message: error.message } };
      case "INVALID_READING":
        return { status: 422, body: { error: error.code, message: error.message } };
    }
  }
  return { status: 500, body: { error: "INTERNAL" } };
}
