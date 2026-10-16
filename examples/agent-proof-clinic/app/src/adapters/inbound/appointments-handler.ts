import type { BookAppointmentUseCase } from "../../application/book-appointment.js";
import type { CancelAppointmentUseCase } from "../../application/cancel-appointment.js";
import type { CompleteAppointmentUseCase } from "../../application/complete-appointment.js";
import type { GetAppointmentUseCase } from "../../application/get-appointment.js";
import type { RescheduleAppointmentUseCase } from "../../application/reschedule-appointment.js";
import type { Appointment } from "../../domain/appointment.js";
import { routeNotFound, toErrorResponse } from "./error-responses.js";
import type { HttpHandler, HttpRequest, HttpResponse } from "./http.js";
import { parseBookRequest, parseRequesterRequest, parseRescheduleRequest } from "./request-parsing.js";

export interface AppointmentUseCases {
  book: BookAppointmentUseCase;
  get: GetAppointmentUseCase;
  cancel: CancelAppointmentUseCase;
  reschedule: RescheduleAppointmentUseCase;
  complete: CompleteAppointmentUseCase;
}

const APPOINTMENT_PATH = /^\/appointments\/([^/]+)(?:\/(cancel|reschedule|complete))?$/;

export function createAppointmentsHandler(useCases: AppointmentUseCases): HttpHandler {
  return async (request: HttpRequest): Promise<HttpResponse> => {
    try {
      if (request.method === "POST" && request.path === "/appointments") {
        const appointment = await useCases.book.execute(parseBookRequest(request.body));
        return { status: 201, body: toDto(appointment) };
      }
      const match = APPOINTMENT_PATH.exec(request.path);
      if (!match) return routeNotFound();
      const id = decodeURIComponent(match[1]!);
      const action = match[2];

      if (request.method === "GET" && !action) {
        return { status: 200, body: toDto(await useCases.get.execute(id)) };
      }
      if (request.method === "POST" && action === "cancel") {
        const { requester } = parseRequesterRequest(request.body);
        const appointment = await useCases.cancel.execute({ appointmentId: id, requester });
        return { status: 200, body: toDto(appointment) };
      }
      if (request.method === "POST" && action === "reschedule") {
        const { requester, start } = parseRescheduleRequest(request.body);
        const appointment = await useCases.reschedule.execute({
          appointmentId: id,
          requester,
          newStart: start,
        });
        return { status: 200, body: toDto(appointment) };
      }
      if (request.method === "POST" && action === "complete") {
        const { requester } = parseRequesterRequest(request.body);
        const appointment = await useCases.complete.execute({ appointmentId: id, requester });
        return { status: 200, body: toDto(appointment) };
      }
      return routeNotFound();
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

function toDto(appointment: Appointment) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    start: appointment.slot.start.toISOString(),
    end: appointment.slot.end.toISOString(),
    status: appointment.status,
    lateCancellation: appointment.lateCancellation,
  };
}
