insert into public.programmes(id, code, name) values
('10000000-0000-0000-0000-000000000001','MIDWIFERY','NMCN Midwifery CBT Preparation')
on conflict (id) do nothing;

insert into public.subjects(id, programme_id, code, name, sort_order) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','ANP','Applied Anatomy and Physiology',1),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','NORM-MID','Normal Midwifery',2)
on conflict (id) do nothing;

insert into public.topics(id, subject_id, parent_topic_id, code, name, sort_order) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',null,'REPRO','Reproductive System',1),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PELVIS','Pelvic Anatomy',1),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',null,'LABOUR','Normal Labour',1)
on conflict (id) do nothing;

insert into public.question_sources(id, source_class, label, public_reference) values
('40000000-0000-0000-0000-000000000001','radicx_original','Synthetic M2 development source','Synthetic fixture only')
on conflict (id) do nothing;

insert into public.questions(id, revision_group_id, revision_number, subject_id, topic_id, source_id, status, stem, options, cognitive_level, clinical_task, random_bucket, published_at) values
('50000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy fixture: which option is marked as the correct development answer?', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',17,now()),
('50000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic labour fixture: choose the designated development answer.', '["Choice 1","Choice 2","Choice 3","Choice 4"]'::jsonb,'application','development_fixture',63,now())
on conflict (id) do nothing;

insert into private.question_keys(question_id, correct_option, explanation_private) values
('50000000-0000-0000-0000-000000000001',1,'Synthetic private explanation for automated development only.'),
('50000000-0000-0000-0000-000000000002',2,'Synthetic private explanation for automated development only.')
on conflict (question_id) do nothing;
