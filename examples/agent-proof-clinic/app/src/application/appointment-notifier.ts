import type { Appointment } from "../domain/appointment.js";
import { formatMoney, type Money } from "../domain/money.js";
import type { Patient } from "../domain/patient.js";
import type { NotificationSender } from "./ports/notification-sender.js";

export type AppointmentEvent =
  | { kind: "booked" }
  | { kind: "cancelled" }
  | { kind: "rescheduled"; previousStart: Date }
  | { kind: "invoiced"; invoiceId: string; total: Money };

/** Turns appointment events into patient notifications. */
export class AppointmentNotifier {
  constructor(private readonly sender: NotificationSender) {}

  /**
   * The appointment change is already saved when this runs, so a delivery failure
   * is reported but does not fail the request.
   */
  async notify(patient: Patient, appointment: Appointment, event: AppointmentEvent): Promise<void> {
    const { subject, body } = compose(appointment, event);
    try {
      await this.sender.send({
        recipient: { name: patient.name, ...patient.contact },
        subject,
        body: `Hello ${patient.name}, ${body}`,
      });
    } catch (error) {
      console.error(`Notification for appointment ${appointment.id} failed`, error);
    }
  }
}

function compose(appointment: Appointment, event: AppointmentEvent): { subject: string; body: string } {
  const start = appointment.slot.start.toISOString();
  switch (event.kind) {
    case "booked":
      return { subject: "Appointment booked", body: `your appointment is booked for ${start}.` };
    case "cancelled":
      return { subject: "Appointment cancelled", body: `your appointment on ${start} was cancelled.` };
    case "rescheduled":
      return {
        subject: "Appointment rescheduled",
        body: `your appointment on ${event.previousStart.toISOString()} was moved to ${start}.`,
      };
    case "invoiced":
      return {
        subject: `Invoice ${event.invoiceId}`,
        body: `invoice ${event.invoiceId} for your appointment on ${start} totals ${formatMoney(event.total)}.`,
      };
  }
}
