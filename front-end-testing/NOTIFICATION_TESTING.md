# Notification Events Testing Guide

This guide explains how to test notification events once they're implemented in the backend.

## Client Notifications

### 1. Booking Confirmed
**Trigger:** After companions are assigned on booking confirmation page
**Expected:** Push notification "Booking Confirmed"

**Test:**
1. Create a booking via Bookings tab
2. Check for notification on device
3. Verify notification payload contains booking details

### 2. Companions Ready (T-30m)
**Trigger:** 
- At T-30 minutes if companion-companion matching completed before
- Immediately if companion-companion matching completes after T-30m

**Expected:** Push notification "Your companions are ready"

**Test:**
```javascript
// In Custom tab, send:
POST /test/trigger-notification
{
  "bookingId": "xxx",
  "type": "COMPANIONS_READY"
}
```

### 3. Client-Companion Match Success
**Trigger:** When client successfully matches with companions via QR/PIN
**Expected:** UI transition to ACTIVE status (no explicit notification)

**Test:**
1. Create booking → Wait for confirmation
2. Simulate match via endpoint
3. Verify booking status changes to ACTIVE

## Companion Notifications

### 1. Companion-Companion Match Success
**Trigger:** When Captain-ViceCaptain complete QR/PIN matching
**Expected:** Toast "Match successful" to both companions

**Test:**
```javascript
// In Custom tab, send:
POST /test/companion-match
{
  "bookingId": "xxx",
  "captainId": "xxx",
  "viceCaptainId": "xxx"
}
```

## Notification Testing Setup

### Option 1: Using Expo Notifications (Web)
```typescript
// Add to src/api.ts
import * as Notifications from 'expo-notifications';

async testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Test Notification",
      body: "This is a test",
    },
    trigger: null, // immediate
  });
}
```

### Option 2: WebSocket Listener
```typescript
// Add to src/api.ts
connectNotificationSocket() {
  const ws = new WebSocket('ws://localhost:3000/notifications');
  
  ws.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    console.log('Notification received:', notification);
    // Show toast/alert
  };
  
  return ws;
}
```

### Option 3: Polling (Simple)
```typescript
// Poll for new notifications every 5 seconds
setInterval(async () => {
  const response = await api.testEndpoint('GET', '/notifications/pending');
  if (response.data.length > 0) {
    // Show notifications
  }
}, 5000);
```

## Creating a Notification Test Tab

Add to App.tsx:

```typescript
const renderNotificationsTab = () => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Notification Testing</Text>
    
    <TextInput
      style={styles.input}
      placeholder="Booking ID"
      value={bookingId}
      onChangeText={setBookingId}
    />
    
    <TouchableOpacity
      style={styles.button}
      onPress={() => handleRequest(
        () => api.testEndpoint('POST', '/test/trigger-notification', {
          bookingId,
          type: 'BOOKING_CONFIRMED'
        }),
        'Trigger: Booking Confirmed'
      )}
    >
      <Text style={styles.buttonText}>Test: Booking Confirmed</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={styles.button}
      onPress={() => handleRequest(
        () => api.testEndpoint('POST', '/test/trigger-notification', {
          bookingId,
          type: 'COMPANIONS_READY'
        }),
        'Trigger: Companions Ready'
      )}
    >
      <Text style={styles.buttonText}>Test: Companions Ready (T-30m)</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={styles.button}
      onPress={() => handleRequest(
        () => api.testEndpoint('POST', '/test/companion-match', {
          bookingId,
        }),
        'Trigger: Companion Match Success'
      )}
    >
      <Text style={styles.buttonText}>Test: Companion-Companion Match</Text>
    </TouchableOpacity>
  </View>
);
```

## Backend Requirements

For notification testing to work, backend should provide:

1. **Test endpoints:**
   - `POST /test/trigger-notification` - Manual notification trigger
   - `POST /test/companion-match` - Simulate companion matching
   - `GET /notifications/pending` - Get pending notifications

2. **WebSocket support** (optional):
   - Real-time notification delivery
   - Event stream for testing

3. **Notification payload structure:**
```json
{
  "id": "notif-xxx",
  "type": "BOOKING_CONFIRMED" | "COMPANIONS_READY" | "MATCH_SUCCESS",
  "title": "Notification Title",
  "body": "Notification Body",
  "data": {
    "bookingId": "xxx",
    "timestamp": "2026-04-21T10:00:00Z"
  }
}
```

## Testing Checklist

- [ ] Client receives "Booking Confirmed" push
- [ ] Client receives "Companions Ready" at T-30m (early match)
- [ ] Client receives "Companions Ready" immediately (late match)
- [ ] Companions see "Match successful" toast
- [ ] Notification timing is correct
- [ ] Notification payload is correct
- [ ] Push notifications work on device
- [ ] Toast notifications appear correctly

## Notes

- Web testing uses console logs + alerts
- Physical device testing requires Expo Go or custom dev build
- Push notifications require FCM/APNs setup
- For local testing, use polling or WebSocket initially
