import { ContractorNotifier } from '../application/ContractorNotifier';

export class RecordingContractorNotifier implements ContractorNotifier {
  readonly sent: string[] = [];

  notify(contractorId: string, message: string): void {
    this.sent.push(contractorId + ': ' + message);
  }
}
