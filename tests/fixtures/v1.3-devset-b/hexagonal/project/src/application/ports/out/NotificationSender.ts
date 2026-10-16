/** Driven port (Cockburn 2005): sends a message to a recipient, implemented by an outbound adapter. */
export interface NotificationSender {
  send(recipient: string, message: string): Promise<void>;
}
