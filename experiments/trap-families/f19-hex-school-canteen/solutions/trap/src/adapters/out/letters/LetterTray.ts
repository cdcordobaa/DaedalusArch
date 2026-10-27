import type { ParentPost } from '../../../application/ports/out/ParentPost';

/** Letters waiting to be printed and sent home in book bags. */
export class LetterTray implements ParentPost {
  private readonly letters: string[] = [];

  send(letter: string): void {
    this.letters.push(letter);
  }

  all(): string[] {
    return [...this.letters];
  }
}
