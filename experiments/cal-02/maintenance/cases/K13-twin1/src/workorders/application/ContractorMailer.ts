export interface ContractorMailer {
  send(contractorId: string, subject: string, body: string): void;
}
