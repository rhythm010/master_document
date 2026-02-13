# Master Specification: Project Companion
**Product Objective:** To provide a luxury concierge experience in high-end malls via a two-man professional team (Captain + Companion). The service aims to add a luxury experience to clients, saving them time and effort.

**Service Description:**
*   **The Companions:** A team of two men, dressed in blue half-polo t-shirts. They resemble personal security but function as luxury assistants.
*   **Key Services:**
    *   **Porterage:** Carrying shopping bags to allow stress-free shopping.
    *   **Door & Access Service:** Holding doors and ensuring VIP entry feel.
    *   **Queue Management:** Standing in queues on behalf of the client.
    *   **Concierge Orders:** Ordering and collecting food/drinks from cafes.
        *   *Payment Flow:* Client pays on App -> Companion pays venue via App/POC.

---

## Phase 1: Discovery & Reservation (T-Minus 24+ Hours)

### 1.1 Onboarding & Profile Setup
* **Functional (Client):** 
    * Registers via OTP.
    * Sets up profile with language preferences and payment methods (PCI-compliant tokenization).
* **Functional (Companion):** 
    * Completes profile with physical stats, language skills, and background verification.
    * Assigned a role by Admin: **Captain** (Lead/Soft-skills) or **Companion** (Support/Operational).
* **Open Questions:** 
    * Should we require physical ID verification (Emirates ID/Passport) during client onboarding?

### 1.2 The Booking & Allocation Flow
#### 1.2.1 Functional (Client)

##### 1.2.1.1 Entry & Account Verification
*   **1.2.1.1.1 Flow:** Client opens the app and navigates to the "Hire Companion" section.
*   **1.2.1.1.2 Request:** **[GET] /user/status** check. If a client already has an active session, they are redirected to the existing booking card instead of the selection flow.
*   **1.2.1.1.3 Logic:** A single client account is restricted to one active booking at any given time.

##### 1.2.1.2 Venue Selection
*   **1.2.1.2.1 Request:** **[GET] /malls** to fetch partnered locations.
*   **1.2.1.2.2 Geolocation:** System requests GPS; FE suggests nearest mall at the top of the dropdown. If GPS is denied, malls are listed alphabetically in the dropdown.
*   **1.2.1.2.3 Logic:** Bookings are specific to a mall and cannot be transferred. Changes require cancellation (subject to the 7h window).

##### 1.2.1.3 Scheduling & Availability
*   **1.2.1.3.1 Input:** Client selects a Date (strictly within a 7-day parameterizable window).
*   **1.2.1.3.2 Request:** **[GET] /availability?mall_id=X&date=Y** to fetch valid 2-hour slots.
*   **1.2.1.3.3 Refresh Logic:** Available slots auto-refresh at a defined interval while the user is on the screen; if the selection session exceeds a specific timeout, an error is shown requiring a fresh start.
*   **1.2.1.3.4 Logic:** Minimum booking duration is fixed at 2 hours. The calendar only displays slots where a full Duo (Captain + Companion) is available. All times are displayed in the Mall's local time.

##### 1.2.1.4 Review & Mandatory Consent
*   **1.2.1.4.1 Summary:** FE displays summary (Mall, Date, Time, Base Rate).
*   **1.2.1.4.2 Action:** Clicking "Book Now" triggers a mandatory modal.
*   **1.2.1.4.3 Policy:** Client must confirm the "No Touch" policy (No physical contact or medical assistance allowed) to proceed.

##### 1.2.1.5 Booking Initiation & Payment Simulation
*   **1.2.1.5.1 Request:** **[POST] /bookings** (MallID, Slot, Nickname).
*   **1.2.1.5.2 BE Operations:** Create record with `status: PENDING`. Apply 15-minute soft-lock on the Duo. Generate unique Booking ID.
*   **1.2.1.5.3 FE Simulation:** Phase 1 mock payment screen with a spinner for 3-5 seconds before showing the "Processing" dashboard.

##### 1.2.1.6 Allocation & Confirmation Sync
*   **1.2.1.6.1 FE Polling:** FE polls **[GET] /bookings/{id}/status** (background auto-retries enabled) or listens for Realtime update.
*   **1.2.1.6.2 BE Logic:** Allocation engine finalizes the Duo match and transitions record to `CONFIRMED`.
*   **1.2.1.6.3 Notification:** A push notification is sent to the client once the `CONFIRMED` status is finalized in the backend.

##### 1.2.1.7 Final Confirmation & Information Display
*   **1.2.1.7.1 Status Update:** App UI transitions to the active booking view.
*   **1.2.1.7.2 Request:** **[GET] /bookings/{id}/details** to fetch the 4-digit PIN (Matching Code).
*   **1.2.1.7.3 Visibility:** The unique Booking ID and 4-digit PIN are visible immediately on the active booking card.

##### 1.2.1.8 Session Maintenance & Termination
*   **1.2.1.8.1 Cancellation:** Clients can cancel up to 7 hours before the start time. Re-booking requires starting the flow fresh.
*   **1.2.1.8.2 Identity:** The system uses the client's profile identity. The client can set a nickname which will be visible to the companions.
*   **1.2.1.8.3 Admin Logic:** Admin has the authority to cancel a client's booking (triggering a notification). Admin cannot "update" a client booking, only cancel.

