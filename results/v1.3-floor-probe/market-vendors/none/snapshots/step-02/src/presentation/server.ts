import express, { NextFunction, Request, Response } from 'express';
import { BusinessError } from '../business/models';
import { router } from './routes';

const app = express();
app.use(express.json());
app.use(router);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof BusinessError ? err.status : 500;
  res.status(status).json({ error: err.message });
});

app.listen(Number(process.env.PORT ?? 3000), () => console.log('market service listening'));
