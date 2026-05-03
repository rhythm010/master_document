-- Add near-end notification marker to bookings.
ALTER TABLE "bookings"
  ADD COLUMN "near_end_notified_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "booking_messages" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "sender_user_id" UUID NOT NULL,
  "message_text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_booking_messages_booking_time"
  ON "booking_messages"("booking_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "booking_messages"
  ADD CONSTRAINT "booking_messages_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_messages"
  ADD CONSTRAINT "booking_messages_sender_user_id_fkey"
  FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
