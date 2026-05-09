# Milestone 9: Environment And Release Hardening

## Objective

Set up local, staging, and production builds properly through EAS.

This milestone prepares the app for realistic testing and release preparation.

## Scope

- Local environment config
- Staging environment config
- Production environment config
- EAS development profile
- EAS staging profile
- EAS production profile
- API URL separation
- iOS and Android identifiers
- Deep link configuration per environment
- Push notification credentials
- Staging builds
- Production builds
- Release testing checklist
- Core journey testing in staging

## Tasks

- Define local, staging, and production frontend env values.
- Define local, staging, and production backend API URLs.
- Configure EAS development profile.
- Configure EAS staging profile.
- Configure EAS production profile.
- Confirm iOS bundle identifiers.
- Confirm Android package identifiers.
- Configure app display names per environment if needed.
- Configure deep links per environment.
- Configure push credentials.
- Configure Google Maps keys per environment.
- Build and install development build.
- Build and install staging build.
- Build production-like build.
- Run core journey tests in staging:
  - signup/login/email verification
  - booking
  - matching
  - active session
  - rating
- Create release testing checklist.

## Backend Dependencies

- Stable local backend URL
- Stable staging backend URL
- Production backend URL
- Staging/prod database and seed data
- Email provider configuration
- Push notification provider configuration
- File storage strategy for uploaded images
- Third-party service keys

Important known gaps to check:

- backend staging/production deployment contract
- production file storage for profile uploads
- production seed/test data for mobile staging journeys

## Validation

Simulator or web can validate:

- local/staging/production config shape
- API URL separation
- basic deep-link route parsing
- EAS config correctness at a static/config level
- release checklist drafting

Real devices must validate:

- EAS development build install
- EAS staging build install
- production-like build install
- iOS bundle identifier behavior
- Android package identifier behavior
- staging API connectivity
- push credentials and delivery
- deep links from real apps
- core staging journeys on iOS and Android

## Done Means

- The same app can be built for local development.
- The same app can be built for staging testing.
- The same app can be built for production release.
- iOS and Android builds work.
- Staging can be used for realistic end-to-end testing.
- Production builds are ready for release preparation.
