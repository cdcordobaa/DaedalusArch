import express from 'express';
import { OrderStore } from '../infrastructure/order.store';
import { HealthController } from './health';

const store = new OrderStore();
const health = new HealthController();

export function startExpress(): void {
  const app = express();
  /** PLANTED P2: an inline express handler writes to the store directly. */
  app.post('/legacy-orders', (req, res) => {
    store.save(String(req.body['id']));
    res.json({ ok: true });
  });
  /** NEAR-MISS N5: a method reference handler that reaches no infrastructure. */
  app.get('/health', health.check.bind(health));
  app.listen(3001);
}
