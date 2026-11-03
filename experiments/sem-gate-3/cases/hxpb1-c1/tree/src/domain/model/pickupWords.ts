/** The pickup page's word for each kiln phase. */
export const PICKUP_WORD: Readonly<Record<string, string | undefined>> = {
  SCHEDULED: 'WAITING',
  CANDLING: 'WAITING',
  RAMPING: 'IN_THE_KILN',
  HOLDING: 'IN_THE_KILN',
  COOLING: 'COOLING_DOWN',
  COMPLETE: 'READY_FOR_PICKUP',
  FAULTED: 'FIRING_FAILED',
};
