# Backend Gap Register: Mobile Frontend V1

Created at: 2026-05-09T11:21:28Z

Last reviewed at: 2026-05-09T12:20:00Z

This file tracks backend API, service, data, environment, and contract gaps discovered during Version 1 mobile frontend planning and development.

Frontend agents must register a gap here before using a mock, static fallback, temporary workaround, or manual test path for missing backend behavior.

This register is organized by mobile frontend milestone. Within each milestone, gaps are ordered by severity:

1. Blocker
2. Needed Soon
3. Workaround Allowed
4. Nice to Have

## Backend Context Reviewed

Reviewed backend code and SDS context:

- Backend app/router registration in `technical/backend-companion/src/app.ts`
- Prisma schema in `technical/backend-companion/prisma/schema.prisma`
- Identity/Auth module routes, schemas, controllers, and service
- Roster/Venues module routes, schemas, controllers, and service
- Booking module routes, schemas, controllers, and service
- Companion Profile module routes, schemas, controllers, and service
- Matching module routes, schemas, controllers, service, and DTOs
- Session In Progress module routes, schemas, controllers, service, schedulers, and DTOs
- Ratings module routes, schemas, controllers, service, and DTOs
- Email service and URL/deep-link helpers
- Backend package scripts, seed file, env examples, and Docker config references
- Current feature SDS files under `SDS/feature-sds/`
- Core SDS and tech stack SDS

## Validation Notes

Validated against backend code and current SDS on 2026-05-09:

- `FE-BE-GAP-001` remains open: backend routes are currently mounted at root (`/health`, `/auth/login`, `/venues`, `/bookings`) rather than `/api/v1`.
- `FE-BE-GAP-002` is resolved in the current workspace: `src/app.ts` now sets CORS headers, supports local dev origins outside production, and reads `CORS_ALLOWED_ORIGINS` from config/env.
- `FE-BE-GAP-003`, `FE-BE-GAP-004`, and `FE-BE-GAP-005` remain open: SMTP is configurable but staging provider/credentials are not established in repo docs, app deep link remains fixed to `companion://...`, and onboarding media ownership is still a product/backend decision.
- Current SDS-to-code mismatches confirmed: `GET /venues/{venueId}` and `GET /companion-profiles/{companionId}` are required by current SDS but are not registered in the inspected route files.
- Current booking SDS says booking details always returns companion public info, but `booking.service.ts` still enforces a T-5h/status-based reveal and can return `companions: null`.
- Current-state/home, assigned-companion current booking lookup, and rating-read/status APIs are not present in inspected routes; the mobile app cannot reconstruct next action from backend alone.
- Push/in-app notifications remain placeholder/log-only in booking, matching, and session scheduler code; no push token registration endpoint or provider delivery path was found.
- Prisma seed remains effectively empty; repeatable mobile staging journey data is not available from `prisma/seed.ts`.

## Status Values

- Open
- In Progress
- Resolved
- Deferred

## Severity Values

- Blocker
- Needed Soon
- Workaround Allowed
- Nice to Have

## Gap Types

- Missing API
- Missing Service
- Contract Mismatch
- Missing Field
- Missing Seed/Test Data
- Environment Gap
- Third-Party Integration Gap
- Product Decision Needed

## Fixed Gap Report Format

Copy this format for every new backend gap.

```md
### FE-BE-GAP-000: Short Gap Title

Created at: YYYY-MM-DDTHH:MM:SSZ

Status: Open

Severity: Blocker | Needed Soon | Workaround Allowed | Nice to Have

Type: Missing API | Missing Service | Contract Mismatch | Missing Field | Missing Seed/Test Data | Environment Gap | Third-Party Integration Gap | Product Decision Needed

Found in milestone: Milestone number and name

Frontend area: Screen, flow, hook, API client, or native capability affected

Gap:
Describe what is missing or mismatched.

Expected backend support:
Describe the API, service, field, response shape, behavior, seed data, or environment config the frontend needs.

Current frontend workaround:
Describe the temporary mock, static behavior, manual setup, or blocked state. If no workaround is safe, write "None - blocker".

Acceptance criteria for resolution:
Describe exactly what must be true before this gap can be marked Resolved.

Resolution notes:
Leave empty until resolved. When resolved, include PR/commit/file references if available.
```

## Milestone 0: Real Device Placeholder App

### FE-BE-GAP-001: API Base Path Alignment

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Needed Soon

