export interface Notices {
  add(sectionId: string, text: string): void;
  all(): string[];
}
