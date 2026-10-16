import { DomainError } from "./errors.js";

export interface PatientContact {
  email?: string;
  phone?: string;
}

export class Patient {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly contact: PatientContact,
  ) {
    if (!id) throw new DomainError("Patient id is required");
    if (!name.trim()) throw new DomainError("Patient name is required");
    if (!contact.email && !contact.phone) {
      throw new DomainError("Patient needs an email or a phone number");
    }
  }
}
