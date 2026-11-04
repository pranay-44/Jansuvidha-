# Citizen and government accounts

This is one Node/Express application with one MySQL application database. The separate `jansuvidha_test` database is used only by automated tests. The existing map, dataset, theme and language controls remain available. Complaints now use authenticated backend storage; old browser demo complaints are neither imported nor deleted.

**Local prototype, not production-ready:** staff MFA is deferred. `NODE_ENV=production` refuses startup, and the server binds only to loopback. Staff login additionally requires `ALLOW_LOCAL_STAFF_WITHOUT_MFA=true`. Do not expose this prototype through a proxy or tunnel. Implement an established MFA enrollment, verification and recovery flow before lifting these guards. Staff password reset must retain the MFA requirement.

## Setup and start

Use Node 24 LTS and MySQL 8.4 with its Windows service running. Install dependencies with `npm ci`.

```powershell
npm run db:setup
npm run db:migrate
npm run auth:bootstrap
npm start
```

Open **http://127.0.0.1:4173** (use this hostname consistently).

`db:setup` prompts privately for the MySQL setup account's password, creates `jansuvidha` and `jansuvidha_test`, creates a randomly named application database user restricted to those databases, and writes an ignored `.env` with generated database/session secrets. It never saves the root password and refuses to overwrite an existing `.env`. Restrict access to this file and keep it outside browser assets. Existing database records are not deleted. For an existing deployment, configure the placeholders in `.env.example` instead. Use a separate migration user and least-privilege runtime grants before deployment.

`db:migrate` applies the versioned SQL migrations once, under a MySQL advisory lock. The initial migration creates tables and does not delete existing data. Migration 002 adds “Civic amenities (pilot)” and “Thane pilot area” only if the respective routing tables are empty, so initial complaint submission is available. These are local pilot routing labels, not verified government assignments; administrators can rename them. Do not point this at an unrelated database with similarly named tables.

`auth:bootstrap` is the exact command to create the first administrator. It prompts for name, official email, password and confirmation; passwords are hidden and never supplied as command arguments. A database lock prevents concurrent bootstrap, and the command refuses if any administrator already exists. There is no HTTP setup endpoint or additional administrator-creation feature.

## Test the citizen flow

1. Select **Citizen sign in** and **Create citizen account**. Choose a username and password; email, phone and real name are not requested.
2. Usernames are ASCII letters, numbers and underscores, 3–32 characters, trimmed and stored lowercase with a unique database constraint. Passwords are 15–128 Unicode characters with no composition rules or silent truncation.
3. Save the eight recovery codes using Copy or Download. They are shown once and each is single-use. Losing both password and codes may mean losing account access.
4. Create a complaint under **My complaints → New complaint** after the administrator has created departments and jurisdictions. Only your complaints and citizen-visible updates are returned.
5. Use **Account settings** to change your password or replace recovery codes. Both require the current password. Password changes revoke other sessions; replacing codes invalidates every old code.
6. **Forgot password?** accepts username, one recovery code and a new password. Recovery consumes the code atomically and revokes all existing sessions. Sign in again afterward.

No browser password hash is used as a login credential. The backend uses Passport Local and Argon2id through `argon2` with random salts, 64 MiB memory, three passes and the complete encoded hash. Hashing reduces breach damage but cannot guarantee that weak passwords remain secret. `BREACHED_PASSWORD_CHECK=true` enables HIBP's range API using only the first five hex characters of a SHA-1 digest; plaintext passwords never leave this application. SHA-1 here is only the lookup protocol, not password storage. Screening fails closed when enabled and unavailable. It is off in the offline local setup.

## Test the government flow

1. Sign in through **Government portal** using the bootstrapped administrator's official email and password.
2. Open **Departments & jurisdictions** and add the relevant entries. Names can be renamed without changing IDs.
3. Open **Officers**, enter name, official email, department and jurisdiction, and create a pending officer. Public registration cannot create staff or set roles or scopes.
4. If SMTP is configured, the invitation is sent to the official email. Otherwise run the explicit development command below in a private terminal. Choose the officer's email and **Officer invitation**:

   ```powershell
   npm run auth:dev-link
   ```

