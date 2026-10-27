export interface CancelSubscriptionCommand {
  readonly subscriptionId: string;
}

export interface CancelSubscriptionPort {
  execute(command: CancelSubscriptionCommand): Promise<void>;
}
