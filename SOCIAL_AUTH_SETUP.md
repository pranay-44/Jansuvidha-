# Citizen sign-in: Google and Facebook

Citizens now create accounts and sign in using Google or Facebook only. Officer/admin login, invitations and password reset still use the existing staff flow. Provider buttons stay disabled until their server credentials are configured. Real sign-in cannot be tested without those credentials and provider test accounts.

## 1. Prepare the local server

In the project directory run `npm run db:migrate`, then configure the ignored `.env` file. Never put secrets in `dist/`, commit them, or paste them in chat.

```dotenv
APP_ORIGIN=http://127.0.0.1:4173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_GRAPH_VERSION=
```

Use the exact origin you open in the browser: `localhost` and `127.0.0.1` are different cookie hosts. The callback URLs below are generated from `APP_ORIGIN`, never from a request Host header. Restart the Node server after editing `.env`.

## 2. Google

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select the JanSuvidha project.
2. Configure the OAuth consent screen / Google Auth Platform branding and audience. Add your test accounts while the app is in testing.
3. Create an OAuth client of type **Web application**.
4. Add this exact authorized redirect URI: `http://127.0.0.1:4173/api/auth/social/google/callback`.
5. Put the client ID and client secret in the matching `.env` variables. The flow requests only `openid profile`; it does not request email, contacts, Drive or offline access.

[Google's web-server OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server) cover client creation, redirect URI rules and testing. Use the normal system browser; this web-server flow is not a native Android OAuth integration.

## 3. Facebook / Meta

1. Open [Meta for Developers](https://developers.facebook.com/apps/) and create/select a JanSuvidha app with the Facebook Login use case for authenticating people.
2. Configure the website platform and Facebook Login redirect settings. Register the exact callback `${APP_ORIGIN}/api/auth/social/facebook/callback` (replace `${APP_ORIGIN}` with your configured origin).
3. Put the App ID and App Secret in `.env`. Set `FACEBOOK_GRAPH_VERSION` to the supported Graph API version shown for your app, in `vNN.0` format. The code deliberately has no guessed version default.
4. Enable the provider's OAuth login settings, and add developer/tester accounts for development-mode testing. The flow requests `public_profile` only; email is not required.
5. If Meta will not accept your local HTTP callback, use an HTTPS development origin and configure that same origin and callback in both the app and server. Do not invent a callback or bypass provider validation.

Use [Meta's manual login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/) and your app dashboard for its current settings and release requirements. Meta documentation was rate-limited during implementation, so dashboard-specific setup still needs confirmation when creating your app. Public release may require privacy-policy and data-deletion URLs, app review and other dashboard requirements; do not switch the app live until those are satisfied.

## 4. Run and verify

Run `npm start`, open the exact `APP_ORIGIN`, and choose Citizen sign in. The first successful provider login creates a citizen; later logins with the same provider identity reopen that account. Test both providers, cancellation, returning login, logout, and submitting/viewing a complaint. `npm run check` runs offline checks; `npm run test:auth` uses the separate `jansuvidha_test` database and mocked provider identities for server integration tests, not a real provider login.

## Account and deployment boundaries

- Existing username/password citizen accounts and their complaints are preserved. Their old password/recovery endpoints are disabled. New social sign-ins create separate accounts; no automatic migration or email-based merging is performed. A reviewed account-linking migration is needed before existing citizens can access their old complaints with social login.
- Google and Facebook identities are separate even if their names or emails match. Continue with the same provider each time.
- Provider subject IDs, names and local account IDs are stored. Provider access tokens are used only during the callback, never persisted. Citizen accounts get an internal generated username and unreachable random password hash to preserve the existing database constraints.
- OAuth start requests use the existing CSRF protection. Callbacks require a session-bound, expiring, single-use state. Google uses PKCE; Facebook tokens are checked for app, user and expiry. Login rotates the session. Citizen cookies use SameSite=Lax for the provider's top-level callback; staff cookies remain Strict.
- This repository still blocks production startup until staff MFA is implemented. The OAuth work does not remove that guard. Public HTTPS deployment and native Android browser/deep-link integration are separate work; static hosting alone cannot run these authentication routes.
