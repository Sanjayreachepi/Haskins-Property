# Account and flow verification

Verified on November 17, 2026 against a separate MySQL verification database. The existing application database was not migrated or modified by these checks.

## Changes

- Added `/account` for website sign-in, name changes, password changes and sign-out, with a footer link. Uses the existing page, form, typography and button styles.
- User invitation/reset links return to `/account`; tenant links continue to return to `/tenant-portal`.
- Matched session authentication and CMS/role tests to the selected password/authenticator MFA flow; removed the obsolete email-OTP session requirement.
- Added the missing `ioredis` dependency so the existing rate-limit source compiles.
- Fixed analytics re-enabling after consent withdrawal and prevented loading before stored preferences/GPC are read.
- Allowed footer legal links to wrap on small screens.

## Checks

- Admin, API and Web TypeScript checks passed.
- Production compilation and page generation succeeded. The final full build command exited non-zero because the existing Next.js security advisory stopped the Admin build; the Web and API build steps completed. The advisory must be addressed before treating the deployment build as fully clear.
- All migrations applied successfully to the verification database.
- A read-only check of the existing application database found no pending migrations. The temporary verification database was removed after testing.
- CMS integration suite passed: drafts/publishing, ownership/dependencies, private payments, inquiry inbox, upload validation, serving and logout.
- Role integration suite passed: admin route restrictions, account scope, tenant isolation, assigned payments, disabled accounts and session revocation.
- Password suite passed, including user invitation destination and user access restrictions.
- MFA suite passed, including authenticator/recovery codes, replay protection, colleague reset and preserving MFA after password reset.
- Headless Chrome verified user invitation/password setup, profile update, password change, sign-out/sign-in, admin login and the public Home, Properties, Available spaces, Services, History and Tenant portal routes.
- Desktop/mobile account screenshots were reviewed. Browser checks verified analytics consent, withdrawal, re-enabling and GPC. Analytics requests were intercepted during testing; no test events were sent to Google.
- A local SMTP receiver captured invitation, reset and management inquiry notifications. Public forgot-password did not expose the reset link; the reset token had a one-hour lifetime.

Integration commands, from the project root, with `DB_NAME` and `TEST_API_URL` pointing at an isolated database/API:

```bash
npm run typecheck
npm run test:integration -w @haskins/api
npm run test:roles -w @haskins/api
npm run test:password -w @haskins/api
npm run test:mfa -w @haskins/api
npm run build
```

The password/MFA suites use the administrator's copy-link fallback and expect SMTP to be unset. The suites create temporary accounts and content and should run against a test database. Set `ADMIN_MFA_REQUIRED=false` for these suites; they test optional MFA enrollment.

## Deployment configuration

- Live SMTP delivery still requires the sending mailbox's `SMTP_HOST`, port/authentication and sender configuration. Local SMTP capture verifies the application path, not delivery to real external inboxes.
- Set and retain `MFA_ENCRYPTION_KEY` before enrolling production administrators. `ADMIN_MFA_REQUIRED=true` makes enrollment mandatory; keep it false when administrators should be able to disable MFA.
- Apply migrations on the intended deployment database with `npm run db:migrate`; no new schema migration was introduced by these fixes.
- Next.js emitted an existing security-upgrade advisory during verification. A framework upgrade was not included in these account/flow fixes.
