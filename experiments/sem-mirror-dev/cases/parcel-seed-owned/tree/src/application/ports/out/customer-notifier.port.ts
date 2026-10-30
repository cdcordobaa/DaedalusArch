export interface CustomerNotifierPort {
  send(customerId: string, text: string): Promise<void>;
}
