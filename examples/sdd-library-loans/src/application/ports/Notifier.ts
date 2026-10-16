/** Outbound port: deliver a message to a member. */
export interface Notifier {
  send(to: string, subject: string, body: string): Promise<void>;
}
