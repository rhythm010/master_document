# Milestone 0: Real Device Placeholder App

## Objective

Create the real Expo mobile app and prove that it can run on real iOS and Android devices.

This milestone is not about features or visual design. It is about creating the mobile project, proving the development loop, and confirming that the app can talk to the backend.

## Scope

- Create or stabilize the Expo app project.
- Add a single placeholder app screen.
- Show the current frontend environment on screen.
- Call the backend health endpoint.
- Add placeholder route names for the planned Version 1 flow.
- Set initial iOS bundle identifier and Android package identifier.
- Add basic local environment config.
- Add basic EAS config so future development builds are possible.

## Minimum UI

The placeholder screen should show:

- App name
- Current environment
- Backend URL
- Backend health check status
- Basic navigation links or buttons to placeholder routes

The screen can be plain. It only needs to prove the shell works.

## Tasks

- Confirm the Expo project location under `technical/frontend-companion/companion-app`.
- Confirm app startup works locally.
- Add environment display using the app config approach chosen for Expo.
- Add a small API call for backend health.
- Add placeholder route structure for:
  - onboarding
  - home
  - booking
  - confirmation
  - matching
  - in service
  - feedback
  - auth
- Confirm the app can run through Expo Go or a development build, depending on native package needs.
- Document the local run command in the app README if missing.

## Backend Dependencies

- Backend health endpoint must be reachable.
- Backend base URL must be known for local development.

If the backend URL or base path is unclear, register or update the gap in `backend-gap-register.md`.

## Validation

Simulator or web can validate:

- Expo startup
- placeholder UI rendering
- route placeholders
- environment label
- backend health request

Real devices must validate:

- app launch on physical iOS
- app launch on physical Android
- backend connectivity over LAN or tunnel
- Expo development workflow on real devices

## Done Means

- The app opens on real iOS and Android devices.
- The app shows the current environment.
- The app can call the backend health endpoint.
- The app has placeholder routing space for the planned V1 flow.
- The developer knows how to run the app locally on physical devices.
