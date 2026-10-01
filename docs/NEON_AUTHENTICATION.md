# Production Neon Auth

## Live State

Production uses the existing Neon Auth service at:

`https://ep-wild-pond-arf5s9do.neonauth.c-4.us-west-2.aws.neon.tech/cactigrow/auth`

The user confirms real production accounts can sign up, authenticate, restore their persistent CactiGrow state, and play Town together. The identity provider, internal player UUID resolver, live Worker, and multiplayer configuration are existing production services; Social V1 must use them without replacing or reconfiguring them.

The browser uses the official `@neondatabase/auth` React SDK with HttpOnly session cookies. Before API and realtime calls, it obtains a JWT from Neon's `/token` endpoint and sends it as a Bearer credential. CactiGrow does not store bearer tokens or self-selected player IDs in local storage.

The Worker verifies Neon JWT signatures using the configured branch JWKS and validates issuer, audience, subject, issued-at, expiry, token type, and a maximum 15-minute lifetime. Verified provider subjects map through `PostgresPlayerIdentityResolver` to durable internal CactiGrow UUIDs. Player-facing profile and relationship records use those internal UUIDs; public profile routes expose only opaque public profile IDs.

Realtime admission uses the verified JWT expiry with the existing ticket, AreaPresence, Layer, and reconnect fencing. Do not change these boundaries for profiles or chat. Upstream logout/revocation is not pushed to already-open sockets; issued JWTs remain valid until expiry.

## Configuration and Validation

The Neon endpoint is public configuration: `VITE_NEON_AUTH_URL` for the production build and `CACTIGROW_NEON_AUTH_URL` for the production Worker. No Neon management credential, database owner credential, or signing secret is required by the auth client.

The Social V1 change does not modify Neon Auth configuration, authentication routes, or identity resolution. It adds only the existing authenticated API routes and additive CactiGrow social tables documented in [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md).

Automated signed-token, API, browser-credential, and realtime admission tests cover the verification boundary. The current live acceptance state above is user-confirmed; those automated tests do not substitute for production account verification.