import { ContractorMailer } from '../application/ContractorMailer';

export class RecordingContractorMailer implements ContractorMailer {
  readonly sent: string[] = [];

  send(contractorId: string, subject: string, body: string): void {
    this.sent.push(contractorId + ': ' + subject + ' / ' + body);
  }
}
