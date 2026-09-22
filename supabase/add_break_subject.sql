-- 第一步：先建字段（这条 SQL 必须独立执行成功，看到 "Success. No rows returned" 再执行第二步）
alter table subjects add column if not exists is_break boolean not null default false;
alter table subjects add column if not exists default_lesson_types text[] not null default '{homework}';