class PalletPathRejection extends Error {
  constructor(reject_code, message) { super(message); this.reject_code = reject_code; }
}
class PalletPathOutage extends Error {}
const consignment = (consignment_no, consignment_status) => ({
  consignment_no, consignment_status, delivery_depot: 'DEP-12', pod_signature: null,
});
class PalletPathClient {
  constructor(options) { this.token = options.account_token; }
  async book(request) {
    if (request.gross_weight_kg > 1200) throw new PalletPathRejection('RJ_OVERWEIGHT', 'load too heavy');
    return consignment('PP-4410', 'BOOKED');
  }
  async track(consignment_no) { return consignment(consignment_no, 'AT_HUB'); }
}
module.exports = { PalletPathClient, PalletPathRejection, PalletPathOutage };
