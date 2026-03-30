// Re-exports from infra — this is the "bridge" that creates the subtle violation
// Looks innocent from domain's perspective, but carries an infra dependency.
export { formatDate } from '../../infrastructure/utils/InfraFormatters';

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}
