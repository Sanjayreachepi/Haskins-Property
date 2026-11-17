# Haskins Administration

Independent Next.js application at http://localhost:3001. The public website reads the content published here (properties, legal entities, available spaces, page SEO and text, site settings) through the API.

Start from the repository root with `npm run dev:admin`. Start the API separately with `npm run dev:api`. The admin app proxies `/api/*` to the backend; it never connects to MySQL directly. Set `API_URL` to change the backend address. `NEXT_PUBLIC_WEB_URL` controls the view-website link and previews of existing website images.

## Staff workflow

- Sign in using the default local administrator **admin@gmail.com / admin@123**, inserted by the role migration, or an account created with `npm run admin:create`.
- Create/publish legal entities before their properties. Enter the exact legal owner as the entity title.
- Manage properties, available spaces, page content, SEO and site settings through their respective sections.
- Save draft leaves the previous published content intact, including property/owner relationships. Save & publish releases a new version and updates the public website immediately (no rebuild).
- Page content is plain text and becomes the page’s intro sentence. Pages with fixed layouts (Home, History, Services, Privacy) also have a PAGE TEXT section of named text boxes; an empty box keeps the standard text (the placeholder). Page slugs correspond to the website routes, with `home` representing `/`.
- Upload public JPG/PNG/WebP images or PDFs in Media library. Choose a cover image, additional gallery photos and public downloadable PDFs in the record editor, or copy the returned path into an image field. Edit alt text in the library and set the image's alt text in the content record as appropriate. Uploads are limited to 10 MB. These are public assets; do not upload private tenant documents.
- Payment instructions require a related property and deliberate payee confirmation. They are never returned by the public content API. Tenant API delivery is limited to the specific payment record explicitly assigned to an active tenancy.
- Inquiry inbox lists submissions sent to the API and supports new/in-progress/resolved status. The website’s contact form submits here, and management is also emailed (see the API guide).
- My account changes your password and invalidates your other sessions.

Admin sign-in uses `/api/admin/auth/login` and the separate `hic_admin_session` cookie. Tenant sign-in continues to use `hic_session`, so logging in or out of one portal does not replace the other portal's session. Existing admin sessions remain supported; sign in again once to switch to the separate cookie.

## Accounts & roles

Admins can create `user`, `tenant` or `admin` accounts, change roles, disable/enable accounts and reset passwords. Role, password or status changes invalidate existing sessions. The backend prevents removing your own admin access or the last active administrator. New accounts and password changes require at least 12 characters; the requested initial local admin password is seeded separately.

Assign tenant accounts to published properties, give each assignment a unit/reference, and optionally select published payment instructions for that property. Only the assigned active tenant can read the tenancy through the tenant API. Deactivate an assignment to remove access. Normal users have only self-service account/profile access. User and tenant accounts cannot open the administration workspace.

Tenants sign in at `/tenant-portal` to view their assigned property, owner and payment instructions, shared notices/private PDFs, and maintenance requests with status/replies. Administrators manage these through Tenant services. Website users sign in at `/account` to update their own name and password. The footer links to My account.

## Account access workflows

- New accounts default to an invitation: choose a password using the single-use email link (72 hours). Administrators can resend invitations and send password reset links (1 hour).
- Admin sign-in uses a password, followed by an authenticator code or a recovery code when two-step sign-in is enabled. My account provides setup, disable and recovery-code renewal; another administrator can reset a colleague's two-step sign-in.
- `ADMIN_MFA_REQUIRED=true` requires administrator MFA setup. Password resets preserve the MFA requirement. Set `MFA_ENCRYPTION_KEY` in production and retain it with encrypted backups.
- Tenant and website-user sign-in uses email and password. Email OTP is not part of the active login flow.
- Configure SMTP to deliver invitations, password reset links and inquiry notifications. Without SMTP, administrators receive a link to copy; public forgot-password responses never expose account existence or return a token.
