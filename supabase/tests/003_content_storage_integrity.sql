begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.capture_sqlstate(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlstate;
end;
$$;

select is((select public from storage.buckets where id='question-media'), false, 'question-media bucket is private');
select is((select public from storage.buckets where id='source-evidence'), false, 'source-evidence bucket is private');
select is((select public from storage.buckets where id='admin-uploads'), false, 'admin-uploads bucket is private');

select is(pg_temp.capture_sqlstate($q$update public.questions set stem='mutated' where id='50000000-0000-0000-0000-000000000001'$q$), 'P0001', 'published question content cannot be mutated');
select is(pg_temp.capture_sqlstate($q$delete from public.questions where id='50000000-0000-0000-0000-000000000001'$q$), 'P0001', 'published question revision cannot be deleted');

select is(pg_temp.capture_sqlstate($q$insert into public.topics(id,subject_id,parent_topic_id,code,name) values ('30000000-0000-0000-0000-000000000099','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','BAD-PARENT','Invalid cross-subject child')$q$), '23503', 'topic parent must belong to the same subject');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}', true);
select is(pg_temp.capture_sqlstate('select * from public.question_sources'), '42501', 'question source records are not browser-queryable in M2');
select is(pg_temp.capture_sqlstate($q$insert into storage.objects(bucket_id,name) values ('admin-uploads','forbidden.txt')$q$), '42501', 'students cannot upload protected administrative objects');

select * from finish();
rollback;
