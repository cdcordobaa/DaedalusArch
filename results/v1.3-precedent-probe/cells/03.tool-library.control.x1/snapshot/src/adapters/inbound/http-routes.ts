import { Router, type Request, type Response } from 'express';
import type { LendTool } from '../../application/lend-tool';
import type { RecordDamage } from '../../application/record-damage';
import type { RegisterTool } from '../../application/register-tool';
import type { ReturnTool } from '../../application/return-tool';

export interface ToolLibraryUseCases {
  readonly registerTool: RegisterTool;
  readonly lendTool: LendTool;
  readonly returnTool: ReturnTool;
  readonly recordDamage: RecordDamage;
}

function fail(res: Response, e: unknown): void {
  res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
}

export function toolRoutes(uc: ToolLibraryUseCases): Router {
  const r = Router();
  r.post('/tools', async (req: Request, res: Response) => {
    try {
      const body = req.body as { name: string; category: string };
      res.status(201).json(await uc.registerTool.execute(body.name, body.category));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/tools/:id/loans', async (req: Request, res: Response) => {
    try {
      const body = req.body as { memberId: string };
      res.status(201).json(await uc.lendTool.execute(String(req.params.id), body.memberId));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/tools/:id/return', async (req: Request, res: Response) => {
    try {
      res.json(await uc.returnTool.execute(String(req.params.id)));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/tools/:id/damage', async (req: Request, res: Response) => {
    try {
      const body = req.body as { description: string; repairFeeCents: number };
      res.status(201).json(await uc.recordDamage.execute(String(req.params.id), body.description, body.repairFeeCents));
    } catch (e) {
      fail(res, e);
    }
  });
  return r;
}
