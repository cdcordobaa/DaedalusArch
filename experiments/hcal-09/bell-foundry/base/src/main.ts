import { CommissionController } from './adapters/in/http/commission.controller';
import { IngotlineDispatchHandler } from './adapters/in/webhook/ingotline-dispatch.handler';
import { MailParishNotifier } from './adapters/out/notification/mail-parish-notifier';
import { InMemoryCommissionRepository } from './adapters/out/persistence/in-memory-commission.repository';
import { IngotlineAlloyGateway } from './adapters/out/supply/ingotline-alloy.gateway';
import { OrderMetalUseCase } from './application/order-metal.use-case';
import { RecordDispatchUseCase } from './application/record-dispatch.use-case';
import { RecordTuningUseCase } from './application/record-tuning.use-case';

const commissions = new InMemoryCommissionRepository();
const notifier = new MailParishNotifier();
const orderMetal = new OrderMetalUseCase(commissions, new IngotlineAlloyGateway('demo-token'), notifier);
const recordDispatch = new RecordDispatchUseCase(commissions, notifier);
const recordTuning = new RecordTuningUseCase(commissions);

export const commissionController = new CommissionController(orderMetal, recordTuning);
export const ingotlineDispatches = new IngotlineDispatchHandler(recordDispatch);
