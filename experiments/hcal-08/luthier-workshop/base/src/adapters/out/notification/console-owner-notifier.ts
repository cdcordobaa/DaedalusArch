import { OwnerNotifierPort } from '../../../application/ports/out/owner-notifier.port';
import { JobStatus } from '../../../domain/job-status';

export class ConsoleOwnerNotifier implements OwnerNotifierPort {
  async notify(ownerId: string, jobId: string, status: JobStatus): Promise<void> {
    console.log(`owner ${ownerId}: repair job ${jobId} is ${status}`);
  }
}
