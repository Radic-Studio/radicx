create or replace function private.protect_published_question_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('published','quarantined','archived') then
      raise exception 'published question revisions cannot be deleted';
    end if;
    return old;
  end if;

  if old.status in ('published','quarantined','archived') then
    if row(
      new.id,
      new.revision_group_id,
      new.revision_number,
      new.supersedes_question_id,
      new.subject_id,
      new.topic_id,
      new.source_id,
      new.stem,
      new.options,
      new.cognitive_level,
      new.clinical_task,
      new.random_bucket,
      new.published_at,
      new.created_at
    ) is distinct from row(
      old.id,
      old.revision_group_id,
      old.revision_number,
      old.supersedes_question_id,
      old.subject_id,
      old.topic_id,
      old.source_id,
      old.stem,
      old.options,
      old.cognitive_level,
      old.clinical_task,
      old.random_bucket,
      old.published_at,
      old.created_at
    ) then
      raise exception 'published question content is immutable; create a new revision instead';
    end if;

    if new.status not in ('published','quarantined','archived') then
      raise exception 'published question status may only remain published or move to quarantined/archived';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_published_question_update
before update on public.questions
for each row execute function private.protect_published_question_revision();

create trigger protect_published_question_delete
before delete on public.questions
for each row execute function private.protect_published_question_revision();

revoke execute on function private.protect_published_question_revision() from public, anon, authenticated;
