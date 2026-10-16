import express, { type NextFunction, type Request, type Response } from "express";
import { UNKNOWN_ACTOR, type MarketService } from "../application/market-service.js";
import { DomainError } from "../domain/errors.js";

const body = (req: Request): Record<string, unknown> => {
  const b: unknown = req.body;
  return typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
};

const param = (req: Request, name: string): string => {
  const v: unknown = req.params[name];
  return typeof v === "string" ? v : "";
};

const actorOf = (req: Request): string => {
  const v = req.header("x-organiser-id");
  return v !== undefined && v.trim() !== "" ? v.trim() : UNKNOWN_ACTOR;
};

export function createApp(service: MarketService): express.Express {
  const app = express();
  app.use(express.json());

  app.post("/market-days", (req, res) => {
    const b = body(req);
    res.status(201).json(service.createMarketDay({ date: b.date, name: b.name }));
  });
  app.get("/market-days", (_req, res) => {
    res.json(service.listMarketDays());
  });

  app.post("/pitches", (req, res) => {
    const b = body(req);
    res.status(201).json(service.createPitch({ number: b.number, size: b.size, hasPower: b.hasPower }));
  });
  app.get("/pitches", (_req, res) => {
    res.json(service.listPitches());
  });

  app.post("/vendors", (req, res) => {
    const b = body(req);
    res.status(201).json(
      service.registerVendor({ businessName: b.businessName, contact: b.contact, products: b.products, commissionRate: b.commissionRate }),
    );
  });
  app.get("/vendors", (_req, res) => {
    res.json(service.listVendors());
  });
  app.get("/vendors/:vendorId", (req, res) => {
    res.json(service.getVendor(param(req, "vendorId")));
  });

  app.post("/market-days/:dayId/bookings", (req, res) => {
    const b = body(req);
    res.status(201).json(service.bookPitch(param(req, "dayId"), { vendorId: b.vendorId, pitchId: b.pitchId }, actorOf(req)));
  });
  app.get("/market-days/:dayId/bookings", (req, res) => {
    res.json(service.listBookings(param(req, "dayId")));
  });

  app.delete("/market-days/:dayId/bookings/:bookingId", (req, res) => {
    res.json(service.cancelBooking(param(req, "dayId"), param(req, "bookingId"), actorOf(req)));
  });

  app.get("/fee-schedule", (_req, res) => {
    res.json(service.getFeeSchedule());
  });
  app.put("/fee-schedule", (req, res) => {
    const b = body(req);
    res.json(service.setFeeSchedule({ stallFees: b.stallFees, powerSurcharge: b.powerSurcharge }, actorOf(req)));
  });

  app.put("/vendors/:vendorId/commission", (req, res) => {
    res.json(service.setVendorCommission(param(req, "vendorId"), { rate: body(req).rate }, actorOf(req)));
  });
  app.get("/vendors/:vendorId/payouts", (req, res) => {
    res.json(service.listVendorPayouts(param(req, "vendorId")));
  });

  app.post("/market-days/:dayId/close", (req, res) => {
    res.json(service.closeMarketDay(param(req, "dayId")));
  });
  app.post("/market-days/:dayId/settlement", (req, res) => {
    res.status(201).json(service.settleMarketDay(param(req, "dayId"), actorOf(req)));
  });
  app.get("/market-days/:dayId/settlement", (req, res) => {
    res.json(service.getSettlement(param(req, "dayId")));
  });

  app.post("/market-days/:dayId/reader-links", (req, res) => {
    const b = body(req);
    res.status(201).json(service.linkReader(param(req, "dayId"), { readerId: b.readerId, vendorId: b.vendorId }));
  });

  app.post("/market-days/:dayId/merchant-links", (req, res) => {
    const b = body(req);
    res.status(201).json(service.linkMerchant(param(req, "dayId"), { merchantId: b.merchantId, vendorId: b.vendorId }));
  });

  app.post("/webhooks/paylane", (req, res) => {
    const b = body(req);
    res.status(201).json(service.recordSale({ readerId: b.readerId, amount: b.amount, time: b.time }));
  });

  app.get("/vendors/:vendorId/sales", (req, res) => {
    const day: unknown = req.query.marketDayId;
    res.json(service.listVendorSales(param(req, "vendorId"), typeof day === "string" ? day : undefined));
  });

  app.get("/market-days/:dayId/audit-log", (req, res) => {
    res.json(service.listAuditLog(param(req, "dayId")));
  });
  app.get("/audit-log", (_req, res) => {
    res.json(service.listAllAuditLog());
  });

  const sendStatement = (req: Request, res: Response, month: unknown): void => {
    const statement = service.getVendorStatement(param(req, "vendorId"), month);
    res.setHeader("Content-Disposition", `attachment; filename="statement-${statement.vendorId}-${statement.month}.json"`);
    res.json(statement);
  };
  app.get("/vendors/:vendorId/statements/:month", (req, res) => {
    sendStatement(req, res, param(req, "month"));
  });
  app.get("/vendors/:vendorId/statement", (req, res) => {
    sendStatement(req, res, req.query.month);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DomainError) {
      const status = err.kind === "not_found" ? 404 : err.kind === "conflict" ? 409 : 422;
      res.status(status).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "invalid JSON body" });
      return;
    }
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
