Feature: Matching Flow
Version: 1.0.0
Status: Current
Previous Version: None
Change Type: MAJOR
Change Summary: Initial version with Round-2 fixes for Matching Flow.
Created At: 2026-04-30T00:00:00Z
Last Edited At: 2026-04-30T00:00:00Z
Owner: TBD
Module: Matching Flow

1. Purpose
- Define companion-companion and client-companion matching at the venue on the booking day.
- Provide a shared matching map view and verification via QR/PIN.
- Enforce mandatory GPS permissions and location-sharing rules.
- Define Start Matching as the creation of the client row in booking_participant_locations via /client-match/start.

2. API Contract
- GET /bookings/{bookingId}/com-match/context
  - Returns com-com matching context for Captain or Vice Captain (QR/PIN only for Captain).
- POST /bookings/{bookingId}/com-match/verify
  - Vice Captain verifies Captain QR/PIN and completes companion-companion matching.
- GET /bookings/{bookingId}/matching/context
  - Returns matching-page context for client or companion.
- POST /bookings/{bookingId}/client-match/start
  - Client starts matching; creates client location row and enables two-way sharing.
- POST /bookings/{bookingId}/client-match/verify
  - Captain verifies client QR/PIN and confirms client-companion match.
- POST /bookings/{bookingId}/matching/location
  - Client or companion sends GPS updates to booking_participant_locations.
- POST /bookings/{bookingId}/cancel
  - End Booking action for client or companion (existing cancellation flow).

3. Input
- GET /bookings/{bookingId}/com-match/context: no body
- POST /bookings/{bookingId}/com-match/verify:
  - verificationMethod: 'QR' | 'PIN'
  - qrCode (required if method=QR)
  - pinCode (required if method=PIN)
- GET /bookings/{bookingId}/matching/context: no body
- POST /bookings/{bookingId}/client-match/start:
  - latitude (required)
  - longitude (required)
  - gpsPermissionGranted (required, boolean)
  - gpsEnabled (required, boolean)
- POST /bookings/{bookingId}/client-match/verify:
  - verificationMethod: 'QR' | 'PIN'
  - qrCode (required if method=QR)
  - pinCode (required if method=PIN)
- POST /bookings/{bookingId}/matching/location:
  - latitude (required)
  - longitude (required)
  - gpsPermissionGranted (required, boolean)
  - gpsEnabled (required, boolean)

4. Output
- GET /bookings/{bookingId}/com-match/context:
  - Captain: bookingId, comMatchQrCode, comMatchPinCode
  - Vice Captain: bookingId, scannerEnabled=true
- POST /bookings/{bookingId}/com-match/verify:
  - bookingId, selfMatchStatus='MATCHED'
- GET /bookings/{bookingId}/matching/context:
  - Client:
    - bookingId, bookingStatus, bookingColor
    - companions: [{id, displayName, languages, averageRating, profilePictureUrl}]
    - companionLocations: [{companionId, latitude, longitude, updatedAt}]
    - qrCode, pinCode (displayed at T−30; generated at booking creation)
    - clientMatchStarted (true if client row exists)
  - Companion:
    - bookingId, bookingStatus, bookingColor, clientNickname
    - clientLocation (only if clientMatchStarted)
    - clientMatchStarted
    - canVerifyClientMatch (true for Captain only)
- POST /bookings/{bookingId}/client-match/start:
  - bookingId, clientMatchStarted=true, locationSharingState='TWO_WAY'
- POST /bookings/{bookingId}/client-match/verify:
  - bookingId, bookingStatus='ACTIVE', clientMatchStatus='CLIENT_MATCHED'
- POST /bookings/{bookingId}/matching/location:
  - bookingId, updatedAt
- POST /bookings/{bookingId}/cancel:
  - As defined in booking cancellation SDS

5. Authorization Rules
- All endpoints require authenticated user.
- Client endpoints (/client-match/start, /matching/context for client):
  - user.id must equal bookings.client_id.
- Companion endpoints:
  - user must be in booking_companion_assignments for the booking.
  - /client-match/verify requires designation=CAPTAIN.
  - /com-match/verify requires designation=VICE_CAPTAIN.
  - /com-match/context requires designation=CAPTAIN or VICE_CAPTAIN; QR/PIN returned only to Captain.
