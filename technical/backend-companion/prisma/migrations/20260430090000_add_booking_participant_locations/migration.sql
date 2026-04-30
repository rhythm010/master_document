-- CreateTable
CREATE TABLE "booking_participant_locations" (
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_participant_locations_pkey" PRIMARY KEY ("booking_id","user_id")
);

-- CreateIndex
CREATE INDEX "idx_booking_participant_locations_booking"
  ON "booking_participant_locations"("booking_id");

-- AddForeignKey
ALTER TABLE "booking_participant_locations"
  ADD CONSTRAINT "booking_participant_locations_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participant_locations"
  ADD CONSTRAINT "booking_participant_locations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
