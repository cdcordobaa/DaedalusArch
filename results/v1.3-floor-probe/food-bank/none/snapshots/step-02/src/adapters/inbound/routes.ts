import { Router } from 'express';
import { FoodBankService } from '../../application/food-bank-service';

export function foodBankRoutes(service: FoodBankService): Router {
  const r = Router();
  r.post('/households', (req, res) => {
    res.status(201).json(service.registerHousehold(req.body));
  });
  r.get('/households', (_req, res) => {
    res.json(service.listHouseholds());
  });
  r.post('/inventory', (req, res) => {
    res.status(201).json(service.addItem(req.body));
  });
  r.get('/inventory', (_req, res) => {
    res.json(service.listInventory());
  });
  r.put('/households/:id/slot', (req, res) => {
    res.json(service.bookSlot(req.params.id, Number(req.body.weekday), Number(req.body.hour)));
  });
  r.post('/households/:id/pickups', (req, res) => {
    res.status(201).json(service.recordPickup(req.params.id, req.body.items ?? []));
  });
  return r;
}
