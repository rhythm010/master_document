# Master Specification: Project Companion

## 1. Project Overview
**Project Companion** is a luxury concierge service operating at partnered venues (malls, clubs, restaurants). It provides clients with a two-man professional team (a "Captain" and a "Vice Captain") to assist with carrying shopping bags, holding doors, managing queues, and handling F&B logistics. The goal is to deliver a "VIP Security" aesthetic combined with high-end personal assistance, saving clients time and effort while elevating their experience.

## 2. Core Flows Index

### Phase 1: Discovery & Reservation
*   **[1.1 Onboarding & Profile Setup](1.1_Onboarding_And_Profile.md):** Handles Client and Companion registration, profile creation, and role assignment.
*   **[1.2 Booking & Allocation](1.2_Booking_And_Allocation_Flow.md):** The end-to-end flow for Clients to discover venues, check availability, and book a Duo, including the allocation logic.
*   **[1.3 Booking Confirmation Page](1.3_Booking_Confirmation_Page.md):** The client-facing confirmation screen displayed after a booking is confirmed. Covers information display, cancel action, and day-of-service QR/PIN reveal. *(Placeholder — to be refined.)*

### Phase 2: The Handshake & Activation
*   **[2.1 Companion Self-Matching](2.1_Companion_Self_Matching.md):** The companion-only flow for pre-arrival notifications, travel to venue, and Duo activation (QR/PIN matching between Captain and Vice Captain).
*   **[2.2 Client Matching & Deployment](2.2_Pre_Arrival_And_Deployment.md):** The client-facing flow for meeting the activated Duo, location sharing, and starting the session via QR handshake.

### Phase 3: In-Service Experience
*   **[3.1 In-Service Flow](3.1_In_Service_Flow.md):** The real-time interface for Clients to summon the Duo and for the Duo to update their status (e.g., "Carrying Bags").
*   **[3.2 Command Flow](3.2_Command_Flow.md):** The logic for managing delegated logistics and F&B tasks during the session. Clients can call companions via a button if they are far away.

### Open Flows
*   **Session Extensions:** The logic for extending active sessions will be handled in a future release.
*   **Billing Adjustments for Extensions:** The billing logic for session extensions will be addressed in a future release.

### Phase 4: Off-boarding & Settlement
*   **[4.1 Session Termination](4.1_Session_Termination.md):** The protocol for ending a session, including the handover of items and the "Stop Clock" confirmation.
*   **[4.2 Final Billing & Feedback](4.2_Final_Billing_And_Feedback.md):** Generates the final consolidated invoice (Service + F&B) and collects performance ratings from the Client.

### Phase 5: Spot Payment
*   **[5.1 Spot Payment & Delegated Purchases](5.1_Spot_Payment.md):** The unified flow for all delegated purchases (remote requests) and spot payments (Client present), subject to strict limits and approval.

### Pending Flows
*   **Dispute and Complaint Flow:** A structured process for handling disputes and complaints from clients and companions.
*   **Race Conditions:** Logic to handle simultaneous "Pay" hits for the same Duo.