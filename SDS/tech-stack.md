# Tech Stack & Tooling

> **Purpose:** Single reference for every tool, library, and convention an AI agent (or developer) must follow when writing code for the Companion application.
> All choices are JavaScript/TypeScript-ecosystem, widely adopted, and straightforward to use.
>
> **Dual-mode requirement:** Every tool in this stack must be operable via **both CLI (terminal)** and a **GUI**. AI agents work through the terminal; human developers may prefer a visual interface. A tool that only has one mode is not acceptable.

---

## 1. Language

| Layer | Language | Notes |
|-------|----------|-------|
| Backend | TypeScript (Node.js) | Strict mode enabled (`"strict": true` in tsconfig). |
| Frontend (Mobile) | TypeScript (React Native) | Already in use in the Expo project. |

* Use `ts-node` or `tsx` for local development execution.
* Compile target: ES2022 or later.

---

## 2. Backend

| Concern | Library / Tool | Version Guidance | Notes |
|---------|---------------|-----------------|-------|
| **Runtime** | Node.js | LTS (≥ 20) | |
| **Framework** | Express | 4.x | Minimal, unopinionated. Use `express.Router` for modular route files. |
| **Validation** | Zod | latest | Validate all request bodies, params, and query strings at the route layer. |
| **ORM / DB Client** | Prisma | latest | Auto-generated client from `schema.prisma`. Use Prisma Migrate for schema migrations. |
| **Database** | PostgreSQL | ≥ 15 | System of record (see `core_sds.md` §9 and `data-model/schema.md`). |
| **Authentication** | jsonwebtoken (`jwt`) | latest | Sign & verify JWTs for session tokens. |
| **Password Hashing** | bcrypt | latest | Hash passwords with a cost factor of 12. |
| **UUID Generation** | `crypto.randomUUID()` | built-in | Node 19+ built-in; no external package needed. |
| **File Upload** | Multer | latest | Multipart/form-data parsing. Also handles local disk storage (Phase 1). One tool for upload parsing + storage. |
| **File Storage** | Express.static() (Phase 1) | built-in | Serve uploaded files from local `uploads/` dir. Phase 2 (TBD): migrate to S3-compatible storage. |
| **Email Sending** | Nodemailer | latest | Send verification and notification emails. Uses SMTP transport — works with any provider or Mailpit in dev. |
| **Rate Limiting** | express-rate-limit | latest | Protect login and sensitive endpoints (e.g., 5 attempts / 15 min per email). |
| **Environment Config** | dotenv | latest | Load `.env` files. Never commit secrets. |
| **Error Handling** | Custom middleware | — | Standard JSON error envelope: `{ code, message }` per `core_sds.md` §8. |
| **Logging** | pino | latest | Structured JSON logging. |
| **Testing** | Jest + Supertest | latest | Unit tests (services), integration tests (API routes via Supertest). |
| **Linting** | ESLint | 9.x (flat config) | Use `@typescript-eslint` plugin. |
| **Formatting** | Prettier | latest | Enforce via ESLint integration or pre-commit hook. |

### 2.1 Backend Project Structure (Modular Monolith)

```
src/
  modules/
    <feature>/          # e.g. booking, auth, venue
      <feature>.routes.ts
      <feature>.service.ts
      <feature>.validation.ts   # Zod schemas
  middleware/
    errorHandler.ts
    auth.ts
  prisma/
    schema.prisma
  app.ts                # Express app setup
  server.ts             # Entry point
```

* Each feature module is self-contained with its own routes, service, and validation.
* Services contain business logic; routes are thin and delegate to services.
* Data access goes through Prisma Client — no raw SQL unless there is a strong performance or correctness reason (e.g., `FOR UPDATE SKIP LOCKED` for concurrency control in booking allocation).

---

## 3. Frontend (Mobile)

