export interface NotifierPort {
  notifyDentist(dentistId: string, message: string): Promise<void>;
}
