-- Defense in depth for sensitive private-schema tables.
-- Browser roles already have no schema/table privileges; RLS adds a fail-closed layer
-- if future grants or API exposure are ever misconfigured.
alter table private.question_keys enable row level security;
alter table private.staff_roles enable row level security;