- /matching/location allowed for client or assigned companions only.
- /cancel allowed for client or assigned companions (End Booking action).

6. Preconditions
- Booking exists and status is CONFIRMED.
  - Exception: if booking is ACTIVE and the operation is idempotent, return success without error (see Idempotency Rules).
- Booking has exactly two companion assignments (CAPTAIN, VICE_CAPTAIN).
- Companion-companion context and verification require both companions presence_status=ARRIVED.
- Client-companion verification requires both assignments self_match_status=MATCHED.
- Timing note: T−30 is UI guidance only; backend does not enforce time gating.
- GPS permissions:
  - Client must grant location permission; no alternative path.
  - Companions must keep GPS always-on; background updates are required.
- Valid latitude/longitude must be provided for any location write.

7. Data Access Mapping
- bookings: read status, start_at, venue_id, qr_code, pin_code, booking_color, com_match_qr_code, com_match_pin_code; update status to ACTIVE on client match confirm.
- booking_companion_assignments: read designation, presence_status, self_match_status, client_match_status; update self_match_status and client_match_status.
- booking_participant_locations: upsert current location for client and companions; read for map context.
- venues: read latitude/longitude for 400m radius check.
- users, companion_profiles: read client nickname and companion display details for matching context.

8. Business Logic
8.1 GET /bookings/{bookingId}/com-match/context
- Authorize companion and fetch both assignments.
- If either assignment presence_status != ARRIVED, return 400 PRESENCE_NOT_ARRIVED (do not expose QR/PIN).
- If caller is CAPTAIN, return comMatchQrCode and comMatchPinCode.
- If caller is VICE_CAPTAIN, return scannerEnabled=true only.

8.2 POST /bookings/{bookingId}/com-match/verify
- Authorize VICE_CAPTAIN only.
- Validate presence_status=ARRIVED for both companions.
- Validate QR/PIN against bookings.com_match_qr_code / com_match_pin_code.
- If both assignments self_match_status already MATCHED, return 200 idempotent.
- Otherwise, update both assignments self_match_status=MATCHED atomically.
- Trigger client notification timing (see Side Effects).

8.3 GET /bookings/{bookingId}/matching/context
- Authorize client or assigned companion.
- Backend does not enforce T−30; UI controls when the screen is shown.
- Client response:
  - Always include companion details and companion locations.
  - Include qrCode and pinCode (generated at booking creation; displayed at T−30).
  - Set clientMatchStarted based on existence of client row in booking_participant_locations.
- Companion response:
  - Include clientNickname and bookingColor.
  - Include clientLocation only if clientMatchStarted is true (client row exists).
  - canVerifyClientMatch is true only for CAPTAIN.

8.4 POST /bookings/{bookingId}/client-match/start
- Authorize client.
- Require valid GPS coordinates and location permission flags.
- If gpsPermissionGranted is false, return 400 GPS_PERMISSION_REQUIRED.
- If gpsEnabled is false, return 400 GPS_DISABLED.
- If booking is ACTIVE and clientMatchStarted already true, return 200 idempotent.
- Otherwise require booking.status=CONFIRMED.
- Compute distance between client coordinates and venue; if >400m, return 400 OUTSIDE_VENUE_RADIUS.
- Upsert booking_participant_locations row for client (this is Start Matching state).
- Return clientMatchStarted=true and locationSharingState='TWO_WAY'.

8.5 POST /bookings/{bookingId}/matching/location
- Authorize client or assigned companion.
- Require valid GPS coordinates and location permission flags.
- If gpsPermissionGranted is false, return 400 GPS_PERMISSION_REQUIRED.
- If gpsEnabled is false, return 400 GPS_DISABLED.
- If caller is client and clientMatchStarted is false, return 400 CLIENT_MATCH_NOT_STARTED.
- Upsert booking_participant_locations for caller with updated_at=now().

8.6 POST /bookings/{bookingId}/client-match/verify
- Authorize CAPTAIN only.
- Validate QR/PIN against bookings.qr_code / pin_code.
- If booking is ACTIVE and both assignments already client_match_status=CLIENT_MATCHED, return 200 idempotent.
- Otherwise require booking.status=CONFIRMED.
- Require both assignments self_match_status=MATCHED.
- Atomically update both assignments client_match_status=CLIENT_MATCHED and update bookings.status=ACTIVE.

