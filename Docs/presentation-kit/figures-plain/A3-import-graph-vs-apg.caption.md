# A3-import-graph-vs-apg (plain set)

**Slide claim.** On the same six files, an import checker sees only six "uses" arrows; the tool’s map also knows each file’s layer, who implements which contract, who is handed what, who calls whom, and (richer map) which types a method returns.

**NUMBERS.md rows used.**
- Graph: "6 files, 6 import arrows; IMPLEMENTS 2, CONSTRUCTOR_INJECTS 2, CALLS 1, SIGNATURE_USES 1 (drawn)" (the "cancel a booking" slice).

**Notes.**
- Plain role names replace the file names: web controller = BookingController, cancel service = CancelBookingService, storage = InMemoryBookingRepository, cancel contract = CancelBooking, storage contract = BookingRepository.
- Edges are drawn by hand from the rows of data/hexagonal.clean.apg2.json; the one SIGNATURE_USES drawn is the storage contract returning Booking.