Type: Contract Mismatch

Found in milestone: Milestone 0: Real Device Placeholder App

Frontend area: Backend health check, API client bootstrap, environment config

Gap:
The old frontend testing harness expected an `/api/v1` base path, while the backend app currently mounts routes at root paths such as `/health`, `/auth/login`, `/venues`, and `/bookings`.

Expected backend support:
A clear final base URL and path convention for local, staging, and production mobile API calls.

Current frontend workaround:
Configure the new frontend API client against the currently working backend route root until a final convention is chosen.

Acceptance criteria for resolution:
The frontend environment config points to the agreed backend API base path, and health/auth/venues/bookings calls work consistently in local and staging.

Resolution notes:

### FE-BE-GAP-002: Browser/Web CORS Support For Expo Web

Created at: 2026-05-09T11:28:42Z

Status: Resolved

Severity: Needed Soon

Type: Environment Gap

Found in milestone: Milestone 0: Real Device Placeholder App

Frontend area: Expo web preview, local API calls from browser

Gap:
The backend app does not currently show CORS middleware. Expo web runs in a browser, so API calls from a different origin/port may be blocked even if the same calls work from simulator or real devices.

Expected backend support:
Local/staging CORS configuration that allows the frontend web dev origin while keeping production rules controlled.

Current frontend workaround:
Use simulator/real device for API smoke tests if browser CORS blocks Expo web.

Acceptance criteria for resolution:
Expo web can call backend health/auth endpoints in local development without browser CORS failures.

Resolution notes:
Resolved in current workspace as of 2026-05-09 validation. `technical/backend-companion/src/app.ts` includes CORS middleware with local-dev origin handling and `technical/backend-companion/src/shared/config/index.ts` exposes `corsAllowedOrigins` from `CORS_ALLOWED_ORIGINS`.

## Milestone 1: Core App Foundation

### FE-BE-GAP-003: Staging Email Provider And Verification Config

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Environment Gap

Found in milestone: Milestone 1: Core App Foundation

Frontend area: Email verification infrastructure, environment setup

Gap:
The backend supports SMTP configuration and sends verification emails, but staging email provider/configuration is not confirmed. Local Mailpit can be used, but staging needs a safe real provider or test provider.

Expected backend support:
Staging-safe SMTP configuration, sender address, and verification URL/deep-link settings.

Current frontend workaround:
Use local Mailpit for local testing and treat staging verification as blocked until SMTP/env config is ready.

Acceptance criteria for resolution:
Signup in staging sends a verification email, the link verifies the user, and login is allowed after verification.

Resolution notes:

### FE-BE-GAP-004: Mobile Deep-Link Verification URL Per Environment

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Environment Gap

Found in milestone: Milestone 1: Core App Foundation

Frontend area: Email verification, deep links, local/staging/prod config

Gap:
The backend currently builds email verification deep links with the fixed scheme `companion://auth/verify-email?token=...`. The mobile app may need environment-specific schemes/hosts for local, staging, and production builds.

Expected backend support:
Configurable app verification deep link per environment, or confirmation that one `companion://` scheme is the final V1 scheme for all environments.

Current frontend workaround:
Use the fixed `companion://` scheme in local development and document any staging/prod differences later.

Acceptance criteria for resolution:
Verification links generated from local/staging/prod emails open the intended app build or verification path.

Resolution notes:

## Milestone 2: Identity Flow With Minimum UI

### FE-BE-GAP-005: Onboarding Media Hosting And Download-Once Strategy

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Workaround Allowed

Type: Product Decision Needed

Found in milestone: Milestone 2: Identity Flow With Minimum UI

Frontend area: Onboarding flow

Gap:
The onboarding flow is expected to show image/video content and behave like a simple download-once page, but media source and caching strategy are not finalized.

Expected backend support:
Either a backend/media hosting source for onboarding assets, or a product decision to bundle onboarding assets locally for V1.

Current frontend workaround:
Use local bundled assets during early development.

Acceptance criteria for resolution:
Onboarding media source and cache/download behavior are documented and implemented consistently in local/staging/prod.

Resolution notes:

## Milestone 3: Backend-Driven Home State

### FE-BE-GAP-006: Current User Booking And Next Action Endpoint

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Blocker

Type: Missing API

Found in milestone: Milestone 3: Backend-Driven Home State

Frontend area: Home routing, frontend state resolver, Client/Companion next-flow routing

