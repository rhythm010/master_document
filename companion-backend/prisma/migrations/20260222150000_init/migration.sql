-- CreateEnum
CREATE TYPE "ClientBookingStatus" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('MALL', 'CLUB', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "CompanionRole" AS ENUM ('CAPTAIN', 'VICE_CAPTAIN');

-- CreateEnum
CREATE TYPE "PenaltyStatus" AS ENUM ('CLEAR', 'WARNING', 'PENALIZED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "AllocationMode" AS ENUM ('AUTO', 'CAPTAIN_SPECIFIED', 'VICE_CAPTAIN_SPECIFIED', 'BOTH_SPECIFIED');

-- CreateEnum
CREATE TYPE "DuoStatus" AS ENUM ('PENDING', 'MATCHED', 'ACTIVATED', 'BREACH');

-- CreateEnum
CREATE TYPE "PaymentHoldStatus" AS ENUM ('NONE', 'HELD', 'CHARGED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CLIENT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'CONFIRMED', 'CANCELLED', 'REALLOCATED', 'STARTED', 'COMPLETED', 'FAILED', 'REFUNDED', 'AUTO_CANCELLED_BREACH', 'AUTO_COMPLETED_NO_SHOW', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CLIENT', 'COMPANION', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BATTERY_CHECK', 'MATCH_PENDING', 'LOCATION_CONFIRM', 'BOOKING_CONFIRMED', 'COMPANIONS_READY', 'ESCALATION_CALL', 'CANCELLATION', 'REMINDER', 'BREACH_ALERT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'SMS', 'AUTOMATED_CALL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('SHIFT_CANCELLATION', 'BREACH', 'NO_SHOW', 'LATE_ARRIVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PenaltySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PenaltyIssuer" AS ENUM ('SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'OPERATIONS');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "profile_language" TEXT NOT NULL DEFAULT 'EN',
    "payment_method_token" TEXT,
    "push_notification_token" TEXT,
    "device_id" TEXT,
    "current_booking_id" UUID,
    "booking_status_cache" "ClientBookingStatus" NOT NULL DEFAULT 'NONE',
    "gps_permission_granted" BOOLEAN NOT NULL DEFAULT false,
    "last_known_latitude" DECIMAL(10,7),
    "last_known_longitude" DECIMAL(10,7),
    "last_gps_update_at" TIMESTAMP(3),
    "consent_version" TEXT,
    "consent_accepted_at" TIMESTAMP(3),
    "average_rating" DECIMAL(3,2),
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companions" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "role" "CompanionRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "physical_stats" JSONB,
    "language_skills" JSONB NOT NULL,
    "background_verified" BOOLEAN NOT NULL DEFAULT false,
    "push_notification_token" TEXT,
    "device_id" TEXT,
    "current_shift_id" UUID,
    "gps_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_known_latitude" DECIMAL(10,7),
    "last_known_longitude" DECIMAL(10,7),
    "last_gps_update_at" TIMESTAMP(3),
    "penalty_status" "PenaltyStatus" NOT NULL DEFAULT 'CLEAR',
    "average_rating" DECIMAL(3,2),
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VenueType" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "country" TEXT NOT NULL,
    "operating_hours_start" TEXT NOT NULL,
    "operating_hours_end" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "penalty_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "captain_id" UUID,
    "vice_captain_id" UUID,
    "allocation_mode" "AllocationMode" NOT NULL DEFAULT 'AUTO',
    "captain_shift_id" UUID,
    "vice_captain_shift_id" UUID,
    "client_nickname_snapshot" TEXT NOT NULL,
    "duo_status" "DuoStatus" NOT NULL DEFAULT 'PENDING',
    "duo_matched_at" TIMESTAMP(3),
    "duo_activated_at" TIMESTAMP(3),
    "duo_breach_reported_at" TIMESTAMP(3),
    "duo_qr_code" TEXT,
    "duo_pin_code" VARCHAR(6),
    "captain_location_confirmed_at" TIMESTAMP(3),
    "vice_captain_location_confirmed_at" TIMESTAMP(3),
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 120,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "base_rate" DECIMAL(10,2) NOT NULL,
    "vat_amount" DECIMAL(10,2) NOT NULL,
    "service_fee" DECIMAL(10,2) NOT NULL,
    "grand_total" DECIMAL(10,2) NOT NULL,
    "payment_hold_status" "PaymentHoldStatus" NOT NULL DEFAULT 'NONE',
    "payment_hold_amount" DECIMAL(10,2),
    "soft_lock_expires_at" TIMESTAMP(3),
    "qr_code" TEXT,
    "pin_code" VARCHAR(4),
    "consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "consent_version_accepted" TEXT,
    "booking_notes" TEXT,
    "failure_reason" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by" "CancelledBy",
    "cancelled_at" TIMESTAMP(3),
    "refund_amount" DECIMAL(10,2),
    "refund_percentage" INTEGER,
    "session_started_at" TIMESTAMP(3),
    "session_ended_at" TIMESTAMP(3),
    "client_no_show" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_audit_logs" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "performed_by_type" "ActorType" NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "device_id" TEXT,
    "pricing_engine_version" TEXT,
    "allocation_engine_version" TEXT,
    "client_latitude" DECIMAL(10,7),
    "client_longitude" DECIMAL(10,7),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "recipient_type" "ActorType" NOT NULL,
    "recipient_id" UUID NOT NULL,
    "booking_id" UUID,
    "notification_type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "content" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" UUID NOT NULL,
    "companion_id" UUID NOT NULL,
    "shift_id" UUID,
    "booking_id" UUID,
    "type" "PenaltyType" NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "PenaltySeverity" NOT NULL,
    "issued_by" "PenaltyIssuer" NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "permissions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_number_key" ON "clients"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "clients_current_booking_id_key" ON "clients"("current_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "companions_phone_number_key" ON "companions"("phone_number");

-- CreateIndex
CREATE INDEX "shifts_companion_id_date_idx" ON "shifts"("companion_id", "date");

-- CreateIndex
CREATE INDEX "shifts_date_status_idx" ON "shifts"("date", "status");

-- CreateIndex
CREATE INDEX "bookings_client_id_status_idx" ON "bookings"("client_id", "status");

-- CreateIndex
CREATE INDEX "bookings_captain_id_date_idx" ON "bookings"("captain_id", "date");

-- CreateIndex
CREATE INDEX "bookings_vice_captain_id_date_idx" ON "bookings"("vice_captain_id", "date");

-- CreateIndex
CREATE INDEX "bookings_status_date_idx" ON "bookings"("status", "date");

-- CreateIndex
CREATE INDEX "bookings_soft_lock_expires_at_idx" ON "bookings"("soft_lock_expires_at");

-- CreateIndex
CREATE INDEX "bookings_date_start_time_idx" ON "bookings"("date", "start_time");

-- CreateIndex
CREATE INDEX "booking_audit_logs_booking_id_idx" ON "booking_audit_logs"("booking_id");

-- CreateIndex
CREATE INDEX "booking_audit_logs_created_at_idx" ON "booking_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_id_recipient_type_idx" ON "notification_logs"("recipient_id", "recipient_type");

-- CreateIndex
CREATE INDEX "notification_logs_booking_id_idx" ON "notification_logs"("booking_id");

-- CreateIndex
CREATE INDEX "penalties_companion_id_idx" ON "penalties"("companion_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_current_booking_id_fkey" FOREIGN KEY ("current_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companions" ADD CONSTRAINT "companions_current_shift_id_fkey" FOREIGN KEY ("current_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "companions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vice_captain_id_fkey" FOREIGN KEY ("vice_captain_id") REFERENCES "companions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_captain_shift_id_fkey" FOREIGN KEY ("captain_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vice_captain_shift_id_fkey" FOREIGN KEY ("vice_captain_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_audit_logs" ADD CONSTRAINT "booking_audit_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_companion_id_fkey" FOREIGN KEY ("companion_id") REFERENCES "companions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

