alter table public.profiles
  add column programme_id uuid references public.programmes(id) on delete restrict,
  add column expected_exam_date date,
  add column daily_study_minutes smallint,
  add column onboarding_status text not null default 'not_started',
  add column onboarding_current_step smallint not null default 1,
  add column onboarding_version smallint not null default 1,
  add column onboarding_completed_at timestamptz,
  add column diagnostic_invitation_decision text,
  add column diagnostic_invitation_decided_at timestamptz;

alter table public.profiles
  add constraint profiles_daily_study_minutes_ck
    check (daily_study_minutes is null or daily_study_minutes in (10, 20, 30, 45, 60)),
  add constraint profiles_onboarding_status_ck
    check (onboarding_status in ('not_started', 'in_progress', 'completed')),
  add constraint profiles_onboarding_step_ck
    check (onboarding_current_step between 1 and 4),
  add constraint profiles_onboarding_version_ck
    check (onboarding_version = 1),
  add constraint profiles_diagnostic_decision_ck
    check (diagnostic_invitation_decision is null or diagnostic_invitation_decision in ('start', 'skip')),
  add constraint profiles_diagnostic_timestamp_ck
    check ((diagnostic_invitation_decision is null) = (diagnostic_invitation_decided_at is null)),
  add constraint profiles_not_started_step_ck
    check (onboarding_status <> 'not_started' or onboarding_current_step = 1),
  add constraint profiles_onboarding_programme_progress_ck
    check (onboarding_current_step = 1 or programme_id is not null),
  add constraint profiles_onboarding_exam_progress_ck
    check (onboarding_current_step < 3 or expected_exam_date is not null),
  add constraint profiles_onboarding_study_progress_ck
    check (onboarding_current_step < 4 or daily_study_minutes is not null),
  add constraint profiles_onboarding_completion_ck
    check (
      (
        onboarding_status = 'completed'
        and onboarding_current_step = 4
        and programme_id is not null
        and expected_exam_date is not null
        and daily_study_minutes is not null
        and diagnostic_invitation_decision is not null
        and diagnostic_invitation_decided_at is not null
        and onboarding_completed_at is not null
      )
      or
      (onboarding_status <> 'completed' and onboarding_completed_at is null)
    );

create index profiles_programme_idx on public.profiles(programme_id) where programme_id is not null;

create or replace function private.apply_profile_onboarding_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.onboarding_version <> 1 then
    raise check_violation using message = 'unsupported onboarding version';
  end if;

  if new.diagnostic_invitation_decision is distinct from old.diagnostic_invitation_decision then
    if new.diagnostic_invitation_decision is null then
      new.diagnostic_invitation_decided_at := null;
    else
      new.diagnostic_invitation_decided_at := now();
    end if;
  else
    new.diagnostic_invitation_decided_at := old.diagnostic_invitation_decided_at;
  end if;

  if new.onboarding_status = 'completed' and old.onboarding_status <> 'completed' then
    new.onboarding_completed_at := now();
  elsif new.onboarding_status <> 'completed' then
    new.onboarding_completed_at := null;
  else
    new.onboarding_completed_at := old.onboarding_completed_at;
  end if;

  if new.programme_id is not null
     and (
       new.programme_id is distinct from old.programme_id
       or (new.onboarding_status = 'completed' and old.onboarding_status <> 'completed')
     )
     and not exists (
       select 1
       from public.programmes p
       where p.id = new.programme_id
         and p.is_active
     ) then
    raise check_violation using message = 'selected programme must be active';
  end if;

  return new;
end;
$$;

revoke execute on function private.apply_profile_onboarding_guard() from public, anon, authenticated;

drop trigger if exists profiles_apply_onboarding_guard on public.profiles;
create trigger profiles_apply_onboarding_guard
before update on public.profiles
for each row execute function private.apply_profile_onboarding_guard();

grant update(
  display_name,
  programme_id,
  expected_exam_date,
  daily_study_minutes,
  onboarding_status,
  onboarding_current_step,
  diagnostic_invitation_decision
) on public.profiles to authenticated;

revoke update(
  user_id,
  created_at,
  updated_at,
  onboarding_version,
  onboarding_completed_at,
  diagnostic_invitation_decided_at
) on public.profiles from authenticated;
