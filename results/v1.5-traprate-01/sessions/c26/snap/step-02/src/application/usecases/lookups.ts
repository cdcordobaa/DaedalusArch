import type { DeliveryJob } from '../../domain/DeliveryJob';
import { DispatchRefusal } from '../../domain/DispatchRefusal';
import type { Rider } from '../../domain/Rider';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderRoster } from '../ports/out/RiderRoster';

export function requireJob(ledger: JobLedger, jobId: string): DeliveryJob {
  const job = ledger.find(jobId);
  if (job === undefined) throw new DispatchRefusal(`no job ${jobId}`);
  return job;
}

export function requireRider(roster: RiderRoster, riderId: string): Rider {
  const rider = roster.find(riderId);
  if (rider === undefined) throw new DispatchRefusal(`no rider ${riderId}`);
  return rider;
}

/** The job a rider currently holds, if any. */
export function jobHeldBy(ledger: JobLedger, riderId: string): DeliveryJob | undefined {
  return ledger.list().find((j) => j.holdsRider && j.riderId === riderId);
}
