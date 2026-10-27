/** Boats the dock gate lets through. */
export interface GateRegister {
  allow(entry: string): void;
  entries(): string[];
}
