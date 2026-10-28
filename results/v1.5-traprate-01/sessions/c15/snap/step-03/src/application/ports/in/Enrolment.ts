export interface PupilView {
  id: string;
  name: string;
  className: string;
  allergies: string[];
  balance: string;
}

export interface Enrolment {
  enrol(name: string, className: string, allergies: readonly string[]): PupilView;
  topUp(pupilId: string, pence: unknown): PupilView;
  pupil(pupilId: string): PupilView;
}
