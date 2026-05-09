# Milestone 1: Core App Foundation

## Objective

Turn the placeholder app into a real application shell.

This milestone creates the foundation that every later flow will depend on: navigation, API client, auth storage, environment handling, state handling, errors, loading states, and role-based routing.

## Scope

- Navigation structure
- API client
- Environment configuration
- Auth token storage
- Session restore
- Shared loading and error behavior
- Role-based route handling
- Backend error envelope handling
- Local email verification support
- One-time onboarding completion storage
- Placeholder behavior for non-core buttons

## Tasks

- Define navigation groups for:
  - unauthenticated routes
  - authenticated Client routes
  - authenticated Companion routes
  - shared routes
  - placeholder routes
- Build an API client wrapper with:
  - base URL config
  - auth token injection
  - request timeout
  - backend error normalization
  - retry policy only where safe
- Add secure auth/session storage.
- Add session restore on app startup.
- Add global loading and error patterns.
- Add role detection after login/profile fetch.
- Add route guards for authenticated and unauthenticated screens.
- Add consistent placeholder behavior for design buttons that are not functional in V1.
- Confirm local email verification infrastructure works, such as Mailpit or the backend's configured local inbox.
- Make sure verification links can be opened and handled by the app once deep linking exists.

## Email Service Definition Of Done

Milestone 1 should not be considered done unless the email service works locally.

At minimum:

- backend can send a verification email in local development
- developer can open the local inbox
- verification email contains a usable verification link
- user can complete verification through the intended flow

Staging email can be configured later, but the gap must remain visible until it is ready.

## Backend Dependencies

- Auth login/signup/profile endpoints
- Email verification and resend endpoints
- Backend error format
- Local SMTP or local inbox setup

Register gaps if:

- backend routes do not match the mobile API client assumptions
- email verification link format is not mobile-friendly
- staging email provider is not configured
- CORS blocks Expo web testing

## Validation

Simulator or web can validate:

- navigation
- route map
- placeholder button behavior
- API client
- environment config
- app state
- loading and error handling
- role routing
- backend error envelopes
- local email inbox loop
- onboarding completion storage

Real devices should validate:

- token/session restore after restart
- API calls using local or staging URLs
- email verification opening the correct app/path if deep linking is wired

## Done Means

- The app can log in.
- The app can store a token.
- The app can restore a session after restart.
- The app can route Client and Companion users differently.
- The app handles backend errors consistently.
- The backend can send verification emails locally.
- The local verification flow works.
- The app remembers whether onboarding has been completed once.
