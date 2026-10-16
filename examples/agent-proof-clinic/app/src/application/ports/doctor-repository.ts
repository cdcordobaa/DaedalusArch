import type { Doctor } from "../../domain/doctor.js";

export interface DoctorRepository {
  save(doctor: Doctor): Promise<void>;
  findById(id: string): Promise<Doctor | undefined>;
  findAll(): Promise<Doctor[]>;
}
