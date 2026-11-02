/** A seat request on a flight: the desk's own states. */
export type SeatRequestState = 'accepted' | 'waiting' | 'declined';

export const isAccepted = (s: SeatRequestState): boolean => s === 'accepted';
