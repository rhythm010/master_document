# project-context-mcp (local-only)

This is a **local, stdio-based MCP server** for the Companion workspace that provides **structured, queryable context** (SDS, schema, module contracts) to reduce repeated raw file reads.

## Registered MCP server

Workspace registration lives in:
- `.vscode/mcp.json` → `project-context-mcp` (stdio, local)

## Tools

- `get_module_contract({ module })`
  - Returns endpoints + auth summary extracted from `technical/backend-companion/src/modules/<module>/*.route.ts`.
- `get_feature_sds({ feature })`
  - Returns structured `businessRules`, `stateTransitions`, `validations`, `apis`, `nonGoals`.
  - **Latest/current SDS resolution only** (`<feature>.feature-sds.md`, then `<feature>_current.md`, then highest semver).
- `get_schema_entity({ entity })`
  - Returns Prisma model fields + attributes for a **single entity**.
- `get_feature_support_matrix()`
  - Heuristic spec-vs-code status comparing master-document endpoints vs route files.
- `get_business_rules({ topic, limit? })`
  - Returns topic-relevant bullet rules across Feature SDS + core SDS + master-docs.
- `get_invariants()`
  - Returns core SDS invariants as structured list.

## Demo (generated via MCP tool calls)

### Identity module contract (excerpt)

From `get_module_contract({ module: "identity" })`:

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/signup` | public |
| GET | `/auth/verify-email` | public |
| POST | `/auth/login` | public |
| GET | `/users/me` | user (Bearer) |
| PATCH | `/users/me` | user (Bearer) |

### Matching Flow SDS APIs (excerpt)

From `get_feature_sds({ feature: "matching-flow" })`:

- `GET /bookings/{bookingId}/com-match/context`
- `POST /bookings/{bookingId}/client-match/start`
- `POST /bookings/{bookingId}/matching/location`

### Prisma: User entity (excerpt)

From `get_schema_entity({ entity: "User" })`:

- `id: String @id @default(uuid()) @db.Uuid`
- `email: String @unique`
- `createdAt: DateTime @default(now()) @db.Timestamptz(6)`
- relations: `bookings`, `rosterSlots`, `bookingAssignments`, ...

## Dev

```bash
cd mcp/project-context-mcp
npm install
npm run build
npm run smoke
```

Notes:
- Logs go to **stderr** (`[project-context-mcp] ...`) for MCP debugging.
- Server keeps a simple in-memory cache keyed by file `mtimeMs` + `size` for fast repeat calls.
