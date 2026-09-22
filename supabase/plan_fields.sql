-- 作业规划与科目扩展字段
-- 用法：在 Supabase 后台 SQL Editor 整段执行，可重复执行

-- 1. subjects 表：休息科目标记 + 默认支持的课型
alter table subjects add column if not exists is_break boolean not null default false;
alter table subjects add column if not exists default_lesson_types text[] not null default '{homework}';

-- 2. homework_plans 表：规划相关字段
-- 已存在 start_time/end_time 的先忽略（按实际情况）
alter table homework_plans add column if not exists start_time time;
alter table homework_plans add column if not exists end_time time;
alter table homework_plans add column if not exists duration_minutes int;
alter table homework_plans add column if not exists lesson_type text not null default 'homework'
  check (lesson_type in ('homework','practice','test','hardpoint','class','oneon_tt1','break'));
alter table homework_plans add column if not exists core_strategy text;
alter table homework_plans add column if not exists today_plan text;
alter table homework_plans add column if not exists note text;

-- 3. 计算并写满 duration_minutes（兼容已存在数据）
update homework_plans
set duration_minutes =
  case
    when start_time is not null and end_time is not null
      then extract(epoch from (end_time - start_time)) / 60
    else null
  end
where duration_minutes is null;