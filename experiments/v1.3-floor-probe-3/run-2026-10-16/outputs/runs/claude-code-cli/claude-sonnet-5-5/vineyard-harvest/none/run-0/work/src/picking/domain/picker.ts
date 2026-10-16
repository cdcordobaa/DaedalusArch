import { DomainError } from "../../shared/errors.js";

export interface Picker {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly hourlyRate: number;
}

export function newPicker(id: string, name: string, phone: string, hourlyRate: number): Picker {
  if (hourlyRate < 0) throw new DomainError("hourlyRate must not be negative");
  return { id, name, phone, hourlyRate };
}
