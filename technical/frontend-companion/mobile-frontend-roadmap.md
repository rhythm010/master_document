# Companion Mobile Frontend Roadmap: Version 1

This roadmap covers Version 1 of the Companion mobile application.

The plan for Version 1 is to build a logic-first mobile application, not a screen-first frontend.

The early app should look plain but behave correctly. Design polish can come after the flows, permissions, services, state, and native integrations are working.

The milestone philosophy is:

- First objective: build a functional mobile shell that can run on real devices.
- Second objective: implement all app logic and feature flows with minimum UI.
- Third objective: integrate native and mobile services like camera, location, maps, notifications, deep links, biometrics, and environment handling.
- Fourth objective: only after that, improve visual design and static UI polish.

This is especially important because the hard parts of this app are not static screens. The hard parts are whether the app can scan QR codes on a real phone, request GPS permissions properly, send location updates reliably, show maps, receive notifications, route users correctly after deep links, work across local, staging, and production, and handle Client and Companion roles correctly.

## Planned Version 1 Pages

These are the currently planned Version 1 pages and flow screens.

The designs for many of these pages are already known, but the roadmap still stays logic-first. During the early milestones, these pages can be implemented with minimum UI so the application flow works. Final visual implementation and polish comes later.

Design references for these pages should live in `technical/frontend-companion/design-reference/v1/`.

The current design references are Client-side and use the `client-` filename prefix. Not every visible control in those references is required to be functional in Version 1. Mock/static controls are allowed when they do not support the core booking, matching, active-session, or feedback flow.

Signup, login, and email verification designs are not available yet. These screens should use minimum functional UI during the logic-first milestones and receive final design treatment later.

- Onboarding flow
- Home page
- Location page
- Calendar/date selection flow
- Time selection flow
- Companion gender/type selection screen
- Main book-now page
- Booking confirmation screen
- Booking confirmation screen updated with companion information
- Matching page
- In-service page
- Feedback page

The expected Client booking journey is:

- Onboarding
- Home
- Book companions
- Location
- Calendar/date selection
- Time selection
- Companion gender/type selection
- Book-now page
- Booking confirmation
- Companion information update
- Matching
- In service
- Feedback
- Home

## Backend Gap Handling

Frontend development may reveal backend APIs, services, fields, seed data, environment config, or third-party integrations that are missing or do not match the mobile app's needs.

All backend gaps discovered during frontend work must be registered in `technical/frontend-companion/backend-gap-register.md`.

Rules for agents:

- Do not silently invent backend behavior.
- Do not hide missing backend behavior inside frontend-only assumptions.
- Register the gap before using a mock, static fallback, temporary workaround, or manual test path.
- Mark whether the gap is a blocker or whether workaround is allowed.
- Keep the frontend logic-first, but make backend blockers visible early.

## Milestone 0: Real Device Placeholder App

Goal:

Create the real Expo app and prove it runs on physical iOS and Android devices.

Minimum UI is fine. One screen is enough.

Things to set up:

- New Expo app project
- Basic placeholder screen
- Basic route placeholder for planned V1 pages
- App name, bundle identifier, and package identifier
- Local environment config
- Backend health check
- Device testing workflow
- Basic EAS setup for future builds

Done means:

- The app opens on real iOS and Android devices
- The app shows the current environment
- The app can call the backend health endpoint
- The app has placeholder routing space for the planned V1 flow
- You know how to run the app locally on physical devices
- Placeholder routes can include mock/static destinations for non-core buttons

Validation:

- Web/simulator can validate Expo startup, placeholder rendering, environment label, backend health request, and route placeholders.
- Real iOS and Android devices must validate app launch, backend connectivity over LAN or tunnel, and QR/development-build workflow.

## Milestone 1: Core App Foundation

Goal:

Turn the placeholder into a real application shell.

The UI can still be very plain. The purpose is not beauty. The purpose is to make sure all future flows have a stable foundation.

Things to set up:

