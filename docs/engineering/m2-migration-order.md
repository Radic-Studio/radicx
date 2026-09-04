# M2 Migration Order

1. `20260904030000_m2_core_schema.sql`
2. `20260904030100_m2_security_rls.sql`
3. `20260904030200_m2_integrity_indexes_storage.sql`
4. `20260904030300_m2_published_question_immutability.sql`

The order separates object creation, access control, integrity/performance/storage policy and published-content immutability for easier review and corrective migration planning.
