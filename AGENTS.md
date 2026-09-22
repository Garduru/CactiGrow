# CactiGrow Agent Instructions

Read `PROJECT_CONTEXT.md` completely before making changes in this repository.

Treat `PROJECT_CONTEXT.md` as the authoritative source for:
- current architecture
- product direction
- implemented systems
- locked/human-approved work
- game rules and constants
- server authority boundaries
- staging/deployment state
- CactiSwap/Base44 integration boundaries

Do not contradict or casually reinterpret `PROJECT_CONTEXT.md`.

## Instruction priority

For repository work, follow this order:

1. Explicit instructions from the user for the current task
2. This `AGENTS.md`
3. `PROJECT_CONTEXT.md`
4. Existing repository architecture and conventions

If instructions conflict in a way that could materially change architecture, game behavior, persistent data, security, economy, or locked human-approved work, stop and ask before proceeding.

## Before editing

Before making changes:

1. Read `PROJECT_CONTEXT.md`.
2. Inspect the relevant existing code.
3. Inspect relevant documentation or asset contracts referenced by the affected system.
4. Understand the existing architecture and data flow.
5. Check the current git working tree and preserve existing user changes.

Do not begin by rewriting or redesigning a system simply because another implementation appears cleaner.

## Scope discipline

Make the smallest coherent change that completes the requested task.

Do not:
- perform unrelated cleanup
- refactor unrelated systems
- redesign architecture unless required
- change visual design unless requested
- alter gameplay values unless requested
- remove working functionality
- replace existing patterns without a concrete reason

When asked only to investigate, audit, review, explain, or plan:
DO NOT modify files.

## CactiGrow independence

CactiGrow is an independent application.

Do not build core CactiGrow systems on Base44.

CactiSwap/Base44 may integrate only through the replaceable boundaries described in `PROJECT_CONTEXT.md`.

Do not scatter Base44-specific code through:
- gameplay
- React UI
- domain logic
- persistence
- genetics
- breeding
- growth
- inventory
- progression
- Farm/Nursery/Garden systems

Core CactiGrow systems must remain independently operable and testable.

## Architecture

Preserve separation between:
- domain/game logic
- React UI
- Phaser rendering/world presentation
- API/server application logic
- persistence/database
- authentication
- external integrations

React and Phaser must consume appropriate projections rather than becoming authoritative owners of persistent gameplay truth.

Do not bypass existing services, repositories, ports, adapters, or server-authority boundaries for convenience.

Preserve the existing authenticated player/bootstrap architecture unless the task explicitly requires changing it.

## Locked and human-approved work

Anything marked in `PROJECT_CONTEXT.md` or an associated contract as:
- HUMAN APPROVED
- HUMAN VISUALLY APPROVED
- LOCKED
- LOCKED SOURCE ART
- LOCKED IMPLEMENTATION BASELINE

must not be casually changed.

Do not retune locked:
- artwork
- sprite registration
- scale
- anchors
- collision
- navigation points
- visual composition
- approved gameplay behavior

unless the user explicitly requests a revision or a demonstrated defect requires it.

## Game correctness

Do not silently alter established:
- XP curves
- progression
- genetics rules
- inheritance
- mutation probabilities
- Shiny odds
- growth timing
- seed behavior
- building levels
- capacity
- currency values
- marketplace/economy rules
- research milestones
- server-authoritative outcomes

Random outcomes that are established once must not be rerolled during later lifecycle operations.

If requested work appears to conflict with a documented game rule, identify the conflict before changing behavior.

## Network efficiency

Avoid unnecessary API requests.

Watch for:
- duplicate requests
- React effect loops
- excessive refetching
- mutation-triggered request storms
- duplicate listeners
- unnecessary polling
- repeated bootstrap requests

Prefer appropriate:
- local state
- shared state
- caching
- batching
- targeted invalidation
- optimistic updates when safe

Do not sacrifice authority or correctness merely to reduce requests.

## Database and persistent data safety

Do not casually change:
- database schema
- migrations
- indexes
- persistence formats
- player initialization
- authority boundaries

Never:
- wipe player data
- reset staging data
- drop tables
- truncate tables
- destroy migrations
- modify existing player records destructively

without explicit user approval.

Before a schema change:
1. inspect existing schema and migrations
2. identify compatibility impact
3. preserve existing player data
4. explain why the migration is required

## Staging and deployment safety

Do not deploy, publish, cut over DNS, change production infrastructure, or perform a production migration unless explicitly instructed.

Treat the staging/development/production boundaries in `PROJECT_CONTEXT.md` as authoritative.

Never assume staging approval means production approval.

## Git safety

Do not automatically:
- commit
- push
- force push
- reset --hard
- clean the repository destructively
- delete branches
- rewrite history
- discard user changes

Do not overwrite unrelated uncommitted work.

Commit or push only when explicitly instructed.

## Dependencies

Do not add major dependencies without a clear need.

Before adding a dependency:
1. inspect existing dependencies
2. confirm the capability is not already present
3. explain why it is needed
4. prefer maintained and established packages

Do not replace major frameworks, database layers, authentication systems, or core libraries unless explicitly instructed.

## Security

Never expose or commit:
- secrets
- API keys
- tokens
- credentials
- private environment variables
- database credentials

Treat client input as untrusted.

Economy-sensitive, ownership-sensitive, progression-sensitive, authentication-sensitive, and cheat-sensitive actions must remain server authoritative where the current architecture requires it.

## Verification

After meaningful edits, follow the validation requirements in `PROJECT_CONTEXT.md`.

At minimum, when applicable:

- `npm run build`
- `npm run lint`
- relevant targeted tests

Run additional checks appropriate to the affected system.

If a check fails:
- determine whether the current work caused it
- fix failures introduced by the current task
- report unrelated existing failures separately

Never claim something was verified if it was not.

## Working style

For substantial implementation tasks:

1. Inspect relevant code and documentation.
2. Give a short implementation plan.
3. Make targeted changes.
4. Run relevant verification.
5. Report:
   - what changed
   - files changed
   - checks/tests run
   - remaining concerns

Keep narration concise.

If significant ambiguity could affect architecture, persistent data, security, economy, or locked work, ask before making that decision.

## Repository discovery

Never guess repository file paths, symbols, modules, or implementations.

If a referenced file or path does not exist:
1. Use glob/search to locate the actual implementation.
2. Read the matching source before describing its behavior.
3. If it still cannot be found, state that it was not found.

Do not describe nonexistent files as "implied by the architecture."
Do not infer implementation details from filenames or general framework conventions when the actual source can be inspected.

When asked to inspect a system, prefer repository search over guessing conventional paths.

## Completion discipline

Do not declare a repository investigation complete until every explicitly requested source or subsystem has either:

1. been located and read, or
2. been explicitly reported as not found after repository search.

If the task requests both client and server implementation, do not stop after finding only one side.

For architecture investigations, every claimed implementation detail should be tied to a source file that was actually inspected during the task.

Do not substitute shared API types, tests, or client behavior for inspection of the requested server implementation when the server implementation exists.

## Evidence requirements

For repository investigations, never state that a source file, function, class, route, or implementation was verified unless it was actually located and read during the current investigation.

When reporting architecture, distinguish clearly between:
- verified from source
- documented in PROJECT_CONTEXT.md
- inference

Do not present inference as verified implementation.

When the user requests verified source paths, every reported implementation path must correspond to a successful source read.

Do not conflate related architectural responsibilities. For example, identity resolution, player repositories, bootstrap projection, gameplay repositories, and API routing are separate layers unless the source explicitly combines them.