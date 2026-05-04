# Database Schema (PostgreSQL)

This document defines the relational schema used by the backend. It is derived from:
1) [SDS/core_sds.md](../core_sds.md)
2) the master flow documents in `master-document/`.

## Conventions

* Database: PostgreSQL
* IDs: `uuid`
* Timestamps: `timestamptz` (store UTC)
* Naming:
	* DB tables/columns use `snake_case`
	* API/JSON uses `camelCase` (mapping handled in application/ORM)
* Arrays: use `text[]` for small enumerated lists (e.g., languages, tags)

---

## Enums

```sql
CREATE TYPE user_role AS ENUM ('CLIENT', 'COMPANION');

CREATE TYPE venue_type AS ENUM ('MALL', 'CLUB', 'RESTAURANT');

CREATE TYPE roster_slot_status AS ENUM ('AVAILABLE', 'BOOKED');

CREATE TYPE booking_status AS ENUM ('CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TYPE companion_designation AS ENUM ('CAPTAIN', 'VICE_CAPTAIN');
CREATE TYPE presence_status AS ENUM ('ASSIGNED', 'ARRIVED');
CREATE TYPE self_match_status AS ENUM ('NOT_MATCHED', 'MATCHED');
CREATE TYPE client_match_status AS ENUM ('WAITING_FOR_CLIENT', 'CLIENT_MATCHED');

CREATE TYPE "BookingRatingType" AS ENUM ('CLIENT_RATING_DUO', 'COMPANION_RATING_CLIENT');
```

---

## Tables

### users

```sql
CREATE TABLE users (
	id uuid PRIMARY KEY,
	role user_role NOT NULL,
	name text NOT NULL,
	nickname text NOT NULL,
	email text NOT NULL UNIQUE,
	password_hash text NOT NULL,
	email_verified boolean NOT NULL DEFAULT false,
	biometric_auth_enabled boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
```

Notes:
* `role` is immutable at the application layer.

---

### companion_profiles

```sql
CREATE TABLE companion_profiles (
	id uuid PRIMARY KEY,
	user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	designation companion_designation NOT NULL DEFAULT 'VICE_CAPTAIN',
	is_active boolean NOT NULL DEFAULT true,
	languages text[] NOT NULL DEFAULT '{}',
	profile_picture_url text NOT NULL DEFAULT '',
	average_rating numeric(3,2) NOT NULL DEFAULT 0.00
);

CREATE INDEX idx_companion_profiles_designation ON companion_profiles(designation);
CREATE INDEX idx_companion_profiles_active ON companion_profiles(is_active);
```

Notes:
* Only `users.role = 'COMPANION'` should have a companion profile (enforced in application).

---

### companion_venue_assignments

Tracks which venues a companion is rostered/assigned to serve.

```sql
CREATE TABLE companion_venue_assignments (
	companion_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
	assigned_at timestamptz NOT NULL DEFAULT now(),

	PRIMARY KEY (companion_id, venue_id)
);

CREATE INDEX idx_companion_venue_assignments_venue ON companion_venue_assignments(venue_id);
```

Notes:
* A companion can be assigned to multiple venues (one-to-many relationship).
* Roster slot population (Venues & Availability module) uses this table to determine which venues to create slots for.
* Managed by the Companion Profile module or Admin.

---

### venues

```sql
CREATE TABLE venues (
	id uuid PRIMARY KEY,
	name text NOT NULL,
	address text NOT NULL,
	venue_type venue_type NOT NULL,

	-- Required for GPS-based “at venue” checks in matching (master-doc 1.4)
	latitude numeric(10,7) NOT NULL,
	longitude numeric(10,7) NOT NULL,

	operating_hours_start time NOT NULL,
	operating_hours_end time NOT NULL
);

CREATE INDEX idx_venues_type ON venues(venue_type);
```

---

### bookings

```sql
CREATE TABLE bookings (
	id uuid PRIMARY KEY,
	client_id uuid NOT NULL REFERENCES users(id),
	venue_id uuid NOT NULL REFERENCES venues(id),

	start_at timestamptz NOT NULL,
	end_at timestamptz NOT NULL,
	status booking_status NOT NULL,

	-- Client-companion matching artifacts
	qr_code text NOT NULL,
	pin_code text NOT NULL,
	booking_color text NOT NULL,

	-- Companion-companion self-match artifacts
	com_match_qr_code text NOT NULL,
	com_match_pin_code text NOT NULL,

	-- Null until the booking is extended (at most once)
	extended_at timestamptz NULL,

	-- Null until the 15-min near-end notification has fired (session-in-progress)
	near_end_notified_at timestamptz NULL,

	created_at timestamptz NOT NULL DEFAULT now(),

	CONSTRAINT chk_bookings_time_range CHECK (end_at > start_at),
	CONSTRAINT chk_bookings_extended_at CHECK (extended_at IS NULL OR extended_at >= start_at)
);

-- Enforce: one non-terminal booking per client (CONFIRMED/ACTIVE)
CREATE UNIQUE INDEX uq_bookings_one_non_terminal_per_client
	ON bookings (client_id)
	WHERE status IN ('CONFIRMED', 'ACTIVE');

CREATE INDEX idx_bookings_venue_time ON bookings(venue_id, start_at);
CREATE INDEX idx_bookings_client_status ON bookings(client_id, status);
```

