-- 学生每日共享备注：核心策略 + 今日预计规划
-- 唯一键 (student_id, plan_date)：同一学生同一天只有一份备注
-- 用法：在 Supabase 后台 SQL Editor 整段执行，可重复执行

create table if not exists student_daily_notes (
  student_id     uuid not null references students(id) on delete cascade,
  plan_date      date not null,
  core_strategy  text,
  today_plan     text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (student_id, plan_date)
);

create index if not exists idx_daily_notes_student_date
  on student_daily_notes (student_id, plan_date desc);

alter table student_daily_notes enable row level security;

drop policy if exists teachers_read_all    on student_daily_notes;
drop policy if exists teachers_insert_all  on student_daily_notes;
drop policy if exists teachers_update_all  on student_daily_notes;
drop policy if exists teachers_delete_all  on student_daily_notes;

create policy teachers_read_all   on student_daily_notes for select to authenticated using (true);
create policy teachers_insert_all on student_daily_notes for insert to authenticated with check (true);
create policy teachers_update_all on student_daily_notes for update to authenticated using (true) with check (true);
create policy teachers_delete_all on student_daily_notes for delete to authenticated using (true);