# Avalisa dashboard (avalisabot.vercel.app)

React 19 site built with [Vite](https://vite.dev) and tested with [Vitest](https://vitest.dev).
Migrated from Create React App on 2026-10-09.

## Scripts

- `npm start` (or `npm run dev`) — dev server on http://localhost:3000
- `npm test` — run the test suite once (Vitest, jsdom)
- `npm run build` — production build into `build/`
- `npm run preview` — serve the production build locally

## Environment

`REACT_APP_*` names are kept from the CRA days (see `envPrefix` in `vite.config.mjs`), so the Vercel
env vars did not need renaming. Read them with `import.meta.env.REACT_APP_*`, not `process.env`.
See `.env.example`.

## Deploy

Vercel project `avalisa-po-bot-v2` (root directory `dashboard/`) deploys `main` to production.
`vercel.json` sets the Vite framework, the `build/` output directory, and the SPA rewrite that lets
deep links such as `/pricing` load on refresh. Static pages in `public/` (guides, `robots.txt`,
`sitemap.xml`) are served as-is.
