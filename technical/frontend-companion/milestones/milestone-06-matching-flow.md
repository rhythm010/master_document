# Milestone 6: Matching Flow

## Objective

Connect native capabilities to the backend matching APIs.

This milestone should move a real booking from confirmed to active using camera, QR/PIN, GPS, maps, and backend state transitions.

## Scope

- Matching page
- Companion-companion matching
- Captain QR/PIN display
- Vice Captain QR scan or PIN verification
- Client start matching with GPS
- Location permission enforcement
- Location updates to backend
- Matching map/context view
- Client QR/PIN display
- Captain client verification
- Transition from confirmed booking to active session
- Matching error states

## Tasks

- Build Matching page state rendering.
- Fetch matching context for the current booking.
- Show companion cards/details when available.
- Support Captain QR/PIN display.
- Support Vice Captain QR scanning.
- Support Vice Captain PIN fallback.
- Start Client matching with GPS coordinates.
- Enforce GPS permission before Client matching starts.
- Post location updates to backend.
- Render matching map with simulated or real positions.
- Show Client QR/PIN.
- Support Captain verification of Client QR/PIN.
- Handle transition to active session.
- Add cancel booking behavior if still allowed.
- Add errors for:
  - GPS disabled
  - permission denied
  - outside venue radius
  - invalid QR/PIN
  - expired QR/PIN
  - booking not in correct state

## Design References

- `client-matching-client-companion.png`
- `client-matching-client-companion-qr.png`

## Placeholder Or Static V1 Items

The following can stay mock/static unless backend support exists:

- Color Signal
- matching message/location input
- any purely visual companion signal behavior that does not affect backend state

## Backend Dependencies

- Companion-companion matching context
- Companion QR/PIN verification
- Client matching context
- Client start matching
- Client location updates
- Client QR/PIN verification
- Booking transition to ACTIVE

Important known gaps to check:

- companion presence arrival endpoint
- Client matching message/location input behavior
- Color Signal backend behavior

## Validation

Simulator or web can validate:

- matching page state rendering
- matching context API calls
- QR/PIN modal display
- PIN paths
- map layout with simulated positions
- matching error states
- GPS disabled UI
- outside-radius behavior with mocked coordinates
- invalid QR/PIN handling
- cancel booking
- mock/static Color Signal and message input behavior

Real devices must validate:

- actual QR scanning
- QR/PIN display on one device and verification from another if possible
- real GPS updates during matching
- Client start matching using real location
- outside-radius behavior with real or controlled location
- app background/foreground behavior
- CONFIRMED to ACTIVE transition on iOS and Android

## Done Means

- The Matching page shows the correct state for the current user.
- Companions can complete companion-companion matching.
- Client can start matching with GPS.
- Location updates are sent reliably.
- Captain can verify the Client using QR/PIN.
- A real booking can move from confirmed to active.
- Non-functional matching controls are clearly placeholders.
