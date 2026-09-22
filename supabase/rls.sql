-- 教培工作台 RLS 策略
-- 业务模型：全体老师共享同一份学生档案，不做按用户隔离
-- 安全边界：只有「已登录老师」可读写；未登录（anon）一律拒绝
-- 用法：在 Supabase 后台 SQL Editor 中整段执行（可重复执行）

-- 1. 开启行级安全
alter table students         enable row level security;
alter table subjects         enable row level security;
alter table homework_plans   enable row level security;
alter table homework_reports enable row level security;
alter table daily_summaries  enable row level security;

-- 2. 清理旧策略，保证脚本可重复执行
drop policy if exists teachers_read_all  on students;
drop policy if exists teachers_write_all on students;
drop policy if exists teachers_read_all  on subjects;
drop policy if exists teachers_write_all on subjects;
drop policy if exists teachers_read_all  on homework_plans;
drop policy if exists teachers_write_all on homework_plans;
drop policy if exists teachers_read_all  on homework_reports;
drop policy if exists teachers_write_all on homework_reports;
drop policy if exists teachers_read_all  on daily_summaries;
drop policy if exists teachers_write_all on daily_summaries;

-- 3. students：登录可读全部 / 可增删改
create policy teachers_read_all on students
  for select to authenticated using (true);
create policy teachers_write_all on students
  for all to authenticated using (true) with check (true);

-- 4. subjects
create policy teachers_read_all on subjects
  for select to authenticated using (true);
create policy teachers_write_all on subjects
  for all to authenticated using (true) with check (true);

-- 5. homework_plans
create policy teachers_read_all on homework_plans
  for select to authenticated using (true);
create policy teachers_write_all on homework_plans
  for all to authenticated using (true) with check (true);

-- 6. homework_reports
create policy teachers_read_all on homework_reports
  for select to authenticated using (true);
create policy teachers_write_all on homework_reports
  for all to authenticated using (true) with check (true);

-- 7. daily_summaries
create policy teachers_read_all on daily_summaries
  for select to authenticated using (true);
create policy teachers_write_all on daily_summaries
  for all to authenticated using (true) with check (true);
