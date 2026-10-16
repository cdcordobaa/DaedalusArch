import type { Requester } from "../../domain/requester.js";

export class BadRequest extends Error {}

type Body = Record<string, unknown>;

export function parseBookRequest(body: unknown): { patientId: string; doctorId: string; start: Date } {
  const fields = asObject(body);
  return {
    patientId: requiredString(fields, "patientId"),
    doctorId: requiredString(fields, "doctorId"),
    start: requiredDate(fields, "start"),
  };
}

/** Body with only a requester (cancel, complete). */
export function parseRequesterRequest(body: unknown): { requester: Requester } {
  return { requester: parseRequester(asObject(body)) };
}

export function parseRescheduleRequest(body: unknown): { requester: Requester; start: Date } {
  const fields = asObject(body);
  return { requester: parseRequester(fields), start: requiredDate(fields, "start") };
}

/**
 * The requester is taken from the body: `{ "requester": { "kind": "staff" } }` or
 * `{ "requester": { "kind": "patient", "patientId": "..." } }`.
 * There is no authentication yet, so this is trusted as sent.
 */
function parseRequester(fields: Body): Requester {
  const requester = fields.requester;
  if (typeof requester !== "object" || requester === null) {
    throw new BadRequest("requester is required");
  }
  const { kind, patientId } = requester as Body;
  if (kind === "staff") return { kind: "staff" };
  if (kind === "patient") {
    if (typeof patientId !== "string" || !patientId) {
      throw new BadRequest("requester.patientId is required for patient requesters");
    }
    return { kind: "patient", patientId };
  }
  throw new BadRequest('requester.kind must be "staff" or "patient"');
}

function asObject(body: unknown): Body {
  if (typeof body !== "object" || body === null) throw new BadRequest("Body must be a JSON object");
  return body as Body;
}

function requiredString(fields: Body, name: string): string {
  const value = fields[name];
  if (typeof value !== "string" || !value) throw new BadRequest(`${name} is required`);
  return value;
}

function requiredDate(fields: Body, name: string): Date {
  const value = fields[name];
  if (typeof value !== "string") throw new BadRequest(`${name} is required (ISO-8601 string)`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequest(`${name} must be a valid ISO-8601 date`);
  return date;
}
