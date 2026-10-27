export interface Notices {
  add(carId: string, text: string): void;
  all(): string[];
}
