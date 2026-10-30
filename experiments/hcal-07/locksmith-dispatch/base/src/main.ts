import { CallOutController } from './adapters/in/http/call-out.controller';
import { CrewClockWebhookHandler } from './adapters/in/webhook/crewclock-webhook.handler';
import { SmsCustomerNotifier } from './adapters/out/notification/sms-customer-notifier';
import { InMemoryCallOutRepository } from './adapters/out/persistence/in-memory-call-out.repository';
import { CrewClockSchedulingGateway } from './adapters/out/scheduling/crewclock-scheduling.gateway';
import { DispatchCallOutUseCase } from './application/dispatch-call-out.use-case';
import { RecordVisitUseCase } from './application/record-visit.use-case';

const callOuts = new InMemoryCallOutRepository();
const notifier = new SmsCustomerNotifier();
const dispatchCallOut = new DispatchCallOutUseCase(callOuts, new CrewClockSchedulingGateway('tenant-1', 'demo-secret'), notifier);
const recordVisit = new RecordVisitUseCase(callOuts, notifier);

export const callOutController = new CallOutController(dispatchCallOut);
export const crewClockWebhook = new CrewClockWebhookHandler(recordVisit);
