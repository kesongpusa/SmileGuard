# Patient Web Portal - Next.js App

Copy `.env.example` to `.env.local` and fill in the values.

```bash
cp ../../.env.example .env.local
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` - Next.js App Router pages and layouts
  - `(auth)/` - Public auth pages (login, signup, reset-password)
  - `(patient)/` - Protected patient dashboard pages
- `components/` - Reusable React components
- `lib/` - Service layer (API calls, database queries)
- `public/` - Static assets
