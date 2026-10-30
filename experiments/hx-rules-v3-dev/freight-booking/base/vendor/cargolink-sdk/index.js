class CarrierRefusal extends Error {
  constructor(refusal_code, message) { super(message); this.refusal_code = refusal_code; }
}
class CargoLinkClient {
  constructor(options) { this.apiKey = options.api_key; }
  async book(request) {
    if (!request.lane_code) throw new CarrierRefusal('H10', 'no lane');
    return {
      booking_ref: 'CL-2001', booking_state: 'BKG_CONFIRMED', hold_codes: [], freight_charge: 410.5, fuel_surcharge: 31.2,
      confirmed_at: '2026-10-29T10:00:00Z', currency: 'EUR', weight: 820, pallets: request.pallet_count,
    };
  }
  async lanes() { return []; }
}
module.exports = { CargoLinkClient, CarrierRefusal };
