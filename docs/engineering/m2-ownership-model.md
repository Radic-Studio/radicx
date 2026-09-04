# M2 Ownership Model

Student-owned RLS uses `auth.uid()` matched to `user_id`. Client-supplied ownership values are accepted only when they equal the authenticated user. Cross-user reads and writes are denied by policy and verified with separate synthetic Student A and Student B identities.
