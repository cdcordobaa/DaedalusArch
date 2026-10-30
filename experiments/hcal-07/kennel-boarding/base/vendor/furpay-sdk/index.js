class FurPayDecline extends Error {
  constructor(decline_code, message) { super(message); this.decline_code = decline_code; }
}
class FurPayApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const charge = (charge_id, charge_status, amount_authorised) => ({
  charge_id, charge_status, amount_authorised, decline_code: null, receipt_url: null, created_at: '2026-11-02T09:00:00Z',
});
class FurPayClient {
  constructor(options) { this.secretKey = options.secret_key; }
  async hold(request) {
    if (request.amount_minor > 100000) return { ...charge('ch_0', 'declined', 0), decline_code: 'insufficient_funds' };
    return charge('ch_51', 'requires_capture', request.amount_minor);
  }
  async capture(charge_id) { return charge(charge_id, 'captured', 0); }
  async release(charge_id) { return charge(charge_id, 'released', 0); }
}
module.exports = { FurPayClient, FurPayDecline, FurPayApiError };
