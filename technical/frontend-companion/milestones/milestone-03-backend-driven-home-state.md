# Milestone 3: Backend-Driven Home State

## Objective

Build the logic that decides what the user should do next after login.

The frontend should not guess the app state from screens. It should derive the current state from backend data and route the user accordingly.

## State Model

The frontend should use a lightweight state resolver that mirrors backend state conceptually, but it should not become a second source of truth.

The backend remains authoritative.

Frontend state should answer:

- what is the user's role?
- does the user have a current booking?
- is matching required?
- is a session active?
- is feedback required?
- what screen should open next?

## Client States

- no booking
- confirmed booking
- matching needed
- active session
- rating needed

## Companion States

- inactive
- active but no assignment
- assigned booking
- matching needed
- active session
- rating needed

## Scope

- Home page logic
- Minimum home UI
- Book companions entry point
- Wallet tab placeholder
- Profile tab minimum UI or placeholder
- Current user state resolver
- Current booking lookup
- Current session lookup
- Current matching state lookup
- Rating-needed detection
- Companion active/inactive detection
- Refresh after login and app resume

## Tasks

- Build the state resolver module.
- Define frontend state names explicitly.
- Map backend booking/session/matching/rating responses into those frontend states.
- Add route guards based on resolved state.
- Add refresh after login.
- Add refresh after app resume.
- Add minimum Client home UI.
- Add minimum Companion home UI if Companion role is in V1 implementation scope.
- Add Book companions entry point.
- Add placeholder behavior for:
  - Wallet
  - Your companions
  - Share companions
  - About Companions
  - notification details
  - non-core Profile actions

## Design Notes

Client home design reference:

- `technical/frontend-companion/design-reference/v1/client-home-page.png`

Not every visible control in the design is functional in V1. The core functional path is the Book companions entry point.

## Backend Dependencies

The frontend likely needs a backend endpoint that returns the current relevant booking or next action for the logged-in user.

Register or keep gaps for:

- current user booking and next action endpoint
- assigned companion current booking lookup
- rating submitted or rating needed state lookup

## Validation

Simulator or web can validate:

- home logic
- minimum home UI
- Book companions entry point
- placeholder tab behavior
- frontend state resolver
- current booking/session/matching lookups
- rating-needed detection
- companion active/inactive detection
- route guards
- refresh after login

Real devices should validate:

- app-resume refresh
- auth/session state after background/foreground cycles
- one Client landing-state smoke test
- one Companion landing-state smoke test if Companion app flow is active

## Done Means

- After login, the app can determine the user's current state.
- The app routes the user to the correct next flow.
- The app does not rely on manually entered booking IDs.
- Client and Companion users both land in a meaningful minimum home state.
- The Book companions action starts the booking flow.
