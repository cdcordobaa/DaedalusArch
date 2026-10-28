import type { RequestRide } from '../../../application/RequestRide';

const point = (text: string | undefined): [number, number] => {
  const [lat, lng] = (text ?? '').split(',').map(Number);
  return [lat ?? Number.NaN, lng ?? Number.NaN];
};

/** `ride <rider> <lat>,<lng> <lat>,<lng>` from the dispatch console; answers one line. */
export class RideCommand {
  constructor(private readonly rides: RequestRide) {}

  async run(line: string): Promise<string> {
    const [verb, rider, pickup, dropoff] = line.trim().split(/\s+/);
    if (verb !== 'ride' || rider === undefined) return 'usage: ride <rider> <lat>,<lng> <lat>,<lng>';
    try {
      const a = await this.rides.request({ rider, pickup: point(pickup), dropoff: point(dropoff) });
      return a.joined ? `${rider} joins ${a.pool} (+${String(a.addedMinutes)} min)` : `${rider} opens ${a.pool}`;
    } catch (e) {
      return `refused: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
