import { Router } from "express";
import { isoDate, num, str } from "../../shared/http.js";
import type { PayService } from "../application/pay-service.js";
import type { PickingService } from "../application/picking-service.js";

export function pickingRouter(svc: PickingService, pay: PayService): Router {
  const r = Router();

  r.post("/pickers", (req, res) => {
    const b = req.body ?? {};
    res.status(201).json(svc.registerPicker(str(b.name, "name"), str(b.phone, "phone"), num(b.hourlyRate, "hourlyRate")));
  });
  r.get("/pickers", (_req, res) => {
    res.json(svc.listPickers());
  });

  r.post("/blocks", (req, res) => {
    const b = req.body ?? {};
    res.status(201).json(
      svc.registerBlock(str(b.name, "name"), str(b.grapeVariety, "grapeVariety"), num(b.areaHectares, "areaHectares")),
    );
  });
  r.get("/blocks", (_req, res) => {
    res.json(svc.listBlocks());
  });

  r.post("/days/:date/assignments", (req, res) => {
    const b = req.body ?? {};
    const date = isoDate(req.params.date, "date");
    svc.assignPicker(date, str(b.pickerId, "pickerId"), str(b.blockId, "blockId"));
    res.status(201).json(svc.getDay(date));
  });
  r.post("/days/:date/bins", (req, res) => {
    const b = req.body ?? {};
    const bin = svc.recordBin(
      isoDate(req.params.date, "date"),
      num(b.tag, "tag"),
      str(b.blockId, "blockId"),
      str(b.pickerId, "pickerId"),
      b.binType === undefined ? undefined : str(b.binType, "binType"),
    );
    res.status(201).json(bin);
  });
  r.put("/days/:date/hours/:pickerId", (req, res) => {
    const date = isoDate(req.params.date, "date");
    const pickerId = str(req.params.pickerId, "pickerId");
    res.json(pay.recordHours(date, pickerId, num((req.body ?? {}).hours, "hours")));
  });

  r.get("/pay/rules", (_req, res) => {
    res.json(pay.getRules());
  });
  r.put("/pay/piece-rate", (req, res) => {
    res.json(pay.setPieceRate(num((req.body ?? {}).pieceRatePerKg, "pieceRatePerKg")));
  });
  r.put("/pay/bin-types/:binType", (req, res) => {
    res.json(pay.setBinTare(str(req.params.binType, "binType"), num((req.body ?? {}).tareKg, "tareKg")));
  });
  r.get("/pay/weeks/:week", (req, res) => {
    res.json(pay.weekStatements(isoDate(req.params.week, "week")));
  });
  r.get("/pay/weeks/:week/pickers/:pickerId", (req, res) => {
    res.json(pay.statement(str(req.params.pickerId, "pickerId"), isoDate(req.params.week, "week")));
  });
  r.post("/pay/weeks/:week/approve", (req, res) => {
    res.status(201).json(pay.approve(isoDate(req.params.week, "week")));
  });
  r.get("/days/:date", (req, res) => {
    res.json(svc.getDay(isoDate(req.params.date, "date")));
  });

  return r;
}
