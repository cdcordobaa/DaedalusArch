class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function json(status, body) {
  return { status, headers: { 'content-type': 'application/json' }, body };
}
module.exports = { HttpError, json };
