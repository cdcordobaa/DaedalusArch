export class PlayLogError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export class PlayLogClient {
  constructor(options) { this.apiKey = options.apiKey; }
  async submit(request) {
    return { status: 'ACCEPTED', receipt_id: 'rcpt-' + request.track_isrc };
  }
}
