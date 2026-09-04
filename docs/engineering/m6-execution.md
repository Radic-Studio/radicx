# M6 Execution Record — Study Engine

Status: IN PROGRESS

Branch: `feat/m6-study-engine`

Accepted base: protected `staging` at `f3c0bb9fc2806562f929ece8dca0c0e130265c2e` (verified 2026-09-04 before branch creation).

## Objective

Deliver the real RadicX Study Engine only: safe question batches, Study session manifests, local answer selection, three-level confidence, authoritative server-side evaluation, feedback, bookmarks, reports, session completion/resume, and the first explicit IndexedDB/outbox working-state layer.

M6 follows the project operating principle: **SERVER AUTHORITATIVE + CLIENT IMMEDIATE**. The authenticated browser is untrusted and never receives bulk answer keys or private content-governance data.

## Accepted dependencies reviewed

- M5 acceptance is PASS and the protected staging head matches the accepted M5 baseline.
- M5 provides Supabase Auth/session restoration, protected student routing, completed onboarding/profile state, selected programme and existing-session discovery.
- M4 provides immutable question revisions, publication/quarantine governance, private answer keys, rights/review gates, and role-guarded content administration.
- M3 provides Student and Focus shells, design tokens, responsive reading width, sync-state language, accessible primitives and reduced-motion behavior.
- M2 provides `sessions`, `session_answers`, `bookmarks`, `question_reports`, `device_version`, private `question_keys`, RLS and browser-untrusted security boundaries.

No accepted-baseline defect was found that blocks M6. Existing plan-dependent leaked-password protection and low-traffic unused-index advisor notices remain outside M6.

## Planned architecture

### Study-session model

Use the existing `public.sessions` table for durable Study lifecycle and extend it minimally with M6 Study context/current-position fields. Add a dedicated `public.study_session_items` manifest table containing the authoritative ordered question set for each Study session. Each manifest row stores the exact `question_id` revision assigned plus a revision-number snapshot, position and availability state. The browser array is only a cache, never the authoritative manifest.

M6 Study kinds are: `study_for_me`, `subject`, `topic`, `quick`, and `bookmarks`. They all use `session_mode = study`; M6 does not introduce Exam behavior.

### Question selection

Question selection will use the existing `random_bucket` foundation plus indexed/range-ordered selection. `ORDER BY random()` is prohibited. Selection must remain within the student's selected active programme and must respect active subject/topic taxonomy, `published` status, current usable rights/publication eligibility and exact immutable revisions.

`Study for me` uses a documented non-adaptive balanced/general baseline. No weakness, mastery, diagnostic or recommendation data is consulted. Subject/Topic modes apply explicit curriculum filters. Quick Practice accepts only 5/10/20. Bookmark sessions use only the student's still-eligible bookmarked questions.

### Browser-safe question contract

Pre-submit Study package data is limited to fields required to render the session: session ID/version/context, manifest position, exact question/revision ID, revision number, stem, options, subject/topic identifiers/names, safe progress metadata and bookmark state.

It excludes correct option, `private.question_keys`, private explanations before submission, rights/reviewer notes, source-governance internals, content fingerprints, staff metadata, audit data and unpublished/quarantined/archived content.

Direct authenticated whole-row access to `public.questions` will be removed for students if required so that safe fields are enforced at the database/RPC boundary rather than hidden in JavaScript.

### Secure answer evaluation

A `SECURITY DEFINER` Study answer RPC will:

1. require `auth.uid()`;
2. validate Study session ownership/status and `device_version`;
3. validate manifest membership and exact assigned question revision;
4. reject currently unavailable/quarantined items safely;
5. validate the submitted option against the assigned option count;
6. validate confidence (`Guessing`, `Unsure`, `Confident` mapped to the approved stored values);
7. enforce one final committed answer per session/question;
8. use `operation_id` for idempotent replay;
9. read `private.question_keys` only inside trusted database logic;
10. derive/store correctness and evaluation time server-side;
11. return only the individual answered-question result and legitimate post-submit explanation/correct-option feedback.

Direct authenticated insert/update/delete paths that would allow rewriting committed answers or forging correctness will be revoked/tightened.

### Revision/quarantine integrity

Manifest rows reference immutable question revision IDs. Historical answers remain tied to that exact revision. Newly quarantined/restricted questions are never assigned. If an already-assigned unanswered item becomes ineligible, authoritative Study operations mark/return it as unavailable and the client skips it without rewriting historical answered results.

## IndexedDB design

Database name: `radicx-study` (versioned explicitly).

Logical stores:

