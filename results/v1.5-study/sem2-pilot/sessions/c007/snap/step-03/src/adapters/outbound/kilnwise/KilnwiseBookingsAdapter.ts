import type { KilnwiseClient } from 'kilnwise-sdk';
import type { Piece } from '../../../domain/model/Piece';
import type { KilnBookings } from '../../../application/ports/out/kiln/KilnBookings';

export class KilnwiseBookingsAdapter implements KilnBookings {
  constructor(private readonly client: KilnwiseClient) {}

  async schedule(label: string, firing: Piece['firing'], peakCelsius: number, shelves: number): Promise<string> {
    const booked = await this.client.scheduleFiring({ label, program: firing === 'glaze' ? 'GLAZE' : 'BISQUE', peakCelsius, shelves });
    return booked.firingId;
  }
}
