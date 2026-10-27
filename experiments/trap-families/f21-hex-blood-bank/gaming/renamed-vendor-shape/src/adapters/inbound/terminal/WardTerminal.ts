import type { FollowDelivery } from '../../../application/FollowDelivery';
import type { RequestUnits } from '../../../application/RequestUnits';

/**
 * The blood bank's ward terminal: one command per line.
 *   request <ward> <component> <group> <units> [urgent]   e.g. request ICU red-cells A+ 2 urgent
 *   delivery <order number>
 */
export class WardTerminal {
  constructor(
    private readonly units: RequestUnits,
    private readonly deliveries: FollowDelivery,
  ) {}

  async run(line: string): Promise<string> {
    const [command, ...args] = line.trim().split(/\s+/);
    try {
      if (command === 'request' && args.length >= 4) {
        const [ward = '', comp = '', group = '', units = '', flag] = args;
        const answer = await this.units.request({ ward, component: comp.replace(/-/g, ' '), group, units: Number(units), urgent: flag === 'urgent' });
        return JSON.stringify(answer);
      }
      if (command === 'delivery' && args.length === 1) return JSON.stringify(await this.deliveries.latest(args[0] ?? ''));
      return 'usage: request <ward> <component> <group> <units> [urgent] | delivery <order number>';
    } catch (e) {
      return `refused: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
