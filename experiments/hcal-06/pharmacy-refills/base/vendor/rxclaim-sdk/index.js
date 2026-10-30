class AdjudicationFault extends Error {
  constructor(fault_code, message) { super(message); this.fault_code = fault_code; }
}
class RxClaimClient {
  constructor(options) { this.apiKey = options.api_key; }
  async adjudicate(submission) {
    if (!submission.bin_number) throw new AdjudicationFault('BIN_UNKNOWN', 'no BIN');
    return {
      claim_ref: 'RX-1001', claim_status: 'PAID', reject_codes: [], patient_pay_amount: 7.5, plan_pay_amount: 42.1,
      copay_basis: 'FLAT', route: 'ROUTE_DIRECT', adjudicated_at: '2026-10-29T10:00:00Z',
    };
  }
}
module.exports = { RxClaimClient, AdjudicationFault };
