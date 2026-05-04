-- Make stars nullable to support client ratings with optional stars.
ALTER TABLE "booking_ratings"
  ALTER COLUMN "stars" DROP NOT NULL;

-- Enforce star range only when stars is provided.
ALTER TABLE "booking_ratings"
  DROP CONSTRAINT IF EXISTS "chk_booking_ratings_stars";

ALTER TABLE "booking_ratings"
  ADD CONSTRAINT "chk_booking_ratings_stars"
  CHECK ("stars" IS NULL OR ("stars" BETWEEN 1 AND 5));

-- Enforce comment length (stored as NOT NULL with default '').
ALTER TABLE "booking_ratings"
  DROP CONSTRAINT IF EXISTS "chk_booking_ratings_comment_length";

ALTER TABLE "booking_ratings"
  ADD CONSTRAINT "chk_booking_ratings_comment_length"
  CHECK (char_length("comment") <= 300);
