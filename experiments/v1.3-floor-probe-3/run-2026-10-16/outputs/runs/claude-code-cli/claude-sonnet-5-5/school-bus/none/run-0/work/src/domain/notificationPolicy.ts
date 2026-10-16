export const DELAY_THRESHOLD_MINUTES = 10;

/**
 * A delay e-mail is due when the bus is more than 10 minutes late and either
 * nothing was sent yet for the trip or the delay grew by another 10 minutes
 * since the last e-mail.
 */
export function isDelayNotificationDue(delayMinutes: number, lastNotifiedDelay: number | undefined): boolean {
  if (delayMinutes <= DELAY_THRESHOLD_MINUTES) return false;
  return lastNotifiedDelay === undefined || delayMinutes >= lastNotifiedDelay + DELAY_THRESHOLD_MINUTES;
}
