import { NoteRepository } from '../persistence/NoteRepository.js';

export class NoteController {
  constructor(private readonly repository: NoteRepository) {}

  post(note: string): number {
    return this.repository.add(note);
  }
}
