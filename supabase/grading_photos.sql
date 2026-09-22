-- 拍照批改：每张照片一行报告，关联到 homework_reports
-- 用法：在 Supabase 后台 SQL Editor 整段执行，可重复执行

alter table homework_reports add column if not exists plan_id uuid references homework_plans(id) on delete set null;
alter table homework_reports add column if not exists total_questions int;
alter table homework_reports add column if not exists correct_count int;
alter table homework_reports add column if not exists wrong_count int;
alter table homework_reports add column if not exists blank_count int;
alter table homework_reports add column if not exists weak_points text;
alter table homework_reports add column if not exists overall_advice text;
alter table homework_reports add column if not exists photo_count int;

create table if not exists homework_report_photos (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references homework_reports(id) on delete cascade,
  page_number  int not null default 1,
  image_data   text not null,
  ai_result    jsonb,
  question_count int,
  correct_count int,
  wrong_count  int,
  blank_count  int,
  created_at   timestamptz not null default now()
);

create index if not exists idx_report_photos_report on homework_report_photos (report_id, page_number);

alter table homework_report_photos enable row level security;

drop policy if exists teachers_read_all  on homework_report_photos;
drop policy if exists teachers_write_all on homework_report_photos;

create policy teachers_read_all on homework_report_photos
  for select to authenticated using (true);
create policy teachers_write_all on homework_report_photos
  for all to authenticated using (true) with check (true);