/** Messages to campaign creators. */
export interface CreatorInbox {
  post(message: string): void;
  messages(): string[];
}
