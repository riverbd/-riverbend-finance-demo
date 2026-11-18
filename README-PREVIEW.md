# Riverbend Finance — Browser Preview

This is the React + TypeScript + Vite source project. It is not a standalone HTML file: the `.tsx` files and Tailwind CSS need to be compiled by Vite before a normal browser can display the app.

## Preview in a browser with StackBlitz

1. Extract this ZIP on your device.
2. Open https://stackblitz.com/ and create a new **Vite + React + TypeScript** project (or open a blank Vite project).
3. In the StackBlitz file explorer, import/drag the extracted project files and folders into the project, keeping the root `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, and `src/` folder at the project root. Replace starter files when asked.
4. Open the StackBlitz terminal and run `npm install` if dependencies have not installed automatically.
5. Run `npm run dev`.
6. Open the Preview pane. The site should render there. Use **Open in New Window** for a full-screen preview.

## Local preview (optional)

With Node.js installed, open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## Important

- Supabase is wired in and is the single source of truth. Customer balances, cards,
  transactions, credentials and the admin's website-content edits are read from and
  written to the database, so they **do** appear on other browsers and devices.
- Connection settings live in `.env` (git-ignored). Copy `.env.example` and set
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Both ship to the browser by
  design, so only ever use the publishable (anon) key — never a service_role key.
- Sign-in is a demo credential check against `customers.demo_password` (plaintext),
  and the admin panel unlocks with a hard-coded demo passphrase kept in the browser.
  Neither is real authentication.
- Do not use this demo as a real financial service or store real customer information.
