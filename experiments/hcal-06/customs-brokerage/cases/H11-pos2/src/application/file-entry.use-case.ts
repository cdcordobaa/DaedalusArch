import { ShipmentNotFoundError } from '../domain/errors';
import { FileEntryCommand, FileEntryPort, FileEntryResult } from './ports/in/file-entry.port';
import { ClientNotifierPort } from './ports/out/client-notifier.port';
import { CustomsFilingPort } from './ports/out/customs-filing.port';
import { ShipmentRepositoryPort } from './ports/out/shipment-repository.port';

export class FileEntryUseCase implements FileEntryPort {
  constructor(
    private readonly shipments: ShipmentRepositoryPort,
    private readonly customs: CustomsFilingPort,
    private readonly notifier: ClientNotifierPort,
  ) {}

  async file(command: FileEntryCommand): Promise<FileEntryResult> {
    const shipment = await this.shipments.findById(command.shipmentId);
    if (shipment === null) throw new ShipmentNotFoundError(command.shipmentId);
    const receipt = await this.customs.file({
      importerId: shipment.importerId,
      tariffCode: shipment.tariffCode,
      originCountry: shipment.originCountry,
      declaredValueCents: shipment.declaredValueCents,
      portCode: shipment.portCode,
    });
    shipment.recordFiling(receipt);
    shipment.setPortalStatus(receipt.outcome === 'refused' ? 'REJECTED' : receipt.outcome === 'needs-attention' ? 'DOCS_REQUIRED' : 'FILED');
    await this.shipments.save(shipment);
    await this.notifier.notifyFiling(shipment.importerId, shipment.id, shipment.clearanceState);
    return {
      shipmentId: shipment.id,
      state: shipment.clearanceState,
      entryRef: shipment.customsEntryRef,
      dutyCents: shipment.assessedDutyCents,
    };
  }
}
