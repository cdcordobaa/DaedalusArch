class BowcraftError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class BowcraftClient {
  constructor(options) { this.apiKey = options.api_key; }
  async order(request) {
    if (request.qty > 20) throw new BowcraftError('BC_OUT_OF_STOCK', 'not enough stock');
    return { order_ref: 'BC-3310', fulfilment: 'PICKING', grade: 'CONCERT', backorder: false, crate: null, eta_date: '2026-11-20', colour: 'amber' };
  }
  async track(order_ref) { return { order_ref, fulfilment: 'FREIGHTED', crate: 'K-88' }; }
}
module.exports = { BowcraftClient, BowcraftError };
