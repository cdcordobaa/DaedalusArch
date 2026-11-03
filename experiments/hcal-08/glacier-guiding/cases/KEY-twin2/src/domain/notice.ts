import { RouteCondition } from './route-condition';

const NOTICE_HOURS: Record<string, number> = {
  open: 0,
  caution: 12,
  closed: 48,
};

export function noticeHoursFor(condition: RouteCondition): number {
  return NOTICE_HOURS[condition] ?? 48;
}
