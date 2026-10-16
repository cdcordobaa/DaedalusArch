import { ValidationError } from "./errors.js";

export type AuditEntityType = "animal" | "application" | "placement" | "notification";

export const SYSTEM_ACTOR = "system";

export interface AuditEntry {
  readonly id: string;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** The animal this change belongs to, when there is one. */
  readonly animalId?: string;
  readonly actor: string;
  readonly at: string;
  /** null when the entity was created by this change. */
  readonly before: unknown;
  readonly after: unknown;
}

export function parseActor(header: unknown): string {
  const v = Array.isArray(header) ? header[0] : header;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : "unknown";
}

export function parseDateBound(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${name} must be a valid date`);
  }
  return Date.parse(value);
}
