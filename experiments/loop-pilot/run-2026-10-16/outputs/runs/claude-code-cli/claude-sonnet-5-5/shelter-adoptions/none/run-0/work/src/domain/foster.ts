import { ConflictError, ValidationError } from "./errors.js";
import { parseChannel } from "./notification.js";
import type { NotificationChannel } from "./notification.js";

export interface FosterCarer {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly notificationChannel: NotificationChannel;
  readonly capacity: number;
  readonly species: readonly string[];
}

export interface Placement {
  readonly id: string;
  readonly animalId: string;
  readonly carerId: string;
  readonly startedAt: string;
  readonly endedAt?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  return v.trim();
}

export function speciesMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function registerCarer(id: string, input: unknown): FosterCarer {
  if (!isRecord(input)) throw new ValidationError("carer details are required");
  const email = text(input.email, "email");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ValidationError("email is not a valid e-mail address");
  }
  const capacity = input.capacity;
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
    throw new ValidationError("capacity must be a positive integer");
  }
  if (!Array.isArray(input.species) || input.species.length === 0) {
    throw new ValidationError("species must be a non-empty array");
  }
  const species: string[] = [];
  for (const s of input.species as unknown[]) {
    const clean = text(s, "species entry");
    if (!species.some((x) => speciesMatches(x, clean))) species.push(clean);
  }
  const notificationChannel = parseChannel(input.notificationChannel, "notificationChannel");
  const phone =
    input.phone === undefined || input.phone === null || input.phone === ""
      ? undefined
      : text(input.phone, "phone");
  if (notificationChannel === "sms" && phone === undefined) {
    throw new ValidationError("phone is required for SMS notifications");
  }
  const base = { id, name: text(input.name, "name"), email, capacity, species, notificationChannel };
  return phone === undefined ? base : { ...base, phone };
}

export function startPlacement(
  id: string,
  carer: FosterCarer,
  animalId: string,
  animalSpecies: string,
  activeCountForCarer: number,
  now: Date,
): Placement {
  if (!carer.species.some((s) => speciesMatches(s, animalSpecies))) {
    throw new ConflictError(`carer does not host species ${animalSpecies}`);
  }
  if (activeCountForCarer >= carer.capacity) {
    throw new ConflictError("carer is at full capacity");
  }
  return { id, animalId, carerId: carer.id, startedAt: now.toISOString() };
}

export function endPlacement(placement: Placement, now: Date): Placement {
  if (placement.endedAt !== undefined) {
    throw new ConflictError("placement has already ended");
  }
  return { ...placement, endedAt: now.toISOString() };
}
