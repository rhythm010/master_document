# Front-End Testing App

A bare-minimum React Native application for testing backend API endpoints and notification events in local development environment.

## Purpose

This app is designed to quickly test backend APIs without waiting for the full UI to be ready. It provides a simple interface to:
- Test authentication endpoints (signup, login)
- Test venue search and availability
- Test booking creation and management
- Test any custom endpoint with flexible HTTP methods
- View raw API responses

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure backend URL:**
   Edit `src/config.ts` and update `BASE_URL`:
   ```typescript
   export const CONFIG = {
     BASE_URL: 'http://localhost:3000/api/v1',
     // For physical device: use your machine's IP
     // BASE_URL: 'http://192.168.1.XXX:3000/api/v1',
   };
   ```

3. **Run the app:**
   ```bash
   # Web (easiest for testing)
   npm run web

   # iOS
   npm run ios

   # Android
   npm run android
   ```

## Features

### 1. Authentication Tab
- Test signup with name, nickname, email, password
- Test login (automatically stores JWT token)
- Logout (clears stored token)

### 2. Venues Tab
- Search venues with optional search term
- Get availability for a specific venue and date
- View venue details

### 3. Bookings Tab
- Create a new booking
- Get booking details by ID
- Cancel a booking

### 4. Custom Endpoint Tab
- Test any endpoint with any HTTP method (GET, POST, PUT, PATCH, DELETE)
- Send custom JSON data
- Flexible testing for new endpoints

## Token Management

The app automatically:
- Stores JWT token after successful login
- Attaches token to all subsequent requests
- Allows manual logout (token clearing)

## Response Viewer

All API responses are displayed in a console-style viewer showing:
- ✅ Success responses with formatted JSON
- ❌ Error responses with error details

## Testing Workflow

1. **Start backend server** on `localhost:3000`
2. **Login** using the Auth tab
3. **Test endpoints** using the respective tabs
4. **View responses** in the response box at the bottom

## For Physical Device Testing

If testing on a physical device:
1. Find your machine's local IP address
2. Update `BASE_URL` in `src/config.ts`
3. Ensure backend is accessible on your local network
4. Run `npm start` and scan QR code with Expo Go app

## Notification Testing

(To be implemented)
- Push notification testing interface
- Companion-companion matching events
- Client notification events
- T-30m notification triggers

## Project Structure

```
front-end-testing/
├── src/
│   ├── config.ts          # API configuration
│   └── api.ts             # API service layer
├── App.tsx                # Main testing interface
├── package.json
└── README.md
```

## Tips

- Keep the response viewer open to see real-time API responses
- Use the Custom tab to quickly test new endpoints
- Token is automatically included in all requests after login
- Responses are formatted JSON for easy reading

## Next Steps

- Add notification testing UI
- Add WebSocket testing for real-time events
- Add request history
- Add response time tracking