Notes:
* Duration rules (2 hours initial, +1 hour extension once) are enforced in application logic.

---

### roster_slots

Represents venue-based roster availability windows for companions.

```sql
CREATE TABLE roster_slots (
	id uuid PRIMARY KEY,
	venue_id uuid NOT NULL REFERENCES venues(id),
	companion_id uuid NOT NULL REFERENCES users(id),

	-- Null when AVAILABLE; set when BOOKED
	booking_id uuid NULL REFERENCES bookings(id),

	start_at timestamptz NOT NULL,
	end_at timestamptz NOT NULL,
	status roster_slot_status NOT NULL,

	CONSTRAINT chk_roster_slots_time_range CHECK (end_at > start_at),
	CONSTRAINT chk_roster_slots_booking_link CHECK (
		(status = 'AVAILABLE' AND booking_id IS NULL)
		OR
		(status = 'BOOKED' AND booking_id IS NOT NULL)
	)
);

-- Prevent duplicate slot definitions
CREATE UNIQUE INDEX uq_roster_slots_unique_slot
	ON roster_slots (venue_id, companion_id, start_at, end_at);

CREATE INDEX idx_roster_slots_lookup
	ON roster_slots (venue_id, start_at, status);

CREATE INDEX idx_roster_slots_companion_time
	ON roster_slots (companion_id, start_at);
```

Notes:
* Overlap prevention for a companion’s BOOKED slots can be enforced at the application layer.

---

### booking_companion_assignments

```sql
CREATE TABLE booking_companion_assignments (
	id uuid PRIMARY KEY,
	booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
	companion_id uuid NOT NULL REFERENCES users(id),
	designation companion_designation NOT NULL,

	presence_status presence_status NOT NULL DEFAULT 'ASSIGNED',
	self_match_status self_match_status NOT NULL DEFAULT 'NOT_MATCHED',
	client_match_status client_match_status NOT NULL DEFAULT 'WAITING_FOR_CLIENT',

	CONSTRAINT uq_assignment_booking_designation UNIQUE (booking_id, designation),
	CONSTRAINT uq_assignment_booking_companion UNIQUE (booking_id, companion_id)
);

CREATE INDEX idx_assignments_booking ON booking_companion_assignments(booking_id);
CREATE INDEX idx_assignments_companion ON booking_companion_assignments(companion_id);
```

Notes:
* Application enforces: exactly two assignments per booking (one CAPTAIN, one VICE_CAPTAIN).
* Application enforces atomic updates for match status transitions.

---

### booking_ratings

```sql
CREATE TABLE booking_ratings (
	id uuid PRIMARY KEY,
	booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
	rater_user_id uuid NOT NULL REFERENCES users(id),
	rating_type "BookingRatingType" NOT NULL,

	stars smallint NULL,
	tags text[] NOT NULL DEFAULT '{}',
	comment text NOT NULL DEFAULT '',

	created_at timestamptz NOT NULL DEFAULT now(),

	CONSTRAINT chk_booking_ratings_stars CHECK (stars IS NULL OR (stars BETWEEN 1 AND 5)),
	CONSTRAINT chk_booking_ratings_comment_length CHECK (char_length(comment) <= 300),
	CONSTRAINT uq_booking_ratings_once UNIQUE (booking_id, rating_type, rater_user_id)
);

CREATE INDEX idx_booking_ratings_booking ON booking_ratings(booking_id);
CREATE INDEX idx_booking_ratings_rater ON booking_ratings(rater_user_id);
```

Notes:
* For `CLIENT_RATING_DUO`, the targets are the two companions assigned to the booking.
* For `COMPANION_RATING_CLIENT`, the target is `bookings.client_id`.
* `companion_profiles.average_rating` is updated by application logic when new ratings are created.

---

## Supporting Tables (Required by Master-Document Flows)

These tables support 1.4/1.5 behaviors (location sharing/monitoring, SOS, companion chat) without introducing realtime infrastructure.

### booking_participant_locations

Stores the latest known location per booking participant (client or companion).

```sql
CREATE TABLE booking_participant_locations (
	booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
	user_id uuid NOT NULL REFERENCES users(id),

	latitude numeric(10,7) NOT NULL,
	longitude numeric(10,7) NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now(),

	PRIMARY KEY (booking_id, user_id)
);

CREATE INDEX idx_booking_participant_locations_booking
	ON booking_participant_locations(booking_id);
```

### booking_messages

Companion-to-companion messages during an active session.

```sql
CREATE TABLE booking_messages (
	id uuid PRIMARY KEY,
	booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
	sender_user_id uuid NOT NULL REFERENCES users(id),
	message_text text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_messages_booking_time
	ON booking_messages(booking_id, created_at);
```

### booking_sos_events

Tracks SOS triggers during a session.

```sql
CREATE TABLE booking_sos_events (
	id uuid PRIMARY KEY,
	booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
	triggered_by_user_id uuid NOT NULL REFERENCES users(id),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_sos_events_booking_time
	ON booking_sos_events(booking_id, created_at);
```

