export interface Noticeboard {
  pin(note: string): void;
  notes(): string[];
}
