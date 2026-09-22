-- 第二步：插入休息科目（指定 user_id 以满足 not-null 约束）
-- 逻辑：从 auth.users 取最早创建的账号 id 作为 user_id；库里无休息/break 科目时才插
insert into subjects (user_id, name, icon, is_break)
select au.id, '休息', '⏸️', true
from (select id from auth.users order by created_at asc limit 1) au
where not exists (select 1 from subjects where name = '休息' or is_break = true);