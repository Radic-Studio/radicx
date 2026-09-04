-- Close PostgreSQL's default PUBLIC EXECUTE grant on security-definer admin RPCs.
-- Authenticated access remains explicitly granted by the preceding M4 migrations;
-- authorization is still enforced inside each RPC by private.require_staff() and AAL2.

revoke execute on function public.is_content_staff() from public, anon;
revoke execute on function public.is_content_admin() from public, anon;
revoke execute on function public.admin_upsert_taxonomy_term(text, text, text, text, integer) from public, anon;
revoke execute on function public.admin_create_source(text, text, text, integer, text, text, text, text) from public, anon;
revoke execute on function public.admin_create_question(uuid, uuid, uuid, text, jsonb, text, text, public.question_risk_tier, integer, text) from public, anon;
revoke execute on function public.admin_set_question_key(uuid, integer, text) from public, anon;
revoke execute on function public.admin_submit_question_for_review(uuid) from public, anon;
revoke execute on function public.admin_record_question_review(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.admin_question_gate_status(uuid) from public, anon;
revoke execute on function public.admin_publish_question(uuid) from public, anon;
revoke execute on function public.admin_create_question_revision(uuid) from public, anon;
revoke execute on function public.admin_quarantine_question(uuid, text) from public, anon;
revoke execute on function public.admin_create_import_batch(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.admin_stage_import_row(uuid, integer, jsonb) from public, anon;
revoke execute on function public.admin_promote_import_row_to_draft(uuid) from public, anon;
revoke execute on function public.admin_list_questions(public.question_status, integer) from public, anon;
