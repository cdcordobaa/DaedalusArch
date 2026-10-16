import express, { NextFunction, Request, Response } from "express";
import {
  ConflictError, ExternalServiceError, ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError,
} from "../../domain/errors";
import { Actor } from "../../domain/model";
import { RepairCafeUseCases } from "../../application/ports";

function ticketParam(req: Request): number {
  const n = Number(req.params.ticketNumber);
  if (!Number.isInteger(n)) throw new ValidationError("ticket number must be an integer");
  return n;
}

function actorOf(req: Request): Actor {
  const fixerId = req.header("X-Fixer-Id")?.trim();
  const venue = req.header("X-Venue")?.trim();
  if (!fixerId || !venue) throw new UnauthenticatedError("X-Fixer-Id and X-Venue headers are required");
  return { fixerId, venue };
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

export function createHttpApp(app: RepairCafeUseCases): express.Express {
  const server = express();
  server.use(express.json());
  const body = (req: Request): Record<string, unknown> =>
    (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

  server.post("/events", wrap(async (req, res) => {
    const b = body(req);
    res.status(201).json(await app.createEvent({ date: b.date, venue: b.venue, opensAt: b.opensAt, closesAt: b.closesAt }));
  }));
  server.get("/events", wrap(async (_req, res) => { res.json(await app.listEvents()); }));
  server.get("/events/:eventId", wrap(async (req, res) => {
    res.json(await app.getEvent(String(req.params.eventId)));
  }));

  server.post("/events/:eventId/fixers", wrap(async (req, res) => {
    const b = body(req);
    res.status(201).json(await app.addFixer({ eventId: String(req.params.eventId), name: b.name, categories: b.categories }));
  }));
  server.get("/events/:eventId/fixers", wrap(async (req, res) => {
    res.json(await app.listFixers(String(req.params.eventId)));
  }));

  server.get("/events/:eventId/leaderboard", wrap(async (req, res) => {
    res.json(await app.leaderboard(String(req.params.eventId)));
  }));

  server.post("/events/:eventId/items", wrap(async (req, res) => {
    const b = body(req);
    const item = await app.registerItem({
      eventId: String(req.params.eventId), category: b.category, brand: b.brand, model: b.model,
      problem: b.problem, visitorName: b.visitorName, visitorMobile: b.visitorMobile,
    });
    res.status(201).json(item);
  }));
  server.get("/events/:eventId/items", wrap(async (req, res) => {
    res.json(await app.listItems(String(req.params.eventId)));
  }));
  server.get("/items/:ticketNumber", wrap(async (req, res) => {
    res.json(await app.getItem(ticketParam(req)));
  }));
  server.post("/items/:ticketNumber/complete", wrap(async (req, res) => {
    const b = body(req);
    res.json(await app.completeRepair({ actor: actorOf(req), ticketNumber: ticketParam(req), outcome: b.outcome, weightKg: b.weightKg }));
  }));

  server.get("/items/:ticketNumber/parts", wrap(async (req, res) => {
    res.json(await app.searchParts(ticketParam(req)));
  }));
  server.post("/items/:ticketNumber/part-orders", wrap(async (req, res) => {
    const b = body(req);
    res.status(201).json(await app.orderPart({ actor: actorOf(req), ticketNumber: ticketParam(req), partId: b.partId }));
  }));
  server.post("/webhooks/sparebox/shipped", wrap(async (req, res) => {
    const b = body(req);
    res.json(await app.partShipped({ orderNumber: b.orderNumber }));
  }));

  server.get("/venues/:venue/sms", wrap(async (req, res) => {
    res.json(await app.getSmsEnabled(req.params.venue));
  }));
  server.put("/venues/:venue/sms", wrap(async (req, res) => {
    res.json(await app.setSmsEnabled(req.params.venue, body(req).enabled));
  }));
  server.get("/venues/:venue/door-messages", wrap(async (req, res) => {
    res.json(await app.listDoorMessages(req.params.venue));
  }));

  server.post("/fixers/:fixerId/claim", wrap(async (req, res) => {
    const actor = actorOf(req);
    if (actor.fixerId !== String(req.params.fixerId)) throw new ForbiddenError("X-Fixer-Id does not match fixer");
    res.json(await app.claimNextItem(actor));
  }));

  server.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) res.status(400).json({ error: err.message });
    else if (err instanceof UnauthenticatedError) res.status(401).json({ error: err.message });
    else if (err instanceof ForbiddenError) res.status(403).json({ error: err.message });
    else if (err instanceof NotFoundError) res.status(404).json({ error: err.message });
    else if (err instanceof ConflictError) res.status(409).json({ error: err.message });
    else if (err instanceof ExternalServiceError) res.status(502).json({ error: err.message });
    else if (err instanceof SyntaxError) res.status(400).json({ error: "invalid JSON" });
    else {
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  });
  return server;
}
