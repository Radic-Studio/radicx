# M2 Idempotency Foundation

`session_answers.operation_id` is globally unique, giving later local-first/outbox synchronization a database-level duplicate-write guard. Full outbox reconciliation belongs to M6/M8/M11.
