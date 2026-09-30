# Production Neon authentication

CactiGrow production uses the existing Neon Auth service at:

`https://ep-wild-pond-arf5s9do.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth`

The endpoint is public configuration, supplied as `VITE_NEON_AUTH_URL` in the production build and `CACTIGROW_NEON_AUTH_URL` in the production Worker. No Neon management credential, database owner credential or auth signing secret is needed by the application. Keep `https://cactigrow.com` trusted in Neon Auth. Configure email/password, verification and recovery email delivery in that branch's Auth settings.

## Identity and sessions

The official `@neondatabase/auth` React adapter handles signup, login, verification emails, password recovery and HttpOnly persistent session cookies. The existing login screen remains inside the game access boundary; the public homepage is unchanged. Successful authentication returns to `/play`. Recovery links use `/auth/reset-password`. The Game Menu includes sign out; successful logout performs a full navigation to discard gameplay projections and close the current page's realtime connection. Failed logout remains visible and is not reported as successful.

Before API and realtime admission calls, the browser calls Neon's official `/token` endpoint with its HttpOnly session cookie; only the returned JWT is sent as a Bearer credential. This avoids a reproduced SDK 0.5.0-beta `token()` cache issue after `getSession()` and does not depend on cross-origin access to the `set-auth-jwt` header. Tokens are not persisted by CactiGrow. No CactiGrow localStorage token or client-selected player ID is used. Old Base44 localStorage entries are never read. Neon cookies remain subject to browser third-party-cookie policy because the supplied Auth service is on a different site; test persistence in supported browsers. A same-site auth domain/proxy is not introduced by this change.

`NeonIdentityProvider` uses `jose` and the configured branch's `/.well-known/jwks.json` to verify Ed25519 signatures, issuer, audience, required subject/issue/expiry claims and a maximum 15-minute lifetime. Anonymous-role and banned tokens are rejected. Key caching and refresh are shared per endpoint with a five-second fetch timeout; unavailable keys fail closed. Provider-controlled email verification policy determines whether Neon issues a session. Never substitute unverified browser session state for API verification.

Verified identities use provider `neon` and an endpoint-scoped subject through the existing `PostgresPlayerIdentityResolver`. Internal CactiGrow UUIDs, transactional concurrent-first-login protection and existing onboarding remain unchanged. Existing Base44 identity rows/gameplay are retained but are not automatically linked by email. A new Neon identity receives its own internal player mapping. No CactiSwap accounts are migrated or modified.

Realtime admission uses the verified JWT expiry through the existing ticket and connection authorization machinery. There is no production fallback lease without a verified expiry. Durable Objects, Areas, Layers and reconnect fencing are unchanged. JWTs already issued can remain usable until expiry after logout/revocation; this is not immediate server-side session revocation. The current page's logout closes its connection through full navigation.

## Environment and validation

Development identity and staging Cloudflare Access are unchanged. The Neon browser client is created only in production. Missing/invalid production configuration rejects authentication. Hyperdrive, gameplay schema, migrations and runtime grants are unchanged. The production custom-domain configuration records existing apex/www attachments so deployment preserves them; staging remains separate.

Focused signed-token, workerd/JWKS, browser-credential, API/bootstrap and existing realtime admission tests cover the authentication boundary. These are automated fixtures, not real production accounts. Real signup, email verification, login, logout, refresh persistence, authenticated bootstrap and Town acceptance are to be completed by the user after deployment. Two-account multiplayer is not claimed verified.

Official references:

- https://neon.com/docs/auth/quick-start/react
- https://neon.com/docs/auth/guides/plugins/jwt
- https://github.com/neondatabase/neon-js/tree/main/packages/auth

This document supersedes the earlier Base44 production authentication instructions and provider-specific portions of `PRODUCTION_LAUNCH.md`.

## Deployment evidence

Production Worker version `008aa2bd-7128-4e92-9a87-05e551399b16` was deployed with the existing Hyperdrive and AreaPresence bindings and existing apex/www Custom Domains. The live homepage, `/play`, recovery page and health endpoint returned 200. The live bundle contains the Neon endpoint and no Base44 app ID. Anonymous, old Base44 and development credentials were rejected by bootstrap (401); anonymous realtime admission was rejected (401). www redirects to HTTPS apex (308) preserving path/query. Staging still redirects to Cloudflare Access (302). No database migrations or CactiSwap changes were made.

Validation: 15 focused identity/browser/realtime tests and 16 selected API authentication/bootstrap tests passed, plus TypeScript, scoped ESLint, production build and diff whitespace checks. Real account acceptance is explicitly delegated to the user; no successful live player bootstrap or two-account multiplayer is claimed.

## Verification-code playtest fix

The branch is configured to require an email code at signup. The previous UI lacked code entry and never called `emailOtp.verifyEmail`; it also checked for a session prematurely after pending signup and discarded provider errors. Registration now treats a successful unverified-user response as a pending account, opens code entry, resends via `emailOtp.sendVerificationOtp` with `email-verification`, verifies the code, and establishes a password session before checking the official token endpoint and entering `/play`. The password remains only in form memory during this flow. If verification succeeds but sign-in fails, the UI returns to sign-in rather than reusing a consumed code. A resumed verification without a retained password prompts sign-in. Existing logout, recovery, gameplay, identity mapping and multiplayer implementations are unchanged.

Safe provider error codes are shown; development diagnostics include bounded safe 4xx messages and HTTP status without logging secrets or complete response bodies. The original user-specific failed signup response was not available, so no additional provider-side root cause is claimed. A production validation-only signup request returned 400 VALIDATION_ERROR for invalid email; SDK CORS preflight returned 204. No real test account was created by the agent.

Production fix version: `ad76048a-a782-42fa-bc42-fcf40cb4dded`. Focused checks passed: 12 registration/auth tests (including actual SDK request assertions against HTTP fixtures), 9 selected bootstrap/auth API tests, 7 realtime admission/runtime tests, TypeScript, scoped ESLint and production build. Live homepage, Farm entry, Nursery, Garden and Town SPA routes returned 200, and the new code-entry bundle was served. Anonymous bootstrap/admission returned 401; staging still returned its Access redirect. SPA delivery does not verify authenticated gameplay.

Real acceptance remains pending with user-controlled accounts: in two separate browser profiles, register different emails, enter their respective codes, reach `/play`, refresh, visit Nursery/Garden, then enter `/town` and require Connected in both. Move each player and observe it from the other profile. Refresh one profile and confirm it rejoins without duplication; sign out one profile and confirm disappearance, then sign in again and rejoin. Record both account results without sharing codes, passwords, cookies or tokens.
