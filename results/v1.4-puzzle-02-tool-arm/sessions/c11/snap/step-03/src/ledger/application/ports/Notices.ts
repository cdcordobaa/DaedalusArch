export interface Notices {
  add(accountId: string, text: string): void;
  all(): string[];
}
