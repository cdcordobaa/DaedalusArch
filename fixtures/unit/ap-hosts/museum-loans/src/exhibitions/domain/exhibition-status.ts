export const EXHIBITION_STATUSES = ['planned', 'open', 'closed', 'cancelled'] as const;

export type ExhibitionStatus = (typeof EXHIBITION_STATUSES)[number];

export function isExhibitionStatus(value: string): value is ExhibitionStatus {
  return (EXHIBITION_STATUSES as readonly string[]).includes(value);
}
