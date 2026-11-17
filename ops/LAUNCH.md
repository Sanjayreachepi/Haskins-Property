# Launch preparation and remaining owner inputs

The supplied website prospectus and archival-image ZIP were reviewed. Existing fonts, colors, logos, photographs and public page layouts are retained. Tenant services use the existing portal/admin components and per-tenancy permissions. User/Admin/Tenant roles are retained; no Editor role is introduced.

## Local demo email

The local API `.env` is configured for `Haskins Demo <demo@gmail.com>`, captured on `127.0.0.1:1025`. This is a placeholder identity, not authenticated Gmail delivery. No email is forwarded to Gmail or external recipients. Start the local receiver in another terminal:

```bash
npm run mail:demo
npm run dev
```

Open `http://localhost:8025` to view captured invitation, password reset and inquiry emails. Refresh to see messages. Only localhost can access the inbox; it stores up to 50 messages in memory, including live reset tokens, and clears them on restart. It must not be exposed through nginx or a public tunnel. `SMTP_DEMO=true` is rejected by production startup.

For client delivery, replace `SMTP_HOST`, port/security, authentication, `MAIL_FROM` and `INQUIRY_NOTIFY_TO`; set `SMTP_DEMO=false`. Configure SPF/DKIM with the actual provider. Do not put credentials into git or command-line arguments.

## Server configuration

1. Confirm the website/admin hostnames and hosting access. Configure an automatically renewed certificate, HTTPS redirects, separate admin subdomain, API bound to loopback/private networking, and the exact HTTPS `WEB_ORIGIN`/`ADMIN_ORIGIN`. Set web/admin `API_URL` to the private API address and `NEXT_PUBLIC_WEB_URL` to the public website. Set `NODE_ENV=production` and `COOKIE_SECURE=true`.
2. Set persistent `UPLOAD_DIR` and `PRIVATE_DOCUMENT_DIR` outside release directories; private documents must stay outside every public/static root. Apply existing migrations with a schema-management identity; never edit an applied migration.
3. Review `database-user.sql.example` with the server DBA. Create a database-specific runtime identity with SELECT/INSERT/UPDATE/DELETE. Do not grant the app global, schema-modification or user-management privileges. Use separate credentials for migrations and restores, and update the protected API environment only after the new account is tested.
4. Generate/store a strong `MFA_ENCRYPTION_KEY` in protected secret storage **before** production MFA enrollment. Retain it in encrypted backups separate from the database. Never replace a key already used to encrypt live MFA secrets without a planned migration/reset. Enroll all active administrators, save recovery codes, test recovery, then set `ADMIN_MFA_REQUIRED=true` and restart. Required MFA disables voluntary MFA removal.
5. Secure the default administrator using My account/Accounts, or supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` via a protected environment and use the CLI below. It renames the unchanged default account, keeps references/MFA, and revokes its sessions. No credentials are invented by these changes.

```bash
# Reads ADMIN_EMAIL/ADMIN_PASSWORD from the protected API environment; no mutation:
npm run admin:secure
# Explicit rotation after reviewing the dry run:
npm run admin:secure -- --apply
```

6. Run `npm run launch:check`. It performs read-only environment/schema/admin/grant checks and exits non-zero for missing prerequisites. It cannot certify certificate renewal, DNS, external inbox delivery, legal approval, restore drills or provider-account access. Resolve the existing Next.js security advisory and validate the full production build before deployment.

## SEO/content transfer

SEO lives in MySQL, not git. Manual re-entry is unnecessary. Transfer a reviewed database backup to a new environment when migrating the whole site. For SEO-only updates between databases containing the same kind/slug records:

```bash
# On source, writes a new private file; refuses to overwrite an existing file:
npm run seo:export -w @haskins/api -- /private/path/seo.json
# On target: dry run; missing records cause failure before any changes:
npm run seo:import -w @haskins/api -- /private/path/seo.json
# Update drafts only; review/publish from the admin panel:
npm run seo:import -w @haskins/api -- /private/path/seo.json --apply
# Deliberately also transfer SEO to already published target records:
npm run seo:import -w @haskins/api -- /private/path/seo.json --apply --publish
```

Match by kind/slug, not numeric IDs. The import changes only SEO fields; property owners, tenancy/payment relationships, page design/content and publication status are preserved. Review canonical domains and restore referenced media first. Keep exports private and back up the target before applying.

## Backup and restore

Set `BACKUP_DIR` to an absolute private directory outside the checkout/public/storage directories, provision `mysqldump`, and run `npm run backup`. Pause writes to obtain a consistent DB/files snapshot. The script writes SQL, uploads, private tenant files and a SHA-256 manifest with restricted directory permissions. No `.env` or secret key is included. Back up the MFA key separately in encrypted secret storage. Failed runs lack a completed manifest and retain `INCOMPLETE`; successful runs remove that marker. Encrypt/copy backups off-host, schedule the script under the service account, monitor failures and apply an owner-approved retention policy. This change does not install a server cron job.

For a restore drill, verify the SQL checksum, create an isolated MySQL instance/database identity, and import the dump using a schema-management account. The dump contains `CREATE DATABASE`/`USE`, so do **not** load it on a live server under a different database argument and assume it is isolated. Restore uploads/private files into new private paths, provide the retained MFA key, run migrations, and test sign-in, MFA, payment visibility and private downloads before changing traffic. Never test a restore over the live database.

## Owner/provider inputs still required

- Final domains, hosting/DNS access and client SMTP identity/provider credentials.
- GA4 property/Measurement ID and live-data verification; Search Console Domain ownership, sitemap submission and owner access. The prospectus requests GA4 Administrator and Search Console owner access for `derek@reachelitepromo.com` and `haskinsequip@gmail.com`; no external invitations are sent by this implementation.
- Privacy/legal approval, actual management contacts, inquiry retention/deletion practice and exact land-holdings entity name. The prospectus names both “Haskins Commercial Land Holdings, LLC” and “Haskins Land Holdings, LLC”; do not silently substitute either. Existing owner/payee labels are unchanged.
- An owner-approved production administrator identity/password, backup schedule/retention and verified restore.

The legacy photographs and design assets in the ZIPs are reference material; they do not authorize changing ownership, publishing unapproved legal facts, sending external messages, or redesigning the existing site.