- `question_cache`: browser-safe Study packages keyed by session/question.
- `active_sessions`: local current position, device version, evaluated/pending item states and last local activity.
- `answer_outbox`: durable pending answer operations with stable UUID operation IDs.
- `bookmark_outbox`: durable desired bookmark operations with stable operation IDs and local sequence ordering.
- `app_meta`: schema/sync metadata only.

No answer bank, private explanation source, staff/admin data, service credentials or another user's data is stored.

## Synchronization / outbox design

Online answer submission attempts the authoritative RPC immediately. A network/offline failure persists the operation in `answer_outbox` before allowing the workflow to continue. Pending operations survive reload/reopen and replay in stable order. Server idempotency prevents duplicate answer creation.

Bookmark/unbookmark is optimistic. Each queued desired-state operation has a stable operation ID and per-question local ordering value; reconciliation applies the newest desired state and collapses superseded local operations.

Sync triggers: app launch after authenticated restoration, browser `online`, visibility resume, successful writes, explicit retry, and before final completion. Background Sync is not required.

## Offline behavior

M6 is working-state continuation, not M11 PWA hardening. An already-cached Study package remains readable and navigable while offline. Selections/confidence and bookmark changes persist locally. Final answer operations can be queued.

Correctness and explanations are never generated offline. The UI uses truthful copy such as: “Answer saved on this device. We’ll check it when you’re back online.” Server feedback appears only after successful replay/evaluation.

A session cannot be truthfully finalized while authoritative answers remain pending.

## Multi-device / stale-state protection

Study mutations carry the session `device_version`. The server rejects stale versions rather than overwriting accepted answers/session position. Accepted server answers always win during reconciliation. M6 does not add realtime collaboration or device takeover orchestration.

## Performance plan

- Preselect/cache 10–20 questions for ordinary Study; Quick uses 5/10/20 exactly.
- Avoid request-per-Next navigation; cached Next transitions are local.
- Keep pre-submit payloads minimal and answer-key-free.
- Add indexes aligned to eligible question selection and manifest/session access.
- Measure Study Home, session creation/batch request, cached Next, answer submission/feedback and resume on Deploy Preview/staging.
- Preserve current bundle budget and avoid new UI/runtime libraries.

Targets remain: controllable button response <100–150ms, cached question navigation <100ms perceived, normal API p75 <500ms and p95 <1s target, useful Study surface around <=1s after cached shell where controllable.

## Security implications

M6 intentionally tightens browser mutation grants around Study sessions/answers and routes correctness through trusted database logic. No service-role key or server secret is added to browser code. M2/M4 private schema and RLS protections remain intact.

An explicit answer-key leak inspection is a mandatory acceptance gate covering HTML, JS/build output, batch responses, IndexedDB, Web Storage, environment/config output and public source maps.

## Tests planned

### Database / pgTAP

- safe batch excludes key/private fields;
- unpublished/quarantined/restricted content cannot be newly assigned;
- direct private answer-key read remains denied;
- cross-user session/manifest/answer access denied;
- session kind/status/manifest membership/revision validated;
- invalid option/confidence rejected;
- client cannot set correctness/evaluation fields;
- duplicate operation ID is idempotent;
- second final answer cannot brute-force correctness;
- stale device version rejected;
- bookmark/report ownership and Study validation;
- M2/M4 private/admin regressions remain intact.

### Application

- Study Home/mode routing;
- Subject/Topic/Quick selection state;
- question selection/confidence state machine;
- submit/feedback/Next/completion/resume;
- optimistic bookmark and report flow;
- IndexedDB persistence;
- offline queue/replay/idempotent retry;
- stale-session/error states;
- truthful completion summary;
- M1–M5 regression, accessibility smoke, production build and bundle budget.

### Hosted

Synthetic authenticated student/content path on Netlify Deploy Preview + RadicX Staging Supabase, including offline interruption/reconnect and explicit network inspection for answer-key leakage.

## Exclusions

M6 does **not** implement M7 diagnostic/mastery/weakness/adaptive/spaced-review logic, M8 Mock Exam/timer, M9 readiness/Momentum/streak/missions/achievements, M10 commerce, M11 full PWA/service-worker hardening, CAT, AI Tutor or runtime AI explanations.

Weak Areas may appear only as an unavailable placeholder and may not fabricate learner weakness data.

## Acceptance criteria

M6 is accepted only after the complete user-provided M6 acceptance gate passes, including clean migrations/pgTAP, application and Database CI, Deploy Preview, hosted Study validation, offline cached continuation/outbox, answer-key leak inspection, responsive/accessibility validation, performance baseline, Security/Performance Advisor review, protected staging merge and post-merge regression.

Until then status remains **IN PROGRESS**.
