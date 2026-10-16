import { DomainError, ForbiddenError, InvalidStateError, SlotUnavailableError } from "./errors.js";
import type { Requester } from "./requester.js";
import { TimeSlot } from "./time-slot.js";

export type AppointmentStatus = "booked" | "cancelled" | "completed";

/** Patients must cancel or reschedule at least this long before the start; staff are exempt. */
export const CHANGE_NOTICE_HOURS = 24;
const CHANGE_NOTICE_MS = CHANGE_NOTICE_HOURS * 60 * 60 * 1000;

export class Appointment {
  private constructor(
    readonly id: string,
    readonly patientId: string,
    readonly doctorId: string,
    readonly slot: TimeSlot,
    readonly status: AppointmentStatus,
    /** True when staff cancelled inside the notice window (billable as a late cancellation). */
    readonly lateCancellation: boolean = false,
  ) {}

  /**
   * Books a slot. `existing` are the appointments already in that slot;
   * neither the doctor nor the patient may hold an active one there.
   */
  static book(params: {
    id: string;
    patientId: string;
    doctorId: string;
    slot: TimeSlot;
    now: Date;
    existing: readonly Appointment[];
  }): Appointment {
    const { id, patientId, doctorId, slot, now, existing } = params;
    if (!id) throw new DomainError("Appointment id is required");
    assertBookable(slot, now, patientId, doctorId, existing);
    return new Appointment(id, patientId, doctorId, slot, "booked");
  }

  /** Whether this appointment holds its slot (booked or already completed). */
  get occupiesSlot(): boolean {
    return this.status !== "cancelled";
  }

  cancel(params: { requester: Requester; now: Date }): Appointment {
    const msUntilStart = this.assertChangeableBy(params.requester, params.now);
    const late = msUntilStart < CHANGE_NOTICE_MS;
    return new Appointment(this.id, this.patientId, this.doctorId, this.slot, "cancelled", late);
  }

  /** Moves the appointment to `newSlot`. `existing` are the appointments already in `newSlot`. */
  reschedule(params: {
    requester: Requester;
    newSlot: TimeSlot;
    now: Date;
    existing: readonly Appointment[];
  }): Appointment {
    const { requester, newSlot, now, existing } = params;
    this.assertChangeableBy(requester, now);
    if (newSlot.equals(this.slot)) throw new DomainError("Appointment is already in that slot");
    const others = existing.filter((a) => a.id !== this.id);
    assertBookable(newSlot, now, this.patientId, this.doctorId, others);
    return new Appointment(this.id, this.patientId, this.doctorId, newSlot, "booked");
  }

  /** Staff mark a booked appointment as completed once it has started. */
  complete(params: { requester: Requester; now: Date }): Appointment {
    if (params.requester.kind !== "staff") {
      throw new ForbiddenError("Only clinic staff can complete appointments");
    }
    if (this.status !== "booked") throw new InvalidStateError(`Appointment is ${this.status}`);
    if (params.now.getTime() < this.slot.start.getTime()) {
      throw new InvalidStateError("Appointment has not started yet");
    }
    return new Appointment(this.id, this.patientId, this.doctorId, this.slot, "completed");
  }

  /** Returns the time left until the start, in ms. */
  private assertChangeableBy(requester: Requester, now: Date): number {
    if (requester.kind === "patient" && requester.patientId !== this.patientId) {
      throw new ForbiddenError("Patients can only change their own appointments");
    }
    if (this.status !== "booked") throw new InvalidStateError(`Appointment is already ${this.status}`);
    const msUntilStart = this.slot.start.getTime() - now.getTime();
    if (msUntilStart <= 0) throw new InvalidStateError("Appointment has already started");
    if (requester.kind !== "staff" && msUntilStart < CHANGE_NOTICE_MS) {
      throw new DomainError(
        `Changes less than ${CHANGE_NOTICE_HOURS} hours before the start must be made by clinic staff`,
      );
    }
    return msUntilStart;
  }
}

function assertBookable(
  slot: TimeSlot,
  now: Date,
  patientId: string,
  doctorId: string,
  existing: readonly Appointment[],
): void {
  if (slot.start.getTime() <= now.getTime()) {
    throw new DomainError("Cannot book a slot in the past");
  }
  for (const other of existing) {
    if (!other.occupiesSlot || !other.slot.equals(slot)) continue;
    if (other.doctorId === doctorId) {
      throw new SlotUnavailableError("Doctor is already booked for this slot");
    }
    if (other.patientId === patientId) {
      throw new SlotUnavailableError("Patient already has an appointment in this slot");
    }
  }
}
