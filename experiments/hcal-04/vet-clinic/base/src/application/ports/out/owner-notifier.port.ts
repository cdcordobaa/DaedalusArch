export interface OwnerNotifierPort {
  notify(ownerId: string, message: string): Promise<void>;
}
