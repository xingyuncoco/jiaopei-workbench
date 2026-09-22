-- 重建 lesson_type check 约束（含 break），兼容老库
do $$
begin
  alter table homework_plans drop constraint if exists homework_plans_lesson_type_check;
exception when others then null;
end $$;

-- 重建 check，包含休息
alter table homework_plans add constraint homework_plans_lesson_type_check
  check (lesson_type in ('homework','practice','test','hardpoint','class','oneon_tt1','break'));