# Milestone 5: Native Capability Foundation

## Objective

Build and test the mobile-native capabilities before wiring them deeply into matching and session flows.

This is a device capability milestone, not a visual milestone.

## Scope

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
- Permission denied and retry states

## Tasks

- Add camera permission request.
- Add QR scanner test screen.
- Add QR display test screen.
- Add GPS permission request.
- Add current location read.
- Add repeated location read or watch mode.
- Add map display with current user marker.
- Configure Google Maps for iOS and Android.
- Add deep link route handling.
- Add push notification permission request.
- Add push token registration flow once backend exists.
- Add foreground notification handling.
- Add background/tap handling where Expo supports it.
- Add clear UI for denied permissions and retry.
- Test on physical iOS and Android devices.

## Design Notes

This milestone can use plain test screens.

Do not spend time matching the final map/matching visuals yet. The goal is to prove the device capabilities.

## Backend Dependencies

- Push token registration endpoint
- Notification delivery service/provider
- Deep link URL scheme agreement

Register gaps if:

- push registration endpoint is missing
- notification provider credentials are not available
- backend does not know how to store device tokens
- deep link routes are not environment-specific

## Validation

Simulator or web can validate:

- map rendering
- markers
- simulated location display
- permission denied/retry UI
- QR display UI
- basic deep-link routing
- basic push permission UI

Real devices must validate:

- camera permission
- QR scanning
- QR scan loop between physical devices if possible
- GPS permission prompts
- real GPS reads
- moving location updates
- Google Maps behavior on iOS and Android
- push registration, delivery, taps
- foreground/background notification behavior
- external deep links

## Done Means

- Camera works independently on real iOS and Android devices.
- QR scanning works independently on real iOS and Android devices.
- QR display works correctly.
- GPS permission and location reading work independently.
- Maps render correctly.
- Deep links can open the app.
- Push notification registration works or the backend gap is clearly registered.
