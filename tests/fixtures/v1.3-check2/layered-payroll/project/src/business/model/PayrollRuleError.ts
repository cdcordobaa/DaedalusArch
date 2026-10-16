export class PayrollRuleError extends Error {
  readonly kind = 'payroll-rule';
}

export class UnknownRecordError extends Error {
  readonly kind = 'unknown-record';
}
