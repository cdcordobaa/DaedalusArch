class PetClaimError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class PetClaimClient {
  constructor(options) { this.apiKey = options.apiKey; }
  async submitClaim(request) {
    if (!this.apiKey) throw new PetClaimError('UNAVAILABLE', 'no key');
    return { claim_ref: 'PC-' + request.policy_no, claim_status: 'APPROVED', precision: 'EXACT' };
  }
}
module.exports = { PetClaimClient, PetClaimError };
