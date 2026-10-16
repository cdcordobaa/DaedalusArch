import type {
  DoctorUtilizationReport,
  DoctorUtilizationReportUseCase,
} from "../../application/doctor-utilization-report.js";
import { DomainError } from "../../domain/errors.js";
import { csvResponse, toCsv } from "./csv.js";
import type { HttpHandler, HttpRequest, HttpResponse } from "./http.js";

export function createReportsHandler(doctorUtilization: DoctorUtilizationReportUseCase): HttpHandler {
  return async (request: HttpRequest): Promise<HttpResponse> => {
    const url = new URL(request.path, "http://localhost");
    const route = url.pathname;
    if (request.method !== "GET" || !route.startsWith("/reports/doctor-utilization")) {
      return { status: 404, body: { error: "Route not found" } };
    }
    const date = url.searchParams.get("date");
    if (!date) return { status: 400, body: { error: "date query parameter is required (YYYY-MM-DD)" } };

    try {
      if (route === "/reports/doctor-utilization") {
        return { status: 200, body: await doctorUtilization.execute(date) };
      }
      if (route === "/reports/doctor-utilization.csv") {
        return csvResponse(reportCsv(await doctorUtilization.execute(date)));
      }
      return { status: 404, body: { error: "Route not found" } };
    } catch (error) {
      if (error instanceof DomainError) return { status: 400, body: { error: error.message } };
      console.error(error);
      return { status: 500, body: { error: "Internal server error" } };
    }
  };
}

function reportCsv(report: DoctorUtilizationReport): string {
  return toCsv(
    [
      "date",
      "doctor_id",
      "doctor_name",
      "booked_slots",
      "cancelled_slots",
      "available_slots",
      "utilization_percent",
    ],
    report.doctors.map((row) => [
      report.date,
      row.doctorId,
      row.doctorName,
      row.bookedSlots,
      row.cancelledSlots,
      report.availableSlotsPerDay,
      row.utilizationPercent,
    ]),
  );
}
