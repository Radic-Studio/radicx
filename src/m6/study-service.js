export function newOperationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

async function rpc(client, name, params = {}) {
  const { data, error } = await client.rpc(name, params);
  if (error) throw error;
  return data;
}

export async function listStudySubjects(client, programmeId) {
  const { data, error } = await client
    .from('subjects')
    .select('id,code,name,sort_order')
    .eq('programme_id', programmeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listStudyTopics(client, subjectId) {
  if (!subjectId) return [];
  const { data, error } = await client
    .from('topics')
    .select('id,subject_id,parent_topic_id,code,name,sort_order')
    .eq('subject_id', subjectId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function studyActiveSession(client) {
  return rpc(client, 'study_active_session');
}

export function studyStartSession(client, {
  kind,
  subjectId = null,
  topicId = null,
  questionCount = null,
  operationId
}) {
  return rpc(client, 'study_start_session', {
    p_study_kind: kind,
    p_subject_id: subjectId,
    p_topic_id: topicId,
    p_question_count: questionCount,
    p_operation_id: operationId
  });
}

export function studyResumeSession(client, sessionId, knownDeviceVersion) {
  return rpc(client, 'study_resume_session', {
    p_session_id: sessionId,
    p_known_device_version: knownDeviceVersion ?? null
  });
}

export function studySubmitAnswer(client, operation) {
  return rpc(client, 'study_submit_answer', {
    p_session_id: operation.sessionId,
    p_question_id: operation.questionId,
    p_selected_option: operation.selectedOption,
    p_confidence: operation.confidence,
    p_operation_id: operation.operationId,
    p_device_version: operation.deviceVersion
  });
}

export function studySetBookmark(client, operation) {
  return rpc(client, 'study_set_bookmark', {
    p_session_id: operation.sessionId,
    p_question_id: operation.questionId,
    p_is_bookmarked: operation.bookmarked,
    p_operation_id: operation.operationId,
    p_operation_sequence: operation.sequence,
    p_device_version: operation.deviceVersion
  });
}

export function studyReportQuestion(client, { sessionId, questionId, category, details = null }) {
  return rpc(client, 'study_report_question', {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_category: category,
    p_details: details
  });
}

export function studyCompleteSession(client, sessionId, deviceVersion) {
  return rpc(client, 'study_complete_session', {
    p_session_id: sessionId,
    p_device_version: deviceVersion
  });
}

export function isNetworkStudyError(error) {
  if (globalThis.navigator && globalThis.navigator.onLine === false) return true;
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request')
    || message.includes('load failed')
    || message.includes('fetch failed');
}

export function isStaleStudyError(error) {
  return String(error?.code ?? '') === '40001'
    || /newer device version|newer device|stale/i.test(String(error?.message ?? ''));
}

export function studyErrorMessage(error, context = 'study') {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  if (isNetworkStudyError(error)) return 'The network is unavailable. Your cached Study work is still on this device.';
  if (isStaleStudyError(error)) return 'This Study session changed on another device. Reload the latest session before sending more answers.';
  if (code === 'P0002') return message || 'No reviewed questions are available for this Study choice yet.';
  if (code === '42501') return 'This Study action is not allowed for the current session.';
  if (code === '23505') return 'That Study action was already saved. RadicX will keep the first accepted result.';
  if (code === '22023') return message || 'Please check the Study choice and try again.';
  if (code === '55000') return message || 'This Study session cannot perform that action right now.';
  if (context === 'start') return 'RadicX could not start this Study session. Please try again.';
  if (context === 'answer') return 'RadicX could not check this answer. It remains saved on this device if local storage is available.';
  if (context === 'bookmark') return 'RadicX could not sync this bookmark yet.';
  if (context === 'report') return 'RadicX could not send this report.';
  return 'RadicX could not complete that Study action.';
}
