# Version 1 Design References

This folder contains Version 1 mobile app design references.

The current images are Client-side references. File names use the `client-` prefix so future Companion-side references can be added separately without confusion.

There are currently no finalized design references for signup, login, or email verification screens. Those screens should be implemented with minimum functional UI during the logic-first milestones and visually designed later.

These images are the visual target for the final UI polish phase. During the early logic-first milestones, agents should use these references to understand the planned screens, user flow, visual hierarchy, and interaction intent, but they should not prioritize pixel-perfect implementation before the application logic works.

## How Agents Should Use These Files

- Use these images to understand the intended Version 1 Client screen flow.
- Build minimum functional UI first during logic-first milestones.
- Use the designs for final visual implementation during the UI design and polish milestone.
- For signup, login, and email verification, use plain functional screens until final designs exist.
- Keep file names stable so agents can refer to the same screen references consistently.
- If a design changes, replace the image but keep the same file name when it still represents the same screen.
- Do not assume every visible button is functional in Version 1. Some controls are visual mocks or placeholders.

## Functional vs Mock Rule

For Version 1, implement controls only when they support the core booking, matching, active-session, or feedback flow.

Functional controls should include:

- Home -> Book companions
- Booking flow back/next actions
- Location selection/search enough to choose a venue
- Calendar/date selection
- Time selection from backend availability
- Companion gender/type selection as a static step
- Book Now
- Booking confirmation continue/next
- Matching QR/PIN display
- Matching cancel booking
- In-service extend session
- In-service end session
- In-service SOS stub
- Feedback stars/tags/comment
- Submit rating

Mock or placeholder controls can include:

- Wallet tab
- Payment Methods
- Premium Member details
- Share companions
- Your companions
- About Companions carousel controls
- AR button
- Notification settings/details
- Personal Info details
- Privacy & Security
- Help Center
- Contact Us
- How to use Companions
- Book-now package carousel if package selection is not backed by real pricing logic
- Color Signal if it is not required by the backend flow yet
- Message/location input on matching if backend support is not in scope for Client V1

Mock controls should be visibly present where needed for layout, but can route to a placeholder, show a "Coming soon" state, or remain disabled depending on the milestone.

## Current Client Reference Files

- `client-home-page.png`
  - Client home page.
  - Shows app title, back button, welcome/member card, notification button, main Book companions CTA, Your companions, Share companions, About Companions carousel, and bottom tabs.
  - Core functional V1 action: Book companions.
  - Likely mock/static V1 areas: notification details, Your companions, Share companions, About carousel, Wallet tab.

- `client-home-profile.png`
  - Client profile tab/page.
  - Shows profile card, member status, account settings, preferences, support, and bottom tabs.
  - Likely mock/static V1 areas: personal info details, payment methods, notification settings, privacy/security, help center, contact us.

- `client-booking-location.png`
  - Booking flow location entry page.
  - Shows destination search and forward action.
  - Functional V1 requirement: choose or search a venue/location enough to continue booking.

- `client-booking-calendar.png`
  - Booking flow calendar/date selection page.
  - Shows month navigation and selectable dates.
  - Functional V1 requirement: select a date that can be checked against backend availability.

- `client-booking-time-slot.png`
  - Booking flow time selection page.
  - Shows available slots, clock visualization, time picker, and Gulf Standard Time label.
  - Functional V1 requirement: select an available start time returned by backend availability.

- `client-booking-companion-gender.png`
  - Companion gender/type selection page.
  - Shows image card and Male/Female segmented control.
  - Version 1 behavior: static step. Capture selection locally if useful, but do not require backend behavior unless added later.

- `client-booking-book-now.png`
  - Main book-now page.
  - Shows selected location, visual package card, package options, price per hour, and Book Now button.
  - Functional V1 requirement: review booking details and submit booking to backend.
  - Likely mock/static V1 areas: AR button, notification detail, package carousel/package switching if pricing is not backend-driven.

- `client-confirmation-without-companions.png`
  - Booking confirmation state immediately after backend confirmation.
  - Map-centered layout with booking status, location, time, date, arrival copy, and duration/progress visual.
  - Functional V1 requirement: show confirmed booking state after booking creation.
  - Likely mock/static V1 areas: How to use Companions.

- `client-confirmation-with-companions.png`
  - Booking confirmation state after companion information is available.
  - Shows assigned companion cards, confirmed status, rating, date/time/duration/location, and Next action.
  - Functional V1 requirement: show assigned companion information from booking details when available and continue toward matching.
  - Likely mock/static V1 areas: How to use Companions.

- `client-matching-client-companion.png`
  - Client matching page.
  - Map-centered layout showing user and companion positions, distance, locating state, QR Code action, Color Signal action, message/location input, and Cancel Booking.
  - Functional V1 requirement: location permission, location update, matching context, QR/PIN access, and cancel booking.
  - Potential mock/static V1 areas: Color Signal and message/location input if not backed by a real Client-side API flow.

- `client-matching-client-companion-qr.png`
  - Matching QR/PIN modal.
  - Shows QR code and one-time PIN for access verification.
  - Functional V1 requirement: display backend-provided client QR/PIN for companion verification.

- `client-in-service-client.png`
  - Client in-service page.
  - Map-centered layout showing session in progress, companion marker/card, timer, SOS, Extend Session, and End Session.
  - Functional V1 requirement: active-session state, timer, extend once, end session, and SOS stub.

- `client-feedback.png`
  - Client feedback/rating page.
  - Shows companion duo, stars, positive tags, comment box, and Submit Rating.
  - Functional V1 requirement: submit client rating with optional stars, required tags, optional comment.

- `client-feedback-client.png`
  - Client feedback/rating page variant.
  - Currently appears visually equivalent to `client-feedback.png`.
  - Keep both files until the design set is cleaned up or one is confirmed as the canonical feedback reference.

## Optional Onboarding Assets

Onboarding images and videos should go in:

`technical/frontend-companion/design-reference/v1/onboarding/`

Recommended names:

- `client-onboarding-01.png`
- `client-onboarding-02.png`
- `client-onboarding-03.png`
- `client-onboarding-video-01.mp4`

## Current Notes From Provided References

- The visual direction is dark, premium, and high-contrast.
- Blue is the primary action/accent color.
- Red is used for destructive or emergency actions such as Cancel Booking, SOS, and End Session.
- The Client flow is step-based: Home -> Location -> Calendar -> Time -> Companion Type -> Book Now -> Confirmation -> Matching -> In Service -> Feedback.
- Booking confirmation and later operational states are map-centered.
- Booking confirmation has at least two visual states: confirmed without companion details, and confirmed with assigned companion details.
- Matching depends on location, QR/PIN, distance display, and cancel booking behavior.
- In-service depends on session state, timer, SOS, extend session, and end session behavior.
- Some visible design affordances are intentional placeholders for Version 1 and should not become backend blockers unless they support the core flow.
