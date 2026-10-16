import { Payslip } from '../../business/model/Payslip';

export function payslipRow(p: Payslip): string {
  return `${p.employeeId};${p.week};${(p.grossCents / 100).toFixed(2)}`;
}
