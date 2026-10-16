import { DeploymentService } from "../application/deployment-service";
import { ImpactReportService } from "../application/impact-report-service";
import { DeploymentError, Incident, Shift } from "../domain/incident";
import { HttpError, obj, Route, str } from "../../shared/http";
import { isDate, isSkill } from "../../registry/domain/volunteer";

function incidentView(i: Incident) {
  return { id: i.id, name: i.name, region: i.region, startDate: i.startDate };
}

function shiftView(s: Shift) {
  return {
    id: s.id,
    incidentId: s.incidentId,
    date: s.date,
    startTime: s.startTime,
    hours: s.hours,
    requiredSkill: s.requiredSkill,
    peopleNeeded: s.peopleNeeded,
    volunteers: s.volunteers,
  };
}

async function translate<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DeploymentError) {
      const status = e.kind === "not_found" ? 404 : e.kind === "conflict" ? 409 : 422;
      throw new HttpError(status, e.message);
    }
    throw e;
  }
}

export function deploymentRoutes(service: DeploymentService, reports: ImpactReportService): Route[] {
  return [
    {
      method: "POST",
      path: "/incidents",
      handler: async ({ body }) => {
        const b = obj(body);
        const startDate = str(b.startDate, "startDate");
        if (!isDate(startDate)) throw new HttpError(400, "startDate must be YYYY-MM-DD");
        const i = service.createIncident({ name: str(b.name, "name"), region: str(b.region, "region"), startDate });
        return { status: 201, body: incidentView(i) };
      },
    },
    { method: "GET", path: "/incidents", handler: async () => ({ status: 200, body: service.listIncidents().map(incidentView) }) },
    {
      method: "GET",
      path: "/incidents/:id",
      handler: ({ params }) => translate(() => ({ status: 200, body: incidentView(service.getIncident(params.id)) })),
    },
    {
      method: "POST",
      path: "/incidents/:id/shifts",
      handler: async ({ params, body }) => {
        const b = obj(body);
        const date = str(b.date, "date");
        if (!isDate(date)) throw new HttpError(400, "date must be YYYY-MM-DD");
        const startTime = str(b.startTime, "startTime");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new HttpError(400, "startTime must be HH:MM");
        if (typeof b.hours !== "number") throw new HttpError(400, "hours must be a number");
        if (!isSkill(b.requiredSkill)) throw new HttpError(400, "requiredSkill must be one of first_aid, heavy_machinery, logistics, translation");
        if (typeof b.peopleNeeded !== "number") throw new HttpError(400, "peopleNeeded must be a number");
        const input = { date, startTime, hours: b.hours, requiredSkill: b.requiredSkill, peopleNeeded: b.peopleNeeded };
        return translate(() => ({ status: 201, body: shiftView(service.addShift(params.id, input)) }));
      },
    },
    {
      method: "GET",
      path: "/incidents/:id/shifts",
      handler: ({ params }) => translate(async () => ({ status: 200, body: (await service.listShifts(params.id)).map(shiftView) })),
    },
    {
      method: "GET",
      path: "/incidents/:id/open-shifts",
      handler: ({ params }) =>
        translate(async () => ({
          status: 200,
          body: (await service.listOpenShifts(params.id)).map((o) => ({ ...shiftView(o.shift), openSlots: o.openSlots, candidates: o.candidates })),
        })),
    },
    {
      method: "GET",
      path: "/shifts/:id",
      handler: ({ params }) => translate(async () => ({ status: 200, body: shiftView(await service.getShift(params.id)) })),
    },
    {
      method: "POST",
      path: "/shifts/:id/assignments",
      handler: async ({ params, body }) => {
        const volunteerId = str(obj(body).volunteerId, "volunteerId");
        return translate(async () => ({ status: 201, body: shiftView(await service.assign(params.id, volunteerId)) }));
      },
    },
    {
      method: "DELETE",
      path: "/shifts/:id/assignments/:volunteerId",
      handler: ({ params }) => translate(() => ({ status: 200, body: shiftView(service.unassign(params.id, params.volunteerId)) })),
    },
    {
      method: "GET",
      path: "/reports/impact",
      handler: ({ query }) => translate(async () => ({ status: 200, body: await reports.monthlyReport(str(query.get("month") ?? undefined, "month")) })),
    },
    {
      method: "GET",
      path: "/volunteers/:id/service-record",
      handler: ({ params, query }) => translate(() => ({ status: 200, body: reports.serviceRecord(params.id, query.get("month") ?? undefined) })),
    },
  ];
}
