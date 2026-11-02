# Architecture

This codebase follows the Hexagonal (ports and adapters) architecture. Every change keeps these rules.

1. **Ports carry only domain types.** The interfaces between the application core and the outside world are written
   in the application's own types. No type, field name or error from a vendor or an infrastructure library appears in a
   port.
2. **Vendor and infrastructure code stays in adapters.** Only adapters, and the composition root that wires them,
   import vendor SDKs or infrastructure libraries. The domain and the application core never depend on them.

## Studio glossary: firing phases

The studio runs its firing book on seven phases, the words the technicians and students use, and each carries a rule.

- **scheduled**: the firing is booked; a student may still take a piece back.
- **candling**: the overnight low hold that dries the ware; a student may still take a piece back.
- **ramping**: the climb to peak; the kiln room is closed to students.
- **holding**: the soak at peak; the technician logs the cone reading at its start and end.
- **cooling**: the slow cool-down; the door stays shut below the safe-touch line.
- **complete**: the kiln is cold and unloaded; pieces wait on the pickup shelf for seven days.
- **faulted**: the firing failed; the technician inspects the kiln and the studio offers a free re-fire.
