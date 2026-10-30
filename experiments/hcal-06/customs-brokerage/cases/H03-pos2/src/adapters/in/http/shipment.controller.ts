import { FileEntryPort } from '../../../application/ports/in/file-entry.port';
import { describeClearance } from '../../out/notification/console-client-notifier';
import { FileEntryParamsDto, FileEntryResponseDto } from './shipment.dto';

export class ShipmentController {
  constructor(private readonly fileEntry: FileEntryPort) {}

  async postEntry(params: FileEntryParamsDto): Promise<FileEntryResponseDto> {
    const result = await this.fileEntry.file({ shipmentId: params.shipmentId.trim().toUpperCase() });
    return {
      shipmentId: result.shipmentId,
      clearance: result.state,
      clearanceLabel: describeClearance(result.state),
      entryNumber: result.entryRef,
      dutyCents: result.dutyCents,
    };
  }
}