| Concern | Library / Tool | Version Guidance | Notes |
|---------|---------------|-----------------|-------|
| **Framework** | React Native | 0.81+ | |
| **Platform Tooling** | Expo | SDK 54+ | Managed workflow. Use `npx expo install` for dependency resolution. |
| **Navigation** | React Navigation | 7.x | Stack + Tab navigators. |
| **State Management** | Zustand | latest | Minimal global stores (e.g., auth, booking). Prefer local state where possible. |
| **HTTP Client** | Axios | latest | Centralised instance with base URL and auth interceptor. |
| **Local Storage** | @react-native-async-storage/async-storage | latest | For persisting auth tokens and lightweight user prefs. |
| **Forms** | React Hook Form + Zod resolver | latest | Zod schemas shared with backend where applicable. |
| **Biometric Auth** | expo-local-authentication | latest | FaceID / TouchID support (see 1.1.1.1 signup flow). |
| **QR Code** | expo-camera (scanner) + react-native-qrcode-svg (display) | latest | For companion-companion and client-companion matching flows. |
| **Push Notifications** | expo-notifications | latest | For booking alerts, session reminders. |
| **Testing** | Jest + React Native Testing Library | latest | Component and hook tests. |
| **Linting / Formatting** | ESLint + Prettier | same config as backend | Shared rules where possible. |

### 3.1 Frontend Project Structure

```
src/
  screens/
    <Feature>/
      <Feature>Screen.tsx
  components/
    common/              # Reusable UI components
    <feature>/           # Feature-specific components
  stores/
    useAuthStore.ts
    useBookingStore.ts
  api/
    client.ts            # Axios instance
    <feature>.api.ts     # API call functions
  hooks/
  utils/
  navigation/
    AppNavigator.tsx
App.tsx
```

---

## 4. Shared Conventions

| Convention | Rule |
|-----------|------|
| **Package Manager** | npm (lock file: `package-lock.json`). |
| **Monorepo** | Not required initially. Backend and frontend are separate projects under `technical/`. |
| **API Style** | REST, JSON, camelCase field names (per `core_sds.md` §6). |
| **IDs** | UUID v4 everywhere. |
| **Timestamps** | ISO 8601 strings over the wire; `timestamptz` in Postgres. |
| **Enums** | Defined once in Prisma schema, mirrored as TypeScript string unions on the frontend. |
| **Secrets** | `.env` files, never committed. Use `.env.example` for templates. |
| **Git Ignore** | `node_modules/`, `dist/`, `.env`, `prisma/*.db`. |

---

## 5. Infrastructure (Local Dev)

| Concern | Tool | Notes |
|---------|------|-------|
| **Database** | Docker Compose (Postgres container) | Single `docker-compose.yml` at project root. GUI: Docker Desktop for container management. |
| **DB Admin** | Prisma Studio | `npx prisma studio` (GUI) for browsing/editing data. CLI: `npx prisma db execute` for raw queries. |
| **Migrations** | Prisma Migrate | CLI: `npx prisma migrate dev`. GUI: Prisma Studio shows current schema state. |
| **Seeding** | `prisma/seed.ts` | CLI: `npx prisma db seed`. |
| **Dev Email** | Mailpit (Docker container) | SMTP on port `1025` (Nodemailer connects here in dev). GUI: `http://localhost:8025` to view sent emails. CLI: Docker logs. |
| **API Testing** | Bruno | CLI: `bru run` (terminal-based collection runner). GUI: Bruno desktop app for visual request building. Stored as plain files in git (no cloud account needed). |

---

## 6. AI-Agent Developer Experience

> The majority of code in this project is written, run, tested, and verified by AI agents operating through a terminal, while human developers maintain and review through GUIs. Every tool must therefore support **both modes** — a CLI that agents can script, and a GUI that humans can use visually.

### 6.1 Guiding Principles

