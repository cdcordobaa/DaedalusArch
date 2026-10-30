class LockboxTimeout extends Error {
  constructor(fault, message) { super(message); this.fault = fault; }
}
class LockboxClient {
  constructor(options) { this.token = options.token; }
  async openDoor(lockerId) {
    if (!lockerId) throw new LockboxTimeout('LB_OFFLINE', 'no locker');
    return { locker_id: lockerId, door_state: 'DOOR_OPEN', opened_at: '2026-10-29T10:00:00Z', battery_pct: 81 };
  }
}
module.exports = { LockboxClient, LockboxTimeout };
