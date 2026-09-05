begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'sessions'
      and indexname = 'sessions_study_subject_id_idx'
  ),
  'M6 covers the Study subject foreign key with an index'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'sessions'
      and indexname = 'sessions_study_topic_id_idx'
  ),
  'M6 covers the Study topic foreign key with an index'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'study_session_items'
      and indexname = 'study_session_items_session_user_idx'
  ),
  'M6 covers the composite Study manifest foreign key with an index'
);

select * from finish();
rollback;
