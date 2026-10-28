export interface ApplicationView {
  readonly id: string;
  readonly petId: string;
  readonly adopterId: string;
  readonly submittedOn: string;
  readonly status: string;
}

export interface Adoptions {
  apply(petId: string, adopterId: string): { id: string };
  /** Approves the application, adopts the pet today and rejects the other pending applications for it. */
  approve(applicationId: string): ApplicationView;
  /** Withdraws a pending application. */
  withdrawApplication(applicationId: string): ApplicationView;
  application(id: string): ApplicationView;
}
