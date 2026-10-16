import type { DoctorRepository } from "../../application/ports/doctor-repository.js";
import type { Doctor } from "../../domain/doctor.js";

export class InMemoryDoctorRepository implements DoctorRepository {
  private readonly byId = new Map<string, Doctor>();

  async save(doctor: Doctor): Promise<void> {
    this.byId.set(doctor.id, doctor);
  }

  async findById(id: string): Promise<Doctor | undefined> {
    return this.byId.get(id);
  }

  async findAll(): Promise<Doctor[]> {
    return [...this.byId.values()];
  }
}
