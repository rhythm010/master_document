# Codex Project Instructions

These instructions are intended for Codex only. Do not mirror them into
`AGENTS.md` or other shared agent instruction files unless explicitly asked.

## Repository

- Treat `technical/frontend-companion/companion-app` as the Expo React Native app.
- Treat `technical/backend-companion` as the Node/TypeScript backend.
- Keep milestone docs, implementation docs, and code aligned when working on milestone tasks.
- Do not expose or print secret values from `.env`, `.env.local`, or backend env files.

## Frontend

- Use Expo Router route-group conventions already present in `app/`.
- Backend routes are root-mounted, such as `/health`, `/auth/login`, and `/users/me`; do not add `/api/v1`.
- Use `EXPO_PUBLIC_API_BASE_URL` for the mobile API base URL.
- Keep auth/session token handling in `store/session.ts` and API authorization in `lib/api-client.ts`.
- Use existing shared UI components before adding new ones.
- For placeholder V1 functionality, prefer the existing placeholder action pattern.

## Backend

- Preserve the existing backend error envelope shape and root-mounted route structure.
- Keep local email verification compatible with Mailpit.
- Treat staging email delivery as intentionally blocked unless configured otherwise.

## Verification

- After frontend code changes, run:
  - `npm run lint`
  - `npx tsc --noEmit`
- For backend code changes, inspect package scripts first and run the narrowest relevant test command.
- If runtime checks require local services such as Mailpit, Postgres, or the backend server, state clearly what was and was not verified.

## Working Style

- Default to analysis and reporting back. Most tasks should end with findings,
  risks, recommendations, or a proposed plan rather than direct code edits.
- Do not make code changes directly without explicit approval from the user.
  If a fix is needed, describe the change first and wait for approval before
  editing files.
- Prefer small, scoped edits.
- Do not revert user changes unless explicitly asked.
- When a milestone says something is done, verify the code path rather than relying only on docs.
