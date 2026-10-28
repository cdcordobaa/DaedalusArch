import { execFileSync } from 'node:child_process';
import { LabelPrinter } from '../../../application/ports/out/label-printer.port';

export class ShellLabelPrinter implements LabelPrinter {
  async print(loanId: string): Promise<string> {
    return execFileSync('label-printer', [loanId]);
  }
}
