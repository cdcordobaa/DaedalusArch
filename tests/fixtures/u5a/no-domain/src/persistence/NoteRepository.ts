export class NoteRepository {
  private readonly notes: string[] = [];

  add(note: string): number {
    this.notes.push(note);
    return this.notes.length;
  }
}
