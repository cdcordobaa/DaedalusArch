import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { ShelterService } from "../../application/shelter-service.js";
import type { FakeMailSender } from "../outbound/fake-mail-sender.js";
import { parseActor } from "../../domain/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors.js";

function body(req: Request): Record<string, unknown> {
  const b: unknown = req.body;
  return typeof b === "object" && b !== null ? (b as Record<string, unknown>) : {};
}

function param(req: Request, name: string): string {
  const v: string | string[] | undefined = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function actor(req: Request): string {
  return parseActor(req.headers["x-staff-id"]);
}

type Handler = (req: Request, res: Response) => Promise<void>;

function wrap(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export function createHttpApp(service: ShelterService, mailbox: FakeMailSender) {
  const app = express();
  app.use(express.json());

  app.post("/animals", wrap(async (req, res) => {
    const b = body(req);
    res.status(201).json(
      await service.registerAnimal(actor(req), {
        species: b.species,
        name: b.name,
        estimatedAgeYears: b.estimatedAgeYears,
        intakeDate: b.intakeDate,
        medicalNotes: b.medicalNotes,
      }),
    );
  }));
  app.get("/animals", wrap(async (_req, res) => {
    res.json(await service.listAnimals());
  }));
  app.get("/animals/:id", wrap(async (req, res) => {
    res.json(await service.getAnimal(param(req, "id")));
  }));
  app.post("/animals/:id/ready", wrap(async (req, res) => {
    res.json(await service.markReadyForAdoption(actor(req), param(req, "id")));
  }));
  app.post("/animals/:id/applications", wrap(async (req, res) => {
    const b = body(req);
    res.status(201).json(
      await service.submitApplication(actor(req), param(req, "id"), b.applicant, b.household),
    );
  }));
  app.get("/animals/:id/audit", wrap(async (req, res) => {
    res.json(await service.listAnimalAudit(param(req, "id")));
  }));
  app.get("/staff/:staffId/audit", wrap(async (req, res) => {
    res.json(await service.listStaffAudit(param(req, "staffId"), req.query.from, req.query.to));
  }));
  app.get("/animals/:id/applications", wrap(async (req, res) => {
    res.json(await service.listApplicationsForAnimal(param(req, "id")));
  }));
  app.get("/applications/:id", wrap(async (req, res) => {
    res.json(await service.getApplication(param(req, "id")));
  }));
  app.post("/applications/:id/approve", wrap(async (req, res) => {
    res.json(await service.approve(actor(req), param(req, "id")));
  }));
  app.post("/applications/:id/reject", wrap(async (req, res) => {
    res.json(await service.reject(actor(req), param(req, "id")));
  }));
  app.post("/carers", wrap(async (req, res) => {
    res.status(201).json(await service.registerCarer(body(req)));
  }));
  app.get("/carers", wrap(async (_req, res) => {
    res.json(await service.listCarers());
  }));
  app.get("/carers/:id", wrap(async (req, res) => {
    res.json(await service.getCarer(param(req, "id")));
  }));
  app.get("/carers/:id/placements", wrap(async (req, res) => {
    res.json(await service.listPlacementsForCarer(param(req, "id")));
  }));
  app.post("/animals/:id/placements", wrap(async (req, res) => {
    res.status(201).json(await service.placeAnimal(actor(req), param(req, "id"), body(req).carerId));
  }));
  app.get("/animals/:id/placement", wrap(async (req, res) => {
    res.json(await service.getActivePlacementForAnimal(param(req, "id")));
  }));
  app.get("/placements/:id", wrap(async (req, res) => {
    res.json(await service.getPlacement(param(req, "id")));
  }));
  app.post("/placements/:id/end", wrap(async (req, res) => {
    res.json(await service.endPlacementById(actor(req), param(req, "id")));
  }));
  app.get("/notifications", wrap(async (_req, res) => {
    res.json(await service.listNotifications());
  }));
  app.get("/notifications/:id", wrap(async (req, res) => {
    res.json(await service.getNotification(param(req, "id")));
  }));
  app.post("/webhooks/textbridge", wrap(async (req, res) => {
    await service.handleDeliveryReport(req.body);
    res.status(200).json({ ok: true });
  }));
  app.get("/mail/outbox", (_req, res) => {
    res.json(mailbox.sent());
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else if (err instanceof ConflictError) {
      res.status(409).json({ error: err.message });
    } else if (err instanceof SyntaxError) {
      res.status(400).json({ error: "malformed JSON body" });
    } else {
      res.status(500).json({ error: "internal server error" });
    }
  });

  return app;
}
