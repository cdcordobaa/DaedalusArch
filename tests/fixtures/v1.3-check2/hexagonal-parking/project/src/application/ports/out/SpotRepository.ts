import { Spot } from '../../../domain/model/Spot';

export interface SpotRepository {
  all(): Promise<Spot[]>;
}
