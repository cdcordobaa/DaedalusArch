# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **Ports carry only domain types.** The interfaces between the application core and the outside world are written
   in the application's own types. No type, field name or error from a vendor or an infrastructure library appears in a
   port.
2. **Vendor and infrastructure code stays in adapters.** Only adapters, and the composition root that wires them,
   import vendor SDKs or infrastructure libraries. The domain and the application core never depend on them.

## Studio glossary: firing stages

The studio's firing book distinguishes seven stages of a firing, and each one carries a studio rule.

- **queued**: the firing is booked but the kiln has not started; a student may still take a piece back.
- **drying**: the low drying hold that drives the last water out; a student may still take a piece back, and the
  studio lets the kiln door be opened once to add a forgotten piece.
- **heating**: the climb to peak; the kiln room is closed to students.
- **soaking**: the hold at peak; the technician logs the cone reading at the start and the end of it.
- **easing**: the slow cool-down; the pickup page shows cooling down and the door stays shut below the studio's
  safe-touch line.
- **done**: the kiln is cold and unloaded; pieces wait on the pickup shelf for seven days.
- **broken**: the firing failed; the technician inspects the kiln and the studio offers a free re-fire.
