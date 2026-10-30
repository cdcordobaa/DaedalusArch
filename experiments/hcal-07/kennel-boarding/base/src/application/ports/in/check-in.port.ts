export interface CheckInCommand {
  readonly bookingId: string;
}

export interface CheckInPort {
  checkIn(command: CheckInCommand): Promise<void>;
}
