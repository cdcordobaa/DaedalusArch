export interface ContractorNotifier {
  notify(contractorId: string, message: string): void;
}
