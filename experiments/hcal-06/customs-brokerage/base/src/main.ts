import { RefileCommand } from './adapters/in/cli/refile.command';
import { ShipmentController } from './adapters/in/http/shipment.controller';
import { ClearwiseFilingGateway } from './adapters/out/customs/clearwise-filing.gateway';
import { ConsoleClientNotifier } from './adapters/out/notification/console-client-notifier';
import { InMemoryShipmentRepository } from './adapters/out/persistence/in-memory-shipment.repository';
import { FileEntryUseCase } from './application/file-entry.use-case';

const fileEntry = new FileEntryUseCase(
  new InMemoryShipmentRepository(),
  new ClearwiseFilingGateway('demo-key'),
  new ConsoleClientNotifier(),
);
export const shipmentController = new ShipmentController(fileEntry);
export const refileCommand = new RefileCommand(fileEntry);
