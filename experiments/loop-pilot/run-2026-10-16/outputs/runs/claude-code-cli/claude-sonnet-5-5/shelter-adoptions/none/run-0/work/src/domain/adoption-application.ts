import { ConflictError, ValidationError } from "./errors.js";
import { parseChannel } from "./notification.js";
import type { NotificationChannel } from "./notification.js";

export type ApplicationStatus = "open" | "approved" | "rejected";

export interface Applicant {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly notificationChannel: NotificationChannel;
}

export interface Household {
  readonly adults: number;
  readonly children: number;
  readonly hasOtherPets: boolean;
  readonly housingType: string;
  readonly notes: string;
}

export interface AdoptionApplication {
  readonly id: string;
  readonly animalId: string;
  readonly applicant: Applicant;
  readonly household: Household;
  readonly status: ApplicationStatus;
  readonly submittedAt: string;
  readonly decidedAt?: string;
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

function count(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return v;
}

export function submitApplication(
  id: string,
  animalId: string,
  applicantInput: unknown,
  householdInput: unknown,
  now: Date,
): AdoptionApplication {
  if (!isRecord(applicantInput)) throw new ValidationError("applicant is required");
  if (!isRecord(householdInput)) throw new ValidationError("household is required");
  const email = text(applicantInput.email, "applicant.email");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ValidationError("applicant.email is not a valid e-mail address");
  }
  if (typeof householdInput.hasOtherPets !== "boolean") {
    throw new ValidationError("household.hasOtherPets must be a boolean");
  }
  const notes = householdInput.notes;
  if (notes !== undefined && typeof notes !== "string") {
    throw new ValidationError("household.notes must be a string");
  }
  return {
    id,
    animalId,
    applicant: {
      name: text(applicantInput.name, "applicant.name"),
      email,
      phone: text(applicantInput.phone, "applicant.phone"),
      notificationChannel: parseChannel(
        applicantInput.notificationChannel,
        "applicant.notificationChannel",
      ),
    },
    household: {
      adults: count(householdInput.adults, "household.adults"),
      children: count(householdInput.children, "household.children"),
      hasOtherPets: householdInput.hasOtherPets,
      housingType: text(householdInput.housingType, "household.housingType"),
      notes: notes ?? "",
    },
    status: "open",
    submittedAt: now.toISOString(),
  };
}

export function decide(
  application: AdoptionApplication,
  decision: "approved" | "rejected",
  now: Date,
): AdoptionApplication {
  if (application.status !== "open") {
    throw new ConflictError(`application is already ${application.status}`);
  }
  return { ...application, status: decision, decidedAt: now.toISOString() };
}
