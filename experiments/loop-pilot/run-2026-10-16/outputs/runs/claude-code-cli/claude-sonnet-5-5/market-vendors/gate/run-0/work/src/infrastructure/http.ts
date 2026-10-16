import express, { NextFunction, Request, Response } from "express";
import { MarketService, UNKNOWN_ACTOR } from "../application/market-service";
import { DomainError } from "../domain/errors";

const STATUS = { validation: 400, "not-found": 404, conflict: 409, rejected: 422 } as const;

export function createApp(service: MarketService) {
  const app = express();
  app.use(express.json());

  const body = (req: Request): Record<string, unknown> =>
    typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
  const actor = (req: Request): string => {
    const h = req.header("x-organiser-id")?.trim();
    return h ? h : UNKNOWN_ACTOR;
  };
  const param =(req: Request, name: string): string => String(req.params[name]);

  app.post("/market-days", (req, res) => { res.status(201).json(service.createMarketDay(body(req))); });
  app.get("/market-days", (_req, res) => { res.json(service.listMarketDays()); });

  app.post("/pitches", (req, res) => { res.status(201).json(service.createPitch(body(req))); });
  app.get("/pitches", (_req, res) => { res.json(service.listPitches()); });

  app.post("/vendors", (req, res) => { res.status(201).json(service.registerVendor(body(req))); });
  app.get("/vendors", (_req, res) => { res.json(service.listVendors()); });
  app.get("/vendors/:vendorId", (req, res) => { res.json(service.getVendor(param(req, "vendorId"))); });
  app.get("/vendors/:vendorId/sales", (req, res) => { res.json(service.listVendorSales(param(req, "vendorId"))); });

  app.post("/market-days/:dayId/bookings", (req, res) => {
    res.status(201).json(service.bookPitch(param(req, "dayId"), body(req), actor(req)));
  });
  app.get("/market-days/:dayId/bookings", (req, res) => { res.json(service.listBookings(param(req, "dayId"))); });
  app.post("/market-days/:dayId/merchants", (req, res) => {
    res.status(201).json(service.linkMerchant(param(req, "dayId"), body(req)));
  });
  app.post("/market-days/:dayId/readers", (req, res) => {
    res.status(201).json(service.linkReader(param(req, "dayId"), body(req)));
  });

  app.delete("/market-days/:dayId/bookings/:bookingId", (req, res) => {
    res.json(service.cancelBooking(param(req, "dayId"), param(req, "bookingId"), actor(req)));
  });
  app.post("/market-days/:dayId/close", (req, res) => { res.json(service.closeMarketDay(param(req, "dayId"))); });
  app.post("/market-days/:dayId/settlement", (req, res) => {
    res.status(201).json(service.settleMarketDay(param(req, "dayId"), actor(req)));
  });
  app.get("/market-days/:dayId/settlement", (req, res) => { res.json(service.listSettlements(param(req, "dayId"))); });

  app.get("/market-days/:dayId/audit", (req, res) => { res.json(service.listAuditLog(param(req, "dayId"))); });

  const sendStatement = (req: Request, res: Response, month: unknown) => {
    const vendorId = param(req, "vendorId");
    const statement = service.getMonthlyStatement(vendorId, month);
    res.setHeader("Content-Disposition", `attachment; filename="statement-${vendorId}-${statement.month}.json"`);
    res.json(statement);
  };
  app.get("/vendors/:vendorId/statements/:month", (req, res) => { sendStatement(req, res, param(req, "month")); });
  app.get("/vendors/:vendorId/statement", (req, res) => { sendStatement(req, res, req.query.month); });

  app.get("/fees", (_req, res) => { res.json(service.getFees()); });
  app.put("/fees", (req, res) => { res.json(service.setFees(body(req), actor(req))); });
  app.put("/vendors/:vendorId/commission", (req, res) => {
    res.json(service.setCommissionRate(param(req, "vendorId"), body(req), actor(req)));
  });
  app.get("/vendors/:vendorId/balance", (req, res) => { res.json(service.getBalance(param(req, "vendorId"))); });

  // PayLane webhook: { readerId, amount, time }
  app.post("/webhooks/paylane", (req, res) => { res.status(201).json(service.recordSale(body(req))); });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DomainError) {
      res.status(STATUS[err.kind]).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "invalid JSON" });
      return;
    }
    res.status(500).json({ error: "internal error" });
  });
  return app;
}
