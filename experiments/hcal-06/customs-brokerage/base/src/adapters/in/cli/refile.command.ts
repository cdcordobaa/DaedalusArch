import { FileEntryPort } from '../../../application/ports/in/file-entry.port';

export class RefileCommand {
  constructor(private readonly fileEntry: FileEntryPort) {}

  async run(argv: readonly string[]): Promise<string> {
    const raw = argv[0];
    if (raw === undefined || raw.trim() === '') return 'usage: refile <shipment-id>';
    const result = await this.fileEntry.file({ shipmentId: raw.trim().toUpperCase() });
    return `${result.shipmentId}: ${result.state}`;
  }
}
