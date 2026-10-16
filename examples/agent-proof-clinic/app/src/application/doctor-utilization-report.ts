import { DomainError } from "../domain/errors.js";
import { AVAILABLE_SLOTS_PER_DAY, formatDay } from "../domain/time-slot.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";
import type { DoctorRepository } from "./ports/doctor-repository.js";

export interface DoctorUtilizationRow {
  doctorId: string;
  doctorName: string;
  bookedSlots: number;
  cancelledSlots: number;
  /** bookedSlots / AVAILABLE_SLOTS_PER_DAY, as a percentage rounded to one decimal. */
  utilizationPercent: number;
}

export interface DoctorUtilizationReport {
  date: string;
  availableSlotsPerDay: number;
  doctors: DoctorUtilizationRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Read-only: per-doctor booked/cancelled counts for one UTC day. */
export class DoctorUtilizationReportUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly doctors: DoctorRepository,
  ) {}

  async execute(date: string): Promise<DoctorUtilizationReport> {
    const dayStart = parseDay(date);
    const [doctors, appointments] = await Promise.all([
      this.doctors.findAll(),
      this.appointments.findStartingBetween(dayStart, new Date(dayStart.getTime() + DAY_MS)),
    ]);

    const rows = doctors.map((doctor): DoctorUtilizationRow => {
      const own = appointments.filter((a) => a.doctorId === doctor.id);
      // Completed appointments used their slot, so they count as booked.
      const bookedSlots = own.filter((a) => a.occupiesSlot).length;
      return {
        doctorId: doctor.id,
        doctorName: doctor.name,
        bookedSlots,
        cancelledSlots: own.filter((a) => a.status === "cancelled").length,
        utilizationPercent: Math.round((bookedSlots / AVAILABLE_SLOTS_PER_DAY) * 1000) / 10,
      };
    });
    rows.sort((a, b) => a.doctorName.localeCompare(b.doctorName));
    return { date: formatDay(dayStart), availableSlotsPerDay: AVAILABLE_SLOTS_PER_DAY, doctors: rows };
  }
}

function parseDay(date: string): Date {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : undefined;
  if (!day || Number.isNaN(day.getTime()) || formatDay(day) !== date) {
    throw new DomainError("date must be a valid YYYY-MM-DD day");
  }
  return day;
}
