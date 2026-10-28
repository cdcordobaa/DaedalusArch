export interface Notifier {
  notifyBorrower(borrower: string, message: string): Promise<void>;
}
