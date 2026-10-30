export interface OwnerNotifierPort {
  tell(ownerId: string, text: string): Promise<void>;
}
