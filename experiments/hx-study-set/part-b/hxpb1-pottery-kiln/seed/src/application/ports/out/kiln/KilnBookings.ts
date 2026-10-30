import type { Piece } from '../../../../domain/model/Piece';

/** Puts a firing on the kiln's schedule; answers the firing id. */
export interface KilnBookings {
  schedule(label: string, firing: Piece['firing'], peakCelsius: number, shelves: number): Promise<string>;
}
