import type { Appointment } from "./appointment.js";
import type { Doctor } from "./doctor.js";
import { InvalidStateError } from "./errors.js";
import type { Money } from "./money.js";

/** Share of the base fee billed for a late cancellation that staff overrode. */
export const LATE_CANCELLATION_FEE_RATE = 0.5;

export interface InvoiceLine {
  readonly description: string;
  readonly amount: Money;
}

export class Invoice {
  private constructor(
    readonly id: string,
    readonly appointmentId: string,
    readonly patientId: string,
    readonly doctorId: string,
    readonly doctorName: string,
    readonly specialty: string,
    /** YYYY-MM-DD, same format as the utilization report. */
    readonly appointmentDate: string,
    readonly lines: readonly InvoiceLine[],
    readonly issuedAt: Date,
  ) {}

  /** One invoice per appointment: completed ones pay the base fee, late cancellations a share of it. */
  static issue(params: { appointment: Appointment; doctor: Doctor; baseFee: Money; issuedAt: Date }): Invoice {
    const { appointment, doctor, baseFee, issuedAt } = params;
    return new Invoice(
      `INV-${appointment.id}`,
      appointment.id,
      appointment.patientId,
      doctor.id,
      doctor.name,
      doctor.specialty,
      appointment.slot.day,
      [billableLine(appointment, doctor, baseFee)],
      issuedAt,
    );
  }

  get total(): Money {
    const currency = this.lines[0]!.amount.currency;
    return { cents: this.lines.reduce((sum, line) => sum + line.amount.cents, 0), currency };
  }
}

function billableLine(appointment: Appointment, doctor: Doctor, baseFee: Money): InvoiceLine {
  if (appointment.status === "completed") {
    return { description: `Consultation (${doctor.specialty})`, amount: baseFee };
  }
  if (appointment.status === "cancelled" && appointment.lateCancellation) {
    return {
      description: `Late cancellation fee (${LATE_CANCELLATION_FEE_RATE * 100}% of base fee)`,
      amount: { cents: Math.round(baseFee.cents * LATE_CANCELLATION_FEE_RATE), currency: baseFee.currency },
    };
  }
  throw new InvalidStateError("Only completed or late-cancelled appointments can be invoiced");
}