Gap:
The frontend needs a reliable way to know what the authenticated user should do next. Existing backend routes require a known booking id for booking details, matching context, session, messages, and ratings. There is no inspected endpoint that returns the current relevant booking/session/matching/rating state for the logged-in user.

Expected backend support:
An authenticated endpoint that returns the user's current app state or enough current booking/session data for the frontend to derive it. It should support both Client and Companion users.

Current frontend workaround:
Temporary mocks or manual booking IDs may be used only during early development. This cannot be the final Milestone 3 behavior.

Acceptance criteria for resolution:
After login/app refresh, the frontend can call backend data and route the user to Home, Booking Confirmation, Matching, Active Session, Feedback, or idle state without manual booking ID entry.

Resolution notes:

### FE-BE-GAP-007: Assigned Companion Current Booking Lookup

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Blocker

Type: Missing API

Found in milestone: Milestone 3: Backend-Driven Home State

Frontend area: Companion home, Companion matching/session routing

Gap:
The backend has companion assignment records, but there is no inspected mobile-facing endpoint for a Companion to list or fetch their current assigned booking.

Expected backend support:
An authenticated Companion endpoint, or shared current-state endpoint, that returns assigned current/upcoming booking information and relevant assignment state.

Current frontend workaround:
Manual booking IDs or seeded test flows only. This is not acceptable for real Companion routing.

Acceptance criteria for resolution:
A logged-in Companion can land in the correct home/matching/session/rating state without manually entering a booking id.

Resolution notes:

### FE-BE-GAP-008: Rating Submitted / Rating Needed State Lookup

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Missing API

Found in milestone: Milestone 3: Backend-Driven Home State

Frontend area: State resolver, Feedback routing, Home cleanup after rating

Gap:
The backend supports `POST /bookings/:id/rating`, but there is no inspected read endpoint that tells the frontend whether the authenticated user has already submitted a rating for a completed or eligible cancelled booking.

Expected backend support:
Current-state endpoint includes rating-needed/rating-submitted status, or a rating status endpoint exists per booking and caller.

Current frontend workaround:
After a successful rating POST, store local completion and route home. This does not survive reinstall, multi-device use, or app state reconstruction from backend alone.

Acceptance criteria for resolution:
The frontend can determine from backend state whether to show Feedback or Home for the authenticated user.

Resolution notes:

## Milestone 4: Booking Logic Flow

### FE-BE-GAP-009: Booking Details Companion Reveal Mismatch

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Blocker

Type: Contract Mismatch

Found in milestone: Milestone 4: Booking Logic Flow

Frontend area: Booking confirmation with companion information, confirmation update state

Gap:
The current booking SDS says companion public info should always be present in booking details. The inspected booking service still uses a T-5h reveal rule and returns `companions: null` before reveal and for cancelled/completed statuses.

Expected backend support:
Either align implementation to current SDS and always return companion public info, or explicitly document that V1 frontend must handle delayed/null companion info.

Current frontend workaround:
Show the "confirmed without companions" state until companion info appears, then update the screen. This matches the current design set but conflicts with the current SDS wording.

Acceptance criteria for resolution:
Booking confirmation behavior is documented and backend response shape is stable. The frontend knows whether companion info is immediate, delayed, or nullable.

Resolution notes:

### FE-BE-GAP-010: Public Venue Detail Endpoint

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Needed Soon

Type: Missing API

Found in milestone: Milestone 4: Booking Logic Flow

Frontend area: Location page, book-now page, booking details display

Gap:
The SDS references `GET /venues/{venueId}`, but the currently inspected backend route list only showed `GET /venues` and `GET /availability`.

Expected backend support:
`GET /venues/{venueId}` returning the selected venue details needed by the booking flow.

Current frontend workaround:
Use venue data from search results if available. This is fragile if the app opens a booking flow from an existing booking or persisted state.

Acceptance criteria for resolution:
The frontend can fetch venue details by id from backend in local/staging and render location/book-now/confirmation details without relying on prior search state.

Resolution notes:

### FE-BE-GAP-011: Booking Details Missing Companion User Id

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Missing Field

Found in milestone: Milestone 4: Booking Logic Flow

Frontend area: Booking confirmation, companion cards, later profile lookup

Gap:
The current booking SDS response includes `companionId`, but inspected `BookingCompanionPublicInfoDTO` does not include companion id. Matching context returns companion ids, but booking details does not.