- Navigation structure
- Navigation map for the planned V1 pages
- Navigation treatment for mock/static buttons
- Auth/session storage
- API client
- Environment config
- App state management
- Shared error handling
- Shared loading handling
- Role-based routing
- Backend error envelope handling
- Email verification infrastructure
- Local email inbox setup, such as Mailpit
- Staging email provider setup or staging-safe email configuration
- One-time onboarding completion storage

Done means:

- The app can log in
- The app can store a token
- The app can restore a session after restart
- The app can route Client and Companion users differently
- The app can handle backend errors consistently
- The backend can send verification emails locally
- The developer can open the local email inbox and see verification emails
- The email verification link works
- A user can be marked verified through the email flow
- The app can remember whether onboarding has been completed once
- Non-core visible buttons have a consistent placeholder behavior

Validation:

- Web/simulator can validate navigation, route map, mock/static button behavior, API client, environment config, app state, loading/error handling, role routing, backend error envelopes, local email inbox loop, and onboarding completion storage.
- Real devices should validate token/session restore after restart, API calls using the correct local/staging URL, and email verification opening the correct app/path if deep linking is already wired.

## Milestone 2: Identity Flow With Minimum UI

Goal:

Build the real account access flow using simple forms and minimum UI.

The focus is whether the logic works.

Things to set up:

- Onboarding flow with image/video content
- Onboarding next/back controls
- Onboarding download-once or cache-once behavior
- Onboarding asset handling for local bundled assets or downloaded media
- Client signup
- Companion signup
- Login
- Logout
- Email verification handling
- Resend verification
- Minimum functional UI for signup, login, and email verification because final designs are not available yet
- User profile fetch
- Optional biometric login (not required in this version)
- Basic authenticated route protection
- Basic unauthenticated route protection

Done means:

- A user can complete onboarding once and not be forced through it repeatedly
- A Client can create an account
- A Companion can create an account
- Both roles can verify email
- Both roles can log in
- Both roles can close and reopen the app and remain correctly authenticated
- The app blocks or handles unverified users correctly
- The app can fetch the logged-in user profile

Validation:

- Web/simulator can validate onboarding controls, onboarding persistence, basic cache/download behavior, signup, login, logout, resend verification, user profile fetch, route protection, and unverified-user handling.
- Real devices should validate email verification deep links from a real email app, session persistence after closing/reopening, biometric login if added later, and onboarding media behavior if it differs from simulator.

## Milestone 3: Backend-Driven Home State

Goal:

Build the logic needed to know what the user should do next.

Instead of building beautiful home pages, this milestone focuses on routing the user based on backend state.

For Client, the app should understand:

- No booking
- Confirmed booking
- Matching needed
- Active session
- Rating needed

For Companion, the app should understand:

- Active or inactive status
- Assigned booking
- Matching needed
- Active session
- Rating needed

Things to set up:

- Home page logic
- Home page minimum UI
- Book companions entry point
- Wallet tab placeholder
- Profile tab minimum UI or placeholder
- Mock/static handling for Your companions, Share companions, About Companions, and notification details
- Minimal Client home state
- Minimal Companion home state
- Current booking lookup
- Current session lookup
- Current matching state lookup
- Rating-needed state detection
- Companion active/inactive state detection
- Route guards based on current user state
- Refresh logic after app resume
- Refresh logic after login

Possible backend need:

- A backend endpoint may be needed to return the current relevant booking or next action for the logged-in user.

Done means:

- After login, the app can determine the user's current state
- The app can route the user to the correct next flow
- The app does not rely on manually entered booking IDs
- Client and Companion users both land in a meaningful minimum home state
- The Book companions action starts the booking flow

Validation:

- Web/simulator can validate home logic, minimum home UI, Book companions entry point, placeholder tab behavior, frontend state resolver, current booking/session/matching lookups, rating-needed detection, companion active/inactive detection, route guards, and refresh after login.
- Real devices should validate app-resume refresh behavior, auth/session state after background/foreground cycles, and one Client/Companion landing-state smoke test.

## Milestone 4: Booking Logic Flow

Goal:

Build the Client booking journey with minimal UI.

The UI can be simple lists, buttons, and forms.

Things to set up:

