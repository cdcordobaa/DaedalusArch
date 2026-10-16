import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AnimalService } from "../../application/animal-service.js";
import type { ApplicationService } from "../../application/application-service.js";
import type { AuditService } from "../../application/audit-service.js";
import type { FosterService } from "../../application/foster-service.js";
import type { NotificationService } from "../../application/notification-service.js";
import { parseChannel } from "../../domain/notification.js";
import type { MailMessage } from "../../application/ports.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors.js";

export interface HttpDeps {
  animals: AnimalService;
  applications: ApplicationService;
  foster: FosterService;
  notifications: NotificationService;
  audit: AuditService;
  sentMail: () => MailMessage[];
  sentSms: () => unknown[];
}

type Json = Record<string, unknown>;

async function readJson(req: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Body is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError("Body must be a JSON object");
  }
  return parsed as Json;
}

function str(obj: Json, key: string, required = true): string {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(`${key} is required`);
    return "";
  }
  if (typeof v !== "string") throw new ValidationError(`${key} must be a string`);
  return v;
}

function num(obj: Json, key: string): number {
  const v = obj[key];
  if (typeof v !== "number") throw new ValidationError(`${key} must be a number`);
  return v;
}

function obj(parent: Json, key: string): Json {
  const v = parent[key];
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new ValidationError(`${key} must be an object`);
  }
  return v as Json;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function route(deps: HttpDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const method = req.method ?? "GET";
  const [root, id, action] = parts;
  const header = req.headers["x-staff-id"];
  const actor = (Array.isArray(header) ? header[0] : header)?.trim() || "anonymous";

  if (root === "staff" && action === "audit" && parts.length === 3 && method === "GET") {
    return send(
      res,
      200,
      await deps.audit.listForActor(
        id!,
        url.searchParams.get("from") ?? undefined,
        url.searchParams.get("to") ?? undefined,
      ),
    );
  }

  if (root === "animals") {
    if (parts.length === 1 && method === "POST") {
      const b = await readJson(req);
      const animal = await deps.animals.register({
        species: str(b, "species"),
        name: str(b, "name"),
        estimatedAgeMonths: num(b, "estimatedAgeMonths"),
        intakeDate: str(b, "intakeDate"),
        medicalNotes: str(b, "medicalNotes", false),
      }, actor);
      return send(res, 201, animal);
    }
    if (parts.length === 3 && action === "audit" && method === "GET") {
      return send(res, 200, await deps.audit.listForAnimal(id!));
    }
    if (parts.length === 1 && method === "GET") return send(res, 200, await deps.animals.list());
    if (parts.length === 2 && method === "GET") return send(res, 200, await deps.animals.get(id!));
    if (parts.length === 3 && action === "ready" && method === "POST") {
      return send(res, 200, await deps.animals.markReadyForAdoption(id!, actor));
    }
  }

  if (root === "applications") {
    if (parts.length === 1 && method === "POST") {
      const b = await readJson(req);
      const a = obj(b, "applicant");
      const h = obj(b, "household");
      const created = await deps.applications.submit({
        animalId: str(b, "animalId"),
        applicant: {
          name: str(a, "name"),
          email: str(a, "email"),
          phone: str(a, "phone"),
          notificationChannel: parseChannel(a["notificationChannel"]),
        },
        household: {
          adults: num(h, "adults"),
          children: num(h, "children"),
          hasOtherPets: h["hasOtherPets"] === true,
          homeType: str(h, "homeType", false),
          notes: str(h, "notes", false),
        },
      }, actor);
      return send(res, 201, created);
    }
    if (parts.length === 1 && method === "GET") return send(res, 200, await deps.applications.list());
    if (parts.length === 2 && method === "GET") return send(res, 200, await deps.applications.get(id!));
    if (parts.length === 3 && method === "POST" && action === "approve") {
      return send(res, 200, await deps.applications.approve(id!, actor));
    }
    if (parts.length === 3 && method === "POST" && action === "reject") {
      return send(res, 200, await deps.applications.reject(id!, actor));
    }
  }

  if (root === "foster-carers") {
    if (parts.length === 1 && method === "POST") {
      const b = await readJson(req);
      const species = b["species"];
      if (!Array.isArray(species) || species.some((s) => typeof s !== "string")) {
        throw new ValidationError("species must be an array of strings");
      }
      const carer = await deps.foster.registerCarer({
        name: str(b, "name"),
        email: str(b, "email"),
        phone: str(b, "phone"),
        notificationChannel: parseChannel(b["notificationChannel"]),
        capacity: num(b, "capacity"),
        species: species as string[],
      });
      return send(res, 201, carer);
    }
    if (parts.length === 1 && method === "GET") return send(res, 200, await deps.foster.listCarers());
    if (parts.length === 2 && method === "GET") return send(res, 200, await deps.foster.getCarer(id!));
    if (parts.length === 3 && action === "placements" && method === "GET") {
      return send(res, 200, await deps.foster.listCarerPlacements(id!));
    }
  }

  if (root === "placements") {
    if (parts.length === 1 && method === "POST") {
      const b = await readJson(req);
      return send(res, 201, await deps.foster.place(str(b, "animalId"), str(b, "carerId"), actor));
    }
    if (parts.length === 1 && method === "GET") return send(res, 200, await deps.foster.list());
    if (parts.length === 2 && method === "GET") return send(res, 200, await deps.foster.get(id!));
    if (parts.length === 3 && action === "end" && method === "POST") {
      return send(res, 200, await deps.foster.end(id!, actor));
    }
  }

  if (root === "mail" && parts.length === 1 && method === "GET") {
    return send(res, 200, deps.sentMail());
  }

  if (root === "sms" && parts.length === 1 && method === "GET") {
    return send(res, 200, deps.sentSms());
  }

  if (root === "notifications") {
    if (parts.length === 1 && method === "GET") {
      return send(res, 200, await deps.notifications.list(url.searchParams.get("status") ?? undefined));
    }
    if (parts.length === 2 && method === "GET") return send(res, 200, await deps.notifications.get(id!));
  }

  // TextBridge delivery reports
  if (root === "webhooks" && id === "textbridge" && parts.length === 2 && method === "POST") {
    const b = await readJson(req);
    const messageId = b["messageId"] ?? b["id"];
    if (typeof messageId !== "string" || !messageId) throw new ValidationError("messageId is required");
    const status = String(b["status"] ?? "").toLowerCase();
    let outcome: "delivered" | "failed";
    if (status === "delivered") outcome = "delivered";
    else if (status === "failed" || status === "undelivered") outcome = "failed";
    else throw new ValidationError("status must be 'delivered' or 'failed'");
    const reason = typeof b["reason"] === "string" ? b["reason"] : undefined;
    await deps.notifications.handleDeliveryReport({ messageId, status: outcome, ...(reason ? { reason } : {}) });
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: "Route not found" });
}

export function createHttpServer(deps: HttpDeps): Server {
  return createServer((req, res) => {
    route(deps, req, res).catch((err: unknown) => {
      if (err instanceof ValidationError) return send(res, 400, { error: err.message });
      if (err instanceof NotFoundError) return send(res, 404, { error: err.message });
      if (err instanceof ConflictError) return send(res, 409, { error: err.message });
      send(res, 500, { error: "Internal server error" });
    });
  });
}