Expected backend support:
Booking details companion items include `companionId` or another stable public identifier.

Current frontend workaround:
Use display-only companion data from booking details, or fetch matching context later when booking id is known. This is fragile for profile/detail navigation.

Acceptance criteria for resolution:
Booking details returns companion ids alongside designation, display name, languages, profile picture URL, and average rating.

Resolution notes:

### FE-BE-GAP-012: Public Companion Profile Detail Endpoint

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Needed Soon

Type: Missing API

Found in milestone: Milestone 4: Booking Logic Flow

Frontend area: Booking confirmation with companion information, companion profile display

Gap:
The SDS references `GET /companion-profiles/{companionId}`, but the currently inspected backend route list only showed companion `/me`, upload, update, and toggle-active routes.

Expected backend support:
`GET /companion-profiles/{companionId}` returning public/non-PII companion profile details for authenticated users.

Current frontend workaround:
Use companion details embedded in booking details or matching context where available. Do not block the core booking confirmation if embedded data is sufficient for V1.

Acceptance criteria for resolution:
The frontend can fetch public companion profile details by companion id when needed, without exposing PII.

Resolution notes:

### FE-BE-GAP-013: Venue Search Requires Non-Empty Query

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Workaround Allowed

Type: Contract Mismatch

Found in milestone: Milestone 4: Booking Logic Flow

Frontend area: Location page, default/empty venue search

Gap:
The location design starts with a search field, but the backend `GET /venues` schema requires a non-empty `q`. There is no inspected endpoint for default nearby/popular venues or empty search.

Expected backend support:
Either allow empty/default venue list, support nearby venues, or confirm that user must type a query before results appear.

Current frontend workaround:
Disable continue/results until the user enters a non-empty query.

Acceptance criteria for resolution:
The location page behavior is documented and matches backend support for empty or non-empty venue searches.

Resolution notes:

### FE-BE-GAP-014: Pricing And Package Behavior

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Workaround Allowed

Type: Product Decision Needed

Found in milestone: Milestone 4: Booking Logic Flow

Frontend area: Book-now page, Silver/Gold package cards, price display, duration display

Gap:
The design shows package and price options such as Silver and Gold, price per hour, and durations such as 4hr/8hr. Current backend booking SDS uses only venue and start time and creates a fixed 2-hour booking.

Expected backend support:
Either backend pricing/package/duration contract, or explicit product decision that packages/prices/durations are static display-only in V1 while backend still books fixed 2-hour sessions.

Current frontend workaround:
Treat package cards, price information, and extended duration labels as static UI unless/until backend pricing/duration is introduced.

Acceptance criteria for resolution:
Either backend supports package/pricing/duration in booking flow, or V1 explicitly documents package/pricing/duration display as static/non-functional.

Resolution notes:

## Milestone 5: Native Capability Foundation

### FE-BE-GAP-015: Push Token Registration And Notification Delivery Service

Created at: 2026-05-09T11:21:28Z

Status: Open

Severity: Blocker

Type: Missing Service

Found in milestone: Milestone 5: Native Capability Foundation

Frontend area: Push notification registration, notification delivery, session/matching notifications

Gap:
Push notification behavior is required for the mobile app, but there is no inspected backend endpoint for registering mobile push tokens, and notification side effects in booking/matching/session schedulers are currently deferred/log placeholders.

Expected backend support:
Backend support for registering device push tokens and sending relevant notifications in staging/prod.

Current frontend workaround:
Implement frontend permission request and token acquisition locally, but treat real backend delivery as blocked until provider/backend config exists.

Acceptance criteria for resolution:
Push tokens can be registered from installed builds, and staging can deliver/test push notifications on real iOS and Android devices.

Resolution notes:

### FE-BE-GAP-016: Notification Provider And Staging Credentials

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Third-Party Integration Gap

Found in milestone: Milestone 5: Native Capability Foundation

Frontend area: Push notification registration, delivery testing, staging builds

Gap:
Push delivery requires provider credentials and staging/prod configuration. The backend currently logs notification placeholders but does not show configured provider delivery.

Expected backend support:
Configured push provider credentials and environment variables for staging and production.

Current frontend workaround:
Use local notification UI testing and frontend token registration scaffolding only.

Acceptance criteria for resolution:
Staging can deliver at least one test push notification to a real iOS device and a real Android device.

Resolution notes:

## Milestone 6: Matching Flow

### FE-BE-GAP-017: Companion Presence Arrival Endpoint

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Blocker

