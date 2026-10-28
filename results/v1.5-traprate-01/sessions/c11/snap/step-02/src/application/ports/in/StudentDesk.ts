export interface StudentView {
  readonly id: string;
  readonly name: string;
}

export interface StudentDesk {
  enrol(name: string): StudentView;
}
