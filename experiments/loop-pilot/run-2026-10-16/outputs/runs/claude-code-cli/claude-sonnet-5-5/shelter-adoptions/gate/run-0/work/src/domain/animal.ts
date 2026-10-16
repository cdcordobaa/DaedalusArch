import { ConflictError } from "./errors.js";

export type AnimalStatus = "in_care" | "ready_for_adoption" | "adopted";

export interface Animal {
  id: string;
  species: string;
  name: string;
  estimatedAgeMonths: number;
  intakeDate: string;
  medicalNotes: string;
  status: AnimalStatus;
}

export function markReady(animal: Animal): Animal {
  if (animal.status !== "in_care") {
    throw new ConflictError(`Animal is ${animal.status}; only animals in care can be marked ready`);
  }
  return { ...animal, status: "ready_for_adoption" };
}

export function markAdopted(animal: Animal): Animal {
  if (animal.status !== "ready_for_adoption") {
    throw new ConflictError(`Animal is ${animal.status}; only animals ready for adoption can be adopted`);
  }
  return { ...animal, status: "adopted" };
}