- Book companions action from Home
- Location page
- Calendar/date selection flow
- Available date handling
- Time selection flow
- Available time handling
- Companion gender/type selection screen as a static V1 page
- Main book-now page
- Price information display
- Location details display
- Book Now action
- Mock/static handling for AR, package carousel, and non-core notification behavior
- Venue search
- Venue details
- Availability lookup
- Time slot selection
- Booking creation
- Booking details
- Booking confirmation screen
- Booking confirmation update when companion information is available
- Booking confirmation state
- Booking cancellation
- Booking state refresh after create/cancel
- Error handling for no availability
- Error handling for existing active or confirmed booking

Done means:

- A Client can search for a venue
- A Client can select an available time
- A Client can pass through the static companion gender/type selection step
- A Client can review price and location details before booking
- A Client can create a real booking against the backend
- A Client sees the booking confirmation screen after backend confirmation
- A Client can view the assigned companion duo
- The booking confirmation screen can update once companion information is available
- A Client can cancel a confirmed booking
- The app stores or displays enough booking state to continue the journey

Validation:

- Web/simulator can validate the full booking flow UI and APIs: Home entry, location/venue search, calendar/date selection, availability, time selection, static companion type step, book-now review, booking creation, confirmation, companion info update, cancellation, error states, and mock/static AR/package/non-core notification behavior.
- Real devices should validate one full Client booking flow on iOS, one full Client booking flow on Android, real-device API connectivity, and layout sanity for booking screens.

## Milestone 5: Native Capability Foundation

Goal:

Build and test device-level features before wiring them deeply into matching and session flows.

This should come before the full matching flow, because matching depends heavily on device capabilities.

This is not a visual milestone. It is a device capability milestone.

Things to set up:

- Matching page device capability support
- Camera permission
- QR scanning
- QR display
- GPS permission
- Live location reading
- Map display
- Google Maps setup
- Deep links
- Push notification registration
- Foreground notification behavior
- Background or app-resume notification behavior where needed
- Permission denied states
- Permission retry states
- Real-device testing for iOS
- Real-device testing for Android

Done means:

- Camera works independently on real iOS and Android devices
- QR scanning works independently on real iOS and Android devices
- QR display works correctly
- GPS permission and location reading work independently
- Maps render correctly
- Deep links can open the app
- Push notification registration works
- Notification behavior is testable on real devices

Validation:

- Web/simulator can validate map rendering, markers, simulated location display, permission-denied/retry UI, QR display UI, basic deep-link routing, and basic push permission UI.
- Real devices must validate camera permission, QR scanning, QR scan loop between physical devices if possible, GPS permission prompts, real GPS reads, moving location updates, Google Maps behavior on iOS/Android, push registration/delivery/taps, foreground/background notification behavior, external deep links, and biometrics if added later.

## Milestone 6: Matching Flow

Goal:

Connect native capabilities to the backend matching APIs.

Things to set up:

- Matching page
- Companion-companion matching
- Captain QR/PIN display
- Vice Captain QR scanning
- Vice Captain PIN verification
- Client start matching with GPS
- Location permission enforcement
- Location updates to backend
- Matching map/context view
- Client QR/PIN display
- Captain client verification
- Booking transition from confirmed to active
- Matching error states
- GPS disabled handling
- Outside venue radius handling
- Invalid QR/PIN handling
- Mock/static handling for Color Signal and message/location input if they are not backed by the V1 Client flow

Done means:

- The Matching page can show the correct state for the current user
- Companions can complete companion-companion matching
- Client can start matching with GPS
- Location updates are sent reliably
- Captain can verify the Client using QR/PIN
- A real booking can move from confirmed to active using actual device camera and GPS behavior
- Any non-functional matching controls are clearly treated as placeholders

Validation:

- Web/simulator can validate matching page state rendering, matching context API calls, QR/PIN modal display, PIN paths, map layout with simulated positions, matching error states, GPS disabled UI, outside-radius behavior with mocked coordinates, invalid QR/PIN handling, cancel booking, and mock/static Color Signal/message input behavior.
- Real devices must validate actual QR scanning, QR/PIN display on one device and verification from another if possible, real GPS updates during matching, client start matching using real location, outside-radius behavior with real or controlled location, app background/foreground behavior, and CONFIRMED to ACTIVE transition on iOS/Android.

