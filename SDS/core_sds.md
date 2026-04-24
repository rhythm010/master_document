## 1. System Overview

A session-based booking system where a Client books a timed session at a Venue and is served by a Companion duo assigned to that Booking.
The system is state-driven: Bookings progress through a global lifecycle and generate immutable audit records (Bookings, Assignments, Ratings).
Identities are unified under a single User model with an immutable role.

## 2. Core Entities

Entity: User

* id
* role (CLIENT, COMPANION)
* name
* nickname
* email
* passwordHash
* emailVerified
* biometricAuthEnabled
* createdAt

Entity: CompanionProfile

* id
* userId
* designation (CAPTAIN, VICE_CAPTAIN)
* isActive
* languages
* profilePictureUrl
* averageRating

Entity: Venue

* id
* name
* address
* venueType
* latitude
* longitude
* operatingHoursStart
* operatingHoursEnd

Entity: RosterSlot

* id
* venueId
* companionId
* bookingId
* startAt
* endAt
* status (AVAILABLE, BOOKED)

Entity: Booking

* id
* clientId
* venueId
* startAt
* endAt
* status (CONFIRMED, ACTIVE, COMPLETED, CANCELLED)
* qrCode
* pinCode
* bookingColor
* comMatchQrCode
* comMatchPinCode
* extendedAt
* createdAt

Entity: BookingCompanionAssignment

* id
* bookingId
* companionId
* designation (CAPTAIN, VICE_CAPTAIN)
* presenceStatus (ASSIGNED, ARRIVED)
* selfMatchStatus (NOT_MATCHED, MATCHED)
* clientMatchStatus (WAITING_FOR_CLIENT, CLIENT_MATCHED)

Entity: BookingRating

* id
* bookingId
* raterUserId
* ratingType (CLIENT_RATING_DUO, COMPANION_RATING_CLIENT)
* stars
* tags
* comment
* createdAt

## 3. Global State Machines

User States:
UNVERIFIED → VERIFIED

CompanionProfile States:
Initial: ACTIVE_TOGGLE_ON
ACTIVE_TOGGLE_ON → ACTIVE_TOGGLE_OFF
ACTIVE_TOGGLE_OFF → ACTIVE_TOGGLE_ON

RosterSlot States:
AVAILABLE → BOOKED → AVAILABLE

Booking States:
CONFIRMED → ACTIVE → COMPLETED

CONFIRMED → CANCELLED

ACTIVE → CANCELLED

BookingCompanionAssignment States:
presenceStatus: ASSIGNED → ARRIVED

selfMatchStatus: NOT_MATCHED → MATCHED

clientMatchStatus: WAITING_FOR_CLIENT → CLIENT_MATCHED

* invalid transitions are not allowed
* transitions must be atomic

## 4. System Invariants

* A User has exactly one role: CLIENT or COMPANION.
* A User role is immutable after creation.
* A CompanionProfile exists only for Users with role COMPANION.
* CompanionProfile.isActive is ON by default (initial state: ACTIVE_TOGGLE_ON).
* A Client may have at most one non-terminal Booking at any time (status in CONFIRMED or ACTIVE).
* A Booking must have exactly two companion assignments: one CAPTAIN and one VICE_CAPTAIN.
* CompanionProfile.designation is assigned at companion signup (CAPTAIN or VICE_CAPTAIN).
* BookingCompanionAssignment.designation must match the assigned companion's CompanionProfile.designation.
* A Booking may transition to ACTIVE only if it is currently CONFIRMED and both companion assignments have selfMatchStatus=MATCHED and clientMatchStatus=CLIENT_MATCHED.
* A Booking may transition to COMPLETED only if it is currently ACTIVE.
* Cancellation is allowed from CONFIRMED or ACTIVE and always results in status CANCELLED.
* A RosterSlot cannot be BOOKED by more than one Booking.
* BookingRatings are immutable once created.
* A BookingRating must reference a valid Booking.
* Booking.endAt must equal Booking.startAt + 2 hours initially. Extension adds exactly 1 hour.
* A Booking can only be extended once (enforced by extendedAt: if non-null, extension is not allowed).
* BookingCompanionAssignment.selfMatchStatus can only transition to MATCHED if both assignments for the same Booking have presenceStatus=ARRIVED.
* A companion may only transition presenceStatus to ARRIVED if their CompanionProfile.isActive is true.
* When client-companion matching succeeds (Captain scans client QR/PIN), both companion assignments for that Booking must transition clientMatchStatus to CLIENT_MATCHED atomically.
* RosterSlot availability is determined by intersection of companion's assigned roster slots and venue operating hours, excluding BOOKED slots.

## 5. Entity Relationships

User → Booking (1:N)

User (COMPANION) → CompanionProfile (1:1)

Venue → Booking (1:N)

Venue → RosterSlot (1:N)

User (COMPANION) → RosterSlot (1:N)

Booking → RosterSlot (1:N)

Booking → BookingCompanionAssignment (1:2)

User (COMPANION) → BookingCompanionAssignment (1:N)

Booking → BookingRating (1:N)

User → BookingRating (1:N)

## 6. Naming & API Conventions

* REST-style APIs
* JSON communication
* Use camelCase for JSON field names and identifiers

## 7. ID & Data Rules

* Use UUID for all IDs
* Use ISO 8601 timestamps for all time fields
* Use ENUMs for all state and role fields
* Booking.endAt is calculated as Booking.startAt + 2 hours on creation. Extension updates endAt by +1 hour.
* Booking.qrCode and Booking.pinCode are generated at booking creation (used for client-companion matching). No rotation occurs.
* Booking.comMatchQrCode and Booking.comMatchPinCode are generated at booking creation (used for companion-companion matching).
* Booking.bookingColor is a unique fixed color assigned per booking for visual identification.

## 8. Error Handling Principles

* Use a standard error envelope with: code, message
* Invalid state transition: 400
* Not found: 404
* Server error: 500

## 9. High-Level Architecture

* Backend: Node.js (TypeScript) as a modular monolith
* Database: PostgreSQL as the system of record
* Client: React Native with Expo (TypeScript)
* Realtime communication is not required in the initial iteration
* Layering:
  * routes
  * services
  * data access

> Full tooling and library choices are defined in [`SDS/tech-stack.md`](tech-stack.md).
