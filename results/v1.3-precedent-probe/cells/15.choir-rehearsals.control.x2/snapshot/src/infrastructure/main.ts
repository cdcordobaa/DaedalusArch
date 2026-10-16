import express from 'express';
import { CancelRehearsal } from '../application/cancel-rehearsal';
import { RecordAttendance } from '../application/record-attendance';
import { RescheduleRehearsal } from '../application/reschedule-rehearsal';
import { ScheduleRehearsal } from '../application/schedule-rehearsal';
import { choirRoutes } from './http/routes';
import { InMemoryRehearsalRepository } from './persistence/in-memory-rehearsal-repository';
import { InMemorySingerRepository } from './persistence/in-memory-singer-repository';
import { TextToneSmsSender } from './sms/text-tone-sms-sender';

export function buildApp(): express.Express {
  const singers = new InMemorySingerRepository();
  const rehearsals = new InMemoryRehearsalRepository();
  const sms = new TextToneSmsSender();
  const app = express();
  app.use(express.json());
  app.use(
    choirRoutes({
      scheduleRehearsal: new ScheduleRehearsal(rehearsals),
      recordAttendance: new RecordAttendance(rehearsals),
      cancelRehearsal: new CancelRehearsal(rehearsals, singers, sms),
      rescheduleRehearsal: new RescheduleRehearsal(rehearsals, singers, sms),
    }),
  );
  return app;
}

if (require.main === module) {
  buildApp().listen(3000, () => console.log('choir on :3000'));
}
