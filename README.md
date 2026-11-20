# Haskins Industrial Complex

Website, admin panel and API for the Haskins family real-estate portfolio in South San Francisco. The portfolio is held by separate legal entities; the site is the central information portal for all of them, with each property's owning entity shown everywhere and property management (Buzz Haskins Equipment Co., Inc.) identified separately.

An npm-workspaces monorepo (Node.js 22+, npm 10+) with three apps:

| App | What it is | URL (dev) |
| --- | --- | --- |
| `apps/web` | Public website — Next.js 16 (App Router), React 19, plain CSS | http://localhost:3000 |
| `apps/admin` | Admin panel for staff — Next.js | http://localhost:3001 |
| `apps/api` | NestJS API on MySQL/MariaDB: content (CMS), accounts, tenants, inquiries, email | http://localhost:4000/api/health |

`packages/shared` holds the built-in fallback property data and the list of editable page-text blocks. Staff edit content in the admin and publish it; the website reads the published content from the API. If the API or database is down, the website falls back to the built-in data and keeps working.

## Quick start (local)

Requirements: Node.js 22+, npm 10+, and MySQL or MariaDB (for example XAMPP).

1. Start MySQL and create an empty database:
   ```sql
   CREATE DATABASE haskins_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Create the API settings: copy `apps/api/.env.example` to `apps/api/.env` and set `DB_PASSWORD` (empty for a default XAMPP `root`). `.env` is ignored by Git.
3. Install, migrate, seed and run:
   ```bash
   npm install
   npm run db:migrate     # applies the SQL migrations
   npm run db:seed        # 4 legal entities, 8 properties, 9 page records
   npm run dev            # website + admin + API together (Ctrl+C stops all three)
   ```
4. Open the admin at http://localhost:3001 and sign in with the default local administrator **admin@gmail.com / admin@123** (created by migration 004). **Change this before going live.**

Run one app on its own with `npm run dev:web`, `npm run dev:admin` or `npm run dev:api`. After `npm run build`, `npm start` runs all three production builds (`start:web`, `start:admin`, `start:api` individually). `NEXT_DIST_DIR` sets a separate Next.js build folder (useful for a build next to a running dev server).

## Repository layout

```text
apps/
  web/                  Public website
    app/                Routes + styles (theme.css, shell.css, ui.css, home.css)
    components/         Header/footer, cards, forms, tenant portal, cookie consent…
    lib/                content.ts (CMS reader), seo.ts, settings.ts, entities.ts, spaces.ts, site.ts
    public/images/      Supplied images (optimized .webp) and logos
  admin/                Admin panel (styles.css + motion.css)
  api/
    src/                main.ts, cms.ts, accounts.ts, mail.ts, migrations/*.sql
    test/               Integration tests
packages/shared/        Fallback property data, editable blocks (page-blocks.ts, site-blocks.ts)
scripts/                Dev/start helper for the Next.js apps
```

## Pages (website)

`/` home · `/properties` and `/properties/[slug]` · `/available-spaces` · `/services` · `/history` · `/contact` · `/tenant-portal` (tenant sign-in) · `/pay-rent` · `/privacy` · custom 404 · `/sitemap.xml` · `/robots.txt`.

## What staff manage in the admin

Sign in at the admin, edit, **Save draft** to keep working or **Save & publish** to make it live on the website immediately (no rebuild).

| Admin section | What it controls on the website |
| --- | --- |
| Properties | Cards, property pages, filters: name, type, location, description, photo and alt text, SEO, land-only flag and wording, partial-ownership share |
| Legal entities | The "separate legal entities" section and the owner shown on every property |
| Available spaces | The listings on Available spaces (each linked to a property and its owner) |
| Pages & SEO | Per page: SEO title, meta description, canonical, no-index, target phrase, social image, intro text — plus editable blocks for **Home (every text, link and photo), History, Services and Privacy** |
| Pages & SEO → Header & footer | Top bar, menu, footer columns/links/legal text, film-strip photos (empty menu/link label hides the item) |
| Pages & SEO → Design | Logo, 10 colors, fonts (13 bundled choices), body size, headline width, content width |
| Site settings | Management email, phone and address (Contact page, footer, emails) **plus site-wide SEO**: site name, default description and social image, logo, social profiles, X handle, Google/Bing verification codes, and a **redirects** list |
| Payment instructions | Shown only to the tenant they are assigned to — never public |
| Media library | Uploaded images and PDFs (served by the API) |
| Inquiry inbox | Messages from the contact form, with status |
| Accounts & roles | Admin / user / tenant accounts and tenant-to-property assignments. New accounts get an **invitation email** (the person chooses their own password, link valid 72 hours); each account has **Send reset link** and **Resend invite** |
| Activity log | Audit trail |

The editor shows the text currently on the site in every box (with a per-item reset). Block type follows the key name (`*Image`, `*Url`, `color*`, `font*`, `num*`) and the API validates it (`blockValue` in `apps/api/src/cms.ts`). To make more editable, add a block to `packages/shared/src/site-blocks.ts` (home/layout/design) or `page-blocks.ts` and render it with `block(page, "<slug>", "<key>")`. Page layout and section structure stay in code.

## Password reset and invitations

- **Forgot password:** "Forgot your password?" on the tenant portal (`/reset-password` on the site) and on the admin sign-in (`/reset-password` on the admin). The answer is the same whether or not the email has an account. The admin form only sends links to administrator accounts.
- **Invitations:** in Accounts & roles, leave "Email an invitation" ticked when creating an account; the person sets their own password from the email.
- **Links:** one-time, only a hash is stored (`password_tokens`, migration 005); reset links last 1 hour, invitations 72 hours; a new link replaces older ones. Using a link signs the account out everywhere. Admins get a link to the admin panel, everyone else to the website. Rate-limited per IP and per email.
- Without SMTP, nothing is emailed: the admin sees the link to copy, and in development the link is also printed in the API log.

## Two-step sign-in (admin MFA)

- **Turn on:** admin → My account → Two-step sign-in → scan the QR code with any authenticator app (Google/Microsoft Authenticator, 1Password…) → enter a code. 10 one-time **recovery codes** are shown once (download them).
- **Sign-in:** password, then a 6-digit code (or a recovery code). The code step lasts 5 minutes and allows 5 tries; each code works once; ±30 s clock drift is accepted.
- **Lost phone:** use a recovery code, or another administrator uses **Reset two-step** in Accounts & roles (it signs that person out). My account can also create new recovery codes or turn MFA off (password + code needed).
- Accounts with MFA cannot sign in through the website's tenant login (no way around the code).
- `ADMIN_MFA_REQUIRED=true` makes it mandatory: an admin without MFA sees only the set-up screen. `MFA_ENCRYPTION_KEY` encrypts the stored secrets (AES-256-GCM) and is required in production — back it up with the database.
- Tables: `mfa_recovery_codes`, `mfa_challenges`, columns on `users` (migration 006). Code: `apps/api/src/mfa.ts`, `apps/admin/components/mfa-panel.tsx`.

## Features beyond content

- **Contact form → inquiry inbox → email.** Inquiries are saved in the database and emailed to management (see Email below). Spam protection: hidden honeypot field and a per-visitor rate limit.
- **Website account.** Users sign in at `/account` (My account in the footer) to update their own name and password. Account invitations and password resets return users to this account screen. Tenant data and administration routes remain restricted by role.
- **Tenant portal.** Tenants sign in on `/tenant-portal` and see only their own tenancy: property, owning legal entity, payment instructions, and a pre-filled maintenance request. Staff accounts are refused there. The site forwards `/api/{auth,account,tenant,public,media,health}` to the API so the session cookie is same-origin (never `/api/admin`).
- **SEO.** Everything is managed in the admin. Each page and property gets a title, meta description, self-referencing canonical URL, Open Graph and Twitter cards (image from the page, the property photo, or the site default) and `robots` directives from its SEO fields; the admin shows a live SEO checklist (title/description length, target phrase, photo, alt text, canonical, no-index). Structured data (JSON-LD): Organization + WebSite on every page, BreadcrumbList on inner pages, Place on property pages — built only from facts the site states (no prices, ratings or availability). `sitemap.xml` is built from live data with `lastmod` (no-index pages left out), `robots.txt`, favicon, Search Console / Bing verification tags, and managed 301/302 redirects (Site settings → Redirects, one `/old -> /new` per line). Tenant portal and Pay Rent are no-index by default.
- **Cookie consent + privacy.** No optional cookies are set today, so there is no banner; the footer "Cookie settings" link explains this. With `NEXT_PUBLIC_GA_MEASUREMENT_ID` set, analytics load only after the visitor accepts (a browser Global Privacy Control signal counts as declining). The Privacy page text is a draft that staff can edit.
- **Land-only wording.** 400/450 E. Jamie Court (the Haskins Way site) is a ground-lease/land interest only; the notice shows on cards, the property page, the entity section, the contact form and the footer photo caption.

## Configuration

API (`apps/api/.env`, see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Database connection |
| `API_PORT` (or `PORT`), `API_HOST` | Where the API listens (default 127.0.0.1:4000) |
| `WEB_ORIGIN`, `ADMIN_ORIGIN` | Allowed website / admin origins (CORS and request checks) |
| `COOKIE_SECURE` | `true` when served over HTTPS (also automatic with `NODE_ENV=production`) |
| `TRUST_PROXY` | Hop count or addresses of the reverse proxy in front of the API (default: loopback only) |
| `UPLOAD_DIR` | Where uploaded media is stored |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Inquiry notifications, invitations and password-reset emails (empty `SMTP_HOST` = no email; the admin is shown invitation/reset links to copy instead) |
| `INQUIRY_NOTIFY_TO` | Who is emailed; if empty, the management email from Site settings is used |

Website / admin environment:

| Variable | Purpose |
| --- | --- |
| `API_URL` | Server-side address of the API (default `http://127.0.0.1:4000`) |
| `NEXT_PUBLIC_API_URL` | Browser-facing API address (uploaded images, contact form) |
| `NEXT_PUBLIC_SITE_URL` | Public site address for the sitemap and robots.txt |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional Google Analytics 4 ID (loads only after consent) |
| `SITE_PASSWORD` | Private preview: when set, every page, image and `/api` route asks for this password first (`/site-access`, 30-day cookie, `noindex`). Remove it to launch publicly. Changing it signs everyone out |
| `NEXT_PUBLIC_WEB_URL` (admin) | Link target for "View website" |

## Security

- **Sessions:** random 256-bit token, stored hashed (SHA-256) in the database, 8-hour expiry, revoked on sign-out and on password or role change. The cookie is `HttpOnly`, `SameSite=Strict`, path `/api`, and `Secure` automatically when `NODE_ENV=production` (or `COOKIE_SECURE=true`). Passwords use salted scrypt; minimum 12 characters.
- **CSRF / origin:** every write must come from the website or admin origin; the admin API accepts only the admin origin. CORS allows only those two origins.
- **Login throttling:** per visitor IP (20) and per account (8) per 15 minutes, so one visitor cannot lock out everyone. The API trusts forwarded client addresses only from a loopback proxy by default; behind nginx or a load balancer set `TRUST_PROXY` (hop count or addresses).
- **Access control:** admin, user and tenant roles are read from the database; tenants see only their own assigned tenancy and payment instructions; payment data is never in the public API. The website forwards only `/api/{auth,account,tenant,public,media,health}`, never `/api/admin`.
- **Uploads:** JPG, PNG, WebP and PDF only, validated by file signature, 10 MB limit, random file names, PDFs served as downloads, `nosniff`.
- **Browser headers (website and admin):** a **nonce-based Content-Security-Policy** set per request in `proxy.ts` — only scripts carrying that request's random nonce run (plus scripts they load, via `strict-dynamic`), so injected inline scripts, inline event handlers and third-party scripts are blocked; no framing, no `<base>` hijacking, no plugins, no external form posts. Also `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, and HSTS in production; `X-Powered-By` removed. To make the nonce work every page renders per request (the root layouts call `connection()`); keep that when editing layouts. Inline `style=""` attributes remain allowed (`style-src-attr`), which is not a script vector. `unsafe-eval` is allowed in development only.
- **Input handling:** all SQL is parameterized; React escapes output (the only raw HTML is JSON-LD structured data, with `<` escaped); contact-email headers are sanitized and the HTML body escaped; request bodies are size-limited; error responses reveal no internals.
- **Default admin guard:** in production the API refuses to start while `admin@gmail.com` still has the default password (`ALLOW_DEFAULT_ADMIN=true` overrides it, not recommended). In development it prints a warning.
- Check dependencies with `npm audit`.

## Design system

All colors, fonts, sizes, spacing and motion are tokens in `apps/web/app/theme.css`; change a value there and the site follows — or override colors, fonts and sizes from the admin (Pages & SEO → Design), which `app/layout.tsx` injects as a nonce'd `<style>` (`lib/design.ts`). There is one heading scale (`--fs-h1`, `--fs-h2`, `--fs-h3`). Shared pieces: `components/card.tsx`, `filter-tabs.tsx`, `entities.tsx`, `page-shell.tsx`, `page-hero.tsx`; `app/ui.css` holds the site-wide card, tab, button and link motion. Fonts (default Archivo, Instrument Serif, IBM Plex Mono, plus the optional choices in `app/layout.tsx`) are bundled at build time by `next/font`, so visitors' browsers never contact Google. Full design and client rules: `../.claude/skills/haskins-design/SKILL.md`.

## Checks

```bash
npm run typecheck      # all three apps
npm run build          # production builds
```

API integration tests (use an isolated API so your data is untouched):

```bash
cd apps/api
API_PORT=4010 npx tsx src/main.ts &          # test instance
TEST_API_URL=http://127.0.0.1:4010/api npm run test:integration
TEST_API_URL=http://127.0.0.1:4010/api npm run test:roles
TEST_API_URL=http://127.0.0.1:4010/api npm run test:password
TEST_API_URL=http://127.0.0.1:4010/api npm run test:mfa
```

Schema changes are versioned SQL files in `apps/api/src/migrations`; never edit an applied one — add a new file. More detail: [API guide](apps/api/README.md), [Admin guide](apps/admin/README.md).

## Content rules (from the client prospectus)

- Never imply one entity owns everything: show "Property Owner" and "Property Management: Buzz Haskins Equipment Co., Inc." Four entities: Haskins Industrial Complex, LLC; Haskins Industrial Complex II, LLC; Haskins Commercial Complex, LLC; Haskins Land Holdings, LLC.
- Never present the building at E. Jamie Ct./Haskins Way as owned (land only); keep partial interests labeled.
- Do not describe Haskins or BHE as an active contractor; BHE is not a licensed contractor and provides no brokerage or leasing services.
- Payment details are visible only to the signed-in tenant they are assigned to; no payments are processed on the site.
- Do not invent rents, square footage, availability or contact details.

## Before going live

- Change the default admin password (`admin@gmail.com` / `admin@123`).
- Set production environment values above; use HTTPS with `COOKIE_SECURE=true`; put the admin on its own subdomain (admin and site use separate session cookie names).
- Configure SMTP and SPF/DKIM for the sending domain; create the Google Analytics 4 property if analytics are wanted.
- Owner confirmations: exact legal name of the land-holdings entity ("Haskins Land Holdings, LLC" vs "Haskins Commercial Land Holdings, LLC"), management email/phone/address, inquiry retention period; legal review of the privacy text.
- Back up MySQL and the uploads folder together.
- Admin MFA, invitations/password-reset links and tenant notices/documents/maintenance are implemented. Production credentials, owner approvals and provider-account setup still require launch configuration.
- See [launch operations](ops/LAUNCH.md) for the local demo inbox, read-only readiness checks, safe administrator rotation, least-privilege DB setup, backups and SEO transfer.
