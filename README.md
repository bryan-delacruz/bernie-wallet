# Bernie Wallet | Your Expenses Log Themselves

![Next.js](https://img.shields.io/badge/next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Gmail API](https://img.shields.io/badge/gmail_api-EA4335?style=for-the-badge&logo=gmail&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

**Live:** [bernie-wallet.vercel.app](https://bernie-wallet.vercel.app)

A personal finance app for Peru that fills itself in. Bernie reads the notification emails your bank sends you, through **read-only Gmail access**, and turns each one into a categorized expense. No manual entry, no bank credentials.

The UI is in Spanish, for its target users.

## How it works

1. **Connect:** sign in with Google and grant read-only access to Gmail.
2. **Bernie reads:** it finds your bank's notifications and extracts amount, merchant, card and category.
3. **You review:** adjust anything you want. Your monthly balance stays up to date.

## Features

- **Supported notifications:** credit and debit card purchases, service payments, Yape transfers and bank transfers (BCP and Yape).
- **Programmatic parser:** a regex-based parser with no AI and no external API cost. It handles decimal commas, thousand separators and trailing punctuation. If it can read the amount but not the merchant, it skips the email instead of saving a degraded expense.
- **Incremental sync:** the first sync covers the last 30 days. Later syncs continue from a cursor, oldest to newest, with no gaps.
- **Resilient sync:** per-email retries with exponential backoff, plus a circuit breaker that stops the sync if the Gmail API looks down instead of discarding emails in bulk.
- **Dashboard:** balance, stat tiles, category bars, monthly trend and payment method split with Recharts.
- **Categories and payment methods:** default categories on sign-up, fully editable.
- **Manual expenses** for cash or anything without an email.
- **Installable PWA** with its own icons and a light / dark theme.
- **Privacy and terms pages.**

## Security and privacy

- **Least privilege:** the app requests only the Gmail read-only scope and only searches for known bank senders.
- **Encrypted refresh tokens:** Google refresh tokens are stored encrypted with **AES-256-GCM** (random IV and auth tag per token).
- **Row Level Security:** every user table in Postgres has RLS policies, so each user can only read their own rows.
- **No bank credentials:** Bernie never asks for bank passwords or card numbers. Card numbers in emails are already masked by the bank.

## Architecture

```
app/(auth)/            Google sign-in
app/(dashboard)/       Dashboard, activity, categories and settings
app/api/sync/          Sync endpoint: Gmail search, parse, store
app/onboarding/        First-run setup
lib/gmail/             Gmail API client (token refresh, search, read)
lib/parser/            Email parser + tests (node:test)
lib/crypto.ts          AES-256-GCM encryption for tokens
supabase/migrations/   Versioned schema with RLS policies
```

## Tech stack

| Layer | Tools |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Backend | Supabase (Postgres, Auth, RLS), Route Handlers, Server Actions |
| Integrations | Gmail API, Google OAuth |
| UI | Tailwind CSS v4, shadcn/ui, Base UI, Recharts, Sonner |
| Testing | `node:test` |
| Deploy | Vercel |

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in Supabase, Google OAuth and the token encryption key. The file explains how to generate each value.

3. Apply the database migrations:

   ```bash
   npm run db:push
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

Run the parser tests with `npm test`.
