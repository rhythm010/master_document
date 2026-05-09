# Milestone 4: Booking Logic Flow

## Objective

Build the Client booking journey with minimal UI.

The user should be able to create a real backend booking and reach the booking confirmation state.

## Scope

- Book companions entry from Home
- Location page
- Calendar/date selection
- Time selection
- Companion gender/type selection as static V1 page
- Book-now review page
- Price and location display
- Booking creation
- Booking confirmation
- Companion information update
- Booking cancellation
- Booking state refresh

## Tasks

- Connect Home Book companions action to the booking flow.
- Build location/venue search.
- Build venue selection.
- Build calendar/date selection.
- Build availability lookup for selected venue/date.
- Build time slot selection.
- Build static companion gender/type selection.
- Build book-now review page.
- Display selected location, date, time, duration, and price/package info.
- Trigger booking creation against backend.
- Show booking confirmation after backend success.
- Fetch booking details after creation.
- Update confirmation screen if companion information becomes available.
- Allow booking cancellation.
- Refresh home/current-state after create and cancel.
- Add error states for:
  - no venue results
  - no availability
  - existing active/confirmed booking
  - booking creation failure
  - cancellation failure

## Design References

- `client-booking-location.png`
- `client-booking-calendar.png`
- `client-booking-time-slot.png`
- `client-booking-companion-gender.png`
- `client-booking-book-now.png`
- `client-confirmation-without-companions.png`
- `client-confirmation-with-companions.png`

## Placeholder Or Static V1 Items

The following can stay mock/static unless backend support exists:

- AR button
- package carousel beyond the backend-supported booking product
- non-core notification behavior
- companion gender/type if backend does not filter by it yet
- price/package variants if backend does not support package selection yet

## Backend Dependencies

- Venue search
- Venue details, if available
- Availability lookup
- Booking creation
- Booking details
- Booking cancellation
- Companion reveal or companion assignment behavior

Important known gaps to check:

- booking details companion reveal mismatch
- missing public venue detail endpoint
- missing companion user id in booking details
- missing public companion profile detail endpoint
- venue search requiring non-empty query
- pricing/package behavior not fully backed by backend

## Validation

Simulator or web can validate:

- full booking flow UI
- Home entry
- location/venue search
- calendar/date selection
- availability lookup
- time selection
- static companion type step
- book-now review
- booking creation
- confirmation
- companion info update
- cancellation
- error states
- mock/static AR, package, and notification behavior

Real devices should validate:

- one full Client booking flow on iOS
- one full Client booking flow on Android
- real-device API connectivity
- layout sanity for booking screens

## Done Means

- A Client can search for a venue.
- A Client can select an available time.
- A Client can pass through the static companion gender/type step.
- A Client can review price and location details.
- A Client can create a real booking.
- A Client sees booking confirmation after backend confirmation.
- A Client can view assigned companion information when backend provides it.
- A Client can cancel a confirmed booking.
