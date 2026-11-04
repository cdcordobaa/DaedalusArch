class IngotlineError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class IngotlineClient {
  constructor(options) { this.token = options.token; }
  async placeOrder(request) {
    if (request.mass_kg > 4000) throw new IngotlineError('IL_SHORTAGE', 'not enough bronze in stock');
    return { heat_number: 'IL-77104', dispatch_state: 'QUEUED', purity: request.purity, tin_pct: 22.1, landed_date: null,
      carrier: 'northline', assay: 'pending', comment: null };
  }
  async notice(heat_number) {
    return { heat_number, dispatch_state: 'LOADED', carrier: 'northline', comment: null, assay_cert_url: null };
  }
}
module.exports = { IngotlineClient, IngotlineError };
