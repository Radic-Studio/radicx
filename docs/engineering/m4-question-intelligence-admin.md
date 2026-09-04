# M4 — Question Intelligence & Admin

## Scope

Milestone M4 implements the RadicX V1 question-intelligence and content-governance foundation defined by the controlled project brief. It does not introduce M5 authentication/onboarding or any Study, Review, Mock Exam, Readiness, commerce or offline/PWA business logic.

The server/database remains authoritative for publication, review state, revisioning, quarantine, import promotion and all private answer-bearing data.

## Classification model

M4 implements the four-dimensional classification model:

`CURRICULUM DOMAIN × TOPIC/SUBTOPIC × COGNITIVE LEVEL × CLINICAL TASK`

Programme, subject and topic structures were established in M2. M4 adds managed cognitive-level and clinical-task lookup tables and constrains question classifications to active taxonomy terms.

The migration carries forward only the synthetic M2 development fixture terms required to validate existing seed data. It does not invent unofficial NMCN weightings or production clinical taxonomy values.

## Source governance

The public `question_sources` record remains separate from restricted governance details. Private source governance tracks:

- provenance confidence;
- rights status;
- private rights notes;
- private evidence references;
- private licence references;
- review actor/date and next review date.

Supported source classes remain:

- Verified Past Question;
- Reported Past Question;
- Licensed Question;
- RadicX Original;
- RadicX Clinical Scenario;
- AI-Assisted Draft.

A past-question claim never acts as a substitute for rights, clinical validity or item quality.

## Question quality and publication workflow

The controlled publication sequence is:

`CAPTURE → AUTHOR/TRANSCRIBE → DUPLICATE CHECK → RIGHTS CHECK → CLINICAL REVIEW → ITEM REVIEW → APPROVE → PUBLISH → LIVE ANALYSIS`

Question drafts are created through role-guarded RPCs. Publication requires all of the following server-side conditions:

1. the question is in `review` state;
2. the source has a usable rights status;
3. the latest rights review is approved;
4. the latest standard clinical review is approved;
5. the latest item review is approved;
6. high-risk content has an enhanced clinical approval;
7. cognitive-level and clinical-task terms are active;
8. a valid private answer key exists for the option set.

The browser receives only boolean gate status, not the answer key itself.

## Staff authorization

All M4 administrative mutations require:

- an authenticated Supabase user;
- `aal2` in the session JWT;
- a staff role stored in `private.staff_roles`.

Role mapping:

- Content Editor: create/edit draft content, set draft/review keys, submit for review, imports, revisions;
- Clinical Reviewer: clinical review decisions;
- Item Reviewer: item-writing review decisions;
- Content Admin: taxonomy, sources/rights, rights review, publication and quarantine.

Forged user metadata is ignored because authorization is derived from the private role table.

## Answer-key isolation

`private.question_keys` remains the only stored answer-key boundary. M4 RPCs may accept a correct option while an authorized editor is authoring or correcting a draft, but no listing, gate-status or admin-view RPC returns stored answer keys or private explanations.

Direct browser access to `private.question_keys` and all new private governance/import tables remains revoked and protected by RLS.

## Revisioning and quarantine

Published, quarantined and archived revisions remain immutable. M4 extends the M2 immutability trigger to include new governance-sensitive question fields such as risk tier and content fingerprint.

Corrections use `admin_create_question_revision`, which:

- creates the next revision number inside the same revision group;
- records the exact superseded revision;
- creates a new `draft` row;
- copies the private key and governance values internally without exposing them to the browser.

Problematic live questions use quarantine rather than deletion. Quarantine reason and actor are written to the private audit log.

## Import staging

The structured import pipeline is:

`UPLOAD → PARSE → MAP → VALIDATE → PREVIEW → DEDUPE → STAGING → REVIEW → DRAFT`

M4 provides:

- private `admin-uploads` Storage access for AAL2 content staff under their own user-ID prefix;
- private source-evidence Storage access for AAL2 Content Admins under their own user-ID prefix;
- idempotent batch fingerprints based on source, file SHA-256 and canonical mapping;
- row-level validation and deterministic content fingerprints;
- duplicate detection against the existing question bank and the current batch;
- promotion from valid staged row to `draft` only.

Import rows never publish directly.

## Audit trail

Content-critical actions are written to `private.content_audit_log` with actor, action, entity type, entity ID, structured details and timestamp. Browser roles have no direct table access.

## Admin surface

`public/admin.html` is upgraded from the M3 placeholder into the M4 content-governance workspace. It exposes the real taxonomy, publication, provenance, import, revision, quarantine and audit model without displaying fabricated production data or private answer keys.

The M4 page intentionally does not add M5 student authentication/onboarding behavior. Server RPCs are already prepared for authenticated AAL2 staff sessions.

## Primary database objects

Public:

- `cognitive_levels`
- `clinical_tasks`
- `questions.risk_tier`
- `questions.content_fingerprint`
- role-guarded `admin_*` RPC contracts

Private:

- `question_source_governance`
- `question_governance`
- `question_reviews`
- `import_batches`
- `import_rows`
- `content_audit_log`

## Testing

M4 adds pgTAP coverage for:

- taxonomy and private governance schema;
- AAL2 and private-role authorization;
- publication-gate blocking and success;
- role-specific rights/clinical/item review;
- answer-key isolation;
- published-content immutability;
- revision creation;
- quarantine;
- idempotent import staging and duplicate detection;
- draft-only import promotion;
- staff-scoped private Storage policies;
- audit-log creation.

Node tests cover the controlled workflow definitions, source classes, quality dimensions, safe admin question views, import preflight behavior, server-gate summarization and M2/M3 regression presence.
