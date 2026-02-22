# Architect's Response to Gemini 5.1 Technical Review

> **Context:** These are the original architect's detailed responses to each question raised during Gemini 5.1's review of the Phase 1 technical specifications.  
> **Date:** Post-review round  
> **Status:** Authoritative — decisions recorded here are binding for implementation.

---

## Design & Architecture

### Q1: State Synchronization — `booking_status_cache`

**Gemini's Concern:** How do we prevent `booking_status_cache` from drifting from the actual `Booking` table, especially when background jobs update booking status?

**Answer:**

The `booking_status_cache` is a deliberate **denormalization for read performance**. The FE check at 1.2.1.1.2 fires on every app open ("Does this client have an active booking? → Redirect"). This must be a single-row read on the `clients` table — no join to `bookings` needed.

**Why not compute on read?** Because the computed approach requires `SELECT b.status FROM bookings b WHERE b.client_id = $1 AND b.status IN ('PENDING', 'CONFIRMED', 'ACTIVE')` on every app open. For Phase 1, this is trivially fast. But the denormalized field also serves as the **single-booking enforcement mechanism** — the `current_booking_id` UNIQUE constraint is the DB-level guard. The cache is a convenience field that rides the same update path.

**How drift is prevented:**

1. **Every state transition already updates the cache.** The spec is explicit: `confirmBooking()` sets `booking_status_cache: CONFIRMED`, `failBooking()` sets `NONE`, cancellation sets `NONE`, soft-lock expiry sets `NONE`, duo breach sets `NONE`, no-show completion sets `NONE`. The cache is written in the **same transaction** as the booking status change. There is no window where they can diverge within normal operation.

2. **Background jobs are not a special case.** The soft-lock expiry job, duo-breach job, and no-show job all run the same service functions (`failBooking()`, cancel logic, complete logic) that update both tables atomically.

3. **Safety net (added to spec):** The `GET /bookings/current` endpoint (6.4.5) should add a **reconciliation check**: if `current_booking_id` is non-null, fetch the booking's actual status. If the booking is in a terminal state (`COMPLETED`, `CANCELLED`, `FAILED`) but the cache says otherwise, **auto-correct** the cache within the same request. Log this as a `warn` event. This costs one extra query only when a booking exists, and self-heals any theoretical drift.

**Decision:** Keep the denormalized cache. Add the reconciliation safety net to `GET /bookings/current`. This is documented in the updated spec.

---

### Q2: Serializable Transactions — Retry Strategy

**Gemini's Concern:** PostgreSQL Serializable isolation can throw `40001` serialization failure errors. What's the retry strategy?

**Answer:**

This is a legitimate gap in the spec. PostgreSQL's Serializable Snapshot Isolation (SSI) can abort transactions with error code `40001` when it detects potential serialization anomalies. This is **expected behavior**, not an error — it's the database correctly preventing race conditions.

**Implementation guidance:**

1. **The backend must implement automatic retries.** The client (mobile app) should not need to handle this. Serialization failures are an internal concurrency concern.

2. **Retry strategy:**
   ```
   MAX_RETRIES = 3
   RETRY_DELAY_BASE_MS = 100
   
   for attempt in 1..MAX_RETRIES:
     try:
       BEGIN TRANSACTION (Serializable)
       ... booking logic ...
       COMMIT
       return success
     catch (error):
       if error.code == '40001':  // Serialization failure
         wait(RETRY_DELAY_BASE_MS * attempt)  // 100ms, 200ms, 300ms
         continue
       else:
         throw error  // Non-retryable error
   
   throw SLOT_UNAVAILABLE  // All retries exhausted
   ```

3. **Why this is safe:** The booking creation logic is **idempotent within the transaction** — it re-checks availability on each attempt. If two users race for the same slot, one succeeds and the other's retry will correctly find the slot unavailable.

4. **Scope:** Only the `POST /bookings` endpoint uses Serializable. All other transactions use the default `Read Committed` isolation, which doesn't have this issue.

**Decision:** Add retry logic with exponential backoff (3 retries, 100ms base). Implemented in a `withSerializableRetry()` utility wrapper. Added to spec.

---

### Q3: Job Redundancy — In-Process Cron

**Gemini's Concern:** What happens if the server restarts during a critical job execution (e.g., processing a refund)?

**Answer:**

This is a calculated risk for Phase 1. Here's why it's acceptable:

