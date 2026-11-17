# Haskins CMS API

NestJS API with MySQL, versioned SQL migrations and an independent admin client. The API owns all database access. The public website reads published content from `/api/public/content` and sends inquiries to `/api/public/inquiries`.

## Local setup

Copy `.env.example` to `.env` in this directory and set database credentials. The local database already exists; the migration runner does not create or drop databases. Root development credentials are kept in the ignored local `.env` only.

From the repository root:

```bash
npm install
npm run db:migrate
npm run db:seed
ADMIN_EMAIL=your-admin@example.com ADMIN_PASSWORD='your-unique-password-at-least-12-characters' npm run admin:create
npm run dev:api
```

Run `npm run dev:admin` in another terminal. API defaults to 127.0.0.1:4000. Existing development processes are not stopped automatically.

## Migrations

All schema changes are SQL files in `src/migrations`, applied in filename order by `npm run db:migrate`. Applied names and SHA-256 checksums are recorded in `schema_migrations`; editing an applied migration fails validation. MySQL advisory locking prevents two migration runners from executing concurrently. There is no ORM schema synchronization or runtime table creation. New schema changes require a new migration file.

MySQL DDL implicitly commits. If a migration fails halfway through, inspect/repair the partial change before retrying; the runner never pretends a partial migration rolled back. Back up production databases before schema upgrades. Rollbacks are deliberate forward repair migrations rather than destructive automatic down scripts.

`npm run db:seed` inserts the initial four entities, eight properties and nine page records while preserving existing CMS records. The supplied prospectus uses two versions of the Land Holdings legal name; confirm the exact name with ownership before production.

## API

All JSON writes require the configured web or admin Origin. Authentication for all three roles uses a random opaque cookie, HttpOnly/SameSite=Strict, backed by a hashed token in MySQL; sessions expire after eight hours. Passwords use salted scrypt. Login has a process-local attempt limiter. Configure an upstream/shared rate limiter for multi-instance deployments.

| Method / route | Access / purpose |
| --- | --- |
| GET `/api/health` | API and database readiness |
| POST `/api/auth/login` | Role-based email/password login |
| POST `/api/auth/logout` | Revoke current session |
| GET `/api/admin/me` | Current administrator |
| POST `/api/admin/password` | Change password and revoke other sessions |
| GET/POST `/api/admin/records` | List / create / save draft records |
| POST `/api/admin/records/:id/publish` | Publish draft; payments require `confirmPayee: true` |
| POST `/api/admin/records/:id/unpublish` | Unpublish; blocks published dependent records |
| GET/POST `/api/admin/media` | List / multipart upload (`file`, `alt`) |
| PATCH `/api/admin/media/:id` | Update library alt text |
| GET `/api/admin/audit` | Latest 100 administrative events |
| GET `/api/admin/inquiries` | Latest 500 inquiries |
| PATCH `/api/admin/inquiries/:id` | Update inquiry status |
| GET `/api/public/content` | Published entity/property/page/space/settings snapshots only |
| POST `/api/public/inquiries` | Validated inquiry submission; honeypot and rate limiting |
| GET `/api/media/:filename` | Public uploaded file; PDFs are downloaded as attachments |

Admin record fields: `id` for updates, `kind`, `slug`, `title`, `entity_id`, `property_id`, `payload`. Supported kinds are entity, property, page, space, settings and payment. Property owner is mandatory; spaces and payments require a property. Relations use foreign keys and API kind checks. Publishing snapshots titles, slugs, payloads and relationships. Records can be unpublished rather than destructively deleted. No bank-account/card credential collection is provided.

## Verification

With an isolated API running and the migrations applied:

```bash
PORT=4010 npm run dev:api
# Another terminal:
TEST_API_URL=http://127.0.0.1:4010/api npm run test:integration -w @haskins/api
```

The CMS integration suite creates its own temporary administrator/content, verifies sessions, Origin protection, draft isolation, published ownership, payment privacy/confirmation, inquiries, upload restrictions and logout, and removes its test data.

## Deployment configuration

