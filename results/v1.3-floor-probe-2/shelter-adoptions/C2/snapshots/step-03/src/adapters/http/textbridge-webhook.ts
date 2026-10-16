import express, { Router } from 'express';
import { DeliveryReports } from '../../ports/in/notifications';

/** TextBridge calls this with { messageId, status: 'delivered' | 'failed' }. */
export function textBridgeWebhook(reports: DeliveryReports): Router {
  const r = express.Router();
  r.post('/webhooks/textbridge', (req, res) => {
    const { messageId, status } = req.body as { messageId: string; status: string };
    const n = reports.reportDelivery(messageId, status === 'delivered');
    res.status(n ? 200 : 404).json(n ?? { error: 'unknown message' });
  });
  r.get('/notifications', (_req, res) => { res.json(reports.listNotifications()); });
  return r;
}
