# Companion Backend

## Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript
- `npm run start` - Run compiled server
- `npm run test` - Run tests
- `npm run db:migrate` - Apply migrations
- `npm run db:seed` - Seed database
