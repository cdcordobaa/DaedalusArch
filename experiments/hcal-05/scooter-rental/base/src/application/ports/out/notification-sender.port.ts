export interface NotificationSenderPort {
  send(riderId: string, message: string): Promise<void>;
}
