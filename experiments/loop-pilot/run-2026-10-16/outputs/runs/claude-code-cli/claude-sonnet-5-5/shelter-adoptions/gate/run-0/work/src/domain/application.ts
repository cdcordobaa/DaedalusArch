import { ConflictError } from "./errors.js";
import type { NotificationChannel } from "./notification.js";

export type ApplicationStatus = "open" | "approved" | "rejected";

export interface Applicant {
  name: string;
  email: string;
  phone: string;
  notificationChannel?: NotificationChannel;
}

export interface Household {
  adults: number;
  children: number;
  hasOtherPets: boolean;
  homeType: string;
  notes: string;
}

export interface AdoptionApplication {
  id: string;
  animalId: string;
  applicant: Applicant;
  household: Household;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt?: string;
}

export function decide(
  app: AdoptionApplication,
  status: "approved" | "rejected",
  at: string,
): AdoptionApplication {
  if (app.status !== "open") {
    throw new ConflictError(`Application is already ${app.status}`);
  }
  return { ...app, status, decidedAt: at };
}