##### 1.2.1.9 Accessibility & Localization
*   **1.2.1.9.1 Standards:** Initial implementation follows standard OS accessibility settings; no bespoke luxury-tier accessibility features are planned for Phase 1.
*   **1.2.1.9.2 Localization:** App UI and AI chat agent support English and Arabic as per user profile.

#### 1.2.2 Functional (Companion) 
*   **1.2.2.1 Calendar Sync:** Availability is auto-driven by pre-defined shifts.
*   **1.2.2.2 Late-Shift Logic:** Bookings allowed up to 2 hours before a shift ends. If service exceeds the shift end, overtime is automatically applied to the companion's session log.
*   **1.2.2.3 Data Access:** View upcoming booking details, including Client Name/Nickname and Plan of Visit notes.
*   **1.2.2.4 Cancellation Penalty:** If a companion cancels post-confirmation, a penalty is applied and the system auto-triggers a replacement search.
*   **1.2.2.5 Admin Authority:** Admin has full control to assign, re-assign, update, or cancel any booking for a companion.
*   **1.2.2.6 Notifications:** Companions receive real-time push notifications for any Admin-led changes to their schedule.

#### 1.2.3 System Logic & Matching
*   **1.2.3.1 Matching Params:** Initially "First-Available." Logic is built to support future weighting for Client and Companion ratings.
*   **1.2.3.2 Duo Integrity:** A booking is only valid if both a Captain and a Companion are available for the full duration.

#### 1.2.4 Admin & Logging
*   **1.2.4.1 Manual Controls:** Admin can manually assign, re-assign, update, or cancel any booking.
*   **1.2.4.2 Audit Snapshots:** All bookings log Device ID, Pricing Engine version, and Client location at time of booking.

* **Open Questions & Resolutions:** 
    * **1.2.5.1 Refund Logic:** 
        * **> 24 Hours Notice:** 100% refund.
        * **7 to 24 Hours Notice:** 50% refund.
        * **< 7 Hours Notice:** No refund (Duo is locked for shift).
        * **Admin-Initiated:** 100% refund.
    * **1.2.5.2 Voucher Logic:** Vouchers are validated via `/vouchers/validate`. Phase 1 supports flat-rate and percentage discounts (non-stackable) applied to the base rate.
    * **1.2.5.3 Payment Failures:** If the DB commit fails post-payment, an automated refund is triggered, and the transaction is logged as `ORPHANED_PAYMENT` for Admin audit.
    * **1.2.5.4 Race Condition:** Distributed locking (Redis) or Row-level locking (Postgres) during the 15-minute soft-lock period prevents double-booking.
    * **1.2.5.5 Buffer/Gap:** A mandatory **30-minute turnover buffer** is enforced between separate bookings for the same Duo.

---

## Phase 2: The Handshake & Activation (Day of Service)

### 2.1 Pre-Arrival & Deployment
* **Functional (Client):** View duo profiles; track real-time location 30m prior to start.
* **Functional (Companion):** * Shift Check-In: Arrive at mall; "Start Shift" via geo-fence.
    * Deployment Toggle: Manually toggle "Ready to be Deployed" when at meeting point.
* **Technical:** GPS updates synced via Supabase Realtime to Client map.
* **Open Questions:** Late arrival compensation triggers.

### 2.2 The QR Handshake
* **Functional:** Client displays QR; Captain scans to verify match.
* **Technical:** Activation Edge Function captures timestamp and triggers billing clock.
* **Open Questions:** Manual override process if scanning fails.

---

## Phase 3: In-Service Experience & Dashboard

### 3.1 Command Dashboard & Communication
* **Functional (Client):** Remote instructions; "Summon" button; VoIP calling.
* **Functional (Companion):** * Status Management: Captain updates activity (e.g., "In Queue," "Carrying Bags").
    * Alerts: Haptic pings for new instructions or summons.
* **Technical:** Sub-second state synchronization via WebSockets.
* **Open Questions:** Bag inventory tracking requirements.

### 3.2 Delegated Logistics (F&B)
* **Functional (Client):** Approve purchase requests; view digital receipts.
* **Functional (Companion):** * Authorization: Captain initiates request (AED 500 limit).
    * Payment: Use company card; upload photo of physical receipt.
* **Open Questions:** Workflow for transactions exceeding AED 500.

### 3.3 Session Extensions (Real-time)
* **Functional (Client):** Can request an extension (e.g., +1 hour) before the current session ends.
* **Logic:**
    1. **Availability Check:** System checks if the current Duo has a subsequent booking or if their shift is ending.
    2. **Approval:** If available, the system approves the extension and updates the "Availability Table" to block the extra time.
    3. **Payment:** Additional pre-auth/charge is processed immediately.
    4. **Denial:** If unavailable, the system notifies the client and triggers the "Handover Checklist" process at the original end time.

---

## Phase 4: Off-boarding & Settlement

### 4.1 Session Termination
* **Functional:** Manual end by Client/Captain; Handover checklist confirmation.
* **Functional (Companion):** Return to "Ready to Deploy" status after 30-min buffer.
* **Open Questions:** Final authority for "Stop the Clock" in case of dispute.

### 4.2 Final Billing & Feedback
* **Functional (Client):** Consolidate Invoice (Hours + F&B); Team Rating (1-5 stars).
* **Functional (Companion):** View session summary and performance feedback.
* **Open Questions:** Charging F&B separately vs. bundled invoice.