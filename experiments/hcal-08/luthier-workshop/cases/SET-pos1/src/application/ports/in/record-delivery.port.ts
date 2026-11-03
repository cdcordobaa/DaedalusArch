export interface RecordDeliveryCommand {
  readonly supplyRef: string;
  readonly fulfilment: string;
}

export interface RecordDeliveryPort {
  record(command: RecordDeliveryCommand): Promise<void>;
}