| Principle | What it means in practice |
|-----------|---------------------------|
| **Dual-mode tooling** | Every tool must have a functional CLI (for agents) **and** a GUI (for humans). No terminal-only or GUI-only tools. |
| **Fast feedback loops** | Tests and lint must run in seconds, not minutes. Use `--bail` / `--findRelatedTests` in Jest and `--cache` in ESLint so agents can iterate quickly. |
| **Deterministic outputs** | Same input → same result. Pin dependency versions, use seeded test data, and avoid time-dependent logic in tests. |
| **Clear exit codes** | Every script must exit `0` on success and non-zero on failure so the agent knows whether a step passed. |
| **Parseable output** | Prefer structured (JSON) output where available (`jest --json`, `eslint -f json`, `prisma migrate status --json`). Agents parse JSON reliably; human-formatted tables are fragile. |
| **No interactive prompts** | All CLI tools must run non-interactively. Use `--yes` / `--force` flags or environment variables where needed (e.g., `npx prisma migrate deploy` in CI, `npm ci` instead of `npm install`). |

### 6.2 Standard Script Catalogue

Every project (`backend-companion`, `frontend-companion`) must expose these npm scripts so an agent can operate without reading the README:

```jsonc
// package.json — scripts (backend)
{
  "dev": "tsx watch src/server.ts",          // start dev server with hot reload
  "build": "tsc",                            // compile TypeScript
  "start": "node dist/server.js",            // run compiled output
  "test": "jest --forceExit --detectOpenHandles",
  "test:ci": "jest --ci --json --outputFile=test-results.json",
  "lint": "eslint src/ --cache",
  "lint:fix": "eslint src/ --cache --fix",
  "format": "prettier --write src/",
  "format:check": "prettier --check src/",
  "db:migrate": "npx prisma migrate dev",
  "db:migrate:deploy": "npx prisma migrate deploy",
  "db:seed": "npx prisma db seed",
  "db:reset": "npx prisma migrate reset --force",
  "db:generate": "npx prisma generate",
  "typecheck": "tsc --noEmit"
}
```

```jsonc
// package.json — scripts (frontend)
{
  "start": "expo start",
  "web": "expo start --web",
  "test": "jest --forceExit",
  "test:ci": "jest --ci --json --outputFile=test-results.json",
  "lint": "eslint src/ --cache",
  "lint:fix": "eslint src/ --cache --fix",
  "format": "prettier --write src/",
  "format:check": "prettier --check src/",
  "typecheck": "tsc --noEmit"
}
```

### 6.3 Agent Workflow (Verify Loop)

When implementing a feature, the agent must follow this loop:

```
1. npm run typecheck          # catch type errors early
2. npm run lint               # style & static analysis
3. npm run test               # run relevant tests
4. (if backend DB change)  npm run db:migrate
5. npm run dev                # start server, smoke test via curl/supertest
```

Every step is a single terminal command with a meaningful exit code. If any step exits non-zero, the agent must fix the issue before proceeding.

### 6.4 Docker (Postgres) — Setup

**Terminal (AI agent):**
```bash
# Start the dev database (from project root)
docker compose up -d db

# Verify it's ready
docker compose exec db pg_isready
```

**GUI (human):** Use Docker Desktop to start/stop/inspect the `db` container.

The `docker-compose.yml` must expose Postgres on a fixed local port (`5432`) with deterministic credentials in `.env.example` so the agent can connect without discovery.

### 6.5 Test Isolation

* Each integration test suite must set up and tear down its own data (use Prisma transactions or truncate between tests).
* Tests must not depend on execution order.
* Use `jest --runInBand` for integration tests that share a DB to avoid race conditions.

---

## 7. Version Pinning

* Lock exact versions in `package-lock.json`.
* Prefer `latest` as guidance above, but pin after initial install.
* Run `npm audit` regularly.

---

> **Rule for AI Agents:** When generating code for any feature, consult this file first to determine which library to use. Do not introduce libraries outside this list without explicit user approval. Every workflow step must be executable via a single terminal command — no interactive prompts, no manual intervention. All tools also provide a GUI for human developers.
