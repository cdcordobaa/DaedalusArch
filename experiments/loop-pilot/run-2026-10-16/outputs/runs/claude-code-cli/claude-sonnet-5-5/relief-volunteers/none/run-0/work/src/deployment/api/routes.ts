import { asObject, HttpError, num, str, type Route } from "../../shared/http.js";
import { DomainError } from "../domain/deployment.js";
import { NotFoundError, type DeploymentService } from "../application/deploymentService.js";

async function guard<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFoundError) throw new HttpError(404, e.message);
    if (e instanceof DomainError) throw new HttpError(409, e.message);
    throw e;
  }
}

function monthParam(v: string | undefined): string {
  if (v === undefined) throw new HttpError(400, "month query parameter (YYYY-MM) is required");
  return v;
}

export function deploymentRoutes(service: DeploymentService): Route[] {
  return [
    {
      method: "POST",
      pattern: "/incidents",
      handler: (req) =>
        guard(() => {
          const b = asObject(req.body);
          return { status: 201, body: service.createIncident(str(b, "name"), str(b, "region"), str(b, "startDate")) };
        }),
    },
    { method: "GET", pattern: "/incidents", handler: () => ({ status: 200, body: service.listIncidents() }) },
    {
      method: "GET",
      pattern: "/incidents/:id",
      handler: (req) => guard(() => ({ status: 200, body: service.getIncident(req.params["id"] as string) })),
    },
    {
      method: "POST",
      pattern: "/incidents/:id/shifts",
      handler: (req) =>
        guard(() => {
          const b = asObject(req.body);
          const shift = service.planShift(req.params["id"] as string, {
            date: str(b, "date"),
            startHour: b["startHour"] === undefined ? 0 : num(b, "startHour"),
            hours: num(b, "hours"),
            requiredSkill: str(b, "requiredSkill"),
            peopleNeeded: num(b, "peopleNeeded"),
          });
          return { status: 201, body: shift };
        }),
    },
    {
      method: "GET",
      pattern: "/incidents/:id/shifts",
      handler: (req) => guard(async () => ({ status: 200, body: await service.listShifts(req.params["id"] as string) })),
    },
    {
      method: "GET",
      pattern: "/incidents/:id/open-shifts",
      handler: (req) => guard(async () => ({ status: 200, body: await service.openShifts(req.params["id"] as string) })),
    },
    {
      method: "GET",
      pattern: "/shifts/:id",
      handler: (req) => guard(async () => ({ status: 200, body: await service.getShift(req.params["id"] as string) })),
    },
    {
      method: "GET",
      pattern: "/reports/impact",
      handler: (req) => guard(async () => ({ status: 200, body: await service.impactReport(monthParam(req.query["month"])) })),
    },
    {
      method: "GET",
      pattern: "/volunteers/:id/service-record",
      handler: (req) =>
        guard(async () => {
          const id = req.params["id"] as string;
          return {
            status: 200,
            body: await service.serviceRecord(id, req.query["month"]),
            headers: { "content-disposition": `attachment; filename="service-record-${id}.json"` },
          };
        }),
    },
    {
      method: "POST",
      pattern: "/shifts/:id/assignments",
      handler: (req) =>
        guard(async () => {
          const b = asObject(req.body);
          return { status: 201, body: await service.assign(req.params["id"] as string, str(b, "volunteerId")) };
        }),
    },
    {
      method: "DELETE",
      pattern: "/shifts/:id/assignments/:volunteerId",
      handler: (req) =>
        guard(() => ({
          status: 200,
          body: service.unassign(req.params["id"] as string, req.params["volunteerId"] as string),
        })),
    },
  ];
}
