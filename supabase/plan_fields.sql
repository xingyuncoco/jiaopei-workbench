-- 第一步：给 homework_plans 加字段（必须独立成功，看到 Success 再跑第二步）
alter table homework_plans add column if not exists start_time time;
alter table homework_plans add column if not exists end_time time;
alter table homework_plans add column if not exists duration_minutes int;
alter table homework_plans add column if not exists lesson_type text not null default 'homework';
alter table homework_plans add column if not exists core_strategy text;
alter table homework_plans add column if not exists today_plan text;
alter table homework_plans add column if not exists note text;

update homework_plans
set duration_minutes =
  case
    when start_time is not null and end_time is not null
      then extract(epoch from (end_time - start_time)) / 60
    else null
  end
where duration_minutes is null;