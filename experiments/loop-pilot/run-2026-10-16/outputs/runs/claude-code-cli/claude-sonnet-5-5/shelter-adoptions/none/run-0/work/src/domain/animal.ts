import { ConflictError, ValidationError } from "./errors.js";

export type AnimalStatus = "intake" | "ready" | "adopted";

export interface Animal {
  readonly id: string;
  readonly species: string;
  readonly name: string;
  readonly estimatedAgeYears: number;
  readonly intakeDate: string;
  readonly medicalNotes: string;
  readonly status: AnimalStatus;
}

export interface NewAnimal {
  species: unknown;
  name: unknown;
  estimatedAgeYears: unknown;
  intakeDate: unknown;
  medicalNotes?: unknown;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}

export function registerAnimal(id: string, input: NewAnimal): Animal {
  const age = input.estimatedAgeYears;
  if (typeof age !== "number" || !Number.isFinite(age) || age < 0) {
    throw new ValidationError("estimatedAgeYears must be a non-negative number");
  }
  const intakeDate = requireText(input.intakeDate, "intakeDate");
  if (Number.isNaN(Date.parse(intakeDate))) {
    throw new ValidationError("intakeDate must be a valid date");
  }
  if (input.medicalNotes !== undefined && typeof input.medicalNotes !== "string") {
    throw new ValidationError("medicalNotes must be a string");
  }
  return {
    id,
    species: requireText(input.species, "species"),
    name: requireText(input.name, "name"),
    estimatedAgeYears: age,
    intakeDate,
    medicalNotes: input.medicalNotes ?? "",
    status: "intake",
  };
}

export function markReady(animal: Animal): Animal {
  if (animal.status === "adopted") {
    throw new ConflictError("animal is already adopted");
  }
  return { ...animal, status: "ready" };
}

export function markAdopted(animal: Animal): Animal {
  if (animal.status === "adopted") {
    throw new ConflictError("animal is already adopted");
  }
  return { ...animal, status: "adopted" };
}