Type: Missing API

Found in milestone: Milestone 6: Matching Flow

Frontend area: Companion matching flow, companion-companion matching precondition

Gap:
Matching service requires both booking assignments to have `presenceStatus=ARRIVED` before companion-companion context/verification can proceed. The inspected backend routes do not include a mobile-facing endpoint for companions to mark themselves arrived.

Expected backend support:
An authenticated Companion endpoint to mark their assignment/presence as arrived for a booking, enforcing active companion/profile rules.

Current frontend workaround:
Manual DB/test seeding can set presence to ARRIVED for development, but real app flow is blocked.

Acceptance criteria for resolution:
Both assigned companions can mark arrived through the app, after which com-match context/verification works without manual database changes.

Resolution notes:

### FE-BE-GAP-018: Client Matching Message/Location Input Backend Behavior

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Workaround Allowed

Type: Product Decision Needed

Found in milestone: Milestone 6: Matching Flow

Frontend area: Client matching page message/location input

Gap:
The Client matching design shows an input like "Let Julian know your location..." but inspected backend messaging endpoints are companion-only and active-session-only. There is no inspected Client matching chat/location-text endpoint.

Expected backend support:
Either a backend Client-to-companion matching message/location-note feature, or product confirmation that this input is mock/static in V1.

Current frontend workaround:
Treat the input as disabled/static/coming-soon for V1 unless backend support is added.

Acceptance criteria for resolution:
The input is either removed/disabled/documented as mock, or a backend endpoint exists and is wired.

Resolution notes:

### FE-BE-GAP-019: Color Signal Backend Behavior

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Workaround Allowed

Type: Product Decision Needed

Found in milestone: Milestone 6: Matching Flow

Frontend area: Client matching page Color Signal action

Gap:
The Client matching design includes a Color Signal action. Backend has a `bookingColor` field and returns it in matching context, but there is no inspected API for a color-signal action/event.

Expected backend support:
Either clarify that Color Signal is display-only using `bookingColor`, or provide an action/event API if tapping it should notify companions.

Current frontend workaround:
Display the color signal using backend `bookingColor` and treat the action as static unless product/backend support is added.

Acceptance criteria for resolution:
The frontend knows whether Color Signal is display-only or a real action, and backend support matches that decision.

Resolution notes:

## Milestone 7: Active Session Logic

### FE-BE-GAP-020: Near-End And Session Notification Side Effects Are Placeholders

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Missing Service

Found in milestone: Milestone 7: Active Session Logic

Frontend area: Active session notifications, near-end notification testing

Gap:
Session schedulers mark or log near-end notification and breach events, but inspected code uses placeholder logging for notification/alert side effects. There is no real push/in-app delivery path.

Expected backend support:
Real push/in-app notification side effects for near-end session notifications and any required active-session alerts.

Current frontend workaround:
Use session polling and local UI state. Do not rely on backend notification delivery until implemented.

Acceptance criteria for resolution:
Near-end notification can be triggered and received on real iOS and Android staging builds.

Resolution notes:

### FE-BE-GAP-021: Companion Breach Alerts Are Placeholders

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Workaround Allowed

Type: Missing Service

Found in milestone: Milestone 7: Active Session Logic

Frontend area: Active session location monitoring, companion breach behavior

Gap:
The scheduler detects companion distance breaches and logs placeholder admin/companion alerts, but no actual alert service is implemented.

Expected backend support:
Real admin and companion alert delivery if breach monitoring is part of V1 acceptance.

Current frontend workaround:
Treat breach alerting as backend/internal placeholder unless V1 requires visible client/companion behavior.

Acceptance criteria for resolution:
Breach alerts are either implemented and testable, or explicitly deferred outside V1 mobile acceptance.

Resolution notes:

## Milestone 8: Ratings Flow

### FE-BE-GAP-022: Terminal Booking Details Do Not Return Companion Info For Feedback

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Blocker

Type: Contract Mismatch

Found in milestone: Milestone 8: Ratings Flow

Frontend area: Feedback page companion duo display

Gap:
The Client feedback design displays the companion duo. The inspected booking details service returns `companions: null` when booking status is CANCELLED or COMPLETED, which are exactly the statuses eligible for rating.

Expected backend support:
A way to fetch companion public info for completed/eligible cancelled bookings, either via booking details, rating context, or companion profile endpoints.

