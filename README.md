# Riverbend Finance

A demo banking site: a marketing landing page, a signed-in customer banking
experience, and an admin panel that edits the website's copy and customer data.
Everything is stored in Supabase, so changes made on one device appear on
another.

Built with React 19 + TypeScript + Vite + Tailwind CSS.

> **This is a synthetic demo.** The accounts are invented, passwords are stored
> in plain text, and nothing here is a real financial service. Do not put real
> customer data in it.

---

## 1. What you need

| Thing | Why |
|---|---|
| Node.js 20 or newer | to install and build |
| A Supabase project (free tier is fine) | the database everything reads and writes |
| The three SQL migrations in `supabase/migrations/` | they create the tables, functions and seed data |

---

## 2. Set up the database (once)

Open your Supabase project → **SQL Editor** → **New query**. For each file below,
paste the whole file and click **Run**, in this order:

1. `supabase/migrations/001_riverbend_schema.sql`
2. `supabase/migrations/002_riverbend_atomic_transfers.sql`
3. `supabase/migrations/003_riverbend_admin.sql`

Run them **one at a time, in that order**. They are idempotent, so re-running is
safe and will not duplicate rows or overwrite data you have edited since.

When the first file finishes you should see a notice like:

```
RIVERBEND seed: 2 customers, 4 bank_accounts, 5 cards, 11 transactions, 1 site_content rows
```

If you instead see `RIVERBEND 001: privileges missing -> …`, the grants did not
apply — make sure you are running as the project owner (the SQL Editor's default
`postgres` role).

That is the whole database setup. It seeds two demo customers, their accounts,
cards, transactions and the default website copy.

---

## 3. Configure the app

```bash
cp .env.example .env
```

Then fill in the two values from your Supabase project
(**Project Settings → API**):

```ini
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your publishable / anon key>
```

Both of these are **public** — they ship to the browser in the built file, which
is normal and by design. Access is controlled by Row Level Security in Postgres,
not by hiding the key.

**Never put a `service_role` (secret) key in `.env`.** It bypasses all security
and would give anyone who views the page full write access to your database.

`.env` is git-ignored. Never commit it.

---

## 4. Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually <http://localhost:5173>).

## 5. Build for deployment

```bash
npm run build
```

This produces `dist/index.html` — a **single self-contained file** with the JS
and CSS inlined. Upload that one file anywhere that serves static content
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3, or any web host).

To preview the built file locally:

```bash
npm run preview
```

**Important for whatever host you choose:** set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as environment variables **in the host's build
settings** before building. There is no `.env` in the repository, so if they are
missing the app throws on load:

> Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY…

That message means the build ran without those variables.

---

## 6. Signing in

**Customer** — either demo account works:

| Username | Email | Password |
|---|---|---|
| `alex` | `alex@riverbend.bank` | `demo1234` |
| `jordan` | `jordan@riverbend.bank` | `demo1234` |

The password hints are also shown on the login screen. An admin can change any
customer's username and password under **Admin → Users**.

**Admin** — go to `#admin` (or the URL followed by `#admin`). The credentials
are set in `src/admin/store.tsx` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) — change them
there before sharing a link publicly.

---

## 7. Pages

Routing is hash-based, so it works on any static host with no server config.

| URL | Page |
|---|---|
| `/` | Sign in (the demo's entry point) |
| `#top` | Marketing landing page |
| `#about` `#contact` `#signup` `#login` | Marketing pages |
| `#dashboard` `#accounts` `#cards` `#profile` `#send` `#move` | Customer banking |
| `#admin` | Admin panel |

The logo in the top-left returns to the landing page.

---

## 8. What the admin panel controls

Everything the site says is editable, plus customer data:

- **Content** — brand, hero, contact, about, signup/login copy, and the wording
  of all six customer screens (17 tabs).
- **Users** — customer usernames, passwords, member IDs, emails.
- **Balances** — checking and savings per customer.
- **Cardholders** — the name engraved on each card.
- **Data** — export or import the whole content document as JSON.

Saves go straight to Supabase and appear on other browsers and devices.

---

## 9. How it is wired

```
src/lib/supabase.ts   the client, built from the two env vars
src/account/db.ts     customer data: accounts, balances, cards, transactions
src/admin/db.ts       admin data: content, customers, balances, cards
src/admin/store.tsx   website content provider (one JSON document)
supabase/migrations/  the database schema, functions and seed
```

Money movement never edits a balance in the browser. `Send` and `Move` call
Postgres functions (`riverbend_send`, `riverbend_transfer`) that debit, credit
and write the ledger inside one transaction, so a balance can never disagree
with the transaction list.

There is no offline mode: if the database cannot be reached the app shows an
error rather than displaying stale numbers.

---

## 10. Known demo-only shortcuts

Acceptable for an investor demo, **not** for real use:

- Customer passwords are stored in plain text (`customers.demo_password`).
  Replace with Supabase Auth before handling real accounts.
- The admin passphrase lives in the browser bundle and is visible in page
  source. It is a demo gate, not authentication.
- Row Level Security policies are deliberately broad (permissive demo policies)
  because there is no per-user auth session yet. Any visitor can read and write
  the demo data.
- Cross-device updates are pull-based: a page re-reads when you return to the
  tab or reload it. Add Supabase Realtime if you need live updates.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Supabase is not configured" on load | env vars missing at build time — see §5 |
| "permission denied for table …" | the migrations' grants were not applied; re-run `001` as the project owner |
| "Insufficient funds: …" | working as intended — the database blocked an overdraft |
| Sign-in fails after an admin edit | the credentials were changed in the admin panel; use the new ones |
| Content edits don't show on another device | reload that page — updates are pull-based (§10) |
