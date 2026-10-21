# glowsyhnc

## Local development on Windows

Use Node.js 22.23.2. Install dependencies from the repository root with
`npm run install:all` if they are not already installed.

Create `server/.env` locally (Git ignores this file). Set `NODE_ENV=development`,
`PORT=3002`, `CLIENT_URL=http://localhost:3000`, and separate random values for
`JWT_SECRET` and `PROMO_CODE`. Never commit those values. Keep cloud service
credentials out of this file when testing with the local SQLite database.
Stripe is optional for startup; checkout needs Stripe configuration.
AI-powered features need their provider configuration to produce real results.

From the repository root, run:

```powershell
npm run dev
```

Open the frontend URL printed by Vite (normally http://localhost:3000).
The backend health check is http://localhost:3002/api/health.
Vite forwards `/api`, `/uploads`, and `/webhooks` to http://localhost:3002 by
default. All frontend backend requests use this proxy during development.
To use a different backend, set `VITE_API_URL` in `client/.env.local` and restart
Vite. This value is a backend origin, without `/api`.

Edit files under `client/src` to preview browser changes with live reload.
The backend restarts when its source changes. Stop both with Ctrl+C.

## Validation and deployment

```powershell
cd client
npm run build
node --test src/utils/*.test.js
cd ../server
node --test src/utils/*.test.js
```

A successful build alone does not prove camera, sign-in, payments, or AI flows
work. Test the relevant flows in the browser and on the physical device.
Production frontend builds default to the existing Railway backend, or use
`VITE_API_URL` when explicitly configured at build time.

Server changes deploy through Railway on push. Client changes for iOS require
`npm run build`, `npx cap sync ios`, and a fresh Xcode install on the device.
Review the diff and test before approving any commit, push, or deployment.
