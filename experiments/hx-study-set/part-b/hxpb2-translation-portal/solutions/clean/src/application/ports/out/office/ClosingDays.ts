import type { ClosingDay } from '../../../../domain/model/office/ClosingDay';

export interface ClosingDays {
  add(day: ClosingDay): Promise<void>;
  between(from: string, to: string): Promise<ClosingDay[]>;
}
