export interface Notices {
  add(roomId: string, text: string): void;
  all(): string[];
}
