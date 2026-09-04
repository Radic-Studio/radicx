const profileColumns = [
  'user_id',
  'display_name',
  'programme_id',
  'expected_exam_date',
  'daily_study_minutes',
  'onboarding_status',
  'onboarding_current_step',
  'onboarding_version',
  'onboarding_completed_at',
  'diagnostic_invitation_decision',
  'diagnostic_invitation_decided_at',
  'updated_at'
].join(',');

export async function getOwnProfile(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select(profileColumns)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateOwnProfile(client, userId, patch) {
  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select(profileColumns)
    .single();

  if (error) throw error;
  return data;
}

export async function listActiveProgrammes(client) {
  const { data, error } = await client
    .from('programmes')
    .select('id,code,name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getProgramme(client, programmeId) {
  if (!programmeId) return null;
  const { data, error } = await client
    .from('programmes')
    .select('id,code,name')
    .eq('id', programmeId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function discoverResumableSession(client) {
  const { data, error } = await client
    .from('sessions')
    .select('id,mode,status,current_question_id,started_at,last_activity_at')
    .in('status', ['created', 'active'])
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