Current frontend workaround:
Carry companion data forward in frontend state from earlier screens. This is fragile and fails on app restart or direct feedback routing.

Acceptance criteria for resolution:
Feedback screen can reconstruct companion duo display from backend after app restart for completed/eligible cancelled bookings.

Resolution notes:

### FE-BE-GAP-023: Rating Submitted / Existing Rating Read

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Missing API

Found in milestone: Milestone 8: Ratings Flow

Frontend area: Feedback routing, duplicate prevention, return-to-home behavior

Gap:
The ratings endpoint is retry-safe on POST, but there is no inspected read endpoint for existing rating state. The app cannot know from backend alone whether to show feedback or home.

Expected backend support:
Current-state endpoint includes rating status, or a `GET /bookings/:id/rating/me` style endpoint exists.

Current frontend workaround:
Use local state immediately after POST. For app restart, rely on future current-state endpoint or show feedback and let POST return existing rating.

Acceptance criteria for resolution:
Frontend can determine whether the authenticated user already rated a booking without submitting a duplicate POST.

Resolution notes:

### FE-BE-GAP-024: Negative Feedback Tags Are Not Defined

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Workaround Allowed

Type: Product Decision Needed

Found in milestone: Milestone 8: Ratings Flow

Frontend area: Feedback page tags

Gap:
Ratings SDS states negative tag starting list is TBD. Current Client feedback design only shows positive tags.

Expected backend support:
No backend enum validation is required because tags are open-set, but product/design should define whether negative tags are included in V1.

Current frontend workaround:
Implement the visible positive tags only for Client V1 unless updated design/product requirements define negative tags.

Acceptance criteria for resolution:
V1 feedback tag set is documented and matches implemented UI.

Resolution notes:

## Milestone 9: Environment And Release Hardening

### FE-BE-GAP-025: Backend Staging/Production Deployment Contract

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Blocker

Type: Environment Gap

Found in milestone: Milestone 9: Environment And Release Hardening

Frontend area: EAS staging/prod builds, API URL separation, release testing

Gap:
The mobile app needs stable local, staging, and production API URLs. Backend code has env config, but the staging/prod deployment contract and public base URLs are not established in the inspected files.

Expected backend support:
Stable deployed API base URLs for staging/prod, health endpoint, HTTPS, environment variables, and release/deploy process.

Current frontend workaround:
Use local backend or temporary staging URL until deployment is finalized.

Acceptance criteria for resolution:
EAS staging and production-like builds can call the correct backend health/auth/core flow endpoints over HTTPS.

Resolution notes:

### FE-BE-GAP-026: Production File Storage For Profile Uploads

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Environment Gap

Found in milestone: Milestone 9: Environment And Release Hardening

Frontend area: Companion profile picture upload/display, production media URLs

Gap:
Companion profile upload currently uses local disk and `express.static("/uploads")`. Tech stack notes this is Phase 1 and future S3-compatible storage is TBD.

Expected backend support:
Production-safe file storage and public URL behavior for uploaded profile images, or explicit V1 decision that local disk is acceptable only in local/staging.

Current frontend workaround:
Use local upload behavior in local development. Avoid treating uploaded media as production-safe until storage is decided.

Acceptance criteria for resolution:
Uploaded profile pictures persist and display correctly in staging/production-like environments.

Resolution notes:

### FE-BE-GAP-027: Production Seed/Test Data For Mobile Staging Journeys

Created at: 2026-05-09T11:28:42Z

Status: Open

Severity: Needed Soon

Type: Missing Seed/Test Data

Found in milestone: Milestone 9: Environment And Release Hardening

Frontend area: Staging acceptance tests, venue availability, booking journey

Gap:
The inspected Prisma seed file only connects/disconnects and does not seed venues, companions, roster assignments, or availability. The mobile app needs predictable staging data for full journey tests.

Expected backend support:
Seed or admin setup process for staging venues, companion accounts/profiles, venue assignments, roster slots, and verified test users.

Current frontend workaround:
Use manual setup or test-runner artifacts during development, but this is not enough for repeatable staging acceptance.

Acceptance criteria for resolution:
A fresh staging environment can be prepared with known test data for Client booking, Companion matching, active session, and ratings.

Resolution notes:

## Milestone 10: UI Design And Polish

No backend gaps currently registered for Milestone 10. This milestone is primarily frontend visual implementation and polish. If final UI exposes new backend-backed behavior, agents must add a gap here before implementing a mock.
