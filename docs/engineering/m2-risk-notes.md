# M2 Risk Notes

Highest M2 risks are accidental answer-key exposure, cross-user RLS failure, staff-role escalation, future-table auto-exposure and migration drift. The implementation addresses these with private schemas, explicit grants, RLS tests, server-only staff authority, fail-closed default privileges and clean-reset CI.