8.7 POST /bookings/{bookingId}/cancel
- Used by client or companion 'End Booking' action.
- Executes booking cancellation flow (CONFIRMED/ACTIVE → CANCELLED) and redirects to home; no rating page.

9. State Changes
- Start Matching: defined by existence of client row in booking_participant_locations (no new booking status).
- Com-com match: booking_companion_assignments.self_match_status NOT_MATCHED → MATCHED for both.
- Client match verify: booking_companion_assignments.client_match_status WAITING_FOR_CLIENT → CLIENT_MATCHED for both; bookings.status CONFIRMED → ACTIVE.
- Cancel: bookings.status CONFIRMED/ACTIVE → CANCELLED.

10. DB Operations
- com-match/context: SELECT bookings, booking_companion_assignments.
- com-match/verify: UPDATE booking_companion_assignments (both rows) to self_match_status=MATCHED.
- matching/context: SELECT bookings, booking_companion_assignments, users, companion_profiles, booking_participant_locations.
- client-match/start: UPSERT booking_participant_locations for client.
- matching/location: UPSERT booking_participant_locations for caller.
- client-match/verify: UPDATE booking_companion_assignments (both rows) to client_match_status=CLIENT_MATCHED; UPDATE bookings.status=ACTIVE.
- cancel: UPDATE bookings.status=CANCELLED (per cancellation SDS).

11. Transaction Boundaries
- com-match/verify: one transaction updating both companion assignments.
- client-match/verify: one transaction updating both companion assignments and booking status.
- client-match/start and matching/location: single upsert statement each.
- context endpoints are read-only.

12. Constraints
- Client GPS permission is mandatory; no alternative path.
- Companions must keep GPS always-on; location updates are required throughout matching.
- Latitude/longitude must be present and valid numeric ranges.
- Start Matching allowed only when client is within 400m of venue.
- QR/PIN codes are generated at booking creation and never rotated.
- QR/PIN should be displayed at T−30 by the UI; backend does not enforce time gating.
- Matching page timing (T−30) is UI guidance only.
- Com-com context and verification require presence_status=ARRIVED for both companions.
- Booking state transitions must respect core SDS invariants.

13. Concurrency Rules
- Use row-level locks on bookings and assignments for match verification to prevent double updates.
- booking_participant_locations uses primary key (booking_id, user_id) with upsert to ensure last-write-wins.
- Idempotent checks must occur before enforcing status=CONFIRMED to allow ACTIVE idempotent responses.
- All status transitions are atomic.

14. Failure Cases
- 400 GPS_PERMISSION_REQUIRED: location permission not granted.
- 400 GPS_DISABLED: device GPS unavailable.
- 400 INVALID_COORDINATES: missing or invalid latitude/longitude.
- 400 OUTSIDE_VENUE_RADIUS: client not within 400m on start.
- 400 PRESENCE_NOT_ARRIVED: com-com context or verify before both ARRIVED.
- 400 SELF_MATCH_INCOMPLETE: client match verify before com-com match.
- 400 CLIENT_MATCH_NOT_STARTED: client location update before /client-match/start.
- 400 INVALID_QR_OR_PIN: verification failed.
- 400 INVALID_STATE: booking status not eligible (and not idempotent).
- 403 FORBIDDEN: user not authorized or wrong designation.
- 404 BOOKING_NOT_FOUND.
- 500 SERVER_ERROR.

15. Side Effects
- com-match/verify triggers push notification to client: 'Your companions are ready'.
  - If com-com match completes before T−30, schedule notification at T−30.
  - If after T−30, send immediately.
- client-match/verify starts the session clock by transitioning booking to ACTIVE.
- End Booking uses cancellation flow; no rating page is shown.

16. Idempotency Rules
- /client-match/start: if client location row exists, return 200 with current matching state (even if booking is ACTIVE).
- /client-match/verify: if booking is ACTIVE and both assignments already CLIENT_MATCHED, return 200 with current state (no 409).
- /com-match/verify: if both assignments already MATCHED, return 200.
- /matching/location: upsert is idempotent for repeated updates of same coordinates.
- Context endpoints are read-only and safe to retry.
