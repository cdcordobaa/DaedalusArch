import { DomainError } from "../../shared/errors.js";
import { newWeighing, type Weighing } from "../domain/bin-intake.js";

/** Translates ScaleLink's webhook JSON (bin tag, gross weight in kg, time) into a cellar Weighing. */
export function weighingFromScaleLink(body: unknown): Weighing {
  if (typeof body !== "object" || body === null) throw new DomainError("body must be a JSON object");
  const b = body as Record<string, unknown>;
  const rawTag = b.binTag;
  const tag = typeof rawTag === "string" && /^\d+$/.test(rawTag) ? Number(rawTag) : rawTag;
  if (typeof tag !== "number") throw new DomainError("binTag must be a number");
  const kg = b.grossWeightKg;
  if (typeof kg !== "number" || !Number.isFinite(kg)) throw new DomainError("grossWeightKg must be a number");
  if (typeof b.time !== "string" || Number.isNaN(Date.parse(b.time))) {
    throw new DomainError("time must be an ISO timestamp string");
  }
  return newWeighing(tag, kg, new Date(b.time).toISOString());
}
