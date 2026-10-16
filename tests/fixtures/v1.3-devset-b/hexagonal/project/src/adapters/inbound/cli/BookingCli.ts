import { BookRoom } from '../../../application/ports/in/BookRoom';
import { BookingView } from '../../../application/ports/in/BookingView';

export function formatCliLine(view: BookingView): string {
  return `${view.id}\t${view.roomId}\t${view.checkIn.slice(0, 10)}..${view.checkOut.slice(0, 10)}\t${view.status}`;
}

/** Second driving adapter on the same port: `book <roomId> <guestId> <checkIn> <checkOut> [guests]`. */
export class BookingCli {
  constructor(private readonly bookRoom: BookRoom) {}

  async run(argv: readonly string[]): Promise<string> {
    const [command, roomId, guestId, checkIn, checkOut, guests] = argv;
    if (command !== 'book' || !roomId || !guestId || !checkIn || !checkOut) {
      return 'usage: book <roomId> <guestId> <checkIn> <checkOut> [guests]';
    }
    const view = await this.bookRoom.book({ roomId, guestId, checkIn, checkOut, guests: Number(guests ?? 1) });
    return formatCliLine(view);
  }
}
