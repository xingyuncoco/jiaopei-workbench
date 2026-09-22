-- 在 subjects 表里直接添加一条 "休息" 记录
-- 用法：在 Supabase 后台 SQL Editor 整段执行，可重复执行（同名则不重复插入）

insert into subjects (name, icon, is_break)
select '休息', '⏸️', true
where not exists (
  select 1 from subjects where name = '休息' or is_break = true
);