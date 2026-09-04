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

-- Synthetic-only question bank sized to exercise M6 Quick Practice 5/10/20 and Study selection.
insert into public.questions(id, revision_group_id, revision_number, subject_id, topic_id, source_id, status, stem, options, cognitive_level, clinical_task, random_bucket, published_at) values
('50000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy fixture: which option is marked as the correct development answer?', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',17,now()),
('50000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic labour fixture: choose the designated development answer.', '["Choice 1","Choice 2","Choice 3","Choice 4"]'::jsonb,'application','development_fixture',63,now()),
('50000000-0000-0000-0000-000000000003','51000000-0000-0000-0000-000000000003',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 3: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',62,now()),
('50000000-0000-0000-0000-000000000004','51000000-0000-0000-0000-000000000004',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 4: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',79,now()),
('50000000-0000-0000-0000-000000000005','51000000-0000-0000-0000-000000000005',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 5: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',96,now()),
('50000000-0000-0000-0000-000000000006','51000000-0000-0000-0000-000000000006',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 6: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',13,now()),
('50000000-0000-0000-0000-000000000007','51000000-0000-0000-0000-000000000007',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 7: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',30,now()),
('50000000-0000-0000-0000-000000000008','51000000-0000-0000-0000-000000000008',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 8: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',47,now()),
('50000000-0000-0000-0000-000000000009','51000000-0000-0000-0000-000000000009',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 9: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',64,now()),
('50000000-0000-0000-0000-000000000010','51000000-0000-0000-0000-000000000010',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 10: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',81,now()),
('50000000-0000-0000-0000-000000000011','51000000-0000-0000-0000-000000000011',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 11: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',98,now()),
('50000000-0000-0000-0000-000000000012','51000000-0000-0000-0000-000000000012',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 12: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',15,now()),
('50000000-0000-0000-0000-000000000013','51000000-0000-0000-0000-000000000013',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 13: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',32,now()),
('50000000-0000-0000-0000-000000000014','51000000-0000-0000-0000-000000000014',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 14: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',49,now()),
('50000000-0000-0000-0000-000000000015','51000000-0000-0000-0000-000000000015',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 15: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',66,now()),
('50000000-0000-0000-0000-000000000016','51000000-0000-0000-0000-000000000016',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 16: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',83,now()),
('50000000-0000-0000-0000-000000000017','51000000-0000-0000-0000-000000000017',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 17: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',0,now()),
('50000000-0000-0000-0000-000000000018','51000000-0000-0000-0000-000000000018',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 18: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',17,now()),
('50000000-0000-0000-0000-000000000019','51000000-0000-0000-0000-000000000019',1,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','published','Synthetic anatomy Study fixture 19: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'recall','development_fixture',34,now()),
('50000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000020',1,'20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','published','Synthetic midwifery Study fixture 20: choose the designated development answer.', '["Option A","Option B","Option C","Option D"]'::jsonb,'application','development_fixture',51,now())
on conflict (id) do nothing;

insert into private.question_keys(question_id, correct_option, explanation_private) values
('50000000-0000-0000-0000-000000000001',1,'Synthetic private explanation for automated development only.'),
('50000000-0000-0000-0000-000000000002',2,'Synthetic private explanation for automated development only.'),
('50000000-0000-0000-0000-000000000003',3,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000004',0,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000005',1,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000006',2,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000007',3,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000008',0,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000009',1,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000010',2,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000011',3,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000012',0,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000013',1,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000014',2,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000015',3,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000016',0,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000017',1,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000018',2,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000019',3,'Synthetic private explanation for automated M6 development only.'),
('50000000-0000-0000-0000-000000000020',0,'Synthetic private explanation for automated M6 development only.')
on conflict (question_id) do nothing;

-- M6 Study selection rechecks current rights eligibility. These are synthetic RadicX-original
-- development fixtures only, so the controlled seed marks the synthetic source as owned.
insert into private.question_source_governance(source_id, rights_status, rights_notes_private, reviewed_at)
values ('40000000-0000-0000-0000-000000000001','owned','Synthetic development fixture; not production clinical content.',now())
on conflict (source_id) do update
  set rights_status = excluded.rights_status,
      rights_notes_private = excluded.rights_notes_private,
      reviewed_at = excluded.reviewed_at,
      updated_at = now();

insert into private.question_governance(question_id)
select q.id from public.questions q
where q.source_id = '40000000-0000-0000-0000-000000000001'
on conflict (question_id) do nothing;
