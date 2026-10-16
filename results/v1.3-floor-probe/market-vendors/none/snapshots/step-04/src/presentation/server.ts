import express, { NextFunction, Request, Response } from 'express';
import { BusinessError } from '../business/models';
import { router } from './routes';
import { salesService } from '../business/sales-service';

const app = express();
app.use(express.json());
app.use(router);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof BusinessError ? err.status : 500;
  res.status(status).json({ error: err.message });
});

// TillWave does not call us: poll every 15 minutes
setInterval(() => {
  salesService.pollTillWave().catch((e) => console.error('TillWave poll failed', e));
}, 15 * 60 * 1000);

app.listen(Number(process.env.PORT ?? 3000), () => console.log('market service listening'));
