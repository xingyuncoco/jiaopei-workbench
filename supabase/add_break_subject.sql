-- 给 subjects 加休息相关字段（如果不存在），并插入一条"休息"记录
-- 用法：在 Supabase 后台 SQL Editor 整段执行，可重复执行

alter table subjects add column if not exists is_break boolean not null default false;
alter table subjects add column if not exists default_lesson_types text[] not null default '{homework}';

insert into subjects (name, icon, is_break)
select '休息', '⏸️', true
where not exists (
  select 1 from subjects where name = '休息' or is_break = true
);