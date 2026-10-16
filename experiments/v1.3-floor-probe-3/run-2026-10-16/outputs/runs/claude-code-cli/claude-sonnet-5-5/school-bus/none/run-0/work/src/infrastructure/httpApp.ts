import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { BusTrackingService } from "../application/busTrackingService.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { Trip } from "../domain/pupil.js";

export function createHttpApp(service: BusTrackingService): express.Express {
  const app = express();
  app.use(express.json());

  app.post("/routes", (req: Request, res: Response) => {
    res.status(201).json(service.createRoute(req.body?.name, req.body?.stops));
  });
  app.get("/routes", (_req: Request, res: Response) => {
    res.json(service.listRoutes());
  });
  app.get("/routes/:id", (req: Request, res: Response) => {
    res.json(service.getRoute(String(req.params["id"])));
  });

  app.post("/pupils", (req: Request, res: Response) => {
    res.status(201).json(service.createPupil(req.body ?? {}));
  });
  app.get("/pupils", (_req: Request, res: Response) => {
    res.json(service.listPupils());
  });
  app.get("/pupils/:id", (req: Request, res: Response) => {
    res.json(service.getPupil(String(req.params["id"])));
  });
  app.get("/pupils/:id/eta", (req: Request, res: Response) => {
    const trip = String(req.query["trip"] ?? "morning") as Trip;
    res.json(service.getEta(String(req.params["id"]), trip));
  });

  app.put("/units/:unitId/route", (req: Request, res: Response) => {
    const run = service.linkUnit(String(req.params["unitId"]), req.body?.routeId, req.body?.date);
    res.json({ unitId: run.unitId, routeId: run.routeId, date: run.date });
  });

  app.post("/routes/:id/cancellations", (req: Request, res: Response) => {
    res.status(201).json(service.cancelTrip(String(req.params["id"]), req.body?.trip, req.body?.date));
  });

  app.post("/routes/:id/delay-mutes", (req: Request, res: Response) => {
    res.status(201).json(service.muteDelays(String(req.params["id"])));
  });

  app.post("/webhooks/trackbus", (req: Request, res: Response) => {
    const linked = service.recordPosition(req.body ?? {});
    res.status(202).json({ accepted: true, linked });
  });

  app.post("/webhooks/cardtap", (req: Request, res: Response) => {
    res.status(202).json(service.recordTap(req.body ?? {}));
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else if (err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  });

  return app;
}
