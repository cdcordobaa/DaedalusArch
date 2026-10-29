export interface Patients {
  hasOpenBill(patientId: string): Promise<boolean>;
}
