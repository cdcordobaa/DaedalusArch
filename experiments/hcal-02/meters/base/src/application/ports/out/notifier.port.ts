export interface NotifierPort {
  notifyHighUsage(meterId: string, projectedKwh: number): Promise<void>;
}
