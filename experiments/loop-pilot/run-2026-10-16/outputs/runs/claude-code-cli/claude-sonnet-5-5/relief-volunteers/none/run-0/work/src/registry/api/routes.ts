import { asObject, HttpError, str, type Route } from "../../shared/http.js";
import { DomainError, isIsoDate, isSkill, type Certification } from "../domain/volunteer.js";
import { NotFoundError, type VolunteerService } from "../application/volunteerService.js";

async function guard<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFoundError) throw new HttpError(404, e.message);
    if (e instanceof DomainError) throw new HttpError(422, e.message);
    throw e;
  }
}

export function registryRoutes(service: VolunteerService): Route[] {
  return [
    {
      method: "POST",
      pattern: "/volunteers",
      handler: (req) => {
        const b = asObject(req.body);
        const v = service.register({ name: str(b, "name"), contact: str(b, "contact"), homeRegion: str(b, "homeRegion") });
        return { status: 201, body: v };
      },
    },
    { method: "GET", pattern: "/volunteers", handler: () => ({ status: 200, body: service.list() }) },
    {
      method: "GET",
      pattern: "/volunteers/:id",
      handler: (req) => guard(() => ({ status: 200, body: service.get(req.params["id"] as string) })),
    },
    {
      method: "POST",
      pattern: "/volunteers/:id/skills",
      handler: (req) =>
        guard(() => {
          const b = asObject(req.body);
          const skill = b["skill"];
          if (!isSkill(skill)) throw new HttpError(400, "skill must be one of first_aid, heavy_machinery, logistics, translation");
          let cert: Certification | undefined;
          if (b["certification"] !== undefined) {
            const c = asObject(b["certification"]);
            const expiresOn = str(c, "expiresOn");
            if (!isIsoDate(expiresOn)) throw new HttpError(400, "expiresOn must be YYYY-MM-DD");
            cert = { number: str(c, "number"), expiresOn };
          }
          return { status: 201, body: service.addSkill(req.params["id"] as string, skill, cert) };
        }),
    },
    {
      method: "DELETE",
      pattern: "/volunteers/:id/skills/:skill/certification",
      handler: (req) =>
        guard(async () => {
          const skill = req.params["skill"];
          if (!isSkill(skill)) throw new HttpError(400, "skill must be one of first_aid, heavy_machinery, logistics, translation");
          return { status: 200, body: await service.withdrawCertification(req.params["id"] as string, skill) };
        }),
    },
  ];
}
