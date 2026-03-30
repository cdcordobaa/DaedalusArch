// VIOLATION #4: circular — CircularHelper imports InMemoryTaskRepository, which imports CircularHelper
import { InMemoryTaskRepository } from './InMemoryTaskRepository';

export class CircularHelper {
  logSave(id: string): void {
    console.log(`Saved task: ${id}`);
  }
}
