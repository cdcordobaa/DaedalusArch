import type { EventBus } from '../../shared-kernel/EventBus';
import type { PermitGranted } from '../../permits/contracts/events';
import type { PilotAssigned } from '../../pilots/contracts/events';
import type { SurveyService } from './SurveyService';

export function registerSurveyHandlers(bus: EventBus, service: SurveyService): void {
  bus.subscribe<PermitGranted>('PermitGranted', (event) => service.markPermitted(event.surveyId));
  bus.subscribe<PilotAssigned>('PilotAssigned', (event) => service.recordPilot(event.surveyId, event.pilotId));
}
