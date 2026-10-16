import { Express } from 'express';
import { Notifier } from '../../../application/notifier';

export function textBridgeRoutes(app: Express, notifier: Notifier): void {
  app.post('/webhooks/textbridge', (req, res) => {
    const body = req.body as { id?: string; status?: string };
    if (!body.id) { res.status(400).json({ error: 'missing id' }); return; }
    const n = notifier.deliveryReported(body.id, body.status === 'delivered');
    res.status(n ? 200 : 404).end();
  });
  app.get('/notifications', (_req, res) => {
    res.json(notifier.all().map((n) => ({ id: n.id, to: n.to.name, channel: n.channel, subject: n.subject, state: n.state, updatedAt: n.updatedAt })));
  });
}
