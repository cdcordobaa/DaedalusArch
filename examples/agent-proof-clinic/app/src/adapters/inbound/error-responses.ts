import {
  DomainError,
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  SlotUnavailableError,
} from "../../domain/errors.js";
import type { HttpResponse } from "./http.js";
import { BadRequest } from "./request-parsing.js";

export function routeNotFound(): HttpResponse {
  return { status: 404, body: { error: "Route not found" } };
}

/** Maps request and domain errors to HTTP statuses; anything else is a 500. */
export function toErrorResponse(error: unknown): HttpResponse {
  if (error instanceof BadRequest) return { status: 400, body: { error: error.message } };
  if (error instanceof NotFoundError) return { status: 404, body: { error: error.message } };
  if (error instanceof ForbiddenError) return { status: 403, body: { error: error.message } };
  if (error instanceof SlotUnavailableError || error instanceof InvalidStateError) {
    return { status: 409, body: { error: error.message } };
  }
  if (error instanceof DomainError) return { status: 422, body: { error: error.message } };
  console.error(error);
  return { status: 500, body: { error: "Internal server error" } };
}
