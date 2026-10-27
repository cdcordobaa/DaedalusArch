import type { SchoolDate } from '../../../domain/model/SchoolDate';

export interface Today {
  date(): SchoolDate;
}
