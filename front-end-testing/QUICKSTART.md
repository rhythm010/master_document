# Quick Start

## 1. Setup (One-time)

```bash
cd front-end-testing
npm install
```

## 2. Configure Backend URL

Edit `src/config.ts`:
```typescript
export const CONFIG = {
  BASE_URL: 'http://localhost:3000/api/v1',
  // For physical device: 'http://YOUR_IP:3000/api/v1'
};
```

## 3. Run

```bash
# Web (easiest)
npm run web

# iOS
npm run ios

# Android
npm run android
```

## 4. Test Workflow

1. **Auth Tab** → Login/Signup
2. **Venues Tab** → Get venues, check availability
3. **Bookings Tab** → Create/view/cancel bookings
4. **Custom Tab** → Test any endpoint

Responses appear at the bottom in green/red.

## Example Test Sequence

1. Start backend: `cd companion-backend && npm run dev`
2. Start this app: `npm run web`
3. Go to **Auth** tab → Fill in details → Click "POST /auth/login"
4. Go to **Venues** tab → Click "GET /venues"
5. Copy a venue ID from response
6. Fill venue ID and date → Click "GET /availability"
7. Go to **Bookings** tab → Fill details → Create booking

Done! 🎉
