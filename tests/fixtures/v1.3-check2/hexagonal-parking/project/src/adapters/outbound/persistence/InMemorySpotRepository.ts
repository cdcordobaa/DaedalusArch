import { Spot } from '../../../domain/model/Spot';
import { SpotRepository } from '../../../application/ports/out/SpotRepository';

export class InMemorySpotRepository implements SpotRepository {
  private readonly spots: Spot[] = [
    new Spot('A-01', 0, false, 250),
    new Spot('A-02', 0, true, 300),
    new Spot('B-01', 1, false, 200),
  ];

  async all(): Promise<Spot[]> {
    return [...this.spots];
  }
}
