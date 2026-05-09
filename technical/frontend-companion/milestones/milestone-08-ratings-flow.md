# Milestone 8: Ratings Flow

## Objective

Build rating logic after session completion or eligible cancellation.

Use basic inputs first. Final styling comes later.

## Scope

- Feedback page
- Client rating flow
- Companion rating flow
- Stars input
- Tags input
- Optional comment input
- Client skip behavior where allowed
- Companion no-skip behavior
- Rating submission
- Duplicate submission handling
- Return-to-home behavior
- Rating-needed state cleanup

## Tasks

- Detect when feedback is required.
- Route user to feedback screen after session completion or eligible cancellation.
- Build Client feedback form.
- Build Companion feedback form if Companion rating is in V1 scope.
- Add stars input where required.
- Add tags input.
- Add optional comment field.
- Add skip option for Client only where allowed.
- Prevent Companion skip if backend requires rating.
- Submit rating to backend.
- Handle duplicate submission safely.
- Refresh current state after rating.
- Return user to the correct home state.
- Add errors for:
  - missing required rating fields
  - duplicate rating
  - invalid booking state
  - network failure

## Design References

- `client-feedback.png`
- `client-feedback-client.png`

## Backend Dependencies

- Rating submission endpoint
- Existing rating or rating-needed state endpoint
- Booking details with companion information after completion
- Rating tag definitions

Important known gaps to check:

- terminal booking details do not return companion info for feedback
- missing rating submitted or existing rating read
- negative feedback tags are not defined

## Validation

Simulator or web can validate:

- feedback layout
- stars
- tags
- optional comment
- Client skip behavior
- Companion no-skip behavior
- rating validation
- rating submission
- duplicate handling
- return-to-home behavior
- rating-needed cleanup

Real devices should validate:

- one Client rating smoke test on iOS
- one Client rating smoke test on Android
- real keyboard/comment behavior
- return-to-home after rating

## Done Means

- Feedback appears after session completion or eligible cancellation.
- Client can rate the companion duo.
- Companion can rate the Client if Companion rating is in V1.
- Required rating rules are enforced.
- Duplicate submission is handled safely.
- The app returns the user to the correct home state.
