declare module '@prisma/client' {
  export interface PatientRow { id: string; fullName: string; birthYear: number; blocked: boolean }
  export interface PractitionerRow { id: string; fullName: string; specialty: string; dailyCapacity: number }
  export interface AppointmentRow { id: string; patientId: string; practitionerId: string; startsAt: Date; minutes: number; status: string }
  export interface VisitNoteRow { id: string; appointmentId: string; author: string; text: string; writtenAt: Date }
  export interface Delegate<T, K extends keyof T> {
    findUnique(args: { where: Pick<T, K> }): Promise<T | null>;
    findMany(args?: { where?: Partial<T> }): Promise<T[]>;
    create(args: { data: T }): Promise<T>;
    update(args: { where: Pick<T, K>; data: Partial<T> }): Promise<T>;
  }
  export class PrismaClient {
    patient: Delegate<PatientRow, 'id'>;
    practitioner: Delegate<PractitionerRow, 'id'>;
    appointment: Delegate<AppointmentRow, 'id'>;
    visitNote: Delegate<VisitNoteRow, 'id'>;
    $connect(): Promise<void>;
  }
}
