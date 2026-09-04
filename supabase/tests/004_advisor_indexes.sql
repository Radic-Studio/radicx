begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(to_regclass('private.staff_roles_granted_by_idx') is not null, 'staff role grantor index exists');
select ok(to_regclass('public.bookmarks_question_idx') is not null, 'bookmark question index exists');
select ok(to_regclass('public.questions_source_idx') is not null, 'question source index exists');
select ok(to_regclass('public.questions_supersedes_idx') is not null, 'question supersedes index exists');
select ok(to_regclass('public.questions_topic_subject_fk_idx') is not null, 'question topic/subject FK index exists');
select ok(to_regclass('public.session_answers_question_idx') is not null, 'session answer question index exists');
select ok(to_regclass('public.session_answers_session_user_idx') is not null, 'session answer session/user index exists');
select ok(to_regclass('public.session_answers_user_idx') is not null, 'session answer user index exists');
select ok(to_regclass('public.sessions_current_question_idx') is not null, 'session current question index exists');
select ok(to_regclass('public.topics_parent_subject_fk_idx') is not null, 'topic parent/subject FK index exists');
select ok(to_regclass('public.user_question_state_question_idx') is not null, 'question state question index exists');
select ok(to_regclass('public.user_subject_stats_subject_idx') is not null, 'subject stats subject index exists');
select ok(to_regclass('public.user_topic_stats_topic_idx') is not null, 'topic stats topic index exists');

select * from finish();
rollback;
