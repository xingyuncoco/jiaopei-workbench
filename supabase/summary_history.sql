-- 总结历史记录表
-- 设计要点：
--   1. kind: 'homework' 作业情况 / 'daily' 日常总结 / 'weekly' 周总结
--   2. student_id 都按学生存（homework 也是按学生生成一份）
--   3. teacher_note：日常总结中老师填写的「今天做了什么 / 实际反馈 / 计划」
--   4. payload：调用 AI 时使用的完整数据快照，便于复现
--   5. 用 created_at 排序 + 索引，前端列表查询按月过滤
-- 用法：Supabase 后台 SQL Editor 整段执行，可重复执行

create table if not exists summary_history (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('homework','daily','weekly')),
  student_id  uuid references students(id) on delete cascade,
  period_start date,
  period_end   date,
  teacher_note text,
  content      text not null,
  payload      jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 列表查询（按 kind + 学生 + 时间倒序）
create index if not exists idx_summary_kind_student_time
  on summary_history (kind, student_id, created_at desc);

-- 作业情况按学生 + 报告日期查询
create index if not exists idx_summary_kind_period
  on summary_history (kind, student_id, period_end desc);

-- 范围清理（按 created_at 删除旧记录）
create index if not exists idx_summary_created_at
  on summary_history (created_at);

alter table summary_history enable row level security;

drop policy if exists teachers_read_all    on summary_history;
drop policy if exists teachers_insert_all  on summary_history;
drop policy if exists teachers_delete_all  on summary_history;
drop policy if exists teachers_update_all  on summary_history;

-- 已登录老师可读、插、删、改（清历史用）
create policy teachers_read_all on summary_history
  for select to authenticated using (true);
create policy teachers_insert_all on summary_history
  for insert to authenticated with check (true);
create policy teachers_delete_all on summary_history
  for delete to authenticated using (true);
create policy teachers_update_all on summary_history
  for update to authenticated using (true) with check (true);