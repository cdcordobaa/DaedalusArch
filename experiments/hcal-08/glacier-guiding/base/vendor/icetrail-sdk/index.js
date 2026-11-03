class IceTrailError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const permit = (permit_no, state) => ({ permit_no, state, warden: 'R. Holm', quota: 4, cairn: 'C-17' });
class IceTrailClient {
  constructor(options) { this.apiKey = options.api_key; }
  async lodge(request) {
    if (request.party_size > 12) throw new IceTrailError('E_QUOTA_FULL', 'route quota full');
    return permit('IT-5521', 'LODGED');
  }
  async lookup(permit_no) { return permit(permit_no, 'GRANTED'); }
}
module.exports = { IceTrailClient, IceTrailError };
