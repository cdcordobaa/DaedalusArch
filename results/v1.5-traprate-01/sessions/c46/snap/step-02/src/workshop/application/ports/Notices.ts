export interface Notices {
  add(jobId: string, text: string): void;
  all(): string[];
}
