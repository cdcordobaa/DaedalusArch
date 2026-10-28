import type { ReceivingLog } from '../application/ports';

export function memoryReceivingLog(): ReceivingLog {
  const written: string[] = [];
  return {
    write: (line) => { written.push(line); },
    lines: () => [...written],
  };
}
