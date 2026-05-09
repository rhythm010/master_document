# Milestone 2: Identity Flow With Minimum UI

## Objective

Build the real account access flow using simple, functional UI.

The final visual designs for signup, login, and email verification are not available yet, so these screens should stay plain until Milestone 10.

## Scope

- Onboarding
- Signup
- Login
- Logout
- Email verification
- Resend verification
- Profile fetch
- Authenticated and unauthenticated route protection

## Tasks

- Build onboarding with:
  - image/video content support
  - next button
  - back button
  - completion state
  - download-once or cache-once behavior if remote media is used
- Build minimum Client signup form.
- Build minimum Companion signup form.
- Build minimum login form.
- Build logout.
- Build email verification handling.
- Build resend verification.
- Fetch logged-in user profile after login/session restore.
- Block or redirect unverified users correctly.
- Keep final UI styling out of scope.

## Design Notes

There are currently no finalized design references for:

- signup
- login
- email verification

Use minimum functional forms in this milestone.

Onboarding may use bundled or downloaded media depending on final asset strategy. If media hosting is not ready, use bundled local assets and keep the backend/media gap registered.

## Backend Dependencies

- Client signup endpoint
- Companion signup endpoint
- Login endpoint
- Email verification endpoint
- Resend verification endpoint
- Current user profile endpoint

Register gaps if:

- backend role naming differs from frontend role routing
- email verification does not support mobile deep links
- onboarding media hosting is expected from backend but not available

## Validation

Simulator or web can validate:

- onboarding controls
- onboarding persistence
- basic cache/download behavior
- signup
- login
- logout
- resend verification
- profile fetch
- route protection
- unverified-user handling

Real devices should validate:

- email verification deep links from a real email app
- session persistence after closing/reopening
- onboarding media behavior if it differs from simulator
- biometric login only if added later

## Done Means

- A user can complete onboarding once.
- A Client can create an account.
- A Companion can create an account.
- Both roles can verify email.
- Both roles can log in.
- Both roles remain authenticated after closing and reopening the app.
- The app fetches the logged-in user profile.
