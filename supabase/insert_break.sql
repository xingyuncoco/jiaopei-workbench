-- 第二步：插入休息科目
insert into subjects (name, icon, is_break)
select '休息', '⏸️', true
where not exists (
  select 1 from subjects where name = '休息' or is_break = true
);