Set `API_HOST`, `API_PORT` (or `PORT`), `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `WEB_ORIGIN`, `ADMIN_ORIGIN`, `UPLOAD_DIR` and `COOKIE_SECURE=true` behind HTTPS as appropriate. `.env` is loaded relative to the API working directory. Use a dedicated database user for deployed environments. Back up MySQL and the persistent uploads directory together.

Build with `npm run build -w @haskins/api`. Run production migrations from this directory using `node dist/migrate.js`, and start using `npm start -w @haskins/api`. Migrations are an explicit deployment step, not server startup behavior.

MFA, private tenant-document workflows, invitation/password-reset email, external analytics setup and production hosting are separate work.

## Role-based accounts

Migration `004-roles-and-default-admin.sql` renames the former administrator table to `users`, preserves existing administrators, adds roles/status/name, renames foreign keys used by sessions/audit, creates tenant assignments and inserts the requested default local admin `admin@gmail.com` / `admin@123` with a salted scrypt hash. There is no automatic password reset on startup or later migration runs.

| Role | Permissions |
| --- | --- |
| admin | CMS, account management, assignment management, own profile |
| user | Own account/profile/password only |
| tenant | Own account/profile/password plus assigned active tenancies and their explicitly assigned published payment instructions |

All `/api/admin/*` endpoints require an active administrator session; the UI also refuses non-admin access. Roles are read from the database rather than accepted from request parameters. Disabling an account or changing its role/password revokes its sessions. Concurrent account updates lock active administrators to preserve at least one active admin.

| Method / route | Access |
| --- | --- |
| GET `/api/auth/me` or `/api/account/me` | Any signed-in account, own profile |
| PATCH `/api/account/profile` | Own name only; role and target-user IDs are ignored |
| POST `/api/account/password` | Own password, current-password verification |
| GET/POST `/api/admin/users` | Admin: list/create accounts; password hashes are never returned |
| PATCH `/api/admin/users/:id` | Admin: name, role, active status, optional password reset |
| GET/POST `/api/admin/tenancies` | Admin: list/create tenant-property assignments |
| PATCH `/api/admin/tenancies/:id` | Admin: activate/deactivate an assignment |
| GET `/api/tenant/tenancies` | Tenant: own active assignments only |
| GET `/api/tenant/tenancies/:id` | Tenant: own active assignment or 404 |

Assignments require an active `tenant` account and a published property. Payment instructions must be explicitly assigned and published for that same property; belonging to the same property alone never gives another tenant access to payment instructions. No tenant-facing frontend changes are included.

Run role regression checks against a running test API with `TEST_API_URL=http://127.0.0.1:4010/api npm run test:roles -w @haskins/api`. If custom origins are used, pass matching `ADMIN_ORIGIN` and `WEB_ORIGIN` to both the server and tests. Tests create and remove temporary accounts/assignments and cover admin denial, role escalation, cross-tenant isolation, private payment scope, deactivation and session revocation.

## Inquiry email notification

After a contact-form inquiry is saved, `src/mail.ts` emails management (Reply-To is the visitor). Configure in `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `INQUIRY_NOTIFY_TO` (comma-separated; if empty, the management email from the published Site settings is used). With no `SMTP_HOST` nothing is sent and a line is logged; mail errors are logged and never affect the visitor. Use a real sending account and set up SPF/DKIM.

## Page text blocks and property ownership fields

Page payloads accept `blocks` (named text boxes, see `packages/shared/src/page-blocks.ts`). Property payloads accept `landOnly` (the entity owns the land, not the building) and `ownershipShare` (e.g. `25%`) in addition to `ownershipNote`.

## Account invitations, MFA and private tenant services

Run migrations before restarting the API (`npm run db:migrate` from the repository root). Existing migration files are immutable. Tenant-service tables are already in migration 005; current password links/MFA use `password_tokens`, `mfa_challenges`, `mfa_recovery_codes` and the MFA columns on users.

Invitations use `/api/admin/users` with `invite: true`, and `/api/admin/users/:id/link` resends invitations or issues reset links. Invitations last 72 hours; reset links last one hour. Single-use token hashes are consumed transactionally. A completed reset revokes sessions and pending MFA login challenges without disabling enrolled MFA. Public forgot-password responses do not reveal whether an account exists. Delivered links are not returned; when SMTP is unavailable, the administrator receives a copy-link fallback. Production logs do not print reset links.

Tenant/website-user login uses email/password. Admin login uses password plus an authenticator or recovery code when MFA is enabled. Email OTP is not used by the active routes. Set `MFA_ENCRYPTION_KEY` before production enrollment, retain it separately in encrypted secret storage, then enable `ADMIN_MFA_REQUIRED=true` after all active administrators are enrolled. The role boundary remains User/Admin/Tenant.

Tenant services are under Admin → Tenant services. Documents and notices target one tenancy explicitly. Documents are PDFs of at most 10 MB, stored under `PRIVATE_DOCUMENT_DIR` outside public/static directories, and served only through authenticated download routes. Access is checked again against active tenancy and published owner/property. Downloads are attachments with no-store headers. Tenant document uploads are not supported; only administrators share PDFs.

Tenants create maintenance requests for their assigned tenancy, read status/history, and exchange messages with management. Administrators change new/in-progress/resolved status. All replies are tenant-visible; there are no internal notes or automatic ticket/notice emails. The portal is not an emergency channel. Inquiry notification emails remain separate.

For demo email, run `npm run mail:demo` from the repository root and use `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, blank SMTP authentication, `SMTP_SECURE=false`, `SMTP_DEMO=true` and `MAIL_FROM="Haskins Demo <demo@gmail.com>"`. View messages at `http://localhost:8025`. This captures mail locally and never sends it to Gmail. Production startup rejects demo mode. Replace these settings with the client provider and `SMTP_DEMO=false` before launch.

The tenant integration suite (`npm run test:portal`) starts its own isolated API/local SMTP receiver. Use a disposable database; it verifies document/notice isolation, private downloads, inactive-tenancy denial, maintenance status/replies and email invitation/reset. Run after the API build. See [launch operations](../../ops/LAUNCH.md) for readiness checks, administrator rotation, least-privilege DB setup, backups and SEO transfer.
