import type { EventBus } from '../../shared-kernel/EventBus';
import type { SurveyBooked } from '../../surveys/contracts/events';
import type { PilotRepository } from '../domain/pilot/PilotRepository';
import type { PilotService } from './PilotService';

export function registerAutoAssign(
  bus: EventBus,
  pilots: PilotRepository,
  service: PilotService,
  defaultHours: number,
): void {
  bus.subscribe<SurveyBooked>('SurveyBooked', (event) => {
    const [leastLoaded] = pilots.findAll().sort((a, b) => a.assignedHours - b.assignedHours);
    if (leastLoaded) {
      service.assignToSurvey(leastLoaded.id, event.surveyId, defaultHours);
    }
  });
}
