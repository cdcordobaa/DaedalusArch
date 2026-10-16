import { DomainError } from "./errors.js";

export class Doctor {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly specialty: string,
  ) {
    if (!id) throw new DomainError("Doctor id is required");
    if (!name.trim()) throw new DomainError("Doctor name is required");
  }
}