1. **All scheduled jobs are idempotent by design.** The queries use conditional WHERE clauses:
   - Soft-lock expiry: `WHERE status = 'PENDING' AND soft_lock_expires_at < NOW()`
   - Duo breach: `WHERE status = 'CONFIRMED' AND duo_status != 'ACTIVATED' AND ...`
   - No-show: `WHERE status = 'CONFIRMED' AND duo_status = 'ACTIVATED' AND session_started_at IS NULL AND ...`
   
   If the server crashes mid-execution and restarts, the cron fires again within 1 minute and picks up the same records (they haven't been updated yet). Re-processing is safe because the state transition is atomic — a booking either moves to FAILED/CANCELLED/COMPLETED or it doesn't.

2. **Partial execution is harmless.** Consider: the soft-lock job finds 3 expired bookings. It processes booking A (success), starts booking B, server crashes. On restart: booking A is already FAILED (skipped by the WHERE clause), booking B and C are still PENDING with expired locks (processed normally). No double-processing.

3. **Refunds are mock in Phase 1.** The payment service is a stub that logs to console. Even if called twice for the same booking, it's a no-op because the booking status has already transitioned.

4. **What would break:** If we had **real** payment processing and the server crashed between "charge the card" and "update the DB." This is the classic distributed transaction problem. The solution for Phase 2 is an **outbox pattern** or **idempotent payment calls** with provider-side deduplication (Stripe supports idempotency keys natively).

**Decision:** No job lock table for Phase 1. All jobs must remain idempotent. When migrating to BullMQ (Phase 2/multi-instance), jobs gain built-in at-least-once delivery and retry semantics. Added a note to the spec's "Future Scalability" section.

---

### Q4: Soft-Lock Race Condition (T-14:59 Payment vs T-15:00 Expiry)

**Gemini's Concern:** If a user submits payment at minute 14:59 and the expiry job runs at minute 15:00, who wins?

**Answer:**

This is already handled by the transaction design, but it deserves explicit documentation because the safety relies on two independent paths both checking the same state.

**How it works:**

- **Path A (Payment completes):** `confirmBooking()` runs inside a transaction. Step 1: `Verify status == PENDING AND soft_lock_expires_at > NOW()`. If the lock hasn't expired, it proceeds to set `status = CONFIRMED` and commits.

- **Path B (Expiry job):** The cron job queries `WHERE status = 'PENDING' AND soft_lock_expires_at < NOW()`. It only finds bookings where the lock has **already** expired.

**Race resolution (whoever commits first wins):**

| Scenario | Path A (Payment) | Path B (Expiry Job) | Outcome |
|----------|-------------------|---------------------|---------|
| Payment commits first | Sets status → CONFIRMED | Finds status != PENDING → skips | ✅ Booking confirmed |
| Expiry commits first | Finds status != PENDING → voids payment hold, returns error | Sets status → FAILED | ✅ Booking expired, payment voided |
| Truly simultaneous | PostgreSQL serializes them — one blocks until the other commits | Second transaction sees committed state | ✅ Deterministic |

**The critical detail:** The `confirmBooking()` check `soft_lock_expires_at > NOW()` provides a **second layer** of protection. Even if the expiry job hasn't run yet, if the lock is expired, confirmBooking refuses to confirm. This means:

- At T-14:59: Lock hasn't expired. Payment can succeed.
- At T-15:01: Lock has expired. Even if the expiry job is delayed, confirmBooking will self-reject.
- At T-15:00 exactly: Database timestamp comparison. Millisecond-level resolution. One wins cleanly.

**Decision:** The design is correct. Added explicit documentation in the spec to make this race-safety visible.

---

## Data & Implementation

### Q5: Location History — Database Bloat

**Gemini's Concern:** Will high-frequency GPS pings bloat PostgreSQL?

**Answer:**

Let's do the math for Phase 1:

- Tracking phases: PRE_ARRIVAL (45 min), POST_MATCH (~30 min), CLIENT_EN_ROUTE (~15 min), IN_SERVICE (120 min)
- Ping frequency: 1 ping per 15 seconds during PRE_ARRIVAL/POST_MATCH, 1 per 30 seconds during IN_SERVICE (lower frequency once session is running)
- Per booking: ~180 pings for PRE_ARRIVAL (2 companions × 45 min × 4/min), ~120 for POST_MATCH, ~60 CLIENT_EN_ROUTE, ~480 IN_SERVICE = **~840 rows per booking**
- At 10 bookings/day (Phase 1 scale): **~8,400 rows/day**, **~250K rows/month**

This is **trivially small** for PostgreSQL. A table with 3M rows (one year) and proper indexes on `(booking_id)` and `(tracked_entity_id, created_at)` performs well.

**Phase 1 decision:**

1. **No partitioning needed.** 250K rows/month is nothing.
2. **Add a retention policy as a scheduled job:** Delete tracking logs older than 90 days. This is a cleanup job, not a correctness requirement — we keep data long enough for dispute resolution.
3. **Add `created_at` index** (already in the schema via the booking_id index; add a standalone created_at index for time-range queries).

**Phase 2 (when scaling):**
- Partition by month using PostgreSQL's native declarative partitioning: `PARTITION BY RANGE (created_at)`.
- Consider moving to TimescaleDB (PostgreSQL extension) if analytics on location data becomes a feature.

**Decision:** No schema change for Phase 1. Add a `location-log-cleanup.job.ts` scheduled job (runs daily, deletes records > 90 days). Added to spec.

---

### Q6: Shift vs. Availability — Partial Shifts

**Gemini's Concern:** If a companion works 9-5 and a booking is 4-6, does the engine reject because it ends after the shift?

**Answer:**

**Yes, the engine correctly rejects this.** The allocation algorithm (spec section 17.2, step 2d) explicitly requires:

> Shift covers: `(slot.startTime - INTER_BOOKING_BUFFER)` to `(slot.endTime + REST_BUFFER)`

For your example:
- Booking: 4:00 PM – 6:00 PM
- Required shift coverage: 3:30 PM (4:00 - 30m buffer) to 6:20 PM (6:00 + 20m rest)
- Companion's shift: 9:00 AM – 5:00 PM
- **Shift ends at 5:00 PM but coverage is needed until 6:20 PM → REJECTED**

This is intentional. A companion cannot serve a booking that extends beyond their shift because:
1. They need the 20-minute post-session rest buffer within their working hours.
2. Extending past shift end creates labor/compliance issues.
3. The companion may have commitments after their shift.

**The engine does NOT support partial shifts.** The companion must have complete coverage for the entire expanded window (pre-buffer + session + post-buffer).

**Edge case clarification:** If the companion has a shift 9:00 AM – 7:00 PM and the booking is 4:00 – 6:00 PM, the required window is 3:30 – 6:20. The shift covers this entirely → **ACCEPTED**.

**Decision:** Behavior is correct and intentional. No change needed.

---

### Q7: Versioning — Allocation Engine

**Gemini's Concern:** Should the AllocationEngine also be versioned like the PricingEngine?

**Answer:**

**Yes.** This is a legitimate gap. The allocation engine's selection logic (sort by `total_sessions ASC`, the filtering criteria, the buffer calculations) directly affects which companions are assigned. If we change the sort order from "least sessions first" to "highest rated first" or add proximity-based matching, we need to know which version of the logic produced a given allocation.

**Implementation:**

1. Add `ALLOCATION_ENGINE_VERSION = "1.0"` to `src/config/constants.ts`.
2. Add `allocation_engine_version` field to `BookingAuditLog` (nullable String, same pattern as `pricing_engine_version`).
3. The `CREATED` audit log entry records both `pricing_engine_version` and `allocation_engine_version`.

**Decision:** Add allocation engine versioning. Schema update applied.

---

### Q8: Idempotency Key for `POST /bookings`

**Gemini's Concern:** Should we implement an `Idempotency-Key` header for cleaner UX on flaky networks?

**Answer:**

**Yes, for Phase 1, but with a lightweight implementation.**

The current protection (unique constraint on `current_booking_id`) prevents **duplicate bookings** but returns a `409 ACTIVE_BOOKING_EXISTS` error on the retry, which the FE must handle specially. An idempotency key provides a cleaner contract.

**Implementation:**

1. Client sends `Idempotency-Key: <uuid>` header with `POST /bookings`.
2. Before starting the booking transaction, check an in-memory `Map<string, { bookingId: string, response: object, expiresAt: number }>` for the key.
3. If found: return the cached response (same 201 body). No DB operation.
4. If not found: proceed with booking creation. On success, store the key → response mapping with a 15-minute TTL (matches soft-lock window).
5. If the key is missing from the request: proceed without idempotency (backward compatible).

**Why in-memory is fine for Phase 1:** Single server instance. When we move to multi-instance, migrate to Redis with TTL — same pattern as OTP store.

**Scope:** Only `POST /bookings` needs this. Other mutating endpoints (`POST /cancel`, `POST /reassign`) are already naturally idempotent (cancelling an already-cancelled booking returns the same result).

**Decision:** Implement Idempotency-Key for `POST /bookings`. Added to spec.

---

## Specific Technical Details

### Q9: Notification Delivery — Battery Check

**Gemini's Concern:** Does the Battery Check notification rely on the app being open, or OS-level push?

**Answer:**

**OS-level push notifications (FCM for Android, APNs for iOS).** The Battery Check and all other notifications are designed to reach the user even when the app is backgrounded or closed.

The schema already stores the necessary tokens:
- `Client.push_notification_token` — for FCM/APNs device token
- `Companion.push_notification_token` — same

**How it works:**

1. On app install/login, the mobile app registers with FCM/APNs and obtains a device token.
2. The app sends this token to the backend via a `PUT /profile` or during auth (OTP verify returns, app sends token in a follow-up call).
3. The `notification.service.ts` interface accepts `(recipientToken, title, body, data)`.
4. **Phase 1:** The stub implementation logs to console. No actual push is sent.
5. **Phase 2:** The real implementation uses Firebase Admin SDK (`firebase-admin`) to send via FCM (which handles both Android and iOS through Firebase).

**No separate APNs integration is needed** if using FCM — Firebase acts as a unified gateway. The `push_notification_token` field stores the FCM registration token, which Firebase maps to the correct OS-level delivery mechanism.

**Decision:** Architecture is correct. The `push_notification_token` field stores FCM tokens. Phase 1 stubs log only. Phase 2 integrates Firebase Admin SDK.

---

### Q10: Timezones — UTC vs GST

**Gemini's Concern:** If the server is in UTC but business rules are in GST (UTC+4), how do we handle "Day of Service" logic?

**Answer:**

**Rule: Store timestamps in UTC. Interpret business-facing date/time fields as GST.**

Here's the breakdown:

| Field Type | Storage Format | Timezone | Examples |
|-----------|---------------|----------|----------|
| `created_at`, `updated_at`, `cancelled_at`, `session_started_at` | `TIMESTAMPTZ` | UTC (PostgreSQL default) | `2026-03-01T06:00:00Z` |
| `booking.date` | `DATE` | GST (business day) | `2026-03-01` (means March 1 in Dubai) |
| `booking.start_time`, `booking.end_time` | `String (HH:mm)` | GST (local time) | `10:00` means 10 AM Gulf time |
| `shift.date`, `shift.start_time`, `shift.end_time` | Same as booking | GST | Same convention |
| `venue.operating_hours_start/end` | `String (HH:mm)` | GST | Venue hours in local time |

**How "Day of Service" logic works:**

When a scheduled job needs to determine if `(date + start_time - 20 minutes) < NOW()`:

```typescript
// Construct the full datetime in GST, then compare against UTC now
const bookingStartGST = dayjs.tz(
  `${booking.date}T${booking.startTime}`, 
  'Asia/Dubai'  // GST = UTC+4
);
const deadlineUTC = bookingStartGST.subtract(20, 'minutes').utc();
const nowUTC = dayjs.utc();

if (nowUTC.isAfter(deadlineUTC)) {
  // Breach condition met
}
```

**Phase 1 simplification:** Since the business operates exclusively in GST and Phase 1 is single-region, we add `BUSINESS_TIMEZONE = 'Asia/Dubai'` to `constants.ts`. All date/time business logic uses `dayjs` with the `timezone` plugin, converting to/from this constant.

**What NOT to do:** Don't store `start_time` as UTC. `10:00` means 10 AM in Dubai, not 10 AM UTC. The string `HH:mm` fields are always local time. Only `TIMESTAMPTZ` columns are UTC.

**Decision:** Add `BUSINESS_TIMEZONE` constant. Use `dayjs` with timezone plugin for all time comparisons. Added to spec.

---

### Q11: Admin Reassignment — Buffer Validation

**Gemini's Concern:** Does admin reassignment validate the 30m/20m buffers for the new companion?

**Answer:**

**Yes.** The reassignment endpoint (6.5.3) spec says:

> "Validate new companion is available for the booking's slot."

This validation uses the **exact same availability logic** as the allocation engine (section 17.2, step 2). That means:

1. New companion must have a shift covering `[startTime - 30m, endTime + 20m]`.
2. New companion must have no overlapping bookings (PENDING/CONFIRMED/ACTIVE) within that expanded window.
3. New companion must be `is_active = true`, `background_verified = true`, `penalty_status != PENALIZED`.
4. New companion must have the correct role (Captain for captainId, Vice Captain for viceCaptainId).

**The buffers are included because the validation calls the same function.** The implementation should extract the availability check into a shared function:

```typescript
function isCompanionAvailableForSlot(
  companionId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeBookingId?: string, // Exclude current booking from overlap check
  tx: PrismaTransactionClient
): Promise<boolean>
```

The `excludeBookingId` parameter is critical for reassignment — the booking being reassigned should not count as a conflict for the new companion.

**Decision:** Confirmed — buffers are validated. Added explicit note about `excludeBookingId` to the reassignment spec.

---

### Q12: Duo Breach — Cron Delay / Grace Period

**Gemini's Concern:** If the breach cron runs at T-19m (1 minute late), does it still cancel?

**Answer:**

**Yes, it still cancels. T-20m is a hard cutoff, not a precise trigger moment.**

The cron query is:

```sql
WHERE status = 'CONFIRMED' 
  AND duo_status != 'ACTIVATED' 
  AND (date + start_time - interval '20 minutes') < NOW()
```

This means: "Find all bookings where T-20m has **already passed** and the duo is still not activated."

At T-19m (cron is 1 minute late), the condition `(booking_start - 20min) < now` is **true** because T-20m was 1 minute ago. The booking is cancelled.

**There is no grace period.** The design is intentionally strict:
- Companions are expected to match by T-30m (arrival time).
- T-20m is a **hard deadline** for the system to automatically cancel.
- The 10-minute window between T-30m (expected match) and T-20m (auto-cancel) IS the grace period.

**Cron timing guarantees:** With `node-cron` running every minute (`* * * * *`), the maximum delay is ~59 seconds. A booking might be cancelled at T-19m01s instead of T-20m00s. This is acceptable — the client wouldn't perceive a 1-minute difference, and the companion had the full grace window.

**Decision:** T-20m is a hard cutoff. No additional grace period. Cron delay up to 59 seconds is acceptable. No spec change needed.

---

### Q13: QR Code Security — Screenshot Fraud

**Gemini's Concern:** Can a companion screenshot the `duo_qr_code` and send it to a partner to fake a match?

**Answer:**

**Phase 1 threat assessment: Low risk, acceptable.**

The attack scenario: Companion A screenshots their QR code and sends it to Companion B (who is not at the venue). Companion B scans it from their phone somewhere else. The duo shows as "matched" but one companion isn't actually there.

**Existing mitigations:**

1. **GPS is logged at scan time.** The `MatchingEventLog` records `gps_latitude` and `gps_longitude` for both parties during the scan event. Post-hoc auditing can detect that one companion was 50km away.

2. **Device ID is logged.** If the QR is scanned from a device that isn't the registered companion's device, this is flagged in the audit trail.

3. **Companion who doesn't show up gets caught at session start.** The client QR handshake (2.2) requires the duo to be physically present with the client. If one companion is absent, the session can't start, and the client reports it.

4. **Violation records and penalties.** If fraud is detected (even retroactively via GPS audit), the companion receives a BREACH violation with HIGH severity.

**Phase 2 enhancement (recommended):**

Add **GPS proximity validation** to the QR scan endpoint:

```typescript
// During duo QR scan validation:
const distance = haversine(scanner.gps, target.gps);
if (distance > MAX_MATCH_DISTANCE_METERS) { // e.g., 500m
  return { success: false, reason: 'PROXIMITY_REQUIRED' };
}
```

Both companions must be within 500m of each other AND within the venue's geo-fence radius for the scan to succeed. This eliminates remote screenshot attacks entirely.

**Decision:** Phase 1 relies on audit trail (GPS + device logging). Phase 2 adds proximity validation. No spec change for Phase 1 — document the Phase 2 recommendation.

---

### Q14: Refund Floating Point Math

**Gemini's Concern:** JavaScript `number` type can produce rounding errors for monetary calculations.

**Answer:**

**This is a critical correctness concern. We must never use JavaScript `number` for monetary math.**

**Implementation rules:**

1. **Prisma returns `Decimal` fields as `Prisma.Decimal` objects** (which wraps the `decimal.js` library). Never call `.toNumber()` on monetary Decimals.

2. **All monetary calculations in the refund engine (and pricing engine) must use `Decimal` arithmetic:**

   ```typescript
   import { Decimal } from '@prisma/client/runtime/library';
   
   function calculateRefund(grandTotal: Decimal, percentage: number): Decimal {
     return grandTotal.mul(percentage).div(100);
     // NOT: grandTotal.toNumber() * percentage / 100
   }
   ```

3. **The pricing engine must also use Decimal:**

   ```typescript
   function calculatePrice(baseRate: number): PricingResult {
     const base = new Decimal(baseRate);
     const vat = base.mul(VAT_RATE);  // 0.05
     const fee = new Decimal(SERVICE_FEE);
     const total = base.add(vat).add(fee);
     return { baseRate: base, vatAmount: vat, serviceFee: fee, grandTotal: total };
   }
   ```

4. **API responses serialize Decimal to string** (e.g., `"575.00"`) to avoid JSON floating-point issues. The FE parses and displays as-is.

5. **No separate `decimal.js` installation needed.** Prisma bundles it. Import from `@prisma/client/runtime/library`.

**Decision:** All monetary math uses `Prisma.Decimal` (decimal.js). Never convert to JavaScript `number` for calculations. API returns monetary values as strings. Added to spec.

---

### Q15: Audit Log Immutability — DB-Level Enforcement

**Gemini's Concern:** Should we add a database trigger to prevent UPDATE/DELETE on `BookingAuditLog`?

**Answer:**

**Phase 1: Application-level enforcement (current spec). Phase 2: Add DB trigger.**

**Rationale for Phase 1:**
- The team is small. All access to the audit log goes through the same Prisma client.
- There is no Prisma model method for update/delete on the audit log — the service layer only exposes `create()`.
- Adding a PostgreSQL trigger requires raw SQL in the migration, which adds complexity for AI agents to manage.
- The risk of a "rogue admin script" is near-zero when there's one admin and the codebase is fully controlled.

**Phase 2 trigger (for when the team grows):**

```sql
-- Add via Prisma migration (raw SQL)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON booking_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();
```

**Decision:** Phase 1 keeps application-level enforcement. Phase 2 adds the DB trigger. No spec change — this is already documented in section 5.4.

---

## Security & Privacy

### Q16: PII in Meeting Instructions

**Gemini's Concern:** Can we purge PII from `MeetingInstructions` without deleting the booking record?

**Answer:**

**Yes. We need an admin PII purge endpoint.**

**Implementation:**

1. Add `POST /api/v1/admin/meeting-instructions/:id/purge` endpoint:
   - Sets `text_note = '[REDACTED BY ADMIN]'`
   - Deletes the actual file from storage (S3/local) referenced by `image_url`
   - Sets `image_url = null`
   - Creates an audit log entry: `action: 'PII_PURGED'`, `performed_by_type: ADMIN`
   - The `MeetingInstructions` record itself is preserved (booking reference intact)

2. **Image storage consideration:** Meeting instruction images should be stored in a dedicated storage path (e.g., `uploads/meeting-instructions/{booking_id}/`) so they can be targeted for deletion without affecting other files.

3. **Phase 2 enhancement:** Add automated content moderation on image upload using a service like AWS Rekognition or Google Cloud Vision to detect and flag potential PII (credit cards, IDs, faces) before storage.

**Decision:** Add admin purge endpoint for Phase 1. Add automated content moderation for Phase 2. Spec updated.

---

### Q17: Companion Visibility — Cross-Companion Contact Info

**Gemini's Concern:** Can a Captain see the Vice-Captain's phone number or email through the API?

**Answer:**

**No. The API does NOT expose companion contact information to other companions.**

The companion booking detail endpoint (6.6.2) returns only:
- `partnerCompanionName`: Full name of the other companion in the duo (so they know who to look for at the venue).
- No phone number, no email, no profile photo, no physical stats.

**The response shape is:**

```json
{
  "bookingId": "uuid",
  "partnerCompanion": {
    "name": "Ahmed K.",
    "role": "VICE_CAPTAIN"
  }
}
```

**If companions need to coordinate (e.g., one is running late):**
- They communicate through the app's notification system, not direct contact.
- The admin can facilitate communication if needed.
- Phase 2 may add an in-app chat channel per booking.

**Client privacy is also protected:** Companions see only the `clientNicknameSnapshot` — never the client's full name, phone, or email.

**Decision:** No contact info exposure. Architecture is correct. No spec change needed.

---

### Q18: Admin Permissions — Granular Keys

**Gemini's Concern:** What are the specific permission keys for Phase 1?

**Answer:**

The `permissions` field is a JSON array of string keys. Here are the Phase 1 permission keys:

```typescript
const ADMIN_PERMISSIONS = {
  // Booking Management
  CAN_CREATE_BOOKING: 'CAN_CREATE_BOOKING',       // Create booking on behalf of client
  CAN_CANCEL_BOOKING: 'CAN_CANCEL_BOOKING',       // Cancel any booking (100% refund)
  CAN_REASSIGN_BOOKING: 'CAN_REASSIGN_BOOKING',   // Reassign companions on a booking
  
  // Companion Management
  CAN_MANAGE_COMPANIONS: 'CAN_MANAGE_COMPANIONS', // Create/edit/deactivate companions
  CAN_MANAGE_SHIFTS: 'CAN_MANAGE_SHIFTS',         // Create/edit/cancel shifts
  CAN_MANUAL_MATCH: 'CAN_MANUAL_MATCH',           // Manually match duo when QR/PIN fail
  
  // Venue Management
  CAN_MANAGE_VENUES: 'CAN_MANAGE_VENUES',         // Create/edit/deactivate venues
  
  // Financial
  CAN_PROCESS_REFUND: 'CAN_PROCESS_REFUND',       // Trigger manual refunds
  
  // Audit & Monitoring
  CAN_VIEW_AUDIT_LOG: 'CAN_VIEW_AUDIT_LOG',       // Read audit trails
  CAN_VIEW_TRACKING: 'CAN_VIEW_TRACKING',         // View companion/client GPS logs
  
  // Privacy
  CAN_PURGE_PII: 'CAN_PURGE_PII',                 // Purge PII from meeting instructions
  
  // System
  CAN_MANAGE_ADMINS: 'CAN_MANAGE_ADMINS',         // Create/edit other admin accounts
} as const;
```

**Default permission sets by role:**

| Role | Permissions |
|------|------------|
| `SUPER_ADMIN` | All permissions |
| `OPERATIONS` | `CAN_CREATE_BOOKING`, `CAN_CANCEL_BOOKING`, `CAN_REASSIGN_BOOKING`, `CAN_MANAGE_COMPANIONS`, `CAN_MANAGE_SHIFTS`, `CAN_MANUAL_MATCH`, `CAN_MANAGE_VENUES`, `CAN_VIEW_AUDIT_LOG`, `CAN_VIEW_TRACKING` |
| `SUPPORT` | `CAN_CANCEL_BOOKING`, `CAN_PROCESS_REFUND`, `CAN_VIEW_AUDIT_LOG`, `CAN_PURGE_PII` |

**Authorization middleware update:**

```typescript
function requirePermission(...permissions: string[]) {
  return async (req, res, next) => {
    const admin = await getAdmin(req.user.id);
    const hasAll = permissions.every(p => admin.permissions.includes(p));
    if (!hasAll) return res.status(403).json({ ... });
    next();
  };
}

// Usage:
router.post('/admin/bookings/:id/reassign', 
  authorize('SUPER_ADMIN', 'OPERATIONS', 'SUPPORT'),
  requirePermission('CAN_REASSIGN_BOOKING'),
  controller
);
```

**Decision:** Permission keys defined above are the Phase 1 set. Added to spec as a reference table.

---

## Technical Gaps Addressed

### Gap: Buffer Logic Clarity

**Gemini's Concern:** Can buffers from adjacent bookings overlap with each other?

**Answer:**

**No. Buffers cannot overlap. They are exclusive.**

Each booking claims an **expanded window** for each companion:

```
[startTime - 30m] ←── pre-buffer ──→ [startTime] ←── 2h session ──→ [endTime] ←── post-buffer ──→ [endTime + 20m]
```

Total exclusive claim: **170 minutes** (30 + 120 + 20).

The overlap check (spec section 17.4) prevents any two expanded windows from intersecting:

```
existing.start < new.end AND existing.end > new.start
```

**Worked example:**
- Booking A: 10:00 – 12:00 → Expanded window: [9:30, 12:20]
- Booking B: 12:00 – 14:00 → Expanded window: [11:30, 14:20]
- Overlap check: 9:30 < 14:20 AND 12:20 > 11:30 → **TRUE → CONFLICT**

- Booking B: 13:00 – 15:00 → Expanded window: [12:30, 15:20]
- Overlap check: 9:30 < 15:20 AND 12:20 > 12:30 → **FALSE → NO CONFLICT → ALLOWED**

**Minimum gap between consecutive bookings for the same companion:**
- Booking A ends at 12:00, expanded window ends at 12:20.
- Booking B's expanded window starts at `B_start - 30m`.
- No overlap when `B_start - 30m >= 12:20` → `B_start >= 12:50`.
- **Minimum gap between end of A and start of B = 50 minutes** (20m rest + 30m prep).

**The `INTER_BOOKING_BUFFER_MINUTES = 30` constant represents the pre-booking preparation buffer.** Combined with the `REST_BUFFER_MINUTES = 20` post-booking rest, the total enforced gap is 50 minutes between consecutive sessions for the same companion.

**Decision:** Buffers are additive and exclusive. Documentation clarified.

---

### Gap: "Hot Swap" Handling

**Gemini's Concern:** Does the system automatically find a replacement if a companion calls in sick?

**Answer:**

**No. Hot Swap is explicitly NOT supported in Phase 1.**

From the master document (Q6 resolution):

> "Hot Swap is not supported in this version. If companions fail to match by T-20m (20 minutes before booking start), the booking is automatically cancelled. Client is notified, refunded, and freed to rebook. Companions receive violation records."

**What happens when a companion calls in sick:**

1. **If they cancel their shift (any time before the shift):** The `Shift` status → `CANCELLED`. The system's Auto-Reallocator (mentioned in shift business rules: "Shift cancellation triggers Auto-Reallocator for all bookings in that shift") attempts to find replacement companions for all bookings in that shift. If replacements are found, bookings are updated. If not, bookings are cancelled with 100% refund.

2. **The Auto-Reallocator is NOT Hot Swap.** It's a pre-service reassignment that runs when a shift is cancelled. It reuses the same allocation engine logic. This only works if there's enough time to find replacements.

3. **If the companion simply doesn't show up (no shift cancellation):** The duo breach logic kicks in at T-20m. Booking auto-cancels. Client refunded. Companion penalized.

**Phase 2 recommendation:** Implement true Hot Swap — when a breach is detected at T-20m, instead of cancelling, attempt to find an available replacement within a 5-minute window before cancelling. This requires the allocation engine to run in "emergency mode" with relaxed constraints (e.g., accept companions from nearby venues even if not originally assigned).

**Decision:** Phase 1 has Auto-Reallocator (on shift cancellation) but NOT Hot Swap (on breach). Spec is already clear on this. No change needed.

---

### Ambiguity: Payment "Hold" vs. "Charge"

**Gemini's Concern:** When does the actual charge happen — at booking or at session completion?

**Answer:**

**Hold at booking confirmation. Charge at session completion. This is a two-step payment flow.**

The `payment_hold_status` lifecycle is:

| Stage | Status | When | What Happens |
|-------|--------|------|-------------|
| Booking created | `NONE` | `POST /bookings` | Booking in PENDING state, payment not yet attempted |
| Payment mock succeeds | `HELD` | After 3-5s simulated delay | Amount is **held** (authorized but not captured). Client sees the hold on their statement. |
| Session completes normally | `CHARGED` | At session end (4.1) | Hold is **captured** (money actually moves). Final charge. |
| Client cancels (100% refund) | `VOIDED` | Client/Admin cancellation | Hold is **released** entirely. No charge. |
| Client cancels (50% refund) | `REFUNDED` | Client cancellation (7-24h window) | Hold is captured for 50%, remaining 50% released. |
| Client cancels (0% refund) | `CHARGED` | Client cancellation (<7h window) | Hold is captured in full. No refund. |
| Soft-lock expires | `VOIDED` | After 15 minutes | Hold is released. |
| Duo breach (system cancels) | `VOIDED` then `REFUNDED` | At T-20m | Hold released, 100% refund issued. |

**Phase 1 reality:** All of this is mocked. `payment.service.holdAmount()` returns success immediately (after delay). `payment.service.chargeHold()` logs "charged." `payment.service.voidHold()` logs "voided." `payment.service.refund()` logs "refunded."

**Phase 2 with real payments (Stripe example):**
- `holdAmount()` → `stripe.paymentIntents.create({ capture_method: 'manual' })` → creates an authorization hold
- `chargeHold()` → `stripe.paymentIntents.capture()` → captures the held amount
- `voidHold()` → `stripe.paymentIntents.cancel()` → releases the hold
- `refund()` → `stripe.refunds.create()` → issues a refund

**The hold/charge split is important for the business model:** The client's card is authorized at booking time (guaranteeing payment), but the actual capture happens only after service delivery. This protects clients from being charged for services not rendered and protects the business from no-shows (hold is captured for no-show scenarios).

**Decision:** Two-step payment flow is confirmed. Hold at confirmation, charge at completion. Spec is clear but added this lifecycle table for explicit reference.

---

## Summary of Spec Updates Made

| Item | Change | Section |
|------|--------|---------|
| Reconciliation safety net for `booking_status_cache` | Added self-healing check to `GET /bookings/current` | 6.4.5 |
| Serializable retry strategy | Added `withSerializableRetry()` utility spec | 6.4.1 |
| Allocation engine versioning | Added `allocation_engine_version` to audit log | 5.2, 16 |
| Idempotency-Key header | Added to `POST /bookings` | 6.4.1 |
| Location log retention | Added cleanup job (90-day retention) | 15 |
| Timezone handling | Added `BUSINESS_TIMEZONE` constant and dayjs convention | 10, 16 |
| Admin permission keys | Defined 12 granular permission keys | New reference table |
| PII purge endpoint | Added admin purge for meeting instructions | New endpoint |
| Monetary math convention | All calculations use Prisma.Decimal | Architectural note |
| Buffer overlap clarification | Explicit worked example showing buffers are exclusive | 17 |
| Payment lifecycle table | Hold → Charge → Void/Refund lifecycle documented | New reference |

---

**END OF RESPONSE**
