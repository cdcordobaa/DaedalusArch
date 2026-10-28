class PaynetError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class PaynetClient {
  constructor(options) { this.options = options; }
  async charge(request) {
    return { status: 'AUTHORIZED', txn_id: 'txn_' + request.merchant_ref, auth_code: 'A1' };
  }
}
module.exports = { PaynetClient, PaynetError };
