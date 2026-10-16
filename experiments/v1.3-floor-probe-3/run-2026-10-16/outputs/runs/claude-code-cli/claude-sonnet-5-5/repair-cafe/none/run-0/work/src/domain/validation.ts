import { CATEGORIES, Category, OUTCOMES, Outcome } from "./model";
import { ValidationError } from "./errors";

export function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}

export function requireCategory(value: unknown, field = "category"): Category {
  if (typeof value !== "string" || !(CATEGORIES as readonly string[]).includes(value)) {
    throw new ValidationError(`${field} must be one of ${CATEGORIES.join(", ")}`);
  }
  return value as Category;
}

export function requireOutcome(value: unknown): Outcome {
  if (typeof value !== "string" || !(OUTCOMES as readonly string[]).includes(value)) {
    throw new ValidationError(`outcome must be one of ${OUTCOMES.join(", ")}`);
  }
  return value as Outcome;
}

export function requireDate(value: unknown): string {
  const v = requireText(value, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ValidationError("date must be YYYY-MM-DD");
  }
  return v;
}

export function requireTime(value: unknown, field: string): string {
  const v = requireText(value, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
    throw new ValidationError(`${field} must be HH:MM`);
  }
  return v;
}

export function requireMobile(value: unknown): string {
  const v = requireText(value, "visitorMobile").replace(/[\s-]/g, "");
  if (!/^\+?\d{7,15}$/.test(v)) {
    throw new ValidationError("visitorMobile must be a valid mobile number");
  }
  return v;
}

export function requireWeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError("weightKg must be a non-negative number");
  }
  return value;
}