5. Open the single-use link and set a password. Invitations expire in 24 hours. Tokens are stored only as hashes and consumed under a transaction. The account remains pending until the administrator changes its status to **ACTIVE**. Do not activate a staff member until you have verified their identity, official email and intended scope.
6. Assign a complaint from its details page. The selected officer must be active and match both department and jurisdiction. Officers cannot assign themselves or use account-management endpoints.
7. Log out and sign in as the officer. Their inbox contains only explicitly assigned complaints in their scope. Notes must be marked either citizen-visible or internal; internal notes never appear in citizen responses. Status transitions are enforced by the backend.
8. Deactivate an officer to revoke access through existing sessions. Changing their scope or other account fields also revokes sessions. Administrator audit history shows account and complaint actions without password/token content.

The existing evidence requirement is preserved: marking a complaint resolved is blocked until evidence upload support exists. Uploads were not added. Assignment can move an open complaint to Assigned; permitted work transitions are Assigned → In progress/Rejected and In progress → Rejected. Resolved → Closed/In progress is supported for a future evidence-backed resolution flow.

## Staff recovery and email configuration

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` in `.env` to enable email. SMTP requires TLS. Staff **Forgot password?** sends a 20-minute single-use reset link to the stored official address and returns a generic result. Reset tokens are hashed, expire and cannot be reused; resetting revokes sessions. Password reset does not grant dashboard access or change roles/status.

Without SMTP, `npm run auth:dev-link` can issue a staff reset link in an explicitly development-only terminal. It is blocked outside `NODE_ENV=development`. Links are not exposed through ordinary API responses or server logs. The CLI intentionally displays the requested local development link once; do not capture its terminal output in shared logs. No email/SMS recovery is added for citizens.

## Sessions and security boundaries

Citizen and government sessions are separate: `js.citizen.sid` and `js.staff.sid`, each with its own CSRF token. The client selects a portal via `X-Portal`; the server checks the session's saved portal and the database role, so changing this header cannot convert a citizen into staff. Citizen settings are at `#account`; staff settings are at `#staff-account`. Logging out of one portal leaves the other session intact. Legacy shared `js.sid` sessions are no longer accepted; sign in again after upgrading.

MySQL-backed `express-session` sessions use HttpOnly, SameSite=Strict cookies, Secure in production configuration, login/session-ID rotation and an eight-hour maximum authenticated lifetime. A session-bound CSRF token and origin checks protect every API mutation, including login and registration. The backend reloads account status and session version on each request; protected writes recheck under a database lock. Random IDs are not treated as authorization.

All queries use parameters; editable fields are allowlisted. Persistent MySQL buckets rate-limit registration, login, recovery, sensitive password operations, invitations and complaint submission by socket IP. This single-process local server does not trust proxy headers. Periodically purge expired `auth_limits` rows and used/expired tokens using a restricted maintenance process before larger-scale operation. Session storage expires old sessions automatically.

## Validation

```powershell
npm run check
npm run test:auth
```

The authentication integration suite uses real HTTP requests and MySQL in `jansuvidha_test`. It creates its own random records and removes only those records afterward. It covers Argon2id, username uniqueness/case handling, role injection, login, CSRF, citizen isolation, internal notes, officer assignment and scope, administrator-only endpoints, disabled sessions, invitation approval/reuse, reset expiry/reuse, concurrent recovery-code consumption, password/session revocation, code replacement, rate limiting and production-MFA guards.

## Remaining deployment work

- Staff MFA, including enrollment, verification, replay protection and recovery, is mandatory before production; startup currently fails closed.
- Configure HTTPS, secure proxy trust, SMTP delivery/monitoring, production database privileges/backups, secret storage and deployment security review before real use. This implementation does not claim anonymity or breach-proof storage; complaint content itself may identify people.
- The packaged Android/static-hosting version has no remote API configuration. Use the Node-served local web application for accounts. Do not publish `dist/` alone and expect authentication to work.
- New account screens are in English. Existing map translations are preserved. Existing local ratings/assessment drafts remain prototype-only and do not modify server complaint/account data.
