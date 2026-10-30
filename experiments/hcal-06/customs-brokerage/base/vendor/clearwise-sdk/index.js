class ClearwiseError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class ClearwiseClient {
  constructor(options) { this.apiKey = options.api_key; }
  async fileEntry(request) {
    if (!request.hts_code) throw new ClearwiseError('HTS_INVALID', 'missing tariff code');
    return { entry_number: 'CW-0001', entry_status: 'FILED', review_queue: 'Q_INTAKE', duty_amount_usd: 41.5, liquidation_date: null };
  }
  async getEntry(entry_number) {
    return { entry_number, entry_status: 'RELEASED', review_queue: 'Q_TRANSMITTED', duty_amount_usd: 41.5, liquidation_date: '2026-12-01' };
  }
}
module.exports = { ClearwiseClient, ClearwiseError };
