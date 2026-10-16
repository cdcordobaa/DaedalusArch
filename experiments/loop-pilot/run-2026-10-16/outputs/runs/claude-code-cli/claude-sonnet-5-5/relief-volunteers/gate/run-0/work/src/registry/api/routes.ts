import { RegistryService } from "../application/registry-service";
import { DomainError, isDate, isSkill, Volunteer } from "../domain/volunteer";
import { HttpError, obj, Route, str } from "../../shared/http";

function view(v: Volunteer) {
  return { id: v.id, name: v.name, contact: v.contact, homeRegion: v.homeRegion, skills: v.skills };
}

export function registryRoutes(service: RegistryService): Route[] {
  const found = <T>(x: T | undefined, id: string): T => {
    if (x === undefined) throw new HttpError(404, `Volunteer ${id} not found`);
    return x;
  };
  return [
    {
      method: "POST",
      path: "/volunteers",
      handler: async ({ body }) => {
        const b = obj(body);
        const v = service.register({ name: str(b.name, "name"), contact: str(b.contact, "contact"), homeRegion: str(b.homeRegion, "homeRegion") });
        return { status: 201, body: view(v) };
      },
    },
    { method: "GET", path: "/volunteers", handler: async () => ({ status: 200, body: service.list().map(view) }) },
    {
      method: "GET",
      path: "/volunteers/:id",
      handler: async ({ params }) => ({ status: 200, body: view(found(service.get(params.id), params.id)) }),
    },
    {
      method: "POST",
      path: "/volunteers/:id/skills",
      handler: async ({ params, body }) => {
        const b = obj(body);
        if (!isSkill(b.skill)) throw new HttpError(400, "skill must be one of first_aid, heavy_machinery, logistics, translation");
        let cert;
        if (b.certification !== undefined) {
          const c = obj(b.certification);
          const expiry = str(c.expiry, "certification.expiry");
          if (!isDate(expiry)) throw new HttpError(400, "certification.expiry must be YYYY-MM-DD");
          cert = { number: str(c.number, "certification.number"), expiry };
        }
        try {
          return { status: 201, body: view(found(await service.addSkill(params.id, b.skill, cert), params.id)) };
        } catch (e) {
          if (e instanceof DomainError) throw new HttpError(422, e.message);
          throw e;
        }
      },
    },
    {
      method: "DELETE",
      path: "/volunteers/:id/skills/:skill/certification",
      handler: async ({ params }) => {
        if (!isSkill(params.skill)) throw new HttpError(400, "skill must be one of first_aid, heavy_machinery, logistics, translation");
        try {
          return { status: 200, body: view(found(await service.withdrawCertification(params.id, params.skill), params.id)) };
        } catch (e) {
          if (e instanceof DomainError) throw new HttpError(422, e.message);
          throw e;
        }
      },
    },
    {
      method: "GET",
      path: "/volunteers/:id/skills",
      handler: async ({ params, query }) => {
        const on = query.get("on") ?? undefined;
        if (on !== undefined && !isDate(on)) throw new HttpError(400, "on must be YYYY-MM-DD");
        return { status: 200, body: found(await service.skillStatuses(params.id, on), params.id) };
      },
    },
  ];
}
