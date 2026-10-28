export interface LabelPrinter {
  print(loanId: string): Promise<string>;
}
