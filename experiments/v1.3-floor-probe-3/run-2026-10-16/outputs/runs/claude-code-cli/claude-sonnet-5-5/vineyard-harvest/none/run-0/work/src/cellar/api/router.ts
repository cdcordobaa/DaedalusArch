import { Router } from "express";
import { isoDate, num, str } from "../../shared/http.js";
import { weighingFromScaleLink } from "../acl/scalelink.js";
import type { CellarService } from "../application/cellar-service.js";

export function cellarRouter(svc: CellarService): Router {
  const r = Router();

  // Webhook called by the ScaleLink weighbridge.
  r.post("/webhooks/scalelink", (req, res) => {
    res.status(202).json(svc.recordWeighing(weighingFromScaleLink(req.body)));
  });

  // Cellar staff correction of a bin's weight; replaces the first weighing.
  r.put("/bins/:tag/weighing", (req, res) => {
    const b = req.body ?? {};
    const time = b.time === undefined ? undefined : str(b.time, "time");
    res.json(svc.correctWeighing(Number(req.params.tag), num(b.grossKg, "grossKg"), time));
  });

  r.post("/bins/:tag/sugar", (req, res) => {
    const b = req.body ?? {};
    const date = b.date === undefined ? undefined : isoDate(b.date, "date");
    res.status(201).json(svc.recordSugar(Number(req.params.tag), num(b.brix, "brix"), date));
  });

  r.put("/varieties/:variety/minimum-sugar", (req, res) => {
    svc.setMinimumBrix(str(req.params.variety, "variety"), num((req.body ?? {}).minimumBrix, "minimumBrix"));
    res.json(svc.listRules());
  });
  r.get("/varieties/minimum-sugar", (_req, res) => {
    res.json(svc.listRules());
  });

  r.put("/rfid-chips/:chip", (req, res) => {
    svc.linkRfid(str(req.params.chip, "chip"), num((req.body ?? {}).tag, "tag"));
    res.json(svc.listRfidLinks());
  });
  r.get("/rfid-chips", (_req, res) => {
    res.json(svc.listRfidLinks());
  });
  r.get("/weighings/unlinked", (_req, res) => {
    res.json(svc.listUnlinkedWeighings());
  });

  r.get("/weighings",(_req, res) => {
    res.json(svc.listWeighings());
  });
  r.get("/intakes", (_req, res) => {
    res.json(svc.listIntakes());
  });

  return r;
}
