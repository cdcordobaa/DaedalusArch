import { Router, type Request, type Response } from 'express';
import type { CancelRehearsal } from '../../application/cancel-rehearsal';
import type { RecordAttendance } from '../../application/record-attendance';
import type { ScheduleRehearsal } from '../../application/schedule-rehearsal';
import type { Section } from '../../domain/singer';

export interface ChoirUseCases {
  readonly scheduleRehearsal: ScheduleRehearsal;
  readonly recordAttendance: RecordAttendance;
  readonly cancelRehearsal: CancelRehearsal;
}

function fail(res: Response, e: unknown): void {
  res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
}

export function choirRoutes(uc: ChoirUseCases): Router {
  const r = Router();
  r.post('/rehearsals', async (req: Request, res: Response) => {
    try {
      const b = req.body as { sections: Section[]; startsAt: string; venue: string };
      res.status(201).json(await uc.scheduleRehearsal.execute(b.sections, new Date(b.startsAt), b.venue));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/rehearsals/:id/attendance', async (req: Request, res: Response) => {
    try {
      const b = req.body as { singerIds: string[] };
      res.json({ attended: await uc.recordAttendance.execute(String(req.params.id), b.singerIds) });
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/rehearsals/:id/cancel', async (req: Request, res: Response) => {
    try {
      const b = req.body as { reason: string };
      res.json({ notified: await uc.cancelRehearsal.execute(String(req.params.id), b.reason) });
    } catch (e) {
      fail(res, e);
    }
  });
  return r;
}
