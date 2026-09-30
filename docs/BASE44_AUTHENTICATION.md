# Base44 authentication boundary

CactiGrow uses Base44 only as a production identity provider. Development/test retain explicit private development credentials; private staging retains Cloudflare Access. The existing CactiSwap Base44 app supplies shared account authentication only; all CactiGrow game data, economy and multiplayer remain independent.

## Supported verification

The official [external client documentation](https://docs.base44.com/developers/references/sdk/docs/functions/createClient) supports `createClient({ appId, token })` in external applications/backends. The [auth documentation](https://docs.base44.com/developers/references/sdk/docs/interfaces/auth) defines `auth.me()` as returning the authenticated user. Each protected Worker request creates a separate user-mode client and calls that method remotely. This is online verification by Base44, not local JWT verification or trust in a browser session. No service-role token, signing secret, inferred JWKS URL, or Base44-hosted function is used.

The Worker checks the returned app ID and rejects disabled, unverified or service accounts and malformed responses. The existing resolver maps `base44` plus `<appId>:<verifiedUserId>` to an internal PostgreSQL UUID. Client player IDs and email addresses are never identity-mapping inputs. Existing UUIDs/mappings are unchanged. A new Base44 identity receives a new internal identity; linking existing Access/development players is not automatic or based on matching email.

SDK 0.8.52 uses Axios. The lockfile and override retain Axios 1.18.1, within the SDK's declared supported range: Axios 1.20.0's browser fetch adapter supplies `cache: 'default'`, which local workerd rejects. The actual SDK verification path passes a local workerd test using Wrangler's browser/workerd resolution conditions and a mocked remote response with 1.18.1. Retest this boundary before removing the override. No SDK code or authentication protocol is patched.

Missing/invalid configuration, missing/malformed tokens, rejected/expired credentials and upstream errors fail closed before player resolution. Credentials and private Base44 profile fields are not returned in CactiGrow projections. No successful verification is cached between requests; availability/latency and rate limits of Base44 therefore affect protected API requests. The auth response does not expose a documented session expiry, so no expiry is invented. Production realtime is enabled with a maximum 15-minute connection authorization after successful remote verification. No Base44 token expiry is inferred; revocation/expiry is checked again on every new admission, not pushed to an already-open connection.

## Configuration

- Worker production variable `CACTIGROW_BASE44_APP_ID`: the existing CactiSwap Base44 application ID `69ff2d4a5df1772fd16bd931`.
- Production Vite build variable `VITE_CACTIGROW_BASE44_APP_ID`: the same public application ID. It is not a secret. The user explicitly approved sharing CactiSwap account identity, never its game data.
- Configure that application's email/password registration and email verification, access policy and any required bot protection in Base44. No remote settings are changed by this implementation. The email/password form uses documented SDK login/register/OTP methods; it does not assume a hosted-login redirect works on an external origin.
- No Base44 API key or privileged credential is required. No database migration is required; the existing identity mapping tables are reused.

## Browser flow

The public homepage remains outside authentication. PLAY NOW still opens `/play`. Protected routes run the existing Worker bootstrap; unauthenticated production players see the login/registration/verification screen, while staging retains its Access message. Successful login reloads `/play` and reruns bootstrap before mounting gameplay. Registration requires email verification; it never grants gameplay access itself.

Base44's SDK stores its user token in browser local storage. The adapter additionally uses an app-scoped CactiGrow key for API credentials. Tokens are sent only through the production same-origin API client as Bearer credentials and verified by the Worker. SDK automatic URL-token adoption is suppressed; this integration does not accept a token callback from arbitrary query strings. Development and staging never emit these credentials. Browser tokens are accessible to JavaScript, so production CSP/XSS controls remain necessary. No custom cookie session or refresh/revocation mechanism is claimed. Logout/password recovery UI is outside this initial integration.

## Production acceptance still required

The production app ID and matching build variable are configured; verify its cross-origin email/password/OTP flow and any Turnstile requirements from the real CactiGrow origin. The initial form does not implement a Turnstile widget: if required by the app, complete that supported provider integration before launch. Test valid, expired, revoked, disabled, wrong-app and unverified identities against Base44 itself, and verify separate internal players and repeat-login persistence against the production database. Automated mocked tests are not live Base44 or PostgreSQL acceptance.

The production binding, existing onboarding and gameplay paths, realtime configuration and Worker have now been deployed. See PRODUCTION_LAUNCH.md for the verified state, domain conflict and outstanding real-account acceptance.
