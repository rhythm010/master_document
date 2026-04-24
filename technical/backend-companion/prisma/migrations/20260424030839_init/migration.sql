-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'COMPANION');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('MALL', 'CLUB', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "RosterSlotStatus" AS ENUM ('AVAILABLE', 'BOOKED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompanionDesignation" AS ENUM ('CAPTAIN', 'VICE_CAPTAIN');

-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('ASSIGNED', 'ARRIVED');

-- CreateEnum
CREATE TYPE "SelfMatchStatus" AS ENUM ('NOT_MATCHED', 'MATCHED');

-- CreateEnum
CREATE TYPE "ClientMatchStatus" AS ENUM ('WAITING_FOR_CLIENT', 'CLIENT_MATCHED');

-- CreateEnum
CREATE TYPE "BookingRatingType" AS ENUM ('CLIENT_RATING_DUO', 'COMPANION_RATING_CLIENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "biometric_auth_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "designation" "CompanionDesignation" NOT NULL DEFAULT 'VICE_CAPTAIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profile_picture_url" TEXT NOT NULL DEFAULT '',
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "companion_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companion_venue_assignments" (
    "companion_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companion_venue_assignments_pkey" PRIMARY KEY ("companion_id","venue_id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "venue_type" "VenueType" NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "operating_hours_start" TIME(0) NOT NULL,
    "operating_hours_end" TIME(0) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "qr_code" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "booking_color" TEXT NOT NULL,
    "com_match_qr_code" TEXT NOT NULL,
    "com_match_pin_code" TEXT NOT NULL,
    "extended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_slots" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "booking_id" UUID,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "RosterSlotStatus" NOT NULL,

    CONSTRAINT "roster_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_companion_assignments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "designation" "CompanionDesignation" NOT NULL,
    "presence_status" "PresenceStatus" NOT NULL DEFAULT 'ASSIGNED',
    "self_match_status" "SelfMatchStatus" NOT NULL DEFAULT 'NOT_MATCHED',
    "client_match_status" "ClientMatchStatus" NOT NULL DEFAULT 'WAITING_FOR_CLIENT',

    CONSTRAINT "booking_companion_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_ratings" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "rater_user_id" UUID NOT NULL,
    "rating_type" "BookingRatingType" NOT NULL,
    "stars" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "companion_profiles_user_id_key" ON "companion_profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_companion_profiles_designation" ON "companion_profiles"("designation");

-- CreateIndex
CREATE INDEX "idx_companion_profiles_active" ON "companion_profiles"("is_active");

-- CreateIndex
CREATE INDEX "idx_companion_venue_assignments_venue" ON "companion_venue_assignments"("venue_id");

-- CreateIndex
CREATE INDEX "idx_venues_type" ON "venues"("venue_type");

-- CreateIndex
CREATE INDEX "idx_bookings_venue_time" ON "bookings"("venue_id", "start_at");

-- CreateIndex
CREATE INDEX "idx_bookings_client_status" ON "bookings"("client_id", "status");

-- CreateIndex
CREATE INDEX "idx_roster_slots_lookup" ON "roster_slots"("venue_id", "start_at", "status");

-- CreateIndex
CREATE INDEX "idx_roster_slots_companion_time" ON "roster_slots"("companion_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_roster_slots_unique_slot" ON "roster_slots"("venue_id", "companion_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "idx_assignments_booking" ON "booking_companion_assignments"("booking_id");

-- CreateIndex
CREATE INDEX "idx_assignments_companion" ON "booking_companion_assignments"("companion_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assignment_booking_designation" ON "booking_companion_assignments"("booking_id", "designation");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assignment_booking_companion" ON "booking_companion_assignments"("booking_id", "companion_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_booking_ratings_once" ON "booking_ratings"("booking_id", "rating_type", "rater_user_id");

-- AddForeignKey
ALTER TABLE "companion_profiles" ADD CONSTRAINT "companion_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_venue_assignments" ADD CONSTRAINT "companion_venue_assignments_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companion_venue_assignments" ADD CONSTRAINT "companion_venue_assignments_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_companion_assignments" ADD CONSTRAINT "booking_companion_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_companion_assignments" ADD CONSTRAINT "booking_companion_assignments_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_ratings" ADD CONSTRAINT "booking_ratings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_ratings" ADD CONSTRAINT "booking_ratings_rater_user_id_fkey" FOREIGN KEY ("rater_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
