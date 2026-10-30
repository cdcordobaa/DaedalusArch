export interface RecipientNotifierPort {
  notifyCollected(phone: string, parcelId: string): Promise<void>;
}
