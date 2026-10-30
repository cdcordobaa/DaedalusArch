import { FileEntryPort } from '../../../application/ports/in/file-entry.port';
import { normaliseShipmentId } from '../shared/shipment-id';
import { FileEntryParamsDto, FileEntryResponseDto } from './shipment.dto';

export class ShipmentController {
  constructor(private readonly fileEntry: FileEntryPort) {}

  async postEntry(params: FileEntryParamsDto): Promise<FileEntryResponseDto> {
    const result = await this.fileEntry.file({ shipmentId: normaliseShipmentId(params.shipmentId) });
    return {
      shipmentId: result.shipmentId,
      clearance: result.state,
      entryNumber: result.entryRef,
      dutyCents: result.dutyCents,
    };
  }
}
