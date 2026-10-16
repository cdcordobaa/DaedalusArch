export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}
