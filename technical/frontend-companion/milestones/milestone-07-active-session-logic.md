# Milestone 7: Active Session Logic

## Objective

Build the session-in-progress experience with minimum UI.

The app should support active session monitoring and actions from both Client and Companion roles.

## Scope

- In-service page
- Client active session view
- Companion active session view
- Timer/countdown behavior
- Session status polling
- Extend once
- End early
- SOS stub
- Companion chat
- Message polling
- Companion location posting
- Completion and cancellation states

## Tasks

- Build in-service screen.
- Fetch active session state.
- Show session status.
- Show elapsed or remaining time.
- Poll or refresh session status.
- Handle app resume by refreshing session state.
- Implement extend session action.
- Enforce extend-once rule in UI.
- Implement end early action.
- Implement SOS action as backend-supported stub.
- Build companion chat UI.
- Poll or refresh companion messages.
- Post companion messages.
- Post companion location updates during active session.
- Handle completed state.
- Handle cancelled state.
- Handle extended state.
- Add errors for invalid session actions.

## Design Reference

- `client-in-service-client.png`

Companion-specific in-service designs may not exist yet. Use minimum functional UI if needed.

## Placeholder Or Static V1 Items

The SOS button can trigger the backend stub if the full emergency workflow is not ready.

Any advanced support/escalation UI can stay placeholder until backend and operations process are defined.

## Backend Dependencies

- Current session endpoint
- Extend session endpoint
- End early or cancellation behavior
- SOS endpoint
- Messages endpoints
- Location posting endpoint
- Session scheduler behavior
- Notification side effects

Important known gaps to check:

- near-end and session notification side effects are placeholders
- companion breach alerts are placeholders

## Validation

Simulator or web can validate:

- active-session views
- countdown/timer logic
- session polling
- extend once
- end early
- SOS stub
- companion chat UI
- message polling
- completion/cancellation states
- extended state
- invalid action errors

Real devices must validate:

- active-session location posting
- timer behavior after background/foreground cycles
- session refresh after app resume
- near-end/session push notifications if included
- extend/end/SOS smoke tests on iOS and Android

## Done Means

- The In-service page shows active session state.
- The active session can be managed from Client and Companion roles.
- Client can extend the session once.
- Client can end the session early.
- SOS stub can be triggered.
- Companions can chat during the session.
- Location posting continues during the active session.
- Completion or cancellation state is reflected in the app.
