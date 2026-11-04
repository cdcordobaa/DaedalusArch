export interface ScaleReading {
  readonly ticketNo: string;
  readonly netTonnes: number;
}

export class ScaleUnavailableError extends Error {}

export interface ScalePort {
  weigh(plate: string): Promise<ScaleReading>;
}
