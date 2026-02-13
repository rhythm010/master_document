# Master Specification: Project Companion

## 1. Project Overview
**Project Companion** is a luxury concierge service operating within high-end malls. It provides clients with a two-man professional team (a "Captain" and a "Companion") to assist with carrying shopping bags, holding doors, managing queues, and handling F&B logistics. The goal is to deliver a "VIP Security" aesthetic combined with high-end personal assistance, saving clients time and effort while elevating their shopping experience.

## 2. Core Flows Index

### Phase 1: Discovery & Reservation
*   **[1.1 Onboarding & Profile Setup](1.1_Onboarding_And_Profile.md):** Handles Client and Companion registration, profile creation, and role assignment.
*   **[1.2 Booking & Allocation](1.2_Booking_And_Allocation_Flow.md):** The end-to-end flow for Clients to discover venues, check availability, and book a Duo, including the allocation logic.

### Phase 2: The Handshake & Activation
### 2.1 Pre-Arrival, Deployment & Handshake

#### 2.1.1 Pre-Arrival & Tracking
* **Functional (Client):** View duo profiles; track real-time location 30m prior to start.
* **Functional (Companion):** 
    * *Shift Check-In:* Arrive at mall; "Start Shift" via geo-fence.
    * *Deployment Toggle:* Manually toggle "Ready to be Deployed" when at meeting point.
* **Technical:** GPS updates synced via Supabase Realtime to Client map.
* **Open Questions:** Late arrival compensation triggers.

#### 2.1.2 The QR Handshake
* **Functional:** Client displays QR; Captain scans to verify match.
* **Technical:** Activation Edge Function captures timestamp and triggers billing clock.
* **Open Questions:** Manual override process if scanning fails.

### Phase 3: In-Service Experience
*   **[3.1 Command Dashboard](3.1_Command_Dashboard_And_Communication.md):** The real-time interface for Clients to summon the Duo and for the Duo to update their status (e.g., "Carrying Bags").
*   **[3.3 Session Extensions](3.3_Session_Extensions.md):** The logic allowing Clients to extend their active session in real-time, subject to Duo availability and billing.

### Phase 4: Off-boarding & Settlement
*   **[4.1 Session Termination](4.1_Session_Termination.md):** The protocol for ending a session, including the handover of items and the "Stop Clock" confirmation.
*   **[4.2 Final Billing & Feedback](4.2_Final_Billing_And_Feedback.md):** Generates the final consolidated invoice (Service + F&B) and collects performance ratings from the Client.

### Phase 5: Spot Payment
*   **[5.1 Spot Payment & Delegated Purchases](5.1_Spot_Payment.md):** The unified flow for all delegated purchases (remote requests) and spot payments (Client present), subject to strict limits and approval.