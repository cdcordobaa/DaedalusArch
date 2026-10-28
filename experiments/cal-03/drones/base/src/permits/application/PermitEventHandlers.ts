import type { EventBus } from '../../shared-kernel/EventBus';
import type { SurveyBooked } from '../../surveys/contracts/events';
import type { PermitService } from './PermitService';

export function registerPermitHandlers(bus: EventBus, service: PermitService): void {
  bus.subscribe<SurveyBooked>('SurveyBooked', (event) => {
    service.requestPermit(event.surveyId, event.windowStart, event.windowEnd);
  });
}