## Milestone 7: Active Session Logic

Goal:

Build the session-in-progress experience with minimum UI.

Things to set up:

- In-service page
- Client active session view
- Companion active session view
- Countdown timer
- Session status polling
- Extend once
- End early
- SOS stub
- Companion chat
- Message polling
- Companion location posting
- Session completion state
- Session cancellation state
- Extended-session state
- Error handling for invalid session actions

Done means:

- The In-service page can show active session state
- The active session can be managed from both Client and Companion roles
- Client can extend the session once
- Client can end the session early
- SOS stub can be triggered
- Companions can chat during the session
- Location posting continues during the active session
- Completion or cancellation state is reflected in the app

Validation:

- Web/simulator can validate active-session views, countdown/timer logic, session polling, extend once, end early, SOS stub, companion chat UI, message polling, completion/cancellation states, extended state, and invalid action errors.
- Real devices must validate active-session location posting, timer behavior after background/foreground cycles, session refresh after app resume, near-end/session push notifications if included, and extend/end/SOS smoke tests on iOS and Android.

## Milestone 8: Ratings Flow

Goal:

Build the rating logic after session completion or eligible cancellation.

Use basic inputs for stars, tags, comment, submit, and skip where allowed.

Things to set up:

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

Done means:

- The Feedback page appears after session completion or eligible cancellation
- Client can rate the companion duo
- Companion can rate the Client
- Required rating rules are enforced
- Duplicate submission is handled safely
- The app returns the user to the correct home state

Validation:

- Web/simulator can validate feedback layout, stars, tags, optional comment, Client skip behavior, Companion no-skip behavior, rating validation, rating submission, duplicate handling, return-to-home behavior, and rating-needed cleanup.
- Real devices should validate one Client rating smoke test on iOS, one Client rating smoke test on Android, real keyboard/comment behavior, and return-to-home after rating.

## Milestone 9: Environment And Release Hardening

Goal:

Set up local, staging, and production builds properly through EAS.

Things to set up:

- Local environment config
- Staging environment config
- Production environment config
- EAS development profile
- EAS staging profile
- EAS production profile
- API URL separation
- App identifiers for iOS and Android
- Deep link configuration per environment
- Push notification credentials
- Staging builds
- Production builds
- Release testing checklist
- Core journey testing in staging

Done means:

- The same app can be built for local development
- The same app can be built for staging testing
- The same app can be built for production release
- iOS and Android builds work
- Staging can be used for realistic end-to-end testing
- Production builds are ready for release preparation

Validation:

- Web/simulator can validate local/staging/production config shape, API URL separation, basic deep-link route parsing, EAS config correctness at a static/config level, and release checklist drafting.
- Real devices must validate EAS development build install, EAS staging build install, production-like build install, iOS bundle identifier behavior, Android package identifier behavior, staging API connectivity, push credentials/delivery, deep links from real apps, and core staging journeys on iOS and Android.

## Milestone 10: UI Design And Polish

Goal:

Implement the proper visual design after the application logic is complete.

Only after the application logic is complete do we implement final design.

Things to set up:

- Design implementation for the planned V1 pages
- Onboarding page polish
- Signup, login, and email verification visual design once references exist
- Home page polish
- Location page polish
- Calendar/date selection polish
- Time selection polish
- Companion gender/type selection polish
- Book-now page polish
- Booking confirmation page polish
- Matching page polish
- In-service page polish
- Feedback page polish
- Final layouts
- Colors
- Typography
- Spacing
- Icons
- Refined navigation
- Better empty states
- Better loading states
- Better error states
- Final form styling
- Final map/session/matching screen styling
- App-store-ready polish

Done means:

- The app is fully functional
- The app is clean and understandable
- The app feels production-ready
- The app is pleasant to use on both iOS and Android

## Key Principle

UI design becomes the final layer, not the first layer.

The early frontend should be plain but honest. It should prove the app works. Once the real flows are alive, design work becomes much easier because you are styling a working product instead of decorating assumptions.
