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
*   **1.2.1.1 Booking Limit:** A single client account is restricted to one active booking at any given time.
*   **1.2.1.2 Mall Selection:** Selected via a dropdown menu on the booking page.
    *   **1.2.1.2.1 Geolocation:** The app checks the client's current GPS to suggest the nearest mall. If GPS is denied, malls are listed alphabetically in the dropdown
    *   **1.2.1.2.2 Fixity:** Bookings are specific to a mall and cannot be transferred. Changes require cancellation (subject to the 7h window).
*   **1.2.1.3 Scheduling:** Selects Date and available Time slots (provided by the API); minimum booking duration is fixed at 2 hours.
    *   **1.2.1.3.1 Booking Window:** Strictly 7 days in advance (parameterizable via ENV).
    *   **1.2.1.3.2 Timezone:** All times are displayed in the Mall's local time.
    *   **1.2.1.3.3 Refresh Logic:** Available slots auto-refresh at a defined interval while the user is on the screen; if the selection session exceeds a specific timeout, an error is shown requiring a fresh start.
*   **1.2.1.4 Availability View:** The calendar only displays slots where a full Duo (Captain + Companion) is available. No details regarding the specific team or quantity are shown.
*   **1.2.1.5 Disclaimer & Consent:** Clicking "Book Now" triggers a mandatory modal.
    *   **1.2.1.5.1 Policy:** Client must confirm the "No Touch" policy (No physical contact or medical assistance allowed).
*   **1.2.1.6 Payment & Status (Mocked/Phase 1):**
    *   **1.2.1.6.1 Identifiers:** A unique Booking ID and a 4-digit PIN (Booking Code) are generated from backend and sent to the client post confirmation. The PIN is visible to the client immediately upon confirmation.
    *   **1.2.1.6.2 Validation:** For this phase, the screen will load for a few seconds (simulated payment) before sending a booking request to the backend.
    *   **1.2.1.6.3 Connectivity:** The app uses background auto-retries to ensure the transition to `CONFIRMED` status is reflected but only till a certain value.
    *   **1.2.1.6.4 Notification:** A push notification is sent to the client once the `CONFIRMED` status is finalized in the backend.
*   **1.2.1.7 Cancellation & Re-booking:**
    *   **1.2.1.7.1 Client Actions:** Clients can cancel up to 7 hours before start time. Re-booking requires starting the flow fresh.
    *   **1.2.1.7.2 Admin Actions:** Admin has the authority to cancel a client's booking (triggering a notification). Admin cannot "update" a client booking, only cancel.
*   **1.2.1.8 Booking Identity:** The system uses the client's profile identity. The client can set a nickname which will be visible to the companions.
*   **1.2.1.9 Accessibility:** Following standard OS settings (No bespoke implementation in Phase 1).
*   **1.2.1.10 Happy Path (End-to-End Journey):**
    *   **1.2.1.10.1 Entry:** Client opens app. **[GET] /malls** to fetch active locations. **[GET] /user/status** to verify no active bookings exist.
    *   **1.2.1.10.2 Mall Selection:** System requests GPS; FE suggests nearest mall. Client confirms selection.
    *   **1.2.1.10.3 Scheduling:** Client picks date. **[GET] /availability?mall_id=X&date=Y** to fetch valid 2-hour slots. Client selects time.
    *   **1.2.1.10.4 Intent & Summary:** Client clicks "Book Now". FE displays summary (Mall, Time, Base Rate).
    *   **1.2.1.10.5 Consent:** Mandatory modal for "No Physical Contact" appears. Client clicks "Confirm".
    *   **1.2.1.10.6 Payment & Request:** **[POST] /bookings** (MallID, Slot, Nickname). BE creates record, starts 15m soft-lock, generates **Booking ID**, and returns `status: PENDING`. 
    *   **1.2.1.10.7 Pending Screen:** FE shows "Processing" spinner. Starts polling **[GET] /bookings/{id}/status** or listens for Realtime update.
    *   **1.2.1.10.8 BE Allocation:** Backend Allocation Engine finalizes Duo match and transitions record to `CONFIRMED`.
    *   **1.2.1.10.9 Final Confirmation:** FE receives status update. **[GET] /bookings/{id}/details** fetches the 4-digit Matching PIN and final booking card. Push notification sent.

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

* **Open Questions:** 
    * **1.2.5.1 Refund Logic:** Specific refund percentages for cancellations.
    * **1.2.5.2 Voucher Logic:** Implementation of discount codes/promos.
    * **1.2.5.3 Payment Failures:** Logic for handling DB lock failures after successful payment.
    * **1.2.5.4 Race Condition:** Resolving simultaneous "Pay" hits for the same Duo.
    * **1.2.5.5 Buffer/Gap:** Minimum turnover time between separate bookings.

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