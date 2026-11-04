import { HealthController } from './adapters/in/http/health.controller';
import { PilotageController } from './adapters/in/http/pilotage.controller';
import { TidewatchMovementHandler } from './adapters/in/feed/tidewatch-movement.handler';
import { ConsoleAgentNotifier } from './adapters/out/notification/console-agent-notifier';
import { InMemoryJobRepository } from './adapters/out/persistence/in-memory-job.repository';
import { seedJobs } from './adapters/out/persistence/seed-jobs';
import { SlotRequest } from './application/ports/out/tide-window.port';
import { RecordMovementUseCase } from './application/record-movement.use-case';
import { SchedulePilotageUseCase } from './application/schedule-pilotage.use-case';

const jobs = new InMemoryJobRepository(seedJobs());
const notifier = new ConsoleAgentNotifier();
const tides = {
  async requestSlot(request: SlotRequest) {
    const { TidewatchWindowGateway } = await import('./adapters/out/tides/tidewatch-window.gateway');
    return new TidewatchWindowGateway('demo-token').requestSlot(request);
  },
};
const schedulePilotage = new SchedulePilotageUseCase(jobs, tides, notifier);
const recordMovement = new RecordMovementUseCase(jobs, notifier);

export const health = new HealthController();
export const pilotageController = new PilotageController(schedulePilotage);
export const tidewatchMovements = new TidewatchMovementHandler(recordMovement);
