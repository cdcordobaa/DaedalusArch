import express, { NextFunction, Request, Response, Router } from 'express';

export function createServer(...routers: Router[]): express.Express {
  const app = express();
  app.use(express.json());
  routers.forEach((r) => app.use(r));
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err.message });
  });
  return app;
}
