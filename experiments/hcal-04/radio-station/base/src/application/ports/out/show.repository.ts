import type { Show } from '../../../domain/show';

export interface ShowRepository {
  save(show: Show): Promise<void>;
  findByDay(dayOfWeek: number): Promise<Show[]>;
}
