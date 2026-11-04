import { InspectionController } from './adapters/in/http/inspection.controller';
import { PlacementController } from './adapters/in/http/placement.controller';
import { HivepulseTelemetryHandler } from './adapters/in/webhook/hivepulse-telemetry.handler';
import { SmsGrowerNotifier } from './adapters/out/notification/sms-grower-notifier';
import { InMemoryPlacementRepository } from './adapters/out/persistence/in-memory-placement.repository';
import { HivepulseLeaseGateway } from './adapters/out/sensors/hivepulse-lease.gateway';
import { PrepareDeliveryUseCase } from './application/prepare-delivery.use-case';
import { RecordInspectionUseCase } from './application/record-inspection.use-case';
import { RecordTelemetryUseCase } from './application/record-telemetry.use-case';

const placements = new InMemoryPlacementRepository();
const prepareDelivery = new PrepareDeliveryUseCase(placements, new HivepulseLeaseGateway('demo-apiary'), new SmsGrowerNotifier());
const recordTelemetry = new RecordTelemetryUseCase(placements);

export const inspections = new InspectionController(new RecordInspectionUseCase(placements));

export const placementController = new PlacementController(prepareDelivery);
export const hivepulseTelemetry = new HivepulseTelemetryHandler(recordTelemetry);
