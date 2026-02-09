# Master Specification: Project Companion
**Product Objective:** To provide a luxury concierge experience in high-end malls via a two-man professional team (Captain + Companion).

---

## Phase 1: Discovery & Reservation (T-Minus 24+ Hours)

### 1.1 Onboarding & Profile Setup
* **Functional (Client):** Registration via mobile/OTP; Language selection (EN/AR); Link credit/debit card.
* **Functional (Companion):** Profile creation (Physical stats, Languages, Background verification).
* **Technical:** Supabase Auth for identity; Card tokenization via PCI-compliant gateway.
* **Open Questions:** Should we require ID verification (Emirates ID/Passport) during onboarding?

### 1.2 The Booking & Allocation Flow
* **Functional (Client):** * Selects mall and time slot (min. 24h lead time).
    * Pre-Auth: Immediate payment hold on "Book Now."
    * Status: UI displays `PENDING_CONFIRMATION` (<30m).
* **Functional (Companion):** * Shift Listing: Companions work fixed shifts (hh:mm to hh:mm) at specific malls.
    * Auto-Assignment: System ranks on-shift companions by Priority Score (Rating/Reliability).
    * The Soft-Lock: Selected duo is reserved for a 15-minute confirmation window.
* **The Allocation Logic:**
    1.  Request raised -> System checks Availability Roster.
    2.  Push Alert sent to Duo.
    3.  Escalation: If unconfirmed at 10 mins, automated Voice Call is made to Captain.
    4.  Resolution: Confirm (Match locked) or Release (System auto-restarts search).
* **Technical:** Allocation Engine background service; Escalation worker for SMS/Voice.
* **Open Questions:** * Fee amount for late cancellations (post-7h).
    * Pre-Auth release logic if no duo is found within 30 mins.

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