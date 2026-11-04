class HivepulseError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class HivepulseClient {
  constructor(options) { this.workspace = options.workspace; this.region = options.region || 'eu'; }
  async leaseSensors(request) {
    if (request.unit_count > 200) throw new HivepulseError('HP_NO_UNITS', 'not enough sensor units');
    return { lease_id: 'HP-L-5521', lease_state: 'ACTIVE', unit_count: request.unit_count, ends_on: '2027-04-30', firmware: '7.2.1' };
  }
  async latestFrame(hive_tag) {
    return { hive_tag, yard_code: 'Y-14', colony_state: 'nominal', brood_temp_c: 34.6, weight_kg: 41.2, firmware: '7.2.1', timestamp: '2026-03-02T06:00:00Z' };
  }
}
function verifyFrame(body, signature) { return typeof body === 'string' && signature === 'demo'; }
module.exports = { HivepulseClient, HivepulseError, verifyFrame };
