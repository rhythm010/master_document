-- Enforce: one non-terminal booking per client (CONFIRMED/ACTIVE)
CREATE UNIQUE INDEX "uq_bookings_one_non_terminal_per_client"
  ON "bookings" ("client_id")
  WHERE "status" IN ('CONFIRMED', 'ACTIVE');
