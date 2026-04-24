# CODE SYSTEM DESIGN SPECIFICATION (code_sds.md)

# Purpose

This document is the engineering source of truth for how backend code must be implemented, modified, organized, and maintained across the project.

It ensures that all code changes—whether created by AI agents or humans—remain:

* consistent across modules
* easy to understand
* safe to extend
* easy to debug
* maintainable long term

This document defines **how engineering happens** in this project.

---

# Scope

This document governs:

* new backend modules
* feature implementation
* code refactors
* bug fixes
* testing updates
* integrations between modules

This document does NOT define business rules. Business rules belong in:

* /SDS/core_sds.md
* /SDS/features/*.md

---

# Source of Truth Priority

If conflicts occur, follow this order:

1. /SDS/core_sds.md
2. /SDS/features/*.md
3. /SDS/data_model/schema.md
4. /SDS/code_sds.md

If conflict remains unclear: STOP and ask.

---

# Tech Stack Rules

Backend standard stack:

* Node.js
* TypeScript
* Modular Monolith Architecture
* PostgreSQL
* ORM / Query Layer approved by project
* Validation library approved by project
* Standard test framework approved by project

Do not introduce new frameworks without approval.

---

# Project Structure Standard

```text
src/
  modules/
    <module-name>/
      <module>.route.ts
      <module>.controller.ts
      <module>.service.ts
      <module>.repository.ts
      <module>.schema.ts
      <module>.types.ts
      <module>.errors.ts
      index.ts
      __tests__/

  shared/
    db/
    errors/
    logger/
    middleware/
    utils/
    config/
```

All new modules must follow this structure unless explicitly approved otherwise.

---

# Module Blueprint

Example:

```text
src/modules/booking/
  booking.route.ts
  booking.controller.ts
  booking.service.ts
  booking.repository.ts
  booking.schema.ts
  booking.types.ts
  booking.errors.ts
  index.ts
  __tests__/
```

Every domain module must mirror the same pattern.

Examples:

* booking
* slot
* venue
* session
* matching

No random layouts.

---

# Layer Responsibilities

## Route Layer

Responsible for:

* registering endpoints
* middleware attachment

Must NOT contain business logic.

---

## Controller Layer

Responsible for:

* reading request input
* invoking services
* returning responses

Must remain thin.

---

## Service Layer

Responsible for:

* business workflows
* orchestration
* state validation
* calling repositories
* calling other services when required
* transaction coordination

Primary logic layer.

---

## Repository Layer

Responsible for:

* database reads
* inserts
* updates
* deletes

Must NOT contain business logic.

---

## Schema Layer

Responsible for:

* request validation
* response validation if used
* DTO typing

---

## Errors Layer

Responsible for:

* domain specific custom errors

---

# Coding Standards

## Core Principles

Code must be:

* readable
* modular
* explicit
* maintainable
* predictable

Avoid clever code.

---

## Single Responsibility Rule

Every method should do one job only.

Good examples:

* createBooking()
* ensureSlotAvailable()
* findVenueById()
* cancelBooking()

Bad examples:

* processEverything()
* handleTask()
* runMain()

---

## Function Size Rule

Preferred:

* 10 to 30 lines

Hard review threshold:

* above 50 lines

Split into sub-methods if too large.

---

## Nesting Rule

Avoid deep nesting.

Preferred:

* max 2 to 3 levels

Use guard clauses.

---

## Service Flow Readability Rule

Service methods should read like business steps.

Example:

```text
validateInput
ensureEligibility
ensureAvailability
createRecord
returnResponse
```

---

# Naming Conventions

## Files

Use lowercase dotted names:

* booking.service.ts
* booking.repository.ts

## Methods

Use verb + noun:

* createBooking
* cancelBooking
* findBookingById

## Variables

Use clear domain names:

* bookingId
* clientId
* activeBooking

Avoid:

* data
* obj
* item
* temp

---

# Change Rules for Existing Code

When modifying existing code:

* prefer minimal safe changes
* understand current flow before editing
* preserve backward compatibility unless requested otherwise
* do not rewrite unrelated files
* do not perform speculative refactors

Refactor only when justified.

---

# Error Handling Standards

Use explicit custom errors.

Examples:

* ValidationError
* NotFoundError
* ConflictError
* UnauthorizedError
* InternalServerError

Do not use unclear generic failures.

Bad:

```text
throw new Error("failed")
```

---

# HTTP Error Mapping

Use consistent responses:

* 400 = invalid request
* 401 = unauthorized
* 403 = forbidden
* 404 = not found
* 409 = conflict
* 500 = internal error

---

# Logging & Debugging Standards

Use structured logs.

Log:

* request start (where applicable)
* important state changes
* failures
* transaction rollback events

Example:

```text
logger.info("createBooking started", { clientId, venueId })
```

Do NOT:

* spam logs
* log secrets
* log passwords
* log tokens

---

# Maintainability Rules

Code must be understandable by a human developer quickly.

Prefer:

* explicit steps
* small methods
* predictable patterns
* low magic behavior

Avoid giant god-functions.

Avoid hidden side effects.

---

# Debuggability Rules

System behavior must be traceable.

Ensure:

* clear method boundaries
* explicit thrown errors
* useful logs
* isolated responsibilities

---

# Database Rules

Use only schema-defined tables and fields.

Do NOT invent columns.

All writes must align with:

/SDS/data_model/schema.md

If schema mismatch exists:

* STOP
* Ask for clarification

---

# Transaction Rules

Use transactions when:

* multiple dependent writes occur
* consistency must be guaranteed
* booking-like reservation flows occur
* race conditions are possible

If unsure, prefer transaction.

---

# Concurrency Rules

Protect against:

* duplicate booking
* double submission
* conflicting updates

Use:

* transactions
* constraints
* re-check before commit
* locking strategy if required

---

# Dependency & Integration Rules

Modules may communicate through services.

Good:

* booking service calls slot service

Avoid:

* direct DB access into another module’s domain
* circular dependencies
* bypassing business logic layers

---

# Testing Standards

Every meaningful change should include tests when project setup supports it.

Minimum tests:

1. Happy path
2. Invalid input
3. Conflict scenario
4. Regression scenario
5. DB state verification where relevant

---

# Test File Placement

Use:

```text
src/modules/<module>/__tests__/
```

Examples:

* create-booking.test.ts
* cancel-booking.test.ts

---

# Performance Rules

Avoid:

* N+1 query patterns
* unnecessary repeated DB reads
* loading unused large datasets

Use pagination for list endpoints where needed.

Indexes must be handled through schema process, not ad-hoc code.

---

# Security Rules

Always:

* validate inputs
* check authentication first
* check authorization/ownership second
* sanitize outputs if required
* avoid leaking internal errors publicly

Never trust request input.

---

# AI Agent Workflow Rules

For every coding task:

1. Read /SDS/core_sds.md
2. Read relevant /SDS/features/*.md
3. Read /SDS/data_model/schema.md
4. Read /SDS/code_sds.md
5. Read impacted code files
6. Identify minimal safe implementation
7. Implement
8. Add/update tests
9. Self-review against this document

---

# Feature Ownership Rules

Every change must map to owning feature SDS.

Examples:

* booking create → booking feature SDS
* slot availability → slot feature SDS
* session start → session feature SDS

If ownership unclear: STOP and ask.

---

# Protected Files Rule

Do NOT modify without approval:

* /master-document/
* /SDS/core_sds.md
* /SDS/features/*.md
* /SDS/data_model/schema.md
* /SDS/code_sds.md

Only application code may be changed unless explicitly approved.

---

# Stop Conditions

STOP and ask if:

* requirements conflict
* feature SDS unclear
* schema missing needed field
* multiple interpretations possible
* change impacts unrelated modules heavily
* current code contradicts SDS

Do not guess.

---

# Output Rules for Agent

After task completion provide:

1. Files changed
2. What was implemented
3. Assumptions made
4. Risks noticed
5. Further clarification needed

Be concise.

---

# Final Principles

Correctness > speed

Consistency > creativity

Clarity > cleverness

Small safe changes > large risky rewrites

Readable code > impressive code

This project must remain maintainable by humans at all times.